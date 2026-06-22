"""SQLite setup and helpers for UberPHOTO MVP."""
import sqlite3
import os
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "uberphoto.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _ensure_column(conn, table, column, ddl):
    """Add a column if an older DB file predates it (SQLite has no IF NOT EXISTS for columns)."""
    cols = [r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS photographers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                status TEXT NOT NULL DEFAULT 'offline',
                rating REAL DEFAULT 4.8,
                shots INTEGER DEFAULT 0,
                specialty TEXT,
                thumb TEXT,
                bio TEXT,
                portfolio TEXT,
                lat REAL,
                lng REAL,
                is_demo INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                plan TEXT NOT NULL,
                price INTEGER NOT NULL,
                location TEXT,
                lat REAL,
                lng REAL,
                status TEXT NOT NULL DEFAULT 'waiting',
                photographer_id INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                matched_at TEXT,
                FOREIGN KEY (photographer_id) REFERENCES photographers(id)
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                photographer_id INTEGER NOT NULL,
                gallery_token TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'shooting',
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed_at TEXT,
                FOREIGN KEY (request_id) REFERENCES requests(id),
                FOREIGN KEY (photographer_id) REFERENCES photographers(id)
            );

            CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER,
                amount INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                stripe_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photographer_id INTEGER NOT NULL,
                request_id INTEGER,
                author TEXT,
                rating INTEGER NOT NULL,
                text TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (photographer_id) REFERENCES photographers(id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                sender TEXT NOT NULL,        -- 'customer' | 'photographer'
                text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (request_id) REFERENCES requests(id)
            );
            """
        )
        # lightweight migrations for older DB files (extra request details)
        _ensure_column(conn, "requests", "people", "people TEXT")
        _ensure_column(conn, "requests", "scene", "scene TEXT")
        _ensure_column(conn, "requests", "note", "note TEXT")
        _ensure_column(conn, "requests", "reviewed", "reviewed INTEGER NOT NULL DEFAULT 0")
        # photographer self-service profile (bio + own portfolio)
        _ensure_column(conn, "photographers", "bio", "bio TEXT")
        _ensure_column(conn, "photographers", "portfolio", "portfolio TEXT")
        _ensure_column(conn, "photographers", "area", "area TEXT")
