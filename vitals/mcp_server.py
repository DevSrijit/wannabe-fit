"""MCP server (stdio) so Claude Code, OpenClaw, or any MCP client can query the local vitals db."""
from __future__ import annotations

import json
import sqlite3

try:  # mcp >= 2.0 renamed FastMCP to MCPServer
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP

from . import db as vdb
from .config import Config

cfg = Config()
mcp = FastMCP("vitals", instructions=(
    "Local wearable analytics computed from Health Connect exports. Tables: daily (one row per local day: recovery, "
    "rhr, sleep_*, strain, trimp, ctl/atl/tsb, spo2_*, steps), workout_metrics, plus raw hr, spo2, sleep_sessions, "
    "sleep_stages, workouts, steps, calories, weight. Timestamps in raw tables are epoch milliseconds UTC; "
    f"local timezone is {cfg.data['timezone']}. Formulas are documented in README.md next to this server."
))


def _con() -> sqlite3.Connection:
    con = vdb.connect(cfg.db_path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA query_only = 1")
    return con


def _rows(sql: str, params: tuple = ()) -> str:
    con = _con()
    try:
        rows = [dict(r) for r in con.execute(sql, params).fetchall()]
    except sqlite3.Error as e:
        return json.dumps({"error": str(e), "hint": "the connection is read-only; call get_schema for table names"})
    finally:
        con.close()
    return json.dumps(rows, default=str)


@mcp.tool()
def get_daily(date_from: str = "", date_to: str = "", limit: int = 30) -> str:
    """Daily metrics (recovery, RHR, sleep, strain, TRIMP, CTL/ATL/TSB, SpO2, steps). ISO dates, newest first."""
    where, params = [], []
    if date_from:
        where.append("date >= ?"); params.append(date_from)
    if date_to:
        where.append("date <= ?"); params.append(date_to)
    w = ("WHERE " + " AND ".join(where)) if where else ""
    return _rows(f"SELECT * FROM daily {w} ORDER BY date DESC LIMIT ?", (*params, int(limit)))


@mcp.tool()
def get_workouts(days: int = 30) -> str:
    """Per-workout metrics: HR avg/max, zone minutes, TRIMP, strain, HR-derived kcal, 1-min HR recovery."""
    return _rows("SELECT * FROM workout_metrics WHERE date >= date('now', ?) ORDER BY start DESC",
                 (f"-{int(days)} days",))


@mcp.tool()
def get_sleep(days: int = 14) -> str:
    """Sleep sessions with stage minutes, efficiency, need, performance, debt, consistency."""
    cols = ("date, sleep_start, sleep_end, sleep_tib_min, sleep_asleep_min, sleep_efficiency, sleep_light_min, "
            "sleep_deep_min, sleep_rem_min, sleep_awake_min, sleep_awakenings, sleep_need_min, sleep_performance, "
            "sleep_debt7_h, sleep_consistency, spo2_night_mean, spo2_night_min, rhr")
    return _rows(f"SELECT {cols} FROM daily WHERE sleep_asleep_min IS NOT NULL ORDER BY date DESC LIMIT ?",
                 (int(days),))


@mcp.tool()
def get_heart_rate(start_iso: str, end_iso: str, bucket_minutes: int = 5) -> str:
    """Raw HR samples between two ISO timestamps (local tz), averaged into buckets. bucket_minutes=0 for raw."""
    import datetime as dt
    tz = cfg.tz
    a = int(dt.datetime.fromisoformat(start_iso).replace(tzinfo=tz).timestamp() * 1000)
    b = int(dt.datetime.fromisoformat(end_iso).replace(tzinfo=tz).timestamp() * 1000)
    if bucket_minutes <= 0:
        rows = json.loads(_rows("SELECT ts, bpm FROM hr WHERE ts BETWEEN ? AND ? ORDER BY ts", (a, b)))
        for r in rows:
            r["local_time"] = dt.datetime.fromtimestamp(r["ts"] / 1000, tz).strftime("%Y-%m-%d %H:%M:%S")
        return json.dumps(rows)
    step = int(bucket_minutes) * 60000
    rows = json.loads(_rows(
        "SELECT (ts / ?) * ? AS bucket_ms, ROUND(AVG(bpm),1) AS bpm, MIN(bpm) AS lo, MAX(bpm) AS hi, "
        "COUNT(*) AS n FROM hr WHERE ts BETWEEN ? AND ? GROUP BY bucket_ms ORDER BY bucket_ms",
        (step, step, a, b)))
    for r in rows:
        r["local_time"] = dt.datetime.fromtimestamp(r["bucket_ms"] / 1000, tz).strftime("%Y-%m-%d %H:%M")
    return json.dumps(rows)


@mcp.tool()
def run_sql(query: str) -> str:
    """Read-only SQL against the vitals db. Use get_schema first."""
    return _rows(query)


@mcp.tool()
def get_schema() -> str:
    """CREATE TABLE statements for every table, plus the column list of daily and workout_metrics."""
    con = _con()
    try:
        out = [r[0] for r in con.execute("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL")]
        for t in ("daily", "workout_metrics"):
            out.append(f"-- {t} columns: " + ", ".join(r[1] for r in con.execute(f'PRAGMA table_info("{t}")')))
    finally:
        con.close()
    return "\n".join(out)


@mcp.tool()
def get_report(days: int = 14) -> str:
    """Markdown report: today's card, daily table, workouts, 7-day means."""
    from .report import report
    con = vdb.connect(cfg.db_path)
    try:
        return report(con, days=int(days))
    finally:
        con.close()


@mcp.tool()
def sync() -> str:
    """Ingest the newest export in the inbox, recompute metrics, and rewrite reports/latest.md."""
    from .cli import cmd_sync
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        cmd_sync(cfg, None)
    return buf.getvalue()


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
