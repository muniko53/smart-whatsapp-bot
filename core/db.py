"""Clean Postgres access. Uses native %s placeholders (no ? shim).

Legacy db.py is untouched — new service code should use these helpers.
Old code paths keep working until Phase 6 cutover.
"""
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from core.config import settings


def connect():
    return psycopg2.connect(
        settings.DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


@contextmanager
def session():
    """Yield a connection with commit/rollback handling. Usage:

    with session() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT ... WHERE id=%s", (1,))
    """
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_one(sql, params=()):
    with session() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            row = cur.fetchone()
            return dict(row) if row else None


def fetch_all(sql, params=()):
    with session() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return [dict(r) for r in cur.fetchall()]


def execute(sql, params=()):
    with session() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return cur.rowcount


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'business',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS businesses (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    type                 TEXT DEFAULT '',
    location             TEXT DEFAULT '',
    hours                TEXT DEFAULT '',
    phone                TEXT DEFAULT '',
    owner_number         TEXT DEFAULT '',
    whatsapp_token       TEXT DEFAULT '',
    phone_number_id      TEXT DEFAULT '',
    active               INTEGER DEFAULT 1,
    bot_enabled          INTEGER DEFAULT 1,
    escalation_enabled   INTEGER DEFAULT 1,
    order_taking_enabled INTEGER DEFAULT 1,
    paybill              TEXT DEFAULT '',
    till_number          TEXT DEFAULT '',
    send_money           TEXT DEFAULT '',
    pochi_number         TEXT DEFAULT '',
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price       TEXT DEFAULT '',
    category    TEXT DEFAULT '',
    description TEXT DEFAULT '',
    photo_url   TEXT DEFAULT '',
    available   INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS faqs (
    id          SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    content     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    phone       TEXT NOT NULL,
    name        TEXT DEFAULT '',
    visit_count INTEGER DEFAULT 1,
    last_seen   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, phone)
);
CREATE TABLE IF NOT EXISTS conversations (
    id              SERIAL PRIMARY KEY,
    business_id     INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id     INTEGER REFERENCES customers(id),
    customer_number TEXT NOT NULL,
    status          TEXT DEFAULT 'bot',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    intent          TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    business_id     INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id     INTEGER REFERENCES customers(id),
    conversation_id INTEGER REFERENCES conversations(id),
    customer_number TEXT NOT NULL,
    customer_name   TEXT DEFAULT '',
    items           TEXT DEFAULT '[]',
    total           TEXT DEFAULT '',
    status          TEXT DEFAULT 'pending',
    notes           TEXT DEFAULT '',
    mpesa_code      TEXT DEFAULT '',
    payment_verified INTEGER DEFAULT 0,
    delivery_type   TEXT DEFAULT '',
    booking_date    TEXT DEFAULT '',
    extras          TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS escalations (
    id              SERIAL PRIMARY KEY,
    business_id     INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id),
    customer_number TEXT NOT NULL,
    reason          TEXT DEFAULT '',
    resolved        INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_states (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
    state           TEXT DEFAULT 'idle',
    collected       TEXT DEFAULT '{}',
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

# Safe additive migrations (mirrors legacy db.py so both agree on schema)
MIGRATIONS = [
    ("businesses", "paybill", "TEXT DEFAULT ''"),
    ("businesses", "till_number", "TEXT DEFAULT ''"),
    ("businesses", "send_money", "TEXT DEFAULT ''"),
    ("businesses", "pochi_number", "TEXT DEFAULT ''"),
    ("orders", "mpesa_code", "TEXT DEFAULT ''"),
    ("orders", "payment_verified", "INTEGER DEFAULT 0"),
    ("orders", "delivery_type", "TEXT DEFAULT ''"),
    ("orders", "booking_date", "TEXT DEFAULT ''"),
    ("orders", "extras", "TEXT DEFAULT ''"),
    ("products", "category", "TEXT DEFAULT ''"),
    ("products", "description", "TEXT DEFAULT ''"),
    ("products", "photo_url", "TEXT DEFAULT ''"),
    ("products", "stock_qty", "INTEGER DEFAULT -1"),
    ("orders", "eta", "TEXT DEFAULT ''"),
    ("orders", "payment_method", "TEXT DEFAULT 'mpesa'"),
    ("businesses", "pay_on_delivery", "INTEGER DEFAULT 0"),
    ("businesses", "paybill_account", "TEXT DEFAULT ''"),
    ("businesses", "subscription_status", "TEXT DEFAULT 'trial'"),
    ("businesses", "trial_expires_at", "DATE"),
    ("businesses", "subscription_note", "TEXT DEFAULT ''"),
]


def init_db():
    """Create tables + columns + seed admin. Idempotent, safe to call on boot."""
    import bcrypt

    conn = connect()
    # psycopg2 needs autocommit-friendly handling for DDL; use one transaction
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for stmt in [s.strip() for s in SCHEMA.split(";") if s.strip()]:
                cur.execute(stmt)
            for table, col, definition in MIGRATIONS:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {definition}")
            cur.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
            if not cur.fetchone():
                pw = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
                cur.execute(
                    "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, 'admin')",
                    (settings.ADMIN_EMAIL, pw),
                )
        conn.commit()
    finally:
        conn.close()


# ── Legacy interface (dashboard_api + scripts) ───────────────────
# Same ?-placeholder API the old db.py exposed, backed by the settings above.
# Lets old call sites run unchanged until migrated route by route.
import re as _re


def _to_pg(sql: str) -> str:
    return _re.sub(r"\?", "%s", sql)


class _LegacyCursor:
    def __init__(self, conn):
        self._conn = conn
        self._cur = conn.cursor()
        self.lastrowid = None

    def execute(self, sql, params=()):
        self._cur.execute(_to_pg(sql), params or ())
        if _re.match(r"\s*INSERT", sql.strip(), _re.IGNORECASE):
            try:
                tmp = self._conn.cursor()
                tmp.execute("SELECT lastval()")
                fetched = tmp.fetchone()
                self.lastrowid = fetched["lastval"] if fetched else None
                tmp.close()
            except Exception:
                self.lastrowid = None
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return _LegacyRow(row) if row else None

    def fetchall(self):
        return [_LegacyRow(r) for r in self._cur.fetchall()]


class _LegacyRow(dict):
    """Dict row with integer index access (sqlite3.Row compat)."""

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


class _LegacyConn:
    def __init__(self):
        import psycopg2.extras

        self._conn = psycopg2.connect(
            settings.DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        self._cur = _LegacyCursor(self._conn)
        self.lastrowid = None

    def execute(self, sql, params=()):
        self._cur.execute(sql, params)
        self.lastrowid = self._cur.lastrowid
        return self._cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def legacy_get_db() -> _LegacyConn:
    return _LegacyConn()
