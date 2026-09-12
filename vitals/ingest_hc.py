"""Ingest an Android Health Connect export (zip or health_connect_export.db).

Schema facts come from the AOSP HealthFitness module:
- interval records: start_time, end_time (epoch ms), start_zone_offset, end_zone_offset (seconds)
- instant records: time (epoch ms), zone_offset (seconds)
- heart_rate_record_series_table: parent_key -> heart_rate_record_table.row_id, epoch_millis, beats_per_minute
- sleep_stages_table: parent_key -> sleep_session_record_table.row_id, stage_start_time, stage_end_time, stage_type
- application_info_table: row_id, package_name, app_name
Every read introspects the columns first, so a schema change degrades to a warning, not a crash.
"""
from __future__ import annotations

import sqlite3
import tempfile
import zipfile
from pathlib import Path

from . import db as vdb

EXERCISE_TYPES = {
    0: "unknown", 1: "badminton", 2: "baseball", 3: "basketball", 4: "biking", 5: "biking_stationary",
    6: "boot_camp", 7: "boxing", 8: "calisthenics", 9: "cricket", 10: "dancing", 11: "exercise_class",
    12: "fencing", 13: "football_american", 14: "football_australian", 15: "frisbee_disc", 16: "golf",
    17: "guided_breathing", 18: "gymnastics", 19: "handball", 20: "hiit", 21: "hiking", 22: "ice_hockey",
    23: "ice_skating", 24: "martial_arts", 25: "paddling", 26: "paragliding", 27: "pilates", 28: "racquetball",
    29: "rock_climbing", 30: "roller_hockey", 31: "rowing", 32: "rugby", 33: "running", 34: "running_treadmill",
    35: "sailing", 36: "scuba_diving", 37: "skating", 38: "skiing", 39: "snowboarding", 40: "snowshoeing",
    41: "soccer", 42: "softball", 43: "squash", 44: "stair_climbing", 45: "strength_training", 46: "stretching",
    47: "surfing", 48: "swimming_open_water", 49: "swimming_pool", 50: "table_tennis", 51: "tennis",
    52: "volleyball", 53: "walking", 54: "water_polo", 55: "weightlifting", 56: "wheelchair", 57: "yoga",
    58: "other_workout", 59: "stair_climbing_machine", 60: "elliptical", 61: "rowing_machine",
}


def _open_export(path: Path) -> tuple[sqlite3.Connection, tempfile.TemporaryDirectory | None]:
    if path.suffix.lower() == ".zip":
        tmp = tempfile.TemporaryDirectory(prefix="hc_export_")
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".db")]
            if not names:
                raise SystemExit(f"no .db file inside {path}")
            z.extract(names[0], tmp.name)
            dbfile = Path(tmp.name) / names[0]
        return sqlite3.connect(f"file:{dbfile}?mode=ro", uri=True), tmp
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True), None


class HC:
    def __init__(self, con: sqlite3.Connection):
        self.con = con
        self.tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.apps = {}
        if "application_info_table" in self.tables:
            for row_id, pkg, name in con.execute(
                "SELECT row_id, package_name, app_name FROM application_info_table"
            ):
                self.apps[row_id] = name or pkg

    def cols(self, table: str) -> list[str]:
        return [r[1] for r in self.con.execute(f'PRAGMA table_info("{table}")')]

    def has(self, table: str, *needed: str) -> bool:
        if table not in self.tables:
            return False
        c = set(self.cols(table))
        return all(n in c for n in needed)

    def src(self, app_info_id) -> str:
        return self.apps.get(app_info_id, str(app_info_id))

    def rows(self, table: str, cols: list[str]) -> list[tuple]:
        have = set(self.cols(table))
        sel = ", ".join(f'"{c}"' if c in have else f"NULL AS \"{c}\"" for c in cols)
        return self.con.execute(f'SELECT {sel} FROM "{table}"').fetchall()


def _uuid(v) -> str:
    if isinstance(v, (bytes, bytearray)):
        return v.hex()
    return str(v)


def ingest(export_path: Path, out: sqlite3.Connection) -> dict[str, int]:
    """Read the export and upsert into the vitals DB. Returns per-table row counts."""
    src_con, tmp = _open_export(export_path)
    hc = HC(src_con)
    n: dict[str, int] = {}
    try:
        # --- heart rate series ---
        if hc.has("heart_rate_record_series_table", "epoch_millis", "beats_per_minute"):
            join = ""
            src_expr = "NULL"
            if hc.has("heart_rate_record_table", "row_id", "app_info_id"):
                join = "LEFT JOIN heart_rate_record_table r ON s.parent_key = r.row_id"
                src_expr = "r.app_info_id"
            rows = src_con.execute(
                f"SELECT s.epoch_millis, s.beats_per_minute, {src_expr} FROM heart_rate_record_series_table s {join}"
            ).fetchall()
            n["hr"] = vdb.upsert_many(out, "hr", ["ts", "bpm", "source"],
                                      [(int(t), int(b), hc.src(a)) for t, b, a in rows if b])
        # --- instant tables ---
        instant = [
            ("oxygen_saturation_record_table", "percentage", "spo2", "pct", float),
            ("heart_rate_variability_rmssd_record_table", "heart_rate_variability_millis", "hrv", "rmssd_ms", float),
            ("resting_heart_rate_record_table", "beats_per_minute", "rhr_device", "bpm", int),
            ("respiratory_rate_record_table", "rate", "resp", "rate", float),
            ("weight_record_table", "weight", "weight", "kg", lambda g: float(g) / 1000.0),  # stored in grams
            ("vo2_max_record_table", "vo2_milliliters_per_minute_kilogram", "vo2_device", "vo2max", float),
        ]
        for table, col, dest, dcol, conv in instant:
            if hc.has(table, "time", col):
                rows = hc.rows(table, ["time", col, "app_info_id"])
                n[dest] = vdb.upsert_many(out, dest, ["ts", dcol, "source"],
                                          [(int(t), conv(v), hc.src(a)) for t, v, a in rows if v is not None])
        # --- interval tables ---
        if hc.has("steps_record_table", "start_time", "end_time", "count"):
            rows = hc.rows("steps_record_table", ["start_time", "end_time", "count", "app_info_id"])
            n["steps"] = vdb.upsert_many(out, "steps", ["start", "end", "count", "source"],
                                         [(int(s), int(e), int(c), hc.src(a)) for s, e, c, a in rows])
        for table, kind in (("active_calories_burned_record_table", "active"),
                            ("total_calories_burned_record_table", "total")):
            if hc.has(table, "start_time", "end_time", "energy"):
                rows = hc.rows(table, ["start_time", "end_time", "energy", "app_info_id"])
                # energy is stored in calories (not kcal) by Health Connect
                n[f"calories_{kind}"] = vdb.upsert_many(
                    out, "calories", ["start", "end", "kcal", "kind", "source"],
                    [(int(s), int(e), float(v) / 1000.0, kind, hc.src(a)) for s, e, v, a in rows])
        if hc.has("distance_record_table", "start_time", "end_time", "distance"):
            rows = hc.rows("distance_record_table", ["start_time", "end_time", "distance", "app_info_id"])
            n["distance"] = vdb.upsert_many(out, "distance", ["start", "end", "meters", "source"],
                                            [(int(s), int(e), float(d), hc.src(a)) for s, e, d, a in rows])
        # --- sleep ---
        if hc.has("sleep_session_record_table", "start_time", "end_time"):
            rows = hc.rows("sleep_session_record_table",
                           ["row_id", "uuid", "start_time", "end_time", "start_zone_offset", "end_zone_offset",
                            "title", "notes", "app_info_id"])
            id_by_row = {}
            sess = []
            for row_id, uuid, s, e, so, eo, title, notes, a in rows:
                sid = _uuid(uuid) if uuid is not None else f"row{row_id}"
                id_by_row[row_id] = sid
                sess.append((sid, int(s), int(e), so, eo, title, notes, hc.src(a)))
            n["sleep_sessions"] = vdb.upsert_many(
                out, "sleep_sessions",
                ["id", "start", "end", "start_offset_s", "end_offset_s", "title", "notes", "source"], sess)
            if hc.has("sleep_stages_table", "parent_key", "stage_start_time", "stage_end_time", "stage_type"):
                srows = hc.rows("sleep_stages_table", ["parent_key", "stage_start_time", "stage_end_time", "stage_type"])
                n["sleep_stages"] = vdb.upsert_many(
                    out, "sleep_stages", ["session_id", "start", "end", "stage"],
                    [(id_by_row.get(pk, f"row{pk}"), int(s), int(e), int(st)) for pk, s, e, st in srows])
        # --- workouts ---
        if hc.has("exercise_session_record_table", "start_time", "end_time"):
            rows = hc.rows("exercise_session_record_table",
                           ["row_id", "uuid", "start_time", "end_time", "start_zone_offset", "end_zone_offset",
                            "exercise_type", "title", "notes", "app_info_id"])
            n["workouts"] = vdb.upsert_many(
                out, "workouts",
                ["id", "start", "end", "start_offset_s", "end_offset_s", "type_code", "type_name", "title", "notes",
                 "source"],
                [(_uuid(uuid) if uuid is not None else f"row{row_id}", int(s), int(e), so, eo, t,
                  EXERCISE_TYPES.get(t, f"type_{t}"), title, notes, hc.src(a))
                 for row_id, uuid, s, e, so, eo, t, title, notes, a in rows])
        out.execute("INSERT OR REPLACE INTO meta VALUES ('last_ingest_file', ?)", (str(export_path),))
        out.commit()
    finally:
        src_con.close()
        if tmp:
            tmp.cleanup()
    return n


def describe(export_path: Path) -> list[str]:
    """Human-readable inventory of what the export contains. Used by `vitals doctor`."""
    src_con, tmp = _open_export(export_path)
    hc = HC(src_con)
    lines = [f"export: {export_path}", f"apps: {sorted(set(hc.apps.values()))}"]
    for t in sorted(hc.tables):
        if not (t.endswith("_record_table") or t.endswith("_series_table") or t in ("sleep_stages_table",)):
            continue
        cnt = src_con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        if cnt:
            lines.append(f"  {t}: {cnt} rows")
    src_con.close()
    if tmp:
        tmp.cleanup()
    return lines
