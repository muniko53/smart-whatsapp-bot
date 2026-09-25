"""Intent routing: INFORMATION (RAG/DB) | ORDER (state machine) | ESCALATION (human)."""
from services.ai.agent import INFORMATION, ORDER, ESCALATION, classify, detect_intent


def test_greeting_goes_to_order():
    assert detect_intent("hello") == "MENU"
    assert classify("hello")[0] == ORDER


def test_track_goes_to_information():
    assert detect_intent("track my order") == "TRACK"
    assert classify("track my order")[0] == INFORMATION


def test_human_request_escalates():
    assert detect_intent("I need a human agent") == "ESCALATE"
    assert classify("I need a human agent")[0] == ESCALATION


def test_complaint_escalates():
    assert classify("my food was bad, refund")[0] == ESCALATION


def test_no_substring_false_positives():
    # 'hi' inside 'chips' must not trigger MENU
    assert detect_intent("chips") == "INQUIRY"


def test_swahili_price_question():
    assert detect_intent("bei gani") == "PRICE_CHECK"


def test_unknown_is_inquiry():
    assert detect_intent("xyzzy plugh") == "INQUIRY"
