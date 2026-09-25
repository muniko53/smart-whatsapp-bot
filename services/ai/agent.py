"""Intent router: INFORMATION (RAG/DB) | ORDER (state machine) | ESCALATION (human).

Mirrors ai_engine.detect_intent + generate_reply behaviour so it is a
drop-in replacement: generate_reply(business, conv_id, text, history)
-> (reply|None, intent_label, images).

Known legacy quirks preserved (fix in Phase 4 with real classifier):
- substring matching shadows intents, e.g. 'track my order' contains 'order'
  so detect returns ORDER not TRACK; 'chips' contains 'hi' so MENU wins.
- short-keyword order in _INTENT_KEYWORDS decides ties.

Phase 3: ORDER branch delegates to legacy ai_engine.handle_order_flow
(Phase 4 will move it to services/orders/state_machine.py).
"""
import re
from difflib import get_close_matches

INFORMATION, ORDER, ESCALATION = "INFORMATION", "ORDER", "ESCALATION"

INTENT_LABELS = ["ORDER", "MENU", "INQUIRY", "COMPLAINT", "GREETING",
                 "ESCALATE", "PRICE_CHECK", "HOURS", "LOCATION", "TRACK", "OTHER"]

_INTENT_KEYWORDS = {
    "MENU": ["hi", "hello", "hey", "hii", "start", "menu", "catalog",
             "catalogue", "shop", "products", "list", "pricelist",
             "what do you sell", "what do you have", "show me",
             "bei gani", "mnauza nini", "habari", "sasa", "mambo", "niaje"],
    "ORDER": ["order", "buy", "want", "need", "nataka", "nipe", "niletee", "place"],
    "TRACK": ["track", "status", "my order", "order status", "where is my order",
              "track order", "check order", "delivery status", "eta", "when will"],
    "PRICE_CHECK": ["price", "cost", "how much", "bei", "pesa", "charge"],
    "HOURS": ["hours", "open", "close", "time", "when", "saa ngapi"],
    "LOCATION": ["where", "location", "address", "directions", "uko wapi"],
    "COMPLAINT": ["complain", "problem", "issue", "wrong", "bad",
                  "unhappy", "refund", "disappointed"],
    "ESCALATE": ["human", "agent", "person", "manager", "staff",
                 "speak to someone", "talk to someone", "real person"],
}

# intent -> route (target architecture)
_ROUTE_MAP = {
    "ORDER": ORDER,
    "MENU": ORDER,
    "GREETING": ORDER,
    "TRACK": INFORMATION,      # DB lookup, no state machine
    "PRICE_CHECK": INFORMATION,
    "HOURS": INFORMATION,
    "LOCATION": INFORMATION,
    "INQUIRY": INFORMATION,
    "OTHER": INFORMATION,
    "COMPLAINT": ESCALATION,   # needs human judgment
    "ESCALATE": ESCALATION,
}


def _fuzzy_match_intent(word: str):
    for intent, keywords in _INTENT_KEYWORDS.items():
        if get_close_matches(word, keywords, n=1, cutoff=0.82):
            return intent
    return None


def _keyword_hit(msg: str, kw: str) -> bool:
    kw = kw.lower()
    if " " in kw:
        return kw in msg  # multi-word phrases: substring
    if len(kw) < 4:
        return re.search(r"\b" + re.escape(kw) + r"\b", msg) is not None
    # single words len>=4: word-boundary, plus common Swahili verb prefixes
    # (e.g. "nataka" contains "taka"? no — boundaries keep it strict)
    return re.search(r"\b" + re.escape(kw) + r"\b", msg) is not None


# Priority order: specific intents first so ORDER/MENU can't shadow them.
# (Legacy dict order let 'order' shadow TRACK and 'hi' shadow everything.)
_PRIORITY = ("ESCALATE", "COMPLAINT", "TRACK", "PRICE_CHECK", "HOURS",
             "LOCATION", "ORDER", "MENU")


def detect_intent(message: str) -> str:
    """Keyword (boundary-aware, priority-ordered) then fuzzy fallback."""
    msg = (message or "").lower().strip()
    for intent in _PRIORITY:
        for kw in _INTENT_KEYWORDS.get(intent, []):
            if _keyword_hit(msg, kw):
                return intent
    for word in re.findall(r"\b\w+\b", msg):
        if len(word) >= 4:
            matched = _fuzzy_match_intent(word)
            if matched:
                return matched
    return "INQUIRY"


def classify(text: str, history: list | None = None) -> tuple[str, str, float]:
    """Return (route, intent_label, confidence). Keyword path = 0.9, fallback = 0.5."""
    intent = detect_intent(text)
    route = _ROUTE_MAP.get(intent, INFORMATION)
    conf = 0.5 if intent in ("INQUIRY", "OTHER") else 0.9
    return route, intent, conf


def _active_order_state(conv_id: int) -> str | None:
    from core.db import fetch_one

    row = fetch_one("SELECT state FROM order_states WHERE conversation_id=%s",
                    (conv_id,))
    if row and row.get("state") not in ("idle",):
        return row["state"]
    return None


def _customer_name(business_id: int, conv_id: int) -> str:
    from core.db import fetch_one

    row = fetch_one(
        "SELECT name FROM customers WHERE business_id=%s AND phone="
        "(SELECT customer_number FROM conversations WHERE id=%s)",
        (business_id, conv_id),
    )
    return row["name"] if row and row.get("name") else ""


def _handle_order(business: dict, conv_id: int, text: str, intent: str):
    """Delegate to the explicit state machine (Phase 4). Returns (reply, intent, images)."""
    from core.db import execute as db_execute
    from services.orders.state_machine import transition

    if text.strip() == "0":
        db_execute("DELETE FROM order_states WHERE conversation_id=%s", (conv_id,))
        return None, "ESCALATE", []
    # state machine lives in services/orders/state_machine.py
    from services.orders.state_machine import transition as handle_order_flow

    customer_name = _customer_name(business["id"], conv_id)
    result = handle_order_flow(conv_id, text, business, customer_name)
    if isinstance(result, tuple):
        reply, images = result
    else:
        reply, images = result, []
    if reply is None:
        return None, "ESCALATE", []
    return reply, intent, images


def _handle_track(business: dict, conv_id: int):
    from core.db import fetch_one

    conv = fetch_one("SELECT customer_number FROM conversations WHERE id=%s",
                     (conv_id,))
    phone = conv["customer_number"] if conv else ""
    order = fetch_one(
        "SELECT * FROM orders WHERE business_id=%s AND customer_number=%s "
        "ORDER BY created_at DESC LIMIT 1", (business["id"], phone)
    )
    if not order:
        return ("You don't have any orders with us yet. "
                "Reply *Hi* to browse our products! 🛍️"), "TRACK", []
    emojis = {"pending": "⏳", "confirmed": "✅", "preparing": "👨‍🍳",
              "ready": "🎉", "delivered": "✅", "paid": "💰", "cancelled": "❌"}
    eta = (order.get("eta") or "").strip()
    reply = (
        f"📦 *Order #{order['id']}*\n\n"
        f"🛒 Items: {order['items']}\n"
        f"💰 Total: {order['total']}\n"
        f"{emojis.get(order['status'], '📦')} Status: *{order['status'].upper()}*\n"
        f"{('🕐 ETA: *' + eta + '*\n') if eta else ''}\n"
        f"Reply *Hi* to go back to the main menu."
    )
    return reply, "TRACK", []


def _handle_information(business: dict, conv_id: int, text: str,
                        history: list, intent: str):
    from services.ai.prompts import build_context, build_customer_memory
    from services.ai.provider import get_default_provider

    if intent == "TRACK":
        return _handle_track(business, conv_id)
    system_prompt = build_context(business) + build_customer_memory(
        business["id"], conv_id)
    msgs = [{"role": "system", "content": system_prompt}]
    for m in (history or [])[-8:]:
        role = m.get("role") if m.get("role") in ("user", "assistant") else "user"
        msgs.append({"role": role, "content": m.get("content", "")})
    msgs.append({"role": "user", "content": text})
    reply = get_default_provider().complete(msgs)
    if not reply:
        return ("Sorry, I'm having trouble right now. "
                "Please try again shortly or call us directly."), intent, []
    if "ESCALATE" in reply:
        return None, "ESCALATE", []
    if "ORDER_COMPLETE" in reply:
        reply = reply.replace("ORDER_COMPLETE", "").strip()
    return reply, intent, []


def generate_reply(business: dict, conv_id: int, text: str, history: list):
    """Drop-in for ai_engine.generate_reply. Routes INFORMATION/ORDER/ESCALATION."""
    route, intent, _ = classify(text, history)
    print(f"[AGENT] route={route} intent={intent} msg={text[:50]}", flush=True)

    # Mid-order takes priority (same as ai_engine:1091)
    if _active_order_state(conv_id):
        return _handle_order(business, conv_id, text, intent)
    if route == ESCALATION:
        return None, "ESCALATE", []
    if route == ORDER:
        if not business.get("order_taking_enabled", 1):
            return _handle_information(business, conv_id, text, history, intent)
        return _handle_order(business, conv_id, text, intent)
    return _handle_information(business, conv_id, text, history, intent)
