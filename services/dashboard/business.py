"""Business/admin CRUD + order/customer/escalation ops. From dashboard_api.py.

All %s. Callers (routes) handle HTTP shapes; these do DB work.
"""
from core.db import fetch_all, fetch_one, execute as db_execute, session


def get_business_for_user(user_id: int) -> dict | None:
    return fetch_one("SELECT * FROM businesses WHERE user_id=%s", (user_id,))


def get_profile(business_id: int) -> dict:
    biz = fetch_one("SELECT * FROM businesses WHERE id=%s", (business_id,))
    products = fetch_all("SELECT * FROM products WHERE business_id=%s", (business_id,))
    faqs = fetch_all("SELECT * FROM faqs WHERE business_id=%s", (business_id,))
    result = dict(biz)
    result["products"] = products
    result["faqs"] = faqs
    return result


def update_profile(business_id: int, data: dict) -> None:
    db_execute(
        """UPDATE businesses SET name=%s, type=%s, location=%s, hours=%s, phone=%s,
           owner_number=%s, whatsapp_token=%s, phone_number_id=%s, paybill=%s,
           paybill_account=%s, till_number=%s, send_money=%s, pochi_number=%s,
           pay_on_delivery=%s WHERE id=%s""",
        (data.get("name"), data.get("type"), data.get("location"), data.get("hours"),
         data.get("phone"), data.get("owner_number"), data.get("whatsapp_token"),
         data.get("phone_number_id"), data.get("paybill", ""), data.get("paybill_account", ""),
         data.get("till_number", ""), data.get("send_money", ""), data.get("pochi_number", ""),
         int(data.get("pay_on_delivery", 0) or 0), business_id),
    )
    if "products" in data:
        db_execute("DELETE FROM products WHERE business_id=%s", (business_id,))
        with session() as conn:
            with conn.cursor() as cur:
                for p in (data["products"] or [])[:50]:
                    cur.execute(
                        "INSERT INTO products (business_id, name, price, category, description, "
                        "photo_url, stock_qty) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                        (business_id, p.get("name", ""), p.get("price", ""),
                         p.get("category", ""), p.get("description", ""),
                         p.get("photo_url", ""), int(p.get("stock_qty", -1) or -1)),
                    )
    if "faqs" in data:
        db_execute("DELETE FROM faqs WHERE business_id=%s", (business_id,))
        with session() as conn:
            with conn.cursor() as cur:
                for f in data["faqs"] or []:
                    cur.execute("INSERT INTO faqs (business_id, content) VALUES (%s,%s)",
                                (business_id, f))


def toggle_bot(business_id: int) -> bool:
    biz = fetch_one("SELECT bot_enabled FROM businesses WHERE id=%s", (business_id,))
    new_state = 0 if biz["bot_enabled"] else 1
    db_execute("UPDATE businesses SET bot_enabled=%s WHERE id=%s", (new_state, business_id))
    return bool(new_state)


def list_orders(business_id: int, limit: int = 100) -> list[dict]:
    return fetch_all("SELECT * FROM orders WHERE business_id=%s ORDER BY created_at DESC LIMIT %s",
                     (business_id, limit))


def update_order(business: dict, order_id: int, data: dict) -> dict | None:
    db_execute(
        "UPDATE orders SET status=%s, notes=%s, eta=%s, updated_at=CURRENT_TIMESTAMP "
        "WHERE id=%s AND business_id=%s",
        (data.get("status"), data.get("notes", ""), data.get("eta", ""),
         order_id, business["id"]),
    )
    return fetch_one(
        """SELECT o.*, p.photo_url FROM orders o
           LEFT JOIN products p ON p.business_id = o.business_id
           WHERE o.id = %s LIMIT 1""", (order_id,)
    )


def verify_payment(business_id: int, order_id: int) -> None:
    db_execute("UPDATE orders SET payment_verified=1, updated_at=CURRENT_TIMESTAMP "
               "WHERE id=%s AND business_id=%s", (order_id, business_id))


def list_customers(business_id: int) -> list[dict]:
    return fetch_all(
        """SELECT c.*, COUNT(DISTINCT conv.id) as conv_count FROM customers c
           LEFT JOIN conversations conv ON conv.customer_id=c.id
           WHERE c.business_id=%s GROUP BY c.id ORDER BY c.last_seen DESC""",
        (business_id,),
    )


def rename_customer(business_id: int, cust_id: int, name: str) -> None:
    db_execute("UPDATE customers SET name=%s WHERE id=%s AND business_id=%s",
               (name, cust_id, business_id))


def list_conversations(business_id: int, limit: int = 50) -> list[dict]:
    return fetch_all(
        """SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) as msg_count,
           (SELECT content FROM messages m WHERE m.conversation_id=c.id
            ORDER BY m.created_at DESC LIMIT 1) as last_message
           FROM conversations c WHERE c.business_id=%s ORDER BY c.updated_at DESC LIMIT %s""",
        (business_id, limit),
    )


def conversation_messages(business_id: int, conv_id: int) -> list[dict] | None:
    conv = fetch_one("SELECT * FROM conversations WHERE id=%s AND business_id=%s",
                     (conv_id, business_id))
    if not conv:
        return None
    return fetch_all("SELECT * FROM messages WHERE conversation_id=%s ORDER BY created_at",
                     (conv_id,))


def list_escalations(business_id: int, limit: int = 50) -> list[dict]:
    return fetch_all("SELECT * FROM escalations WHERE business_id=%s "
                     "ORDER BY created_at DESC LIMIT %s", (business_id, limit))


def resolve_escalation(business_id: int, esc_id: int) -> None:
    db_execute("UPDATE escalations SET resolved=1 WHERE id=%s AND business_id=%s",
               (esc_id, business_id))


def list_businesses_admin() -> list[dict]:
    return fetch_all(
        """SELECT b.*, u.email,
           (SELECT COUNT(*) FROM conversations c WHERE c.business_id=b.id) as conv_count,
           (SELECT COUNT(*) FROM conversations c JOIN messages m ON m.conversation_id=c.id
            WHERE c.business_id=b.id) as msg_count
           FROM businesses b JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC"""
    )


def list_orders_admin(limit: int = 200) -> list[dict]:
    return fetch_all(
        """SELECT o.*, b.name as business_name FROM orders o
           JOIN businesses b ON b.id=o.business_id ORDER BY o.created_at DESC LIMIT %s""",
        (limit,),
    )


def list_conversations_admin(limit: int = 100) -> list[dict]:
    return fetch_all(
        """SELECT c.*, b.name as business_name,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) as msg_count,
           (SELECT content FROM messages m WHERE m.conversation_id=c.id
            ORDER BY m.created_at DESC LIMIT 1) as last_message
           FROM conversations c JOIN businesses b ON b.id=c.business_id
           ORDER BY c.updated_at DESC LIMIT %s""", (limit,),
    )


def list_escalations_admin(limit: int = 100) -> list[dict]:
    return fetch_all(
        """SELECT e.*, b.name as business_name FROM escalations e
           JOIN businesses b ON b.id=e.business_id ORDER BY e.created_at DESC LIMIT %s""",
        (limit,),
    )
