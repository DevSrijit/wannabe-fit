"""SQLite storage for normalized wearable data. One row per sample, deduped."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS hr (ts INTEGER PRIMARY KEY, bpm INTEGER NOT NULL, source TEXT);
CREATE TABLE IF NOT EXISTS spo2 (ts INTEGER PRIMARY KEY, pct REAL NOT NULL, source TEXT);
CREATE TABLE IF NOT EXISTS hrv (ts INTEGER PRIMARY KEY, rmssd_ms REAL NOT NULL, source TEXT);
CREATE TABLE IF NOT EXISTS rhr_device (ts INTEGER PRIMARY KEY, bpm INTEGER NOT NULL, source TEXT);
CREATE TABLE IF NOT EXISTS resp (ts INTEGER PRIMARY KEY, rate REAL NOT NULL, source TEXT);
CREATE TABLE IF NOT EXISTS weight (ts INTEGER PRIMARY KEY, kg REAL NOT NULL, source TEXT);
CREATE TABLE IF NOT EXISTS vo2_device (ts INTEGER PRIMARY KEY, vo2max REAL NOT NULL, source TEXT);
CREATE TABLE IF NOT EXISTS steps (start INTEGER, "end" INTEGER, count INTEGER NOT NULL, source TEXT,
    PRIMARY KEY (start, "end", source));
CREATE TABLE IF NOT EXISTS calories (start INTEGER, "end" INTEGER, kcal REAL NOT NULL, kind TEXT, source TEXT,
    PRIMARY KEY (start, "end", kind, source));
CREATE TABLE IF NOT EXISTS distance (start INTEGER, "end" INTEGER, meters REAL NOT NULL, source TEXT,
    PRIMARY KEY (start, "end", source));
CREATE TABLE IF NOT EXISTS sleep_sessions (id TEXT PRIMARY KEY, start INTEGER NOT NULL, "end" INTEGER NOT NULL,
    start_offset_s INTEGER, end_offset_s INTEGER, title TEXT, notes TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS sleep_stages (session_id TEXT, start INTEGER, "end" INTEGER, stage INTEGER,
    PRIMARY KEY (session_id, start));
CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY, start INTEGER NOT NULL, "end" INTEGER NOT NULL,
    start_offset_s INTEGER, end_offset_s INTEGER, type_code INTEGER, type_name TEXT, title TEXT, notes TEXT,
    source TEXT);
CREATE INDEX IF NOT EXISTS hr_ts ON hr(ts);
CREATE INDEX IF NOT EXISTS spo2_ts ON spo2(ts);
CREATE INDEX IF NOT EXISTS steps_start ON steps(start);
"""

SLEEP_STAGE_NAMES = {
    0: "unknown", 1: "awake", 2: "sleeping", 3: "out_of_bed",
    4: "light", 5: "deep", 6: "rem", 7: "awake_in_bed",
}
ASLEEP_STAGES = {2, 4, 5, 6}


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)
    con.execute("PRAGMA journal_mode=WAL")
    return con


def upsert_many(con: sqlite3.Connection, table: str, cols: list[str], rows: list[tuple]) -> int:
    """INSERT OR REPLACE rows. Returns the number of rows given."""
    if not rows:
        return 0
    q = ", ".join(f'"{c}"' for c in cols)
    ph = ", ".join("?" for _ in cols)
    con.executemany(f'INSERT OR REPLACE INTO "{table}" ({q}) VALUES ({ph})', rows)
    return len(rows)


def counts(con: sqlite3.Connection) -> dict[str, int]:
    tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    return {t: con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}
