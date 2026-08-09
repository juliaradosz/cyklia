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
    pill_time TEXT DEFAULT '12:00',
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
    steps INTEGER,
    sleep_quality TEXT,
    UNIQUE (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS pill_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    intro TEXT DEFAULT '',
    read_minutes INTEGER DEFAULT 5,
    illustration TEXT DEFAULT 'bloom',
    tone TEXT DEFAULT 'rose',
    badge TEXT DEFAULT '',
    phase TEXT DEFAULT 'any',
    keywords TEXT DEFAULT '',
    related TEXT DEFAULT '[]',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    saved_at TEXT NOT NULL,
    UNIQUE (user_id, article_id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (article_id) REFERENCES articles (id)
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

CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT DEFAULT 'Nowa rozmowa',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id INTEGER,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (session_id) REFERENCES chat_sessions (id)
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
    ("ALTER TABLE users ADD COLUMN pill_time TEXT DEFAULT '12:00'", "pill_time"),
    # rozszerzone pola dziennika (entries)
    ("ALTER TABLE entries ADD COLUMN libido TEXT", "libido"),
    ("ALTER TABLE entries ADD COLUMN stress INTEGER", "stress"),
    ("ALTER TABLE entries ADD COLUMN mucus TEXT", "mucus"),
    ("ALTER TABLE entries ADD COLUMN weight REAL", "weight"),
    ("ALTER TABLE entries ADD COLUMN steps INTEGER", "steps"),
    ("ALTER TABLE entries ADD COLUMN sleep_quality TEXT", "sleep_quality"),
    # rozbudowana biblioteka artykułów (Inspiracje)
    ("ALTER TABLE articles ADD COLUMN slug TEXT", "slug"),
    ("ALTER TABLE articles ADD COLUMN intro TEXT DEFAULT ''", "intro"),
    ("ALTER TABLE articles ADD COLUMN read_minutes INTEGER DEFAULT 5", "read_minutes"),
    ("ALTER TABLE articles ADD COLUMN illustration TEXT DEFAULT 'bloom'", "illustration"),
    ("ALTER TABLE articles ADD COLUMN tone TEXT DEFAULT 'rose'", "tone"),
    ("ALTER TABLE articles ADD COLUMN badge TEXT DEFAULT ''", "badge"),
    ("ALTER TABLE articles ADD COLUMN phase TEXT DEFAULT 'any'", "phase"),
    ("ALTER TABLE articles ADD COLUMN keywords TEXT DEFAULT ''", "keywords"),
    ("ALTER TABLE articles ADD COLUMN related TEXT DEFAULT '[]'", "related"),
    # rozmowy czatu (osobne sesje)
    ("ALTER TABLE chat_messages ADD COLUMN session_id INTEGER", "session_id"),
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
    acols = {r["name"] for r in conn.execute("PRAGMA table_info(articles)")}
    mcols = {r["name"] for r in conn.execute("PRAGMA table_info(chat_messages)")}
    for sql, col in MIGRATIONS:
        if col in {"pill_mode", "pill_cycle_days", "pill_break_days", "pill_name", "pill_time"}:
            cols_set = cols
        elif col in {"libido", "stress", "mucus", "weight", "steps", "sleep_quality"}:
            cols_set = ecols
        elif col == "session_id":
            cols_set = mcols
        else:
            cols_set = acols
        if col not in cols_set:
            conn.execute(sql)
    try:
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles (slug)")
    except Exception:
        pass
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
