# Wannabe Fit · web

A read-only dashboard over `data/vitals.db`. Next.js 16 (App Router, Turbopack), Tailwind v4, shadcn, Recharts, Bun.

## Run

```bash
cd web
bun install
bun run dev        # http://localhost:3000
```

The site reads the SQLite file the Python pipeline writes. It never writes to it. Point it elsewhere with `VITALS_DB=/path/to/vitals.db`. The local timezone defaults to `Asia/Kolkata`; set `NEXT_PUBLIC_VITALS_TZ` to change it.

Production:

```bash
bun run build
bun run start
```

## Host it on a VPS and install it as a PWA

```bash
cd web
bun install
bun run build
VITALS_DB=/srv/vitals/vitals.db PORT=3000 bun run start
```

Put a reverse proxy with HTTPS in front of it (Caddy does this in two lines). Android only offers "Install app" over HTTPS. Chrome then reads `/manifest.webmanifest`, uses the icons in `public/icons/`, and opens the site full screen with a black status bar and the floating tab bar above the system gesture area. Keep `data/vitals.db` on the VPS current with `vitals sync` from the machine that receives the Health Connect export, then `rsync` the file.

The site has no service worker on purpose. Every page reads the database on request, so an offline cache would show stale numbers without saying so.

## Pages

| Route | What it shows |
| --- | --- |
| `/` | Summary: three recovery rings (resting HR, sleep, blood oxygen) around the score, last night's hypnogram, day strain and zones, 14-day context, heart-rate summary. Use `?date=YYYY-MM-DD` for any past day. |
| `/recovery` | Recovery history with bands, resting HR against its 30-day baseline band, overnight SpO2, VO2max estimate, daily table. |
| `/sleep` | Last night in detail, sleep against need per night, stage mix, consistency, nightly table. |
| `/strain` | Day strain, zone minutes, fitness/fatigue/form (CTL/ATL/TSB), ACWR, HR calories against device calories. |
| `/workouts` | Every session with zones, TRIMP, strain, HR recovery. `/workouts/[id]` shows the heart-rate trace with zone bands. |
| `/heart-rate` | Every sample for one day with sleep and workout windows shaded, plus 60-day averages. |
| `/trends` | Weekly means, day-of-week means, and a few correlations. |
| `/browse` | The fifth tab. Links to Workouts, Heart rate, Trends, and Learn, plus the data source and sync time. |
| `/learn` | The glossary. Every metric: definition, why it matters, exact formula, how to read it, source, caveat, and today's value. |

Recovery, Sleep, Strain, and Workouts share one range control: D, 1W, 2W, 1M, 2M, 3M. The D view is a dedicated day page with arrows to move between days. It shows only what was measured that day, with the arithmetic behind the score, the stage timeline, zone boundaries, and each session. It shows no rolling averages and no fitness model.

Every metric name on the site is a dotted-underline term. Hover it for the short explanation; click it to jump to the full entry.

## Where the numbers come from

All metrics are computed by `vitals/metrics.py` and stored in the `daily` and `workout_metrics` tables. The site does not recompute anything except the three recovery components shown on the Today page (from the stored inputs, with the same formula) and the Pearson correlations on the Trends page.

The formulas in `src/lib/glossary.ts` are transcribed from the pipeline. If you change a constant in `metrics.py`, change the glossary text too.

## Design

The site follows the iOS dark appearance so it reads as a native app, in the manner of the Health app.

- Pure black background, `#1C1C1E` grouped cards, hairline separators, and UIKit label opacities. Tokens are in `src/app/globals.css`.
- The system font stack renders San Francisco on Apple devices and Inter elsewhere. Type sizes match the iOS text styles (large title 34, title 2 22, headline 17, subhead 15, footnote 13).
- Five tabs. On a phone they sit in a floating liquid-glass tab bar with a lens that slides under the active tab. On a wide screen they sit in a floating pill at the top, as on iPadOS.
- The large title collapses into a centred compact title in a blurred bar when the page scrolls. `src/components/nav.tsx` holds the shell.
- Hues are the Apple system colours, dark variants: orange for strain, indigo for sleep, pink for heart, cyan for blood oxygen, green, yellow, and red for the recovery bands.
- The site declares `apple-mobile-web-app-capable` and ships a web manifest, so Add to Home Screen on iOS opens it full screen without browser chrome.

## Layout

- `src/lib/db.ts` opens the database read-only with `node:sqlite` (Node 22.13+ or Bun 1.2+). Server only.
- `src/lib/queries.ts` is every query the pages use.
- `src/lib/glossary.ts` is the content of the Learn page and the hover cards.
- `src/lib/verdict.ts` writes the plain-language sentences on the Today page from rules.
- `src/components/charts/` are Recharts client components plus a hand-drawn SVG hypnogram and recovery ring.
