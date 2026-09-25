"""Security: dedupe, rate limits, brute-force guards, secret hygiene."""
from services.whatsapp.webhook import _SEEN_IDS, is_duplicate, parse_incoming


def _payload(msg):
    return {"entry": [{"changes": [{"value": {
        "metadata": {"phone_number_id": "PID"},
        "messages": [msg]}}]}]}


def test_message_id_parsed():
    e = parse_incoming(_payload({"id": "wamid.X", "from": "2547",
                                 "type": "text", "text": {"body": "hi"}}))
    assert e["message_id"] == "wamid.X"


def test_duplicate_delivery_skipped_once():
    _SEEN_IDS.clear()
    assert is_duplicate("wamid.DUP") is False
    assert is_duplicate("wamid.DUP") is True
    assert is_duplicate(None) is False
    assert is_duplicate("") is False


def test_rate_limiter_trips_and_holds():
    from dashboard_api import _RATE_BUCKETS, rate_limited

    _RATE_BUCKETS.pop("sec-test", None)
    results = [rate_limited("sec-test", limit=5, window=60) for _ in range(7)]
    assert results == [False] * 5 + [True] * 2


def test_login_brute_force_trips_429():
    import main

    c = main.app.test_client()
    codes = [c.post("/api/auth/login",
                    json={"email": "nobody@example.com", "password": "wrong"}).status_code
             for _ in range(17)]
    assert codes[0] == 401
    assert codes[-1] == 429


def test_no_secrets_in_client_bundle():
    import os

    hits = []
    for dirpath, _, filenames in os.walk("frontend/src"):
        for fn in filenames:
            if not fn.endswith((".js", ".css")):
                continue
            text = open(os.path.join(dirpath, fn), encoding="utf-8").read()
            for marker in ("sk-or-v1-", "gsk_", "npg_", "EAAD", "BEGIN PRIVATE"):
                if marker in text:
                    hits.append(f"{fn}:{marker}")
    assert hits == [], hits
