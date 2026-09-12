"""`vitals` command line."""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import shutil
import subprocess
import sys
from pathlib import Path

from . import db as vdb
from .config import Config


def _newest_export(inbox: Path) -> Path | None:
    cands = [p for p in inbox.glob("*") if p.suffix.lower() in (".zip", ".db") and p.is_file()]
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def _ingest_path(cfg: Config, path: Path) -> dict:
    con = vdb.connect(cfg.db_path)
    try:
        is_takeout = False
        if path.suffix.lower() == ".zip":
            import zipfile
            with zipfile.ZipFile(path) as z:
                names = z.namelist()
                is_takeout = any("/Fit/" in n for n in names) and not any(n.endswith(".db") for n in names)
        elif path.is_dir() or path.suffix.lower() == ".json":
            is_takeout = True
        if is_takeout:
            from . import ingest_takeout
            n = ingest_takeout.ingest(path, con)
        else:
            from . import ingest_hc
            n = ingest_hc.ingest(path, con)
        return n
    finally:
        con.close()


def cmd_ingest(cfg: Config, args) -> None:
    path = Path(args.path).expanduser() if args.path else _newest_export(cfg.inbox)
    if not path or not path.exists():
        sys.exit(f"nothing to ingest. Drop a Health Connect zip into {cfg.inbox} or pass a path.")
    n = _ingest_path(cfg, path)
    print(f"ingested {path.name}:")
    for k, v in n.items():
        print(f"  {k}: {v} rows")
    con = vdb.connect(cfg.db_path)
    print("db totals:", {k: v for k, v in vdb.counts(con).items() if v})
    con.close()


def cmd_doctor(cfg: Config, args) -> None:
    path = Path(args.path).expanduser() if args.path else _newest_export(cfg.inbox)
    print(f"config: {cfg.path}")
    print(f"db: {cfg.db_path} ({'exists' if cfg.db_path.exists() else 'missing'})")
    print(f"inbox: {cfg.inbox} newest export: {path}")
    print(f"hr_max used: {cfg.hr_max():.1f} (age {cfg.age()})")
    if path and path.suffix.lower() in (".zip", ".db") and path.exists():
        from . import ingest_hc
        try:
            print("\n".join(ingest_hc.describe(path)))
        except Exception as e:  # noqa: BLE001
            print(f"could not read as Health Connect export: {e}")
    if cfg.db_path.exists():
        con = vdb.connect(cfg.db_path)
        print("db totals:", {k: v for k, v in vdb.counts(con).items() if v})
        rng = con.execute("SELECT MIN(ts), MAX(ts), COUNT(*) FROM hr").fetchone()
        if rng[2]:
            tz = cfg.tz
            a = dt.datetime.fromtimestamp(rng[0] / 1000, tz)
            b = dt.datetime.fromtimestamp(rng[1] / 1000, tz)
            print(f"hr range: {a:%Y-%m-%d %H:%M} .. {b:%Y-%m-%d %H:%M} ({rng[2]} samples)")
            gaps = [r[0] for r in con.execute(
                "SELECT (ts - LAG(ts) OVER (ORDER BY ts)) / 1000.0 FROM hr ORDER BY ts DESC LIMIT 5000")]
            gaps = sorted(g for g in gaps if g is not None and g > 0)
            if gaps:
                med = gaps[len(gaps) // 2]
                print(f"recent hr sample gap: median {med:.0f}s, p90 {gaps[int(len(gaps) * 0.9)]:.0f}s")
        for k, v in con.execute("SELECT key, value FROM meta"):
            print(f"meta {k}: {v}")
        con.close()


def cmd_compute(cfg: Config, args) -> None:
    from .metrics import compute
    con = vdb.connect(cfg.db_path)
    daily, wo = compute(con, cfg)
    con.close()
    print(f"computed {len(daily)} daily rows, {len(wo)} workouts")


def cmd_sync(cfg: Config, args) -> None:
    if cfg.rclone_remote and shutil.which("rclone"):
        cfg.inbox.mkdir(parents=True, exist_ok=True)
        subprocess.run(["rclone", "copy", "--include", "*.zip", cfg.rclone_remote, str(cfg.inbox)], check=False)
    path = _newest_export(cfg.inbox)
    if path:
        n = _ingest_path(cfg, path)
        print(f"ingested {path.name}: {n}")
    else:
        print(f"no export in {cfg.inbox}; computing from existing db")
    from .metrics import compute
    from .report import report
    con = vdb.connect(cfg.db_path)
    compute(con, cfg)
    cfg.reports_dir.mkdir(parents=True, exist_ok=True)
    md = report(con, days=14)
    (cfg.reports_dir / "latest.md").write_text(md)
    (cfg.reports_dir / f"{dt.date.today().isoformat()}.md").write_text(md)
    con.close()
    print(f"wrote {cfg.reports_dir / 'latest.md'}")


def cmd_today(cfg: Config, args) -> None:
    from .report import today_card
    con = vdb.connect(cfg.db_path)
    print(today_card(con))
    con.close()


def cmd_report(cfg: Config, args) -> None:
    from .report import report
    con = vdb.connect(cfg.db_path)
    print(report(con, days=args.days))
    con.close()


def cmd_sql(cfg: Config, args) -> None:
    con = vdb.connect(cfg.db_path)
    con.execute("PRAGMA query_only = 1")
    cur = con.execute(args.query)
    cols = [d[0] for d in cur.description] if cur.description else []
    w = csv.writer(sys.stdout)
    if cols:
        w.writerow(cols)
    w.writerows(cur.fetchall())
    con.close()


def cmd_export(cfg: Config, args) -> None:
    out = Path(args.dir).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    con = vdb.connect(cfg.db_path)
    for t in [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]:
        cur = con.execute(f'SELECT * FROM "{t}"')
        with open(out / f"{t}.csv", "w", newline="") as f:
            w = csv.writer(f)
            w.writerow([d[0] for d in cur.description])
            w.writerows(cur.fetchall())
    con.close()
    print(f"wrote CSVs to {out}")


def cmd_schema(cfg: Config, args) -> None:
    con = vdb.connect(cfg.db_path)
    for name, sql in con.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"):
        print(sql + ";")
    con.close()


def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="vitals", description="Local Whoop-style metrics from Health Connect exports.")
    p.add_argument("--config", help="path to config.yaml")
    sp = p.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("ingest", help="load a Health Connect zip/db or Takeout zip/folder (default: newest in inbox)")
    a.add_argument("path", nargs="?")
    a = sp.add_parser("doctor", help="inventory of an export and of the local db")
    a.add_argument("path", nargs="?")
    sp.add_parser("compute", help="recompute daily and workout metrics")
    sp.add_parser("sync", help="rclone pull (optional) + ingest newest + compute + write reports/latest.md")
    sp.add_parser("today", help="print the latest day card")
    a = sp.add_parser("report", help="markdown report")
    a.add_argument("--days", type=int, default=14)
    a = sp.add_parser("sql", help="run a read-only SQL query, CSV output")
    a.add_argument("query")
    a = sp.add_parser("export", help="dump every table to CSV")
    a.add_argument("dir")
    sp.add_parser("schema", help="print the db schema")
    args = p.parse_args(argv)
    cfg = Config(Path(args.config) if args.config else None)
    {"ingest": cmd_ingest, "doctor": cmd_doctor, "compute": cmd_compute, "sync": cmd_sync, "today": cmd_today,
     "report": cmd_report, "sql": cmd_sql, "export": cmd_export, "schema": cmd_schema}[args.cmd](cfg, args)


if __name__ == "__main__":
    main()
