"""Pure order-service logic (no DB)."""
from services.orders.service import build_cart, confirm_summary, mpesa_instructions


def test_build_cart_totals():
    cart, lines, total = build_cart([
        {"name": "Chips", "price": "Ksh 500", "qty": 2},
        {"name": "Soda", "price": "Ksh 200", "qty": 1},
    ])
    assert total == "Ksh 1,200"
    assert "2 x Chips" in lines


def test_build_cart_comma_price():
    _, _, total = build_cart([{"name": "Platter", "price": "Ksh 1,500", "qty": 2}])
    assert total == "Ksh 3,000"


def test_build_cart_unknown_price():
    _, _, total = build_cart([{"name": "Special", "price": "To be confirmed", "qty": 1}])
    assert total == "To be confirmed"


def test_confirm_summary_fields():
    msg = confirm_summary({"name": "Ann", "total": "Ksh 1,500"}, "  • 1 x Chips")
    assert "Ann" in msg and "Ksh 1,500" in msg and "Yes" in msg


def test_mpesa_none_without_config():
    assert mpesa_instructions(
        {"paybill": "", "till_number": "", "send_money": "", "pochi_number": ""},
        1, "Ksh 100") is None


def test_mpesa_paybill_section():
    msg = mpesa_instructions({"paybill": "123456", "till_number": "",
                              "send_money": "", "pochi_number": "",
                              "paybill_account": ""}, 7, "Ksh 1,500")
    assert "123456" in msg and "#7" in msg and "Ksh 1,500" in msg
