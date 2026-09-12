"""Build a synthetic health_connect_export.db with the real Health Connect table layout.

Used to test the pipeline before the first real export lands. 35 days: nightly sleep with stages, 24/7 HR
every 5 min, 4 workouts a week with 1-second HR, nightly SpO2, hourly steps, weight.
Usage: uv run python scripts/make_fixture.py /tmp/fixture.zip && uv run vitals ingest /tmp/fixture.zip
Do not put the fixture in data/inbox: `vitals sync` would mix synthetic rows into the real database.
"""
from __future__ import annotations

import datetime as dt
import math
import random
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path
from zoneinfo import ZoneInfo

random.seed(7)
TZ = ZoneInfo("Asia/Kolkata")
OFF = 19800
out = Path(sys.argv[1] if len(sys.argv) > 1 else "fixture_health_connect_export.zip")

tmp = Path(tempfile.mkdtemp())
dbf = tmp / "health_connect_export.db"
con = sqlite3.connect(dbf)
con.executescript("""
CREATE TABLE application_info_table (row_id INTEGER PRIMARY KEY, package_name TEXT, app_name TEXT, app_icon BLOB, record_types_used TEXT);
CREATE TABLE heart_rate_record_table (row_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid BLOB, app_info_id INTEGER, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, end_zone_offset INTEGER, last_modified_time INTEGER);
CREATE TABLE heart_rate_record_series_table (parent_key INTEGER, epoch_millis INTEGER, beats_per_minute INTEGER);
CREATE TABLE oxygen_saturation_record_table (row_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid BLOB, app_info_id INTEGER, time INTEGER, zone_offset INTEGER, percentage REAL);
CREATE TABLE steps_record_table (row_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid BLOB, app_info_id INTEGER, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, end_zone_offset INTEGER, count INTEGER);
CREATE TABLE active_calories_burned_record_table (row_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid BLOB, app_info_id INTEGER, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, end_zone_offset INTEGER, energy REAL);
CREATE TABLE sleep_session_record_table (row_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid BLOB, app_info_id INTEGER, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, end_zone_offset INTEGER, title TEXT, notes TEXT);
CREATE TABLE sleep_stages_table (parent_key INTEGER, stage_start_time INTEGER, stage_end_time INTEGER, stage_type INTEGER);
CREATE TABLE exercise_session_record_table (row_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid BLOB, app_info_id INTEGER, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, end_zone_offset INTEGER, exercise_type INTEGER, title TEXT, notes TEXT, has_route INTEGER);
CREATE TABLE weight_record_table (row_id INTEGER PRIMARY KEY AUTOINCREMENT, uuid BLOB, app_info_id INTEGER, time INTEGER, zone_offset INTEGER, weight REAL);
""")
con.execute("INSERT INTO application_info_table VALUES (1, 'com.nothing.smartcenter', 'Nothing X', NULL, NULL)")
ms = lambda d: int(d.timestamp() * 1000)  # noqa: E731
uid = lambda: random.randbytes(16)  # noqa: E731

today = dt.datetime.now(TZ).replace(hour=0, minute=0, second=0, microsecond=0)
start_day = today - dt.timedelta(days=35)
hr_rows, series = [], []
day = start_day
weight = 108.0
while day < today:
    d = (day - start_day).days
    fatigue = 1.0 + 0.15 * math.sin(d / 5.0)
    # sleep 00:45 -> 08:30 next morning, assigned to wake date
    s0 = day + dt.timedelta(hours=0, minutes=45 + random.randint(-30, 40))
    s1 = day + dt.timedelta(hours=8, minutes=30 + random.randint(-40, 40))
    cur = con.execute("INSERT INTO sleep_session_record_table (uuid, app_info_id, start_time, end_time, start_zone_offset, end_zone_offset, title) VALUES (?,1,?,?,?,?,?)",
                      (uid(), ms(s0), ms(s1), OFF, OFF, "Sleep"))
    sid = cur.lastrowid
    t = s0
    while t < s1:
        length = dt.timedelta(minutes=random.randint(10, 40))
        stage = random.choices([4, 5, 6, 1], weights=[55, 20, 20, 5])[0]
        con.execute("INSERT INTO sleep_stages_table VALUES (?,?,?,?)", (sid, ms(t), ms(min(t + length, s1)), stage))
        t += length
    # 24/7 HR every 5 min
    rec = con.execute("INSERT INTO heart_rate_record_table (uuid, app_info_id, start_time, end_time, start_zone_offset, end_zone_offset) VALUES (?,1,?,?,?,?)",
                      (uid(), ms(day), ms(day + dt.timedelta(days=1)), OFF, OFF)).lastrowid
    t = day
    while t < day + dt.timedelta(days=1):
        h = t.hour + t.minute / 60
        base = 58 * fatigue if (s0 <= t <= s1) else (80 if 9 <= h <= 23 else 68)
        series.append((rec, ms(t), int(random.gauss(base, 4))))
        t += dt.timedelta(minutes=5)
    # SpO2 nightly every 30 min
    t = s0
    while t < s1:
        con.execute("INSERT INTO oxygen_saturation_record_table (uuid, app_info_id, time, zone_offset, percentage) VALUES (?,1,?,?,?)",
                    (uid(), ms(t), OFF, round(random.gauss(96.5, 1.0), 1)))
        t += dt.timedelta(minutes=30)
    # steps hourly
    for h in range(9, 24):
        st = day + dt.timedelta(hours=h)
        con.execute("INSERT INTO steps_record_table (uuid, app_info_id, start_time, end_time, start_zone_offset, end_zone_offset, count) VALUES (?,1,?,?,?,?,?)",
                    (uid(), ms(st), ms(st + dt.timedelta(hours=1)), OFF, OFF, random.randint(200, 900)))
    # workouts: Mon/Tue/Thu/Fri strength 60 min, Sat run 30 min
    wd = day.weekday()
    if wd in (0, 1, 3, 4, 5):
        w0 = day + dt.timedelta(hours=18, minutes=random.randint(0, 40))
        run = wd == 5
        dur = 30 if run else 60
        w1 = w0 + dt.timedelta(minutes=dur)
        con.execute("INSERT INTO exercise_session_record_table (uuid, app_info_id, start_time, end_time, start_zone_offset, end_zone_offset, exercise_type, title, has_route) VALUES (?,1,?,?,?,?,?,?,0)",
                    (uid(), ms(w0), ms(w1), OFF, OFF, 33 if run else 45, "Run" if run else "Upper/Lower"))
        wrec = con.execute("INSERT INTO heart_rate_record_table (uuid, app_info_id, start_time, end_time, start_zone_offset, end_zone_offset) VALUES (?,1,?,?,?,?)",
                           (uid(), ms(w0), ms(w1 + dt.timedelta(minutes=3)), OFF, OFF)).lastrowid
        t = w0
        while t < w1 + dt.timedelta(minutes=3):
            frac = (t - w0).total_seconds() / (dur * 60)
            if t > w1:
                base = 150 - 40 * min(1.0, (t - w1).total_seconds() / 120)
            elif run:
                base = 120 + 45 * min(1.0, frac * 4) + 8 * math.sin(frac * 20)
            else:
                base = 110 + 35 * abs(math.sin(frac * 30))
            series.append((wrec, ms(t), int(random.gauss(base, 3))))
            t += dt.timedelta(seconds=1)
        con.execute("INSERT INTO active_calories_burned_record_table (uuid, app_info_id, start_time, end_time, start_zone_offset, end_zone_offset, energy) VALUES (?,1,?,?,?,?,?)",
                    (uid(), ms(w0), ms(w1), OFF, OFF, (320 if run else 280) * 1000.0))
    if d % 3 == 0:
        weight -= 0.25
        con.execute("INSERT INTO weight_record_table (uuid, app_info_id, time, zone_offset, weight) VALUES (?,1,?,?,?)",
                    (uid(), ms(day + dt.timedelta(hours=9)), OFF, weight * 1000.0))
    day += dt.timedelta(days=1)
con.executemany("INSERT INTO heart_rate_record_series_table VALUES (?,?,?)", series)
con.commit()
con.close()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(dbf, "health_connect_export.db")
print(f"wrote {out} ({len(series)} hr samples)")
