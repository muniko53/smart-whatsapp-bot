"""Escalation: DB writes + message copy. Caller sends via whatsapp client.

Extracted from main.py:166-182 escalation branch.
"""
from core.db import execute as db_execute


def customer_handoff_message(business: dict) -> str:
    phone = business.get("phone") or "see our contact info"
    return (
        "I understand you need personal assistance. 🙏\n"
        "I'm connecting you with our team now.\n"
        f"You can also call us directly: {phone}"
    )


def owner_alert_text(business: dict, customer_number: str, reason: str = "") -> str:
    return (
        f"⚠️ *Escalation Alert — {business['name']}*\n\n"
        f"Customer *{customer_number}* needs human assistance.\n"
        f"Reason: {reason or 'Customer requested agent'}\n\n"
        "Please follow up directly."
    )


def create(business_id: int, conv_id: int, customer_number: str, reason: str = "") -> None:
    db_execute(
        "INSERT INTO escalations (business_id, conversation_id, customer_number, reason) "
        "VALUES (%s,%s,%s,%s)", (business_id, conv_id, customer_number, reason[:200])
    )
    db_execute("UPDATE conversations SET status=%s WHERE id=%s", ("escalated", conv_id))


def resolve(escalation_id: int) -> None:
    db_execute("UPDATE escalations SET resolved=1 WHERE id=%s", (escalation_id,))


def alert_owner(business: dict, customer_number: str, reason: str = "") -> None:
    """Send escalation alert to the owner number. No-op without credentials."""
    if not business.get("owner_number") or not business.get("whatsapp_token"):
        print("[ESCALATION] no owner number/token — skipping alert", flush=True)
        return
    from services.whatsapp.client import WhatsappClient

    WhatsappClient(business["whatsapp_token"],
                   business.get("phone_number_id", "")).send_text(
        business["owner_number"],
        owner_alert_text(business, customer_number, reason))
    print(f"[ESCALATION] alert sent to {business['owner_number']}", flush=True)
