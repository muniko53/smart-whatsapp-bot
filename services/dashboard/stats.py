"""Stats queries. From dashboard_api.py:193-235,344-470. Native %s, same shapes."""
import re
from datetime import datetime, timedelta

from core.db import fetch_all, fetch_one


def _parse_amount(s) -> int:
    nums = re.findall(r"[\d]+", str(s).replace(",", ""))
    return int(nums[0]) if nums else 0


def admin_stats() -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    total_biz = fetch_one("SELECT COUNT(*) FROM businesses")["count"]
    active_biz = fetch_one("SELECT COUNT(*) FROM businesses WHERE active=1")["count"]
    total_msg = fetch_one("SELECT COUNT(*) FROM messages")["count"]
    msg_today = fetch_one("SELECT COUNT(*) FROM messages WHERE created_at::date = %s",
                          (today,))["count"]
    msg_week = fetch_one("SELECT COUNT(*) FROM messages WHERE created_at::date >= %s",
                         (week_ago,))["count"]
    msg_month = fetch_one("SELECT COUNT(*) FROM messages WHERE created_at::date >= %s",
                          (month_ago,))["count"]
    total_convos = fetch_one("SELECT COUNT(*) FROM conversations")["count"]
    daily = fetch_all("""SELECT (created_at::date)::text as day, COUNT(*) as count
        FROM messages WHERE created_at::date >= %s GROUP BY day ORDER BY day""", (week_ago,))
    top_biz = fetch_all("""SELECT b.name, COUNT(m.id) as msg_count FROM businesses b
        LEFT JOIN conversations c ON c.business_id = b.id
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY b.id ORDER BY msg_count DESC LIMIT 5""")
    return {
        "total_businesses": total_biz, "active_businesses": active_biz,
        "total_messages": total_msg, "messages_today": msg_today,
        "messages_week": msg_week, "messages_month": msg_month,
        "total_conversations": total_convos,
        "daily_messages": [{"day": r["day"], "count": r["count"]} for r in daily],
        "top_businesses": [{"name": r["name"], "messages": r["msg_count"]} for r in top_biz],
    }


def business_stats(biz_id: int) -> dict:
    biz = fetch_one("SELECT * FROM businesses WHERE id=%s", (biz_id,))
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    prev_month = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")

    def _one(sql, params=()):
        row = fetch_one(sql, params)
        return list(row.values())[0] if row else 0

    msg_today = _one("""SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id
        WHERE c.business_id=%s AND m.created_at::date = %s""", (biz_id, today))
    msg_week = _one("""SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id
        WHERE c.business_id=%s AND m.created_at::date >= %s""", (biz_id, week_ago))
    msg_month = _one("""SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id
        WHERE c.business_id=%s AND m.created_at::date >= %s""", (biz_id, month_ago))
    total_convos = _one("SELECT COUNT(*) FROM conversations WHERE business_id=%s", (biz_id,))
    daily = fetch_all("""SELECT (m.created_at::date)::text as day, COUNT(*) as count
        FROM messages m JOIN conversations c ON c.id=m.conversation_id
        WHERE c.business_id=%s AND m.created_at::date >= %s AND m.role='user'
        GROUP BY day ORDER BY day""", (biz_id, week_ago))
    orders_today = _one("""SELECT COUNT(*) FROM orders WHERE business_id=%s
        AND status != 'cancelled' AND created_at::date = %s""", (biz_id, today))
    total_orders = _one("""SELECT COUNT(*) FROM orders WHERE business_id=%s
        AND status != 'cancelled'""", (biz_id,))
    month_rows = fetch_all("""SELECT total FROM orders WHERE business_id=%s
        AND status NOT IN ('cancelled','pending') AND created_at::date >= %s""",
        (biz_id, month_ago))
    today_rows = fetch_all("""SELECT total FROM orders WHERE business_id=%s
        AND status NOT IN ('cancelled','pending') AND created_at::date = %s""",
        (biz_id, today))
    item_rows = fetch_all("SELECT items FROM orders WHERE business_id=%s AND status != 'cancelled'",
                          (biz_id,))
    counts: dict[str, int] = {}
    for row in item_rows:
        for item in str(row["items"]).split(","):
            name = item.strip()
            if name:
                counts[name] = counts.get(name, 0) + 1
    new_month = _one("SELECT COUNT(*) FROM customers WHERE business_id=%s AND created_at::date >= %s",
                     (biz_id, month_ago))
    new_prev = _one("""SELECT COUNT(*) FROM customers WHERE business_id=%s
        AND created_at::date >= %s AND created_at::date < %s""", (biz_id, prev_month, month_ago))
    daily_orders = fetch_all("""SELECT (created_at::date)::text as day, COUNT(*) as count
        FROM orders WHERE business_id=%s AND status != 'cancelled'
        AND created_at::date >= %s GROUP BY day ORDER BY day""", (biz_id, week_ago))
    return {
        "messages_today": msg_today, "messages_week": msg_week, "messages_month": msg_month,
        "total_conversations": total_convos, "business_name": biz["name"],
        "bot_enabled": bool(biz["bot_enabled"]),
        "subscription_status": biz.get("subscription_status", "trial"),
        "trial_expires_at": str(biz["trial_expires_at"]) if biz.get("trial_expires_at") else None,
        "daily_messages": [{"day": r["day"], "count": r["count"]} for r in daily],
        "orders_today": orders_today, "total_orders": total_orders,
        "revenue_today": sum(_parse_amount(r["total"]) for r in today_rows),
        "revenue_month": sum(_parse_amount(r["total"]) for r in month_rows),
        "top_products": [{"name": n, "count": c}
                         for n, c in sorted(counts.items(), key=lambda x: -x[1])[:5]],
        "new_customers_month": new_month, "new_customers_prev": new_prev,
        "conversion_rate": round((total_orders / total_convos * 100) if total_convos else 0, 1),
        "daily_orders": [{"day": r["day"], "count": r["count"]} for r in daily_orders],
    }
