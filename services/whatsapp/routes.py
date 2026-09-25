"""Webhook Flask blueprint. Thin HTTP layer over services.

GET /webhook — Meta verification.
POST /webhook — parse -> tenant lookup -> subscription gate -> transcribe ->
  customer/conv -> agent.generate_reply -> sends -> persist -> owner notifies.

Replaces main.py:71-201 / app.py:70-239 bodies (deleted in Phase 6).
"""
import json

from flask import Blueprint, jsonify, request

webhook_bp = Blueprint("webhook", __name__)


@webhook_bp.route("/webhook", methods=["GET"])
def verify():
    from services.whatsapp.webhook import check_verify_token

    if check_verify_token(request.args.get("hub.mode"), request.args.get("hub.verify_token")):
        print("[WEBHOOK] verified", flush=True)
        return request.args.get("hub.challenge"), 200
    return "Forbidden", 403


@webhook_bp.route("/webhook", methods=["POST"])
def webhook():
    from services.whatsapp.webhook import (
        BLOCKED_MESSAGE,
        UNSUPPORTED_MESSAGE,
        VOICE_FAIL_MESSAGE,
        get_business_for_phone,
        is_duplicate,
        is_subscription_blocked,
        parse_incoming,
    )

    data = request.get_json(silent=True) or {}
    try:
        event = parse_incoming(data)
    except Exception:
        event = None
    if event is None:
        return jsonify({"status": "ok"})  # status callbacks / unparseable
    if is_duplicate(event.get("message_id")):
        print("[WEBHOOK] duplicate delivery, skipping", flush=True)
        return jsonify({"status": "ok"})

    business = get_business_for_phone(event["phone_id"])
    if not business:
        print(f"[WEBHOOK] no active business for phone_id {event['phone_id']}", flush=True)
        return jsonify({"status": "ok"})
    if is_subscription_blocked(business):
        from services.whatsapp.client import WhatsappClient

        WhatsappClient(business.get("whatsapp_token", ""),
                       business.get("phone_number_id", "")).send_text(
            event["from_number"], BLOCKED_MESSAGE)
        return jsonify({"status": "ok"})

    print(f"[WEBHOOK] {business['name']} <- {event['from_number']} "
          f"({event['msg_type']})", flush=True)

    # normalize to text
    if event["msg_type"] == "audio":
        from services.whatsapp.client import transcribe_voice_note

        text = transcribe_voice_note(event["media_id"],
                                     business.get("whatsapp_token", "")) if event["media_id"] else None
        if not text:
            _reply(business, event["from_number"], VOICE_FAIL_MESSAGE)
            return jsonify({"status": "ok"})
    elif event["msg_type"] != "text":
        _reply(business, event["from_number"], UNSUPPORTED_MESSAGE)
        return jsonify({"status": "ok"})
    else:
        text = event["text"]

    from services.ai.agent import generate_reply
    from services.customers.service import (
        get_or_create_conversation,
        get_or_create_customer,
        recent_history,
        save_message,
    )

    customer = get_or_create_customer(business["id"], event["from_number"])
    conv = get_or_create_conversation(business["id"], event["from_number"], customer["id"])
    save_message(conv["id"], "user", text)
    history = recent_history(conv["id"])

    try:
        reply, intent, images = generate_reply(business, conv["id"], text, history)
    except Exception:
        import traceback
        print(f"[WEBHOOK] agent error: {traceback.format_exc()}", flush=True)
        return jsonify({"status": "ok"})

    from services.whatsapp.client import WhatsappClient

    client = WhatsappClient(business.get("whatsapp_token", ""),
                            business.get("phone_number_id", ""))
    for img_url, caption in images or []:
        client.send_image(event["from_number"], img_url, caption or "")

    if intent == "ESCALATE" and reply is None:
        from services.escalation.service import create, customer_handoff_message

        msg = customer_handoff_message(business)
        client.send_text(event["from_number"], msg)
        create(business["id"], conv["id"], event["from_number"], text[:200])
        save_message(conv["id"], "assistant", msg, "ESCALATE")
        _notify_escalation(business, event["from_number"], text[:100])
        return jsonify({"status": "ok"})

    if reply:
        client.send_text(event["from_number"], reply)
        save_message(conv["id"], "assistant", reply, intent)
        _notify_new_order_if_confirmed(business, conv["id"])

    return jsonify({"status": "ok"})


def _reply(business: dict, to: str, message: str) -> None:
    if not business.get("whatsapp_token") or not business.get("phone_number_id"):
        print(f"[WEBHOOK] no credentials, would reply: {message[:120]}", flush=True)
        return
    from services.whatsapp.client import send_text

    send_text(to, message, business["whatsapp_token"], business["phone_number_id"])


def _notify_escalation(business: dict, customer_number: str, reason: str) -> None:
    try:
        from services.escalation.service import alert_owner
        alert_owner(business, customer_number, reason)
    except Exception as e:
        print(f"[WEBHOOK] escalation notify failed: {e}", flush=True)


def _notify_new_order_if_confirmed(business: dict, conv_id: int) -> None:
    try:
        from core.db import fetch_one
        from services.orders.service import (
            notify_low_stock,
            notify_new_order,
            notify_payment_received,
        )

        order = fetch_one("SELECT * FROM orders WHERE conversation_id=%s "
                          "ORDER BY id DESC LIMIT 1", (conv_id,))
        if order and order.get("status") == "confirmed":
            notify_new_order(business, dict(order))
        from services.orders import state_machine as sm

        paid = getattr(sm.transition, "_last_paid_order", None)
        if paid:
            sm.transition._last_paid_order = None
            notify_payment_received(business, paid)
        low = getattr(sm.transition, "_last_low_stock", None)
        if low:
            sm.transition._last_low_stock = None
            for name, qty in low:
                notify_low_stock(business, name, qty)
    except Exception as e:
        print(f"[WEBHOOK] owner notify failed: {e}", flush=True)
