"""Webhook parsing + subscription gate (no DB for parse; gate is pure)."""
from services.whatsapp.webhook import (
    check_verify_token,
    is_subscription_blocked,
    parse_incoming,
)


def _payload(msg):
    return {"entry": [{"changes": [{"value": {
        "metadata": {"phone_number_id": "PID"},
        "messages": [msg]}}]}]}


def test_status_callback_returns_none():
    assert parse_incoming({"entry": [{"changes": [{"value": {"statuses": []}}]}]}) is None
    assert parse_incoming({}) is None


def test_text_parses():
    e = parse_incoming(_payload({"from": "2547", "type": "text",
                                 "text": {"body": "hi"}}))
    assert e == {"from_number": "2547", "phone_id": "PID",
                 "msg_type": "text", "text": "hi", "media_id": None}


def test_audio_parses_media_id():
    e = parse_incoming(_payload({"from": "2547", "type": "audio",
                                 "audio": {"id": "MID"}}))
    assert e["media_id"] == "MID" and e["text"] is None


def test_verify_token():
    assert check_verify_token("subscribe", "linklet_verify_2026") is True
    assert check_verify_token("subscribe", "wrong") is False


def test_suspended_blocked():
    assert is_subscription_blocked({"subscription_status": "suspended"}) is True


def test_expired_trial_blocked():
    assert is_subscription_blocked({"subscription_status": "trial",
                                    "trial_expires_at": "2000-01-01"}) is True
    assert is_subscription_blocked({"subscription_status": "trial",
                                    "trial_expires_at": "2999-01-01"}) is False
