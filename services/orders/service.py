"""Order persistence, totals, M-Pesa copy. From ai_engine.py:210-273,387-473.

Returns data — caller (state_machine/webhook) sends via whatsapp client
and notifies owner. No Flask imports.
"""
import json
import re

from core.db import fetch_one, execute as db_execute, session


def confirm_summary(collected: dict, cart_lines: str) -> str:
    lines = ["📋 *Order Summary*\n",
             f"👤 Name: *{collected.get('name', '')}*",
             f"🛒 Items:\n{cart_lines}"]
    if collected.get("delivery_type"):
        lines.append(f"🚗 Type: *{collected['delivery_type']}*")
    if collected.get("size"):
        lines.append(f"📏 Size: *{collected['size']}*")
    if collected.get("color"):
        lines.append(f"🎨 Color: *{collected['color']}*")
    if collected.get("booking_date"):
        lines.append(f"📅 Booking: *{collected['booking_date']}*")
    lines.append(f"💰 Total: *{collected.get('total', 'To be confirmed')}*")
    lines.append("\nReply *Yes* to confirm or *No* to change.")
    return "\n".join(lines)


def mpesa_instructions(business: dict, order_id, total: str) -> str | None:
    paybill = (business.get("paybill") or "").strip()
    till_number = (business.get("till_number") or "").strip()
    send_money = (business.get("send_money") or "").strip()
    pochi_number = (business.get("pochi_number") or "").strip()
    if not any([paybill, till_number, send_money, pochi_number]):
        return None
    sections = []
    if paybill:
        account = (business.get("paybill_account") or "").strip() or f"ORDER-{order_id}"
        sections.append(
            "🏦 *Option 1 — Paybill:*\n"
            f"   Go to M-Pesa → *Lipa na M-Pesa* → *Pay Bill*\n"
            f"   Business No: *{paybill}*\n"
            f"   Account No: *{account}*\n"
            f"   Amount: *{total}*"
        )
    if till_number:
        sections.append(
            "🏪 *Option 2 — Buy Goods (Till):*\n"
            f"   Go to M-Pesa → *Lipa na M-Pesa* → *Buy Goods*\n"
            f"   Till Number: *{till_number}*\n"
            f"   Amount: *{total}*"
        )
    if send_money:
        sections.append(
            "📲 *Option 3 — Send Money:*\n"
            f"   Go to M-Pesa → *Send Money*\n"
            f"   Phone: *{send_money}*\n"
            f"   Amount: *{total}*"
        )
    if pochi_number:
        sections.append(
            "💼 *Option 4 — Pochi la Biashara:*\n"
            f"   Go to M-Pesa → *Pochi la Biashara*\n"
            f"   Phone: *{pochi_number}*\n"
            f"   Amount: *{total}*"
        )
    return ("💳 *How to Pay via M-Pesa:*\n" + "\n\n".join(sections) +
            f"\n🆔 Order ID: *#{order_id}*\n\n"
            "Once done, reply *PAID* and we'll confirm your order. 🙏")


def parse_unit_price(price_str: str) -> int | None:
    nums = re.findall(r"[\d]+", (price_str or "").replace(",", ""))
    return int(nums[0]) if nums else None


def build_cart(pending: list[dict]) -> tuple[list[dict], str, str]:
    """From pending [{name,price,qty}] build cart lines + total. Returns (cart, cart_lines, total)."""
    cart, parts = [], []
    total_known = True
    for p in pending:
        qty = p.get("qty", 1)
        unit = parse_unit_price(p.get("price", ""))
        line_total = unit * qty if unit else None
        cart.append({"name": p["name"], "price": p["price"], "qty": qty,
                     "line_total": f"Ksh {line_total}" if line_total else p["price"]})
        if line_total:
            parts.append(line_total)
        else:
            total_known = False
    total = f"Ksh {sum(parts):,}" if (total_known and parts) else "To be confirmed"
    lines = "\n".join(f"  • {c['qty']} x {c['name']} — {c['line_total']}" for c in cart)
    return cart, lines, total


def lookup_latest(business_id: int, customer_number: str) -> dict | None:
    return fetch_one(
        "SELECT * FROM orders WHERE business_id=%s AND customer_number=%s "
        "ORDER BY created_at DESC LIMIT 1", (business_id, customer_number)
    )


def place_order(business: dict, conversation_id: int, collected: dict,
                payment_method: str = "mpesa") -> dict:
    """Insert confirmed order + decrement stock. Returns result dict:

    {order_id, message, next_state, collected, low_stock:[(name,qty)], status}
    Caller sends message + owner notify + writes order_states.
    """
    from services.products.service import decrement_stock, build_upsell

    cart = collected.get("cart", [])
    items_str = ", ".join(c["name"] for c in cart)
    total_str = collected.get("total", "")
    extras = json.dumps({k: collected[k] for k in
                         ("size", "color", "delivery_type", "booking_date")
                         if collected.get(k)})
    with session() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO orders (business_id, conversation_id, customer_number,
                    customer_name, items, total, status, delivery_type, booking_date,
                    extras, payment_method)
                   SELECT b.id, %s, c.customer_number, %s, %s, %s, 'confirmed', %s, %s, %s, %s
                   FROM conversations c JOIN businesses b ON b.id=c.business_id
                   WHERE c.id=%s RETURNING id""",
                (conversation_id, collected.get("name", ""), items_str, total_str,
                 collected.get("delivery_type", ""), collected.get("booking_date", ""),
                 extras, payment_method, conversation_id),
            )
            order_id = cur.fetchone()["id"]
    low_stock = decrement_stock(business["id"], cart)
    upsell = build_upsell(business["id"], {c["name"] for c in cart})

    if payment_method == "cash_on_delivery":
        msg = (
            f"✅ *Order confirmed!* Thank you, {collected.get('name', '')}! 🎉\n\n"
            f"🆔 Order ID: *#{order_id}*\n🛒 Items: {items_str}\n💰 Total: *{total_str}*\n\n"
            f"💵 *Payment:* Cash on Delivery\n"
            f"Please have *{total_str}* ready when your order arrives. 🙏\n\n"
            f"Reply *Menu* anytime to order again."
        )
        if upsell:
            msg += f"\n\n{upsell}"
        return {"order_id": order_id, "message": msg, "next_state": None,
                "collected": collected, "low_stock": low_stock, "status": "confirmed"}

    pay_msg = mpesa_instructions(business, order_id, total_str)
    if pay_msg:
        collected = {**collected, "order_id": order_id, "total": total_str}
        msg = (f"✅ *Order placed!* Thank you, {collected.get('name', '')}! 🎉\n\n"
               f"🆔 Order ID: *#{order_id}*\n🛒 Items: {items_str}\n💰 Total: *{total_str}*\n\n"
               f"{pay_msg}")
        if upsell:
            msg += f"\n\n{upsell}"
        return {"order_id": order_id, "message": msg, "next_state": "awaiting_payment",
                "collected": collected, "low_stock": low_stock, "status": "confirmed"}

    msg = (f"✅ *Order confirmed!* Thank you, {collected.get('name', '')}!\n\n"
           "We'll prepare your order and reach out shortly. 🙏\n"
           "Reply *Menu* anytime to order again.")
    if upsell:
        msg += f"\n\n{upsell}"
    return {"order_id": order_id, "message": msg, "next_state": None,
            "collected": collected, "low_stock": low_stock, "status": "confirmed"}


def mark_paid(order_id: int, mpesa_code: str) -> dict | None:
    db_execute("UPDATE orders SET status='paid', mpesa_code=%s, "
               "updated_at=CURRENT_TIMESTAMP WHERE id=%s", (mpesa_code, order_id))
    return fetch_one("SELECT * FROM orders WHERE id=%s", (order_id,))


def cancel_order(order_id: int) -> None:
    db_execute("UPDATE orders SET status='cancelled' WHERE id=%s", (order_id,))


# ── Owner + customer notifications (transport via whatsapp client) ──
# Copy preserved from notifications.py; Phase 7 moves the send path here.

def _owner_client(business: dict):
    from services.whatsapp.client import WhatsappClient

    return WhatsappClient(business.get("whatsapp_token", ""),
                          business.get("phone_number_id", ""))


def notify_new_order(business: dict, order: dict) -> None:
    if not business.get("owner_number") or not business.get("whatsapp_token"):
        return
    _owner_client(business).send_text(
        business["owner_number"],
        f"🛍️ *New Order — {business['name']}*\n\n"
        f"👤 Customer: {order.get('customer_name', 'Unknown')}\n"
        f"📱 Phone: {order.get('customer_number', '')}\n"
        f"🛒 Items: {order.get('items', '')}\n"
        f"📅 Time: {order.get('created_at', 'Now')}\n\n"
        "Please prepare and confirm the order.")


def notify_payment_received(business: dict, order: dict) -> None:
    if not business.get("owner_number") or not business.get("whatsapp_token"):
        return
    _owner_client(business).send_text(
        business["owner_number"],
        f"💰 *Payment Received — {business['name']}*\n\n"
        f"👤 Customer: {order.get('customer_name', 'Unknown')}\n"
        f"📱 Phone: {order.get('customer_number', '')}\n"
        f"🛒 Items: {order.get('items', '')}\n"
        f"💵 Amount: {order.get('total', 'N/A')}\n"
        f"🆔 Order ID: #{order.get('id', '')}\n\n"
        "✅ Payment confirmed by customer.")


def notify_low_stock(business: dict, product_name: str, stock_qty: int) -> None:
    if not business.get("owner_number") or not business.get("whatsapp_token"):
        return
    _owner_client(business).send_text(
        business["owner_number"],
        f"⚠️ *Low Stock Alert — {business['name']}*\n\n"
        f"🛒 Product: *{product_name}*\n"
        f"📦 Remaining: *{stock_qty} unit{'s' if stock_qty != 1 else ''}*\n\n"
        "Please restock soon to avoid missing orders.")


_STATUS_COPY = {
    "confirmed": ("✅", "has been confirmed! We are preparing it now."),
    "preparing": ("👨‍🍳", "is being prepared right now."),
    "ready": ("🎉", "is ready for pickup / delivery!"),
    "delivered": ("🚀", "is out for delivery. It's on its way!"),
    "cancelled": ("❌", "has been cancelled. Contact us for more info."),
}


def send_status_update(business: dict, order: dict, status: str) -> None:
    """Customer-facing order-status message with Check-Status button."""
    from services.whatsapp.client import send_interactive

    token, phone_id = business.get("whatsapp_token", ""), business.get("phone_number_id", "")
    to = order.get("customer_number", "")
    if not token or not phone_id or not to:
        return
    name = order.get("customer_name") or "there"
    emoji, status_text = _STATUS_COPY.get(status, ("📦", f"status is now *{status}*."))
    eta = (order.get("eta") or "").strip()
    body = (
        f"{emoji} Hi *{name}*,\n\n"
        f"Your order *{order.get('items', '')}* {status_text}\n\n"
        f"🆔 Order No. *#{order.get('id', '')}*\n"
        f"{('🕐 ETA: *' + eta + '*\n') if eta else ''}\n"
        "Reply *STATUS* anytime to check your order."
    )
    send_interactive(to, body, [{"id": "check_status", "title": "📦 Check Status"}],
                     token, phone_id, image_url=order.get("photo_url", "") or "")


def send_followup(business: dict, order: dict) -> None:
    from services.whatsapp.client import send_text

    token, phone_id = business.get("whatsapp_token", ""), business.get("phone_number_id", "")
    to = order.get("customer_number", "")
    if not token or not phone_id or not to:
        return
    name = order.get("customer_name") or "there"
    send_text(to, (
        f"👋 Hi *{name}*!\n\n"
        f"We hope you enjoyed *{order.get('items', 'your order')}*. 😊\n\n"
        "How was your experience? We'd love your feedback!\n\n"
        "⭐ Reply:\n• *5* — Excellent\n• *4* — Good\n• *3* — Okay\n"
        "• *1* or *2* — Could be better\n\n"
        "Or reply *1* to browse our menu and order again! 🛍️"
    ), token, phone_id)
