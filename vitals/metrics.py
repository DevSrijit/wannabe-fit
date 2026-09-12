"""Daily and per-workout metrics. Whoop-style scores computed from raw HR, sleep, and SpO2 samples.

Formulas (all documented in README.md):
- HR max: config override, else Tanaka 208 - 0.7*age.
- Resting HR: lowest 15-minute mean of HR inside the main sleep session (fallbacks listed in `_rhr`).
- Zones: Karvonen heart-rate-reserve fractions from config.
- TRIMP (Banister 1991): sum(dt_min * f * 0.64 * e^(1.92 f)) for men, 0.86 * e^(1.67 f) for women,
  over samples with f >= 0.30 only (sedentary time carries no load).
- Edwards TRIMP: sum(zone_i minutes * i).
- Strain (0-21, Whoop-like): 21 * (1 - exp(-L / 155)), L = sum(zone_i minutes * i).
- HR calories (Keytel 2005): per-minute kcal from HR, weight, age, sex; only while f >= 0.30.
- PMC (Banister impulse-response): CTL 42-day EWMA, ATL 7-day EWMA, TSB = CTL - ATL, ACWR = 7d / 28d.
- Sleep need: base + 1h * (strain_prev / 21) + min(1h, 0.5 * 7-day debt).
- Recovery (0-100): 50% RHR z-score, 35% sleep performance, 15% overnight SpO2; HRV added when present.
- VO2max (Uth 2004): 15.3 * HRmax / RHR.
"""
from __future__ import annotations

import datetime as dt
import math
import sqlite3

import numpy as np
import pandas as pd

from .config import Config
from .db import ASLEEP_STAGES

ZONE_KEYS = ["z1", "z2", "z3", "z4", "z5"]


def _df(con: sqlite3.Connection, sql: str) -> pd.DataFrame:
    return pd.read_sql_query(sql, con)


def _localize(df: pd.DataFrame, col: str, tz) -> pd.Series:
    return pd.to_datetime(df[col], unit="ms", utc=True).dt.tz_convert(tz)


def _hr_with_dt(hr: pd.DataFrame, cap_s: int) -> pd.DataFrame:
    hr = hr.sort_values("ts").reset_index(drop=True)
    gap = hr["ts"].diff().shift(-1) / 1000.0
    gap = gap.fillna(60.0).clip(lower=1.0, upper=cap_s)
    hr["dt_s"] = gap
    return hr


def _rhr(sleep_win: tuple[int, int] | None, day_hr: pd.DataFrame, night_hr: pd.DataFrame,
         rhr_device: float | None) -> tuple[float | None, str]:
    """Lowest 15-min mean HR while asleep. Returns (bpm, method)."""
    for frame, label in ((night_hr, "sleep_15min_min"), (day_hr, "day_15min_min")):
        if len(frame) >= 5:
            s = frame.set_index("t")["bpm"].resample("5min").mean().dropna()
            if len(s) >= 3:
                r = s.rolling(3, min_periods=2).mean().dropna()
                if len(r):
                    return float(r.min()), label
    if rhr_device is not None:
        return float(rhr_device), "device"
    if len(day_hr):
        return float(np.percentile(day_hr["bpm"], 5)), "day_p5"
    return None, "none"


def _keytel(bpm: np.ndarray, weight: float, age: float, male: bool) -> np.ndarray:
    if male:
        return (-55.0969 + 0.6309 * bpm + 0.1988 * weight + 0.2017 * age) / 4.184
    return (-20.4022 + 0.4472 * bpm - 0.1263 * weight + 0.074 * age) / 4.184


def _hr_block_metrics(frame: pd.DataFrame, rhr_ref: float, hr_max: float, cfg: Config, weight: float,
                      age: float) -> dict:
    """Zone minutes, TRIMP variants, strain, HR kcal for a set of HR samples with dt_s."""
    out = {k: 0.0 for k in ZONE_KEYS}
    out.update({"z0": 0.0, "trimp": 0.0, "trimp_edwards": 0.0, "strain": 0.0, "kcal_hr": 0.0,
                "hr_avg": None, "hr_max": None, "hr_samples": int(len(frame)), "hr_minutes": 0.0})
    if frame.empty:
        return out
    hrr = max(hr_max - rhr_ref, 30.0)
    f = ((frame["bpm"].to_numpy(float) - rhr_ref) / hrr).clip(0.0, 1.0)
    mins = frame["dt_s"].to_numpy(float) / 60.0
    out["hr_minutes"] = round(float(mins.sum()), 1)
    # Sedentary samples (below 30% of heart-rate reserve) carry no training load. Without this gate a
    # 16-hour day at 80 bpm scores like a workout.
    mins = np.where(f >= 0.30, mins, 0.0)
    zones = cfg.zones
    load = 0.0
    for i, k in enumerate(ZONE_KEYS, start=1):
        lo, hi = zones[k]
        m = float(mins[(f >= lo) & (f < hi)].sum())
        out[k] = round(m, 1)
        out["trimp_edwards"] += m * i
        load += m * i
    out["z0"] = round(float(mins[f < zones["z1"][0]].sum()), 1)
    male = str(cfg.profile.get("sex", "male")).lower().startswith("m")
    w = (0.64 * np.exp(1.92 * f)) if male else (0.86 * np.exp(1.67 * f))
    out["trimp"] = round(float((mins * f * w).sum()), 1)
    out["trimp_edwards"] = round(out["trimp_edwards"], 1)
    out["strain"] = round(21.0 * (1.0 - math.exp(-load / 155.0)), 1)
    active = f >= 0.30
    kcal = _keytel(frame["bpm"].to_numpy(float)[active], weight, age, male) * mins[active]
    out["kcal_hr"] = round(float(kcal.clip(min=0).sum()), 0)
    out["hr_avg"] = round(float(frame["bpm"].mean()), 1)
    out["hr_max"] = int(frame["bpm"].max())
    return out


def _sum_by_best_source(df: pd.DataFrame, col: str) -> float:
    """Several apps may write overlapping totals for the same day. Take the largest single-source total."""
    if df.empty:
        return 0.0
    return float(df.groupby("source")[col].sum().max())


def compute(con: sqlite3.Connection, cfg: Config) -> tuple[pd.DataFrame, pd.DataFrame]:
    tz = cfg.tz
    hr_max = cfg.hr_max()
    male = str(cfg.profile.get("sex", "male")).lower().startswith("m")

    hr = _df(con, "SELECT ts, bpm FROM hr")
    if hr.empty:
        raise SystemExit("no heart-rate samples in the database. Run `vitals ingest` first.")
    hr = _hr_with_dt(hr, cfg.hr_sample_cap_s)
    hr["t"] = _localize(hr, "ts", tz)
    hr["date"] = hr["t"].dt.date

    spo2 = _df(con, "SELECT ts, pct FROM spo2")
    spo2["t"] = _localize(spo2, "ts", tz) if len(spo2) else pd.Series(dtype="datetime64[ns, UTC]")
    hrv = _df(con, "SELECT ts, rmssd_ms FROM hrv")
    hrv["t"] = _localize(hrv, "ts", tz) if len(hrv) else pd.Series(dtype="datetime64[ns, UTC]")
    rhr_dev = _df(con, "SELECT ts, bpm FROM rhr_device")
    rhr_dev["date"] = _localize(rhr_dev, "ts", tz).dt.date if len(rhr_dev) else pd.Series(dtype=object)
    weight = _df(con, "SELECT ts, kg FROM weight ORDER BY ts")
    steps = _df(con, 'SELECT start, count, source FROM steps')
    steps["date"] = _localize(steps, "start", tz).dt.date if len(steps) else pd.Series(dtype=object)
    cal = _df(con, 'SELECT start, kcal, kind, source FROM calories')
    cal["date"] = _localize(cal, "start", tz).dt.date if len(cal) else pd.Series(dtype=object)
    dist = _df(con, 'SELECT start, meters, source FROM distance')
    dist["date"] = _localize(dist, "start", tz).dt.date if len(dist) else pd.Series(dtype=object)
    sessions = _df(con, 'SELECT id, start, "end" FROM sleep_sessions')
    stages = _df(con, 'SELECT session_id, start, "end", stage FROM sleep_stages')
    workouts = _df(con, 'SELECT id, start, "end", type_name, title, source FROM workouts ORDER BY start')
    ignore = set(cfg.data.get("ignore_workout_sources") or [])
    if ignore and len(workouts):
        workouts = workouts[~workouts["source"].isin(ignore)]
    auto = set(cfg.data.get("autodetect_workout_sources") or [])
    if auto and len(workouts):
        tracked = workouts[~workouts["source"].isin(auto)]
        keep = []
        for _, w in workouts.iterrows():
            if w["source"] not in auto:
                keep.append(True)
                continue
            ov = (np.minimum(tracked["end"], w["end"]) - np.maximum(tracked["start"], w["start"])).clip(lower=0)
            keep.append(bool((ov <= 0.5 * (w["end"] - w["start"])).all()) if len(tracked) else True)
        workouts = workouts[keep]

    if len(sessions):
        sessions["wake_date"] = _localize(sessions, "end", tz).dt.date
        sessions["dur_min"] = (sessions["end"] - sessions["start"]) / 60000.0

    def weight_on(day: dt.date) -> float:
        if len(weight):
            ts = int(dt.datetime.combine(day, dt.time.max, tz).timestamp() * 1000)
            w = weight[weight["ts"] <= ts]
            if len(w):
                return float(w.iloc[-1]["kg"])
        return float(cfg.profile["weight_kg"])

    days = pd.date_range(hr["date"].min(), hr["date"].max(), freq="D").date
    rows = []
    for day in days:
        age = day.year - int(cfg.profile["birth_year"])
        day_hr = hr[hr["date"] == day]
        row: dict = {"date": day.isoformat()}
        # --- sleep ---
        main = None
        night_hr = day_hr.iloc[0:0]
        if len(sessions):
            cand = sessions[sessions["wake_date"] == day]
            if len(cand):
                main = cand.sort_values("dur_min").iloc[-1]
        if main is not None:
            st = stages[stages["session_id"] == main["id"]]
            tib = float(main["dur_min"])
            if len(st):
                st_min = (st["end"] - st["start"]) / 60000.0
                asleep = float(st_min[st["stage"].isin(ASLEEP_STAGES)].sum())
                row.update({
                    "sleep_light_min": round(float(st_min[st["stage"] == 4].sum()), 1),
                    "sleep_deep_min": round(float(st_min[st["stage"] == 5].sum()), 1),
                    "sleep_rem_min": round(float(st_min[st["stage"] == 6].sum()), 1),
                    "sleep_awake_min": round(float(st_min[st["stage"].isin([1, 3, 7])].sum()), 1),
                    "sleep_awakenings": int((st["stage"].isin([1, 7])).sum()),
                })
            else:
                asleep = tib
            row.update({
                "sleep_start": pd.Timestamp(main["start"], unit="ms", tz="UTC").tz_convert(tz).strftime("%H:%M"),
                "sleep_end": pd.Timestamp(main["end"], unit="ms", tz="UTC").tz_convert(tz).strftime("%H:%M"),
                "sleep_tib_min": round(tib, 1),
                "sleep_asleep_min": round(asleep, 1),
                "sleep_efficiency": round(100.0 * asleep / tib, 1) if tib else None,
            })
            night_hr = hr[(hr["ts"] >= main["start"]) & (hr["ts"] <= main["end"])]
            if len(spo2):
                ns = spo2[(spo2["ts"] >= main["start"]) & (spo2["ts"] <= main["end"])]
                if len(ns):
                    row["spo2_night_mean"] = round(float(ns["pct"].mean()), 1)
                    row["spo2_night_min"] = round(float(ns["pct"].min()), 1)
            if len(hrv):
                nh = hrv[(hrv["ts"] >= main["start"]) & (hrv["ts"] <= main["end"])]
                if len(nh):
                    row["hrv_night_ms"] = round(float(nh["rmssd_ms"].mean()), 1)
        # --- resting HR ---
        dev = rhr_dev[rhr_dev["date"] == day]["bpm"] if len(rhr_dev) else pd.Series(dtype=float)
        rhr, method = _rhr(None, day_hr, night_hr, float(dev.iloc[-1]) if len(dev) else None)
        row["rhr"] = round(rhr, 1) if rhr is not None else None
        row["rhr_method"] = method
        # --- daily HR load ---
        if len(spo2):
            ds = spo2[spo2["t"].dt.date == day]
            if len(ds):
                row["spo2_day_mean"] = round(float(ds["pct"].mean()), 1)
        row["weight_kg"] = weight_on(day)
        row["steps"] = int(_sum_by_best_source(steps[steps["date"] == day], "count")) if len(steps) else 0
        if len(cal):
            row["kcal_active_device"] = round(_sum_by_best_source(cal[(cal["date"] == day) & (cal["kind"] == "active")], "kcal"))
            row["kcal_total_device"] = round(_sum_by_best_source(cal[(cal["date"] == day) & (cal["kind"] == "total")], "kcal"))
        if len(dist):
            row["distance_km"] = round(_sum_by_best_source(dist[dist["date"] == day], "meters") / 1000.0, 2)
        row["_day_hr"] = day_hr  # kept for the second pass
        rows.append(row)

    daily = pd.DataFrame(rows)
    # --- baselines (rolling, trailing) ---
    daily["rhr_base30"] = daily["rhr"].rolling(30, min_periods=3).median().shift(1)
    daily["rhr_sd30"] = daily["rhr"].rolling(30, min_periods=5).std().shift(1)
    daily["rhr_base30"] = daily["rhr_base30"].fillna(daily["rhr"])
    if "hrv_night_ms" in daily:
        daily["hrv_base30"] = daily["hrv_night_ms"].rolling(30, min_periods=3).median().shift(1)
        daily["hrv_sd30"] = daily["hrv_night_ms"].rolling(30, min_periods=5).std().shift(1)

    # --- second pass: zones, TRIMP, strain, kcal (need a stable RHR reference) ---
    block_rows = []
    for i, r in daily.iterrows():
        ref = r["rhr_base30"] if pd.notna(r["rhr_base30"]) else (r["rhr"] if pd.notna(r["rhr"]) else 60.0)
        age = dt.date.fromisoformat(r["date"]).year - int(cfg.profile["birth_year"])
        block_rows.append(_hr_block_metrics(r["_day_hr"], float(ref), hr_max, cfg, float(r["weight_kg"]), age))
    daily = pd.concat([daily.drop(columns=["_day_hr"]), pd.DataFrame(block_rows)], axis=1)
    daily["hr_max_used"] = round(hr_max, 1)
    daily["hr_coverage_pct"] = (daily["hr_minutes"] / 1440.0 * 100.0).round(1)

    # --- PMC ---
    ctl = atl = 0.0
    ctls, atls, tsbs = [], [], []
    for t in daily["trimp"].fillna(0.0):
        tsbs.append(round(ctl - atl, 1))
        ctl += (t - ctl) / 42.0
        atl += (t - atl) / 7.0
        ctls.append(round(ctl, 1))
        atls.append(round(atl, 1))
    daily["ctl"], daily["atl"], daily["tsb"] = ctls, atls, tsbs
    acute = daily["trimp"].rolling(7, min_periods=1).mean()
    chronic = daily["trimp"].rolling(28, min_periods=7).mean()
    daily["acwr"] = (acute / chronic.replace(0, np.nan)).round(2)

    # --- sleep need, performance, debt, consistency ---
    base = float(cfg.profile["sleep_need_base_h"]) * 60.0
    asleep = daily.get("sleep_asleep_min", pd.Series([np.nan] * len(daily)))
    debt7 = (base - asleep).clip(lower=0).fillna(0).rolling(7, min_periods=1).sum().shift(1).fillna(0)
    strain_prev = daily["strain"].shift(1).fillna(0)
    need = base + 60.0 * (strain_prev / 21.0) + np.minimum(60.0, 0.5 * debt7)
    daily["sleep_need_min"] = need.round(0)
    daily["sleep_debt7_h"] = (debt7 / 60.0).round(1)
    daily["sleep_performance"] = (100.0 * asleep / need).clip(upper=100).round(0)
    if "sleep_start" in daily:
        def _mins(s):
            if pd.isna(s):
                return np.nan
            h, m = map(int, s.split(":"))
            return h * 60 + m

        def _circ_sd(win: pd.Series) -> float:
            # Clock times wrap at midnight, so use the circular standard deviation. A 23:30 and a
            # 00:30 bedtime are one hour apart, and so are 11:50 and 12:50 wake times.
            v = win.dropna().to_numpy(float)
            if len(v) < 3:
                return np.nan
            theta = v / 1440.0 * 2.0 * np.pi
            r = float(np.hypot(np.cos(theta).mean(), np.sin(theta).mean()))
            if r <= 0:
                return 720.0
            return float(np.sqrt(-2.0 * np.log(min(r, 1.0))) * 1440.0 / (2.0 * np.pi))

        bed = daily["sleep_start"].map(_mins)
        wake = daily["sleep_end"].map(_mins)
        sd = (bed.rolling(7, min_periods=3).apply(_circ_sd, raw=False)
              + wake.rolling(7, min_periods=3).apply(_circ_sd, raw=False)) / 2.0
        daily["sleep_consistency"] = (100.0 - sd / 60.0 * 25.0).clip(0, 100).round(0)

    # --- recovery ---
    z = (daily["rhr"] - daily["rhr_base30"]) / daily["rhr_sd30"].fillna(3.0).clip(lower=1.5)
    rhr_comp = (70.0 - 20.0 * z).clip(0, 100)
    sleep_comp = daily["sleep_performance"]
    spo2_min = daily.get("spo2_night_min", pd.Series([np.nan] * len(daily)))
    spo2_comp = ((spo2_min - 88.0) / 7.0 * 100.0).clip(0, 100)
    parts = [(rhr_comp, 0.50), (sleep_comp, 0.35), (spo2_comp, 0.15)]
    if "hrv_night_ms" in daily and daily["hrv_night_ms"].notna().any():
        zh = (daily["hrv_night_ms"] - daily["hrv_base30"]) / daily["hrv_sd30"].fillna(8.0).clip(lower=3.0)
        hrv_comp = (65.0 + 20.0 * zh).clip(0, 100)
        parts = [(hrv_comp, 0.40), (rhr_comp, 0.25), (sleep_comp, 0.25), (spo2_comp, 0.10)]
    num = sum(p.fillna(0) * w for p, w in parts)
    den = sum(p.notna() * w for p, w in parts)
    daily["recovery"] = (num / den.replace(0, np.nan)).round(0)
    daily["recovery_band"] = pd.cut(daily["recovery"], [-1, 33, 66, 101], labels=["red", "yellow", "green"]).astype(str)
    daily.loc[daily["recovery"].isna(), "recovery_band"] = None
    daily["vo2max_uth"] = (15.3 * hr_max / daily["rhr_base30"]).round(1)

    # --- workouts ---
    wrows = []
    for _, w in workouts.iterrows():
        seg = hr[(hr["ts"] >= w["start"]) & (hr["ts"] <= w["end"])].copy()
        day = pd.Timestamp(w["start"], unit="ms", tz="UTC").tz_convert(tz).date()
        drow = daily[daily["date"] == day.isoformat()]
        ref = float(drow["rhr_base30"].iloc[0]) if len(drow) and pd.notna(drow["rhr_base30"].iloc[0]) else 60.0
        wt = float(drow["weight_kg"].iloc[0]) if len(drow) else weight_on(day)
        age = day.year - int(cfg.profile["birth_year"])
        if len(seg):
            seg["dt_s"] = seg["dt_s"].clip(upper=60.0)
        m = _hr_block_metrics(seg, ref, hr_max, cfg, wt, age)
        dur = (w["end"] - w["start"]) / 60000.0
        rec = {
            "id": w["id"], "date": day.isoformat(), "source": w["source"],
            "start": pd.Timestamp(w["start"], unit="ms", tz="UTC").tz_convert(tz).strftime("%Y-%m-%d %H:%M"),
            "type": w["type_name"], "title": w["title"], "duration_min": round(dur, 1),
            "hr_avg": m["hr_avg"], "hr_max": m["hr_max"], "hr_samples": m["hr_samples"],
            "pct_hrmax_avg": round(100.0 * m["hr_avg"] / hr_max, 0) if m["hr_avg"] else None,
            **{k: m[k] for k in ZONE_KEYS},
            "trimp": m["trimp"], "trimp_edwards": m["trimp_edwards"], "strain": m["strain"], "kcal_hr": m["kcal_hr"],
        }
        # 1-minute heart-rate recovery: HR at the end minus HR 60 s after the end.
        tail = hr[(hr["ts"] >= w["end"] - 15000) & (hr["ts"] <= w["end"])]
        after = hr[(hr["ts"] >= w["end"] + 50000) & (hr["ts"] <= w["end"] + 75000)]
        if len(tail) and len(after):
            rec["hrr_1min"] = round(float(tail["bpm"].mean() - after["bpm"].mean()), 0)
        if len(cal):
            c = cal[(cal["start"] >= w["start"]) & (cal["start"] <= w["end"])]
            if len(c):
                rec["kcal_device"] = round(_sum_by_best_source(c, "kcal"))
        if len(dist):
            d = dist[(dist["start"] >= w["start"]) & (dist["start"] <= w["end"])]
            if len(d):
                rec["distance_km"] = round(_sum_by_best_source(d, "meters") / 1000.0, 2)
        wrows.append(rec)
    wdf = pd.DataFrame(wrows)

    daily.to_sql("daily", con, if_exists="replace", index=False)
    wdf.to_sql("workout_metrics", con, if_exists="replace", index=False)
    con.execute("INSERT OR REPLACE INTO meta VALUES ('last_compute', ?)", (dt.datetime.now(tz).isoformat(),))
    con.commit()
    return daily, wdf
