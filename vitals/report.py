"""Markdown report from the `daily` and `workout_metrics` tables."""
from __future__ import annotations

import sqlite3

import pandas as pd

DAILY_COLS = ["date", "recovery", "recovery_band", "rhr", "hrv_night_ms", "spo2_night_min", "sleep_asleep_min",
              "sleep_performance", "sleep_efficiency", "strain", "trimp", "steps", "kcal_hr", "ctl", "atl", "tsb",
              "acwr", "hr_coverage_pct"]
WO_COLS = ["start", "type", "duration_min", "hr_avg", "hr_max", "pct_hrmax_avg", "z1", "z2", "z3", "z4", "z5",
           "trimp", "strain", "kcal_hr", "kcal_device", "hrr_1min"]


def _table(df: pd.DataFrame, cols: list[str]) -> str:
    cols = [c for c in cols if c in df.columns]
    if df.empty or not cols:
        return "_no rows_\n"
    d = df[cols].copy()
    for c in d.columns:
        if d[c].dtype.kind == "f":
            d[c] = d[c].map(lambda v: "" if pd.isna(v) else (f"{v:.0f}" if abs(v) >= 100 else f"{v:g}"))
    d = d.fillna("")
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join("---" for _ in cols) + "|"]
    lines += ["| " + " | ".join(str(v) for v in r) + " |" for r in d.itertuples(index=False)]
    return "\n".join(lines) + "\n"


def today_card(con: sqlite3.Connection) -> str:
    d = pd.read_sql_query("SELECT * FROM daily ORDER BY date DESC LIMIT 1", con)
    if d.empty:
        return "no daily rows yet\n"
    r = d.iloc[0]
    g = lambda k, f="{}": ("" if k not in r or pd.isna(r[k]) else f.format(r[k]))  # noqa: E731
    lines = [
        f"# {r['date']}",
        "",
        f"- Recovery: **{g('recovery', '{:.0f}')}** ({g('recovery_band')})  RHR {g('rhr', '{:.0f}')} bpm"
        f" (30d median {g('rhr_base30', '{:.0f}')}, method {g('rhr_method')})",
        f"- Sleep: {g('sleep_asleep_min', '{:.0f}')} min asleep / {g('sleep_tib_min', '{:.0f}')} in bed"
        f" ({g('sleep_start')}–{g('sleep_end')}), efficiency {g('sleep_efficiency', '{:.0f}')}%,"
        f" need {g('sleep_need_min', '{:.0f}')} min, performance {g('sleep_performance', '{:.0f}')}%,"
        f" 7d debt {g('sleep_debt7_h')} h",
        f"- Stages: light {g('sleep_light_min', '{:.0f}')} / deep {g('sleep_deep_min', '{:.0f}')}"
        f" / REM {g('sleep_rem_min', '{:.0f}')} / awake {g('sleep_awake_min', '{:.0f}')} min",
        f"- SpO2 overnight: mean {g('spo2_night_mean')}%, min {g('spo2_night_min')}%",
        f"- Strain: **{g('strain')}** / 21, TRIMP {g('trimp', '{:.0f}')}, zones z1-z5 min:"
        f" {g('z1', '{:.0f}')}/{g('z2', '{:.0f}')}/{g('z3', '{:.0f}')}/{g('z4', '{:.0f}')}/{g('z5', '{:.0f}')}",
        f"- Fitness: CTL {g('ctl')}  ATL {g('atl')}  TSB {g('tsb')}  ACWR {g('acwr')}  VO2max~{g('vo2max_uth')}",
        f"- Activity: {g('steps')} steps, HR-kcal {g('kcal_hr', '{:.0f}')}, device active kcal"
        f" {g('kcal_active_device', '{:.0f}')}, HR coverage {g('hr_coverage_pct')}% of the day",
        "",
    ]
    return "\n".join(lines)


def report(con: sqlite3.Connection, days: int = 14) -> str:
    daily = pd.read_sql_query(f"SELECT * FROM daily ORDER BY date DESC LIMIT {int(days)}", con)
    wo = pd.read_sql_query(f"SELECT * FROM workout_metrics ORDER BY start DESC LIMIT {int(days) * 2}", con)
    out = [today_card(con), f"## Last {days} days", "", _table(daily, DAILY_COLS), "## Workouts", "",
           _table(wo, WO_COLS)]
    if len(daily) >= 7:
        m = daily.head(7).mean(numeric_only=True)
        out += ["## 7-day means", "",
                f"recovery {m.get('recovery', float('nan')):.0f}, RHR {m.get('rhr', float('nan')):.1f},"
                f" sleep {m.get('sleep_asleep_min', float('nan')):.0f} min, strain {m.get('strain', float('nan')):.1f},"
                f" TRIMP {m.get('trimp', float('nan')):.0f}/day, steps {m.get('steps', float('nan')):.0f}", ""]
    return "\n".join(out)
