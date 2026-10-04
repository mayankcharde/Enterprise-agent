import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()

def init_db() -> None:
    db_path = Path(settings.audit_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as con:
        con.execute(
            """CREATE TABLE IF NOT EXISTS query_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                question TEXT NOT NULL,
                source_used TEXT NOT NULL,
                trace_json TEXT NOT NULL,
                user_id TEXT,
                conversation_id TEXT
            )"""
        )
        columns = {row[1] for row in con.execute("PRAGMA table_info(query_audit)")}
        if "user_id" not in columns:
            con.execute("ALTER TABLE query_audit ADD COLUMN user_id TEXT")
        if "conversation_id" not in columns:
            con.execute("ALTER TABLE query_audit ADD COLUMN conversation_id TEXT")

def write_audit(
    question: str,
    source_used: str,
    trace: list[str],
    *,
    user_id: str | None = None,
    conversation_id: str | None = None,
) -> None:
    init_db()
    with sqlite3.connect(settings.audit_db_path) as con:
        con.execute(
            """INSERT INTO query_audit(
                created_at, question, source_used, trace_json, user_id, conversation_id
            ) VALUES (?, ?, ?, ?, ?, ?)""",
            (
                datetime.now(timezone.utc).isoformat(),
                question,
                source_used,
                json.dumps(trace),
                user_id,
                conversation_id,
            ),
        )