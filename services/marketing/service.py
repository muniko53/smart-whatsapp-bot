"""Marketing broadcast. From dashboard_api.py:757-808, via whatsapp client."""
from datetime import datetime, timedelta

from core.db import fetch_all, fetch_one


def broadcast_targets(business_id: int, segment: str = "all") -> list[str]:
    month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if segment == "recent":
        rows = fetch_all("SELECT DISTINCT phone FROM customers "
                         "WHERE business_id=%s AND last_seen::date >= %s",
                         (business_id, month_ago))
    elif segment == "repeat":
        rows = fetch_all("SELECT DISTINCT phone FROM customers "
                         "WHERE business_id=%s AND visit_count >= 2", (business_id,))
    else:
        rows = fetch_all("SELECT DISTINCT phone FROM customers WHERE business_id=%s",
                         (business_id,))
    return [r["phone"] for r in rows if r.get("phone")]


def broadcast(business: dict, message: str, segment: str = "all") -> dict:
    from services.whatsapp.client import send_text

    phones = broadcast_targets(business["id"], segment)
    sent, failed = 0, 0
    for phone in phones:
        try:
            result = send_text(phone, message,
                               business["whatsapp_token"], business["phone_number_id"])
            if result is None:
                failed += 1
            else:
                sent += 1
        except Exception:
            failed += 1
    print(f"[MARKETING] broadcast: {sent} ok, {failed} failed", flush=True)
    return {"sent": sent, "failed": failed, "total": len(phones)}


def get_business_for_user(user_id: int) -> dict | None:
    return fetch_one("SELECT * FROM businesses WHERE user_id=%s", (user_id,))
