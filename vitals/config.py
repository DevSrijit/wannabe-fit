"""Load config.yaml and resolve paths relative to the project root."""
from __future__ import annotations

import datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULTS = {
    "profile": {
        "sex": "male",
        "birth_year": 1990,
        "height_cm": 175,
        "weight_kg": 75,
        "hr_max": None,
        "sleep_need_base_h": 8.0,
    },
    "timezone": "UTC",
    "paths": {"inbox": "data/inbox", "db": "data/vitals.db", "reports": "data/reports"},
    "rclone": {"remote_path": None},
    "zones": {
        "z1": [0.50, 0.60],
        "z2": [0.60, 0.70],
        "z3": [0.70, 0.80],
        "z4": [0.80, 0.90],
        "z5": [0.90, 1.01],
    },
    "hr_sample_cap_s": 600,
    "ignore_workout_sources": [],
    "autodetect_workout_sources": ["Fit", "Google Play services"],
}


def _merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


class Config:
    def __init__(self, path: Path | None = None):
        self.path = path or ROOT / "config.yaml"
        raw = {}
        if self.path.exists():
            raw = yaml.safe_load(self.path.read_text()) or {}
        self.data = _merge(DEFAULTS, raw)

    @property
    def profile(self) -> dict:
        return self.data["profile"]

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.data["timezone"])

    def _path(self, key: str) -> Path:
        p = Path(self.data["paths"][key])
        return p if p.is_absolute() else ROOT / p

    @property
    def inbox(self) -> Path:
        return self._path("inbox")

    @property
    def db_path(self) -> Path:
        return self._path("db")

    @property
    def reports_dir(self) -> Path:
        return self._path("reports")

    @property
    def zones(self) -> dict:
        return self.data["zones"]

    @property
    def hr_sample_cap_s(self) -> int:
        return int(self.data["hr_sample_cap_s"])

    @property
    def rclone_remote(self) -> str | None:
        return self.data["rclone"].get("remote_path")

    def age(self, on: dt.date | None = None) -> int:
        on = on or dt.date.today()
        return on.year - int(self.profile["birth_year"])

    def hr_max(self) -> float:
        if self.profile.get("hr_max"):
            return float(self.profile["hr_max"])
        return 208.0 - 0.7 * self.age()
