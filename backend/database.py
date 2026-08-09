import os
import sqlite3
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("CYKLIA_DB", os.path.join(BASE_DIR, "cyklia.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    cycle_length_default INTEGER DEFAULT 28,
    period_length_default INTEGER DEFAULT 5,
    pill_mode INTEGER DEFAULT 0,
    pill_cycle_days INTEGER DEFAULT 21,
    pill_break_days INTEGER DEFAULT 7,
    pill_name TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    flow_level INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    temperature REAL,
    mood TEXT,
    symptoms TEXT DEFAULT '[]',
    notes TEXT,
    water INTEGER,
    sleep REAL,
    activity INTEGER,
    libido TEXT,
    stress INTEGER,
    mucus TEXT,
    weight REAL,
    UNIQUE (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
"""


def now_iso():
    return datetime.now(timezone.utc).isoformat()


MIGRATIONS = [
    # tryb tabletek antykoncepcyjnych (users)
    ("ALTER TABLE users ADD COLUMN pill_mode INTEGER DEFAULT 0", "pill_mode"),
    ("ALTER TABLE users ADD COLUMN pill_cycle_days INTEGER DEFAULT 21", "pill_cycle_days"),
    ("ALTER TABLE users ADD COLUMN pill_break_days INTEGER DEFAULT 7", "pill_break_days"),
    ("ALTER TABLE users ADD COLUMN pill_name TEXT", "pill_name"),
    # rozszerzone pola dziennika (entries)
    ("ALTER TABLE entries ADD COLUMN libido TEXT", "libido"),
    ("ALTER TABLE entries ADD COLUMN stress INTEGER", "stress"),
    ("ALTER TABLE entries ADD COLUMN mucus TEXT", "mucus"),
    ("ALTER TABLE entries ADD COLUMN weight REAL", "weight"),
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    migrate(conn)
    conn.commit()
    conn.close()


def migrate(conn=None):
    own = conn is None
    if own:
        conn = get_db()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)")}
    ecols = {r["name"] for r in conn.execute("PRAGMA table_info(entries)")}
    for sql, col in MIGRATIONS:
        table = "users" if col in [
            "pill_mode", "pill_cycle_days", "pill_break_days", "pill_name"
        ] else "entries"
        cols_set = cols if table == "users" else ecols
        if col not in cols_set:
            conn.execute(sql)
    if own:
        conn.commit()
        conn.close()


def query(sql, args=()):
    conn = get_db()
    cur = conn.execute(sql, args)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def query_one(sql, args=()):
    conn = get_db()
    cur = conn.execute(sql, args)
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def execute(sql, args=()):
    conn = get_db()
    cur = conn.execute(sql, args)
    conn.commit()
    last_id = cur.lastrowid
    conn.close()
    return last_id
