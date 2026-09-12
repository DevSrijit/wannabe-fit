"""Fallback ingester for Google Takeout > Fit > 'All Data' JSON files (or the zip).

Each file is {"Data Points": [{"startTimeNanos", "endTimeNanos", "dataTypeName", "value": [{"fpVal"|"intVal"}],
"originDataSourceId"}]}. Google Fit data types map onto the same normalized tables as Health Connect.
Sleep segments arrive as com.google.sleep.segment points whose intVal is the stage (1 awake, 2 sleep,
3 out of bed, 4 light, 5 deep, 6 REM), which matches the Health Connect stage codes.
"""
from __future__ import annotations

import json
import sqlite3
import zipfile
from pathlib import Path

from . import db as vdb

FIT_ACTIVITY = {  # Google Fit activity type -> Health Connect exercise name (partial)
    7: "walking", 8: "running", 1: "biking", 80: "strength_training", 97: "weightlifting", 72: "sleep",
    57: "running_treadmill", 25: "elliptical", 77: "stair_climbing", 82: "swimming_pool", 100: "yoga",
    3: "still", 4: "unknown", 108: "other_workout", 116: "hiit",
}


def _iter_files(path: Path):
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                if "/Fit/" in name and name.endswith(".json"):
                    yield name, json.loads(z.read(name))
    elif path.is_dir():
        for f in path.rglob("*.json"):
            yield str(f), json.loads(f.read_text())
    else:
        yield str(path), json.loads(path.read_text())


def _val(p):
    for v in p.get("value", []):
        if "fpVal" in v:
            return float(v["fpVal"])
        if "intVal" in v:
            return int(v["intVal"])
    return None


def ingest(path: Path, out: sqlite3.Connection) -> dict[str, int]:
    n: dict[str, int] = {}
    hr, spo2, steps, cal, dist, weight, sleep_stages, sessions = [], [], [], [], [], [], [], []
    for name, doc in _iter_files(path):
        pts = doc.get("Data Points") or doc.get("dataPoints") or []
        for p in pts:
            t = p.get("dataTypeName", "")
            s = int(p.get("startTimeNanos", 0)) // 1_000_000
            e = int(p.get("endTimeNanos", 0)) // 1_000_000
            src = p.get("originDataSourceId", "takeout")
            v = _val(p)
            if v is None:
                continue
            if t == "com.google.heart_rate.bpm":
                hr.append((s, int(round(v)), src))
            elif t == "com.google.oxygen_saturation":
                spo2.append((s, float(v), src))
            elif t == "com.google.step_count.delta":
                steps.append((s, e, int(v), src))
            elif t == "com.google.calories.expended":
                cal.append((s, e, float(v), "total", src))
            elif t == "com.google.distance.delta":
                dist.append((s, e, float(v), src))
            elif t == "com.google.weight":
                weight.append((s, float(v), src))
            elif t == "com.google.sleep.segment":
                sleep_stages.append((s, e, int(v)))
            elif t == "com.google.activity.segment" and int(v) not in (3, 4, 72):
                sessions.append((f"fit-{s}-{e}", s, e, None, None, int(v),
                                 FIT_ACTIVITY.get(int(v), f"fit_{int(v)}"), None, None, src))
    n["hr"] = vdb.upsert_many(out, "hr", ["ts", "bpm", "source"], hr)
    n["spo2"] = vdb.upsert_many(out, "spo2", ["ts", "pct", "source"], spo2)
    n["steps"] = vdb.upsert_many(out, "steps", ["start", "end", "count", "source"], steps)
    n["calories"] = vdb.upsert_many(out, "calories", ["start", "end", "kcal", "kind", "source"], cal)
    n["distance"] = vdb.upsert_many(out, "distance", ["start", "end", "meters", "source"], dist)
    n["weight"] = vdb.upsert_many(out, "weight", ["ts", "kg", "source"], weight)
    n["workouts"] = vdb.upsert_many(
        out, "workouts",
        ["id", "start", "end", "start_offset_s", "end_offset_s", "type_code", "type_name", "title", "notes", "source"],
        sessions)
    # Group contiguous sleep segments (gap < 90 min) into sessions.
    sleep_stages.sort()
    sess_rows, stage_rows = [], []
    cur = []
    for seg in sleep_stages + [None]:
        if seg is None or (cur and seg[0] - cur[-1][1] > 90 * 60_000):
            if cur:
                sid = f"fit-sleep-{cur[0][0]}"
                sess_rows.append((sid, cur[0][0], cur[-1][1], None, None, None, None, "takeout"))
                stage_rows += [(sid, a, b, st) for a, b, st in cur]
            cur = []
        if seg is not None:
            cur.append(seg)
    n["sleep_sessions"] = vdb.upsert_many(
        out, "sleep_sessions",
        ["id", "start", "end", "start_offset_s", "end_offset_s", "title", "notes", "source"], sess_rows)
    n["sleep_stages"] = vdb.upsert_many(out, "sleep_stages", ["session_id", "start", "end", "stage"], stage_rows)
    out.execute("INSERT OR REPLACE INTO meta VALUES ('last_ingest_file', ?)", (str(path),))
    out.commit()
    return n
