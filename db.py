import psycopg2
import psycopg2.extras
import os
import re

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost/wa_bot')

def _to_pg(sql):
    """Convert SQLite ? placeholders to PostgreSQL %s"""
    return re.sub(r'\?', '%s', sql)

class Row(dict):
    """Dict that also supports integer index access like sqlite3.Row"""
    def __init__(self, data):
        super().__init__(data)
        self._vals = list(data.values())

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._vals[key]
        return super().__getitem__(key)

class _Cursor:
    def __init__(self, pg_conn):
        self._conn = pg_conn
        self._cur  = pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        self.lastrowid = None

    def execute(self, sql, params=()):
        self._cur.execute(_to_pg(sql), params or ())
        if re.match(r'\s*INSERT', sql.strip(), re.IGNORECASE):
            try:
                tmp = self._conn.cursor()
                tmp.execute("SELECT lastval()")
                self.lastrowid = tmp.fetchone()[0]
                tmp.close()
            except Exception:
                self.lastrowid = None
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return Row(row) if row else None

    def fetchall(self):
        return [Row(r) for r in self._cur.fetchall()]

class _Connection:
    def __init__(self, pg_conn):
        self._conn = pg_conn
        self._cur  = _Cursor(pg_conn)
        self.lastrowid = None

    def execute(self, sql, params=()):
        self._cur.execute(sql, params)
        self.lastrowid = self._cur.lastrowid
        return self._cur

    def executescript(self, script):
        cur = self._conn.cursor()
        for stmt in script.split(';'):
            stmt = stmt.strip()
            if stmt:
                cur.execute(stmt)
        cur.close()

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    return _Connection(conn)

def init_db():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'business',
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cur.execute('''
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
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id          SERIAL PRIMARY KEY,
            business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            price       TEXT DEFAULT '',
            category    TEXT DEFAULT '',
            description TEXT DEFAULT '',
            photo_url   TEXT DEFAULT '',
            available   INTEGER DEFAULT 1
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS faqs (
            id          SERIAL PRIMARY KEY,
            business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
            content     TEXT NOT NULL
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id          SERIAL PRIMARY KEY,
            business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
            phone       TEXT NOT NULL,
            name        TEXT DEFAULT '',
            visit_count INTEGER DEFAULT 1,
            last_seen   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(business_id, phone)
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id              SERIAL PRIMARY KEY,
            business_id     INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
            customer_id     INTEGER REFERENCES customers(id),
            customer_number TEXT NOT NULL,
            status          TEXT DEFAULT 'bot',
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id              SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
            role            TEXT NOT NULL,
            content         TEXT NOT NULL,
            intent          TEXT DEFAULT '',
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cur.execute('''
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
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS escalations (
            id              SERIAL PRIMARY KEY,
            business_id     INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
            conversation_id INTEGER REFERENCES conversations(id),
            customer_number TEXT NOT NULL,
            reason          TEXT DEFAULT '',
            resolved        INTEGER DEFAULT 0,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS order_states (
            id              SERIAL PRIMARY KEY,
            conversation_id INTEGER UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
            state           TEXT DEFAULT 'idle',
            collected       TEXT DEFAULT '{}',
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Add any missing columns safely
    migrations = [
        ('businesses', 'paybill',       "TEXT DEFAULT ''"),
        ('businesses', 'till_number',   "TEXT DEFAULT ''"),
        ('businesses', 'send_money',    "TEXT DEFAULT ''"),
        ('businesses', 'pochi_number',  "TEXT DEFAULT ''"),
        ('orders',     'mpesa_code',    "TEXT DEFAULT ''"),
        ('orders',     'payment_verified', "INTEGER DEFAULT 0"),
        ('orders',     'delivery_type', "TEXT DEFAULT ''"),
        ('orders',     'booking_date',  "TEXT DEFAULT ''"),
        ('orders',     'extras',        "TEXT DEFAULT ''"),
        ('products',   'category',      "TEXT DEFAULT ''"),
        ('products',   'description',   "TEXT DEFAULT ''"),
        ('products',   'photo_url',     "TEXT DEFAULT ''"),
        ('products',   'stock_qty',     "INTEGER DEFAULT -1"),
        ('orders',     'eta',           "TEXT DEFAULT ''"),
        ('orders',     'payment_method', "TEXT DEFAULT 'mpesa'"),
        ('businesses', 'pay_on_delivery',      "INTEGER DEFAULT 0"),
        ('businesses', 'paybill_account',     "TEXT DEFAULT ''"),
        ('businesses', 'subscription_status', "TEXT DEFAULT 'trial'"),
        ('businesses', 'trial_expires_at',    "DATE"),
        ('businesses', 'subscription_note',   "TEXT DEFAULT ''"),
    ]
    for table, col, definition in migrations:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {definition}")

    # Seed admin account if missing
    import bcrypt
    cur.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    if not cur.fetchone():
        pw = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode()
        cur.execute(
            "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, 'admin')",
            (os.environ.get('ADMIN_EMAIL', 'admin@example.com'), pw)
        )

    conn.commit()
    cur.close()
    conn.close()
