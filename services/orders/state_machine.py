"""Explicit order state machine. Ported from ai_engine.handle_order_flow (505-1030).

transition(conv_id, message, business, customer_name='') -> (reply|None, images).
None reply signals ESCALATE (caller creates escalation + notifies owner).

States: welcome_menu, select_category, select_items, ask_quantity,
ask_delivery, ask_size, ask_color, ask_booking, ask_name, confirm,
ask_payment_method, awaiting_payment, idle.
"""
import json
import re
from datetime import datetime

from core.db import fetch_one, execute as db_execute, session
from services.ai.prompts import show_welcome_menu, get_business_type
from services.orders.service import (
    build_cart, cancel_order, confirm_summary, lookup_latest,
    mark_paid, mpesa_instructions, place_order,
)
from services.products.service import (
    category_menu, full_catalog, products_in_category,
)

STATUS_EMOJIS = {
    "pending": "⏳", "confirmed": "✅", "preparing": "👨‍🍳",
    "ready": "🎉", "delivered": "✅", "out for delivery": "🚚",
    "cancelled": "❌", "paid": "💰",
}


def get_state(conv_id: int):
    row = fetch_one("SELECT * FROM order_states WHERE conversation_id=%s", (conv_id,))
    if not row:
        return None, {}
    try:
        collected = json.loads(row.get("collected") or "{}")
    except (ValueError, TypeError):
        collected = {}
    return row.get("state", "idle"), collected


def set_state(conv_id: int, state: str, collected: dict) -> None:
    db_execute("UPDATE order_states SET state=%s, collected=%s WHERE conversation_id=%s",
               (state, json.dumps(collected), conv_id))


def clear_state(conv_id: int) -> None:
    db_execute("DELETE FROM order_states WHERE conversation_id=%s", (conv_id,))


def _ensure_started(conv_id: int, customer_name: str = "") -> None:
    with session() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM order_states WHERE conversation_id=%s", (conv_id,))
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO order_states (conversation_id, state, collected) "
                    "VALUES (%s,%s,%s)",
                    (conv_id, "welcome_menu", json.dumps({"name": customer_name})),
                )


def _payment_receipt(name: str, order_id, items_str: str, total_str: str,
                     mpesa_code: str) -> str:
    return (
        "🧾 *Payment Receipt*\n\n✅ Payment received!\n"
        f"👤 Name: *{name}*\n🆔 Order ID: *#{order_id}*\n🛒 Items: {items_str}\n"
        f"💰 Amount: *{total_str}*\n📲 M-Pesa Code: *{mpesa_code}*\n"
        f"📅 Date: {datetime.now().strftime('%d %b %Y, %H:%M')}\n\n"
        f"Thank you, {name}! We'll prepare your order shortly. 🙏\n"
        "Reply *Menu* to order again."
    )


def _track_latest(business: dict, conv_id: int):
    conv = fetch_one("SELECT customer_number FROM conversations WHERE id=%s", (conv_id,))
    phone = conv["customer_number"] if conv else ""
    order = lookup_latest(business["id"], phone)
    clear_state(conv_id)
    if not order:
        return "You don't have any orders with us yet. Reply *1* to browse our products! 🛍️", []
    eta = (order.get("eta") or "").strip()
    return (
        f"📦 *Your Latest Order*\n\n🆔 Order ID: *#{order['id']}*\n"
        f"🛒 Items: {order['items']}\n💰 Total: {order['total']}\n"
        f"{STATUS_EMOJIS.get(order['status'], '📦')} Status: *{order['status'].upper()}*\n"
        f"{('🕐 ETA: *' + eta + '*\n') if eta else ''}\n"
        "Reply *Hi* to go back to the main menu."
    ), []


def _apply_place_result(conv_id: int, result: dict):
    """Persist place_order outcome. Returns (message, images)."""
    from services.orders import state_machine as _sm  # stash for owner notifies
    if result.get("low_stock"):
        _sm.transition._last_low_stock = list(result["low_stock"])
    if result["next_state"]:
        set_state(conv_id, result["next_state"], result["collected"])
    else:
        clear_state(conv_id)
    return result["message"], []


def transition(conv_id: int, message: str, business: dict, customer_name: str = ""):
    state, collected = get_state(conv_id)

    if not state:
        _ensure_started(conv_id, customer_name)
        return show_welcome_menu(business, customer_name or collected.get("name", "")), []

    msg = (message or "").strip()

    if state == "welcome_menu":
        choice = next((c for c in re.findall(r"\d+", msg)), None)
        if choice == "1":
            cat_msg, cat_list = category_menu(business)
            if not cat_list:
                return "Sorry, no products are available right now. Please check back soon! 😊", []
            if cat_msg is None and len(cat_list) == 1:
                prod_msg, numbered, images = products_in_category(business, cat_list[0])
                set_state(conv_id, "select_items", {
                    "catalog": [(n, p["name"], p["price"]) for n, p in numbered],
                    "category": cat_list[0],
                    "name": collected.get("name", customer_name)})
                return prod_msg, images
            set_state(conv_id, "select_category",
                      {"categories": cat_list, "name": collected.get("name", customer_name)})
            return cat_msg, []
        if choice == "2":
            return _track_latest(business, conv_id)
        if choice == "3":
            clear_state(conv_id)
            return None, []
        return show_welcome_menu(business, collected.get("name", customer_name)), []

    if state == "select_category":
        low = msg.lower()
        if msg == "0":
            clear_state(conv_id)
            return None, []
        cat_list = collected.get("categories", [])
        if low in ("back", "menu", "hi", "hello"):
            clear_state(conv_id)
            return show_welcome_menu(business, collected.get("name", customer_name)), []
        chosen = None
        nums = re.findall(r"\d+", msg)
        if nums:
            idx = int(nums[0]) - 1
            if 0 <= idx < len(cat_list):
                chosen = cat_list[idx]
        if not chosen:
            for cat in cat_list:
                if cat.lower() in low or low in cat.lower():
                    chosen = cat
                    break
        if not chosen:
            cat_msg, _ = category_menu(business)
            return f"Please choose a number from the list 👇\n\n{cat_msg}", []
        prod_msg, numbered, images = products_in_category(business, chosen)
        if not prod_msg:
            cat_msg, _ = category_menu(business)
            return f"No products in that category yet.\n\n{cat_msg}", []
        set_state(conv_id, "select_items", {
            "catalog": [(n, p["name"], p["price"]) for n, p in numbered],
            "category": chosen, "categories": cat_list,
            "name": collected.get("name", customer_name)})
        return prod_msg, images

    if state == "select_items":
        if msg == "0":
            clear_state(conv_id)
            return None, []
        if msg.lower() in ("back", "categories", "menu"):
            cat_list = collected.get("categories", [])
            if cat_list:
                cat_msg, _ = category_menu(business)
                set_state(conv_id, "select_category",
                          {"categories": cat_list, "name": collected.get("name", "")})
                return cat_msg, []
        catalog = collected.get("catalog", [])
        picked = [int(x) for x in re.findall(r"\d+", msg) if 1 <= int(x) <= len(catalog)]
        if not picked:
            matched = [item for item in catalog if str(item[1]).lower() in msg.lower()]
            if matched:
                picked = [item[0] for item in matched]
        if not picked:
            cat_name = collected.get("category", "")
            if cat_name:
                prod_msg, _, _ = products_in_category(business, cat_name)
                return f"Please reply with the *number* of what you want 😊\n\n{prod_msg}", []
            return "Please reply with the *number* of what you want, or type *back* to see categories. 😊", []
        pending = []
        for num in picked:
            item = next((c for c in catalog if c[0] == num), None)
            if item:
                pending.append({"name": item[1], "price": item[2], "qty": 1})
        collected["pending_cart"] = pending
        set_state(conv_id, "ask_quantity", collected)
        if len(pending) == 1:
            return (f"✅ *{pending[0]['name']}* — {pending[0]['price']}\n\n"
                    "How many would you like? *(reply with a number, e.g. 1, 2, 3)*"), []
        lines = "\n".join(f"  {i + 1}. {p['name']} — {p['price']}"
                          for i, p in enumerate(pending))
        return (f"✅ You selected:\n{lines}\n\nHow many of each? Reply with quantities "
                "separated by commas.\nExample: *2, 1* means 2 of the first item and 1 of the second."), []

    if state == "ask_quantity":
        pending = collected.get("pending_cart", [])
        qty_nums = re.findall(r"\d+", msg)
        if qty_nums:
            for i, p in enumerate(pending):
                if i < len(qty_nums):
                    pending[i]["qty"] = max(1, int(qty_nums[i]))
        cart, cart_lines, total_str = build_cart(pending)
        collected.update({"cart": cart, "total": total_str})
        collected.pop("pending_cart", None)
        btype = get_business_type(business)
        if btype == "restaurant" and not collected.get("delivery_type"):
            nxt = "ask_delivery"
        elif btype == "clothing" and not collected.get("size"):
            nxt = "ask_size"
        elif btype == "service" and not collected.get("booking_date"):
            nxt = "ask_booking"
        elif not collected.get("name"):
            nxt = "ask_name"
        else:
            nxt = "confirm"
        set_state(conv_id, nxt, collected)
        summary = f"🛒 *Your Cart:*\n{cart_lines}\n💰 Total: *{total_str}*"
        if nxt == "ask_delivery":
            return (f"{summary}\n\nHow would you like to receive your order?\n\n"
                    "1️⃣ Dine In\n2️⃣ Takeaway\n3️⃣ Delivery\n\nReply *1*, *2*, or *3*."), []
        if nxt == "ask_size":
            return f"{summary}\n\nWhat size do you need?\n*(XS / S / M / L / XL / XXL)*", []
        if nxt == "ask_booking":
            return (f"{summary}\n\n📅 What date and time works for you?\n"
                    "Example: *Tomorrow 2PM* or *Mon 25 Apr, 10AM*"), []
        return f"{summary}\n\nMay I get your name to place the order? 😊", []

    if state == "ask_delivery":
        low = msg.lower()
        if "1" in msg or "dine" in low:
            collected["delivery_type"] = "Dine In"
        elif "2" in msg or "take" in low:
            collected["delivery_type"] = "Takeaway"
        elif "3" in msg or "deliver" in low:
            collected["delivery_type"] = "Delivery"
        else:
            collected["delivery_type"] = msg
        nxt = "ask_name" if not collected.get("name") else "confirm"
        set_state(conv_id, nxt, collected)
        if nxt == "ask_name":
            return f"Got it — *{collected['delivery_type']}* 👍\nMay I get your name?", []
        cart_lines = "\n".join(f"  • {c['name']} — {c['price']}" for c in collected.get("cart", []))
        return confirm_summary(collected, cart_lines), []

    if state == "ask_size":
        collected["size"] = msg.upper()
        if not collected.get("color"):
            set_state(conv_id, "ask_color", collected)
            return f"Size *{collected['size']}* noted! 👍\nWhat color would you prefer?", []
        nxt = "ask_name" if not collected.get("name") else "confirm"
        set_state(conv_id, nxt, collected)
        if nxt == "ask_name":
            return "Got it! May I get your name to complete the order?", []
        cart_lines = "\n".join(f"  • {c['name']} — {c['price']}" for c in collected.get("cart", []))
        return confirm_summary(collected, cart_lines), []

    if state == "ask_color":
        collected["color"] = msg
        nxt = "ask_name" if not collected.get("name") else "confirm"
        set_state(conv_id, nxt, collected)
        if nxt == "ask_name":
            return f"Color *{collected['color']}* noted! 🎨\nMay I get your name?", []
        cart_lines = "\n".join(f"  • {c['name']} — {c['price']}" for c in collected.get("cart", []))
        return confirm_summary(collected, cart_lines), []

    if state == "ask_booking":
        collected["booking_date"] = msg
        nxt = "ask_name" if not collected.get("name") else "confirm"
        set_state(conv_id, nxt, collected)
        if nxt == "ask_name":
            return f"📅 Booked for *{collected['booking_date']}*!\nMay I get your name?", []
        cart_lines = "\n".join(f"  • {c['name']} — {c['price']}" for c in collected.get("cart", []))
        return confirm_summary(collected, cart_lines), []

    if state in ("ask_name", "ask_name_legacy"):
        collected["name"] = msg
        cart_lines = "\n".join(f"  • {c['name']} — {c['price']}" for c in collected.get("cart", []))
        set_state(conv_id, "confirm", collected)
        return confirm_summary(collected, cart_lines), []

    if state == "confirm":
        if any(w in msg.lower() for w in
               ["yes", "yeah", "yep", "confirm", "ok", "sure", "ndio", "sawa"]):
            has_mpesa = mpesa_instructions(business, 0, "") is not None
            has_pod = bool(business.get("pay_on_delivery", 0))
            if has_mpesa and has_pod:
                collected["confirmed"] = True
                set_state(conv_id, "ask_payment_method", collected)
                cart = collected.get("cart", [])
                cart_lines = "\n".join(
                    f"  • {c['qty']} x {c['name']} — {c['line_total']}" for c in cart)
                return (
                    "✅ *Order confirmed!*\n\n🛒 " + cart_lines + "\n"
                    f"💰 Total: *{collected.get('total', '')}*\n\n"
                    "How would you like to pay?\n\n1️⃣  Pay now via *M-Pesa*\n"
                    "2️⃣  Pay on *Delivery* (cash)\n\nReply *1* or *2*."
                ), []
            method = "cash_on_delivery" if (has_pod and not has_mpesa) else "mpesa"
            return _apply_place_result(conv_id, place_order(business, conv_id, collected, method))
        catalog_msg, _, _ = full_catalog(business)
        set_state(conv_id, "select_items",
                  {"catalog": collected.get("catalog", []),
                   "name": collected.get("name", "")})
        return f"No problem! Here's the menu again:\n\n{catalog_msg}", []

    if state == "ask_payment_method":
        if "2" in msg or any(w in msg.lower() for w in
                             ["delivery", "cash", "pod", "deliver", "baadaye"]):
            return _apply_place_result(
                conv_id, place_order(business, conv_id, collected, "cash_on_delivery"))
        return _apply_place_result(
            conv_id, place_order(business, conv_id, collected, "mpesa"))

    if state == "awaiting_payment":
        low = msg.lower().strip()
        paid_words = ["paid", "nimelipia", "nimelipa", "done", "sent", "nimesend",
                      "complete", "payed", "lipa", "transferred"]
        code = (re.search(r"\b([A-Z0-9]{10})\b", msg.upper()).group(1)
                if re.search(r"\b([A-Z0-9]{10})\b", msg.upper()) else "")
        if any(w in low for w in paid_words) or code:
            if not code:
                return ("✅ Great! Please share your *M-Pesa transaction code* so we can verify "
                        "your payment.\n\nYou can find it in the M-Pesa confirmation SMS.\n"
                        "Example: *QGH123ABC4*"), []
            order_id = collected.get("order_id")
            order = mark_paid(order_id, code)
            clear_state(conv_id)
            cart = collected.get("cart", [])
            items_str = ", ".join(c["name"] for c in cart)
            # caller notifies owner via notify_payment_received (needs order row)
            transition._last_paid_order = dict(order) if order else None
            return _payment_receipt(collected.get("name", ""), order_id,
                                    items_str, collected.get("total", ""), code), []
        if any(w in low for w in ["cancel", "stop", "sitaki"]):
            cancel_order(collected.get("order_id"))
            clear_state(conv_id)
            return "Order cancelled. Reply *Menu* anytime to start a new order. 😊", []
        pay_msg_text = mpesa_instructions(business, collected.get("order_id"),
                                          collected.get("total", ""))
        return f"We're still waiting for your payment 😊\n\n{pay_msg_text}", []

    return None, []
