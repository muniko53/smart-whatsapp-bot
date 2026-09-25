"""Thin webhook parsing + tenant routing + subscription gate.

Extracted from main.py:71-201 / app.py:70-239 so the Flask route becomes:

    event = parse_incoming(request.json)
    if event is None: return {"status": "ok"}
    business = get_business_for_phone(event["phone_id"])
    ...

No Flask, no AI, no sends here — pure parsing + DB lookups.
"""
from datetime import date as _date
from collections import deque

# Meta retries webhook POSTs: skip message IDs already processed recently.
# Per-process memory (approximate under multiple workers) — the DB writes
# behind it remain the source of truth.
_SEEN_IDS = deque(maxlen=2000)


def is_duplicate(message_id: str | None) -> bool:
    if not message_id:
        return False
    if message_id in _SEEN_IDS:
        return True
    _SEEN_IDS.append(message_id)
    return False


def check_verify_token(mode: str | None, token: str | None) -> bool:
    from core.config import settings

    return mode == "subscribe" and token == settings.VERIFY_TOKEN


def parse_incoming(payload: dict) -> dict | None:
    """Parse Meta Cloud API payload.

    Returns None for status callbacks / unparseable (caller returns 200 ok).
    Else: {"from_number", "phone_id", "msg_type", "text"|"media_id"|None}
    """
    try:
        value = payload["entry"][0]["changes"][0]["value"]
    except (KeyError, IndexError, TypeError):
        return None
    if "messages" not in value:
        return None
    try:
        msg = value["messages"][0]
        from_number = msg["from"]
        phone_id = value["metadata"]["phone_number_id"]
        msg_type = msg.get("type", "")
    except (KeyError, TypeError):
        return None

    event = {"from_number": from_number, "phone_id": phone_id,
             "msg_type": msg_type, "text": None, "media_id": None,
             "message_id": msg.get("id")}
    if msg_type == "text":
        try:
            event["text"] = msg["text"]["body"]
        except (KeyError, TypeError):
            return None
    elif msg_type == "audio":
        try:
            event["media_id"] = msg.get("audio", {}).get("id")
        except AttributeError:
            event["media_id"] = None
    # other types (image/video/button/interactive): caller sends unsupported reply
    return event


def get_business_for_phone(phone_id: str) -> dict | None:
    """Multi-tenant lookup. Mirrors main.py:102-105 but with native %s."""
    from core.db import fetch_one

    row = fetch_one(
        "SELECT * FROM businesses WHERE phone_number_id=%s AND active=1 AND bot_enabled=1",
        (phone_id,),
    )
    return row


def is_subscription_blocked(business: dict) -> bool:
    """True when bot must refuse service. From main.py:112-116."""
    sub_status = (business or {}).get("subscription_status", "trial")
    trial_exp = (business or {}).get("trial_expires_at")
    is_expired = (
        sub_status == "trial" and trial_exp and str(trial_exp) < str(_date.today())
    )
    return sub_status == "suspended" or bool(is_expired)


BLOCKED_MESSAGE = (
    "⚠️ This business's bot service is currently unavailable. "
    "Please contact the business directly."
)

UNSUPPORTED_MESSAGE = (
    "Hi! I can read text and voice messages 😊 Please send a text or voice note."
)

VOICE_FAIL_MESSAGE = (
    "🎤 I received your voice note but couldn't transcribe it right now.\n"
    "Please type your message and I'll be happy to help! 😊"
)
