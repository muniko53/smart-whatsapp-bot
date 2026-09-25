"""Customer + conversation persistence. From main.py:39-67 + ai_engine memory helpers.

All SQL uses native %s via core.db. No Flask, no sends.
"""
from core.db import fetch_all, fetch_one, execute as db_execute, session


def get_or_create_customer(business_id: int, phone: str) -> dict:
    row = fetch_one(
        "SELECT * FROM customers WHERE business_id=%s AND phone=%s",
        (business_id, phone),
    )
    if not row:
        with session() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO customers (business_id, phone) VALUES (%s,%s)",
                    (business_id, phone),
                )
        row = fetch_one(
            "SELECT * FROM customers WHERE business_id=%s AND phone=%s",
            (business_id, phone),
        )
    else:
        db_execute(
            "UPDATE customers SET visit_count=visit_count+1, "
            "last_seen=CURRENT_TIMESTAMP WHERE id=%s", (row["id"],)
        )
        row = fetch_one("SELECT * FROM customers WHERE id=%s", (row["id"],))
    return row


def get_or_create_conversation(business_id: int, customer_number: str,
                               customer_id: int | None = None) -> dict:
    conv = fetch_one(
        "SELECT * FROM conversations WHERE business_id=%s AND customer_number=%s "
        "ORDER BY updated_at DESC LIMIT 1", (business_id, customer_number)
    )
    if not conv:
        with session() as conn:
            with conn.cursor() as cur:
                if customer_id:
                    cur.execute(
                        "INSERT INTO conversations (business_id, customer_number, customer_id) "
                        "VALUES (%s,%s,%s)", (business_id, customer_number, customer_id)
                    )
                else:
                    cur.execute(
                        "INSERT INTO conversations (business_id, customer_number) VALUES (%s,%s)",
                        (business_id, customer_number),
                    )
        conv = fetch_one(
            "SELECT * FROM conversations WHERE business_id=%s AND customer_number=%s "
            "ORDER BY id DESC LIMIT 1", (business_id, customer_number)
        )
    else:
        db_execute("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=%s",
                   (conv["id"],))
        if customer_id and not conv.get("customer_id"):
            db_execute("UPDATE conversations SET customer_id=%s WHERE id=%s",
                       (customer_id, conv["id"]))
        conv = fetch_one("SELECT * FROM conversations WHERE id=%s", (conv["id"],))
    return conv


def save_message(conv_id: int, role: str, content: str, intent: str = "") -> None:
    db_execute(
        "INSERT INTO messages (conversation_id, role, content, intent) VALUES (%s,%s,%s,%s)",
        (conv_id, role, content, intent),
    )


def recent_history(conv_id: int, limit: int = 10) -> list[dict]:
    rows = fetch_all(
        "SELECT role, content FROM messages WHERE conversation_id=%s "
        "ORDER BY created_at DESC LIMIT %s", (conv_id, limit)
    )
    return list(reversed(rows))


def get_customer_name(business_id: int, conv_id: int) -> str:
    row = fetch_one(
        "SELECT name FROM customers WHERE business_id=%s AND phone="
        "(SELECT customer_number FROM conversations WHERE id=%s)",
        (business_id, conv_id),
    )
    return (row.get("name") if row else "") or ""
