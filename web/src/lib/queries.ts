import { all, one } from "./db";
import { TZ } from "./tz";

export type Daily = {
  date: string;
  rhr: number | null;
  rhr_method: string | null;
  spo2_day_mean: number | null;
  weight_kg: number | null;
  steps: number | null;
  kcal_active_device: number | null;
  kcal_total_device: number | null;
  distance_km: number | null;
  sleep_light_min: number | null;
  sleep_deep_min: number | null;
  sleep_rem_min: number | null;
  sleep_awake_min: number | null;
  sleep_awakenings: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
  sleep_tib_min: number | null;
  sleep_asleep_min: number | null;
  sleep_efficiency: number | null;
  spo2_night_mean: number | null;
  spo2_night_min: number | null;
  rhr_base30: number | null;
  rhr_sd30: number | null;
  z0: number | null;
  z1: number | null;
  z2: number | null;
  z3: number | null;
  z4: number | null;
  z5: number | null;
  trimp: number | null;
  trimp_edwards: number | null;
  strain: number | null;
  kcal_hr: number | null;
  hr_avg: number | null;
  hr_max: number | null;
  hr_samples: number | null;
  hr_minutes: number | null;
  hr_max_used: number | null;
  hr_coverage_pct: number | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  acwr: number | null;
  sleep_need_min: number | null;
  sleep_debt7_h: number | null;
  sleep_performance: number | null;
  sleep_consistency: number | null;
  recovery: number | null;
  recovery_band: "green" | "yellow" | "red" | null;
  vo2max_uth: number | null;
};

export type WorkoutMetric = {
  id: string;
  date: string;
  source: string;
  start: string;
  type: string;
  title: string | null;
  duration_min: number;
  hr_avg: number | null;
  hr_max: number | null;
  hr_samples: number;
  pct_hrmax_avg: number | null;
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  trimp: number;
  trimp_edwards: number;
  strain: number;
  kcal_hr: number;
  kcal_device: number | null;
  distance_km: number | null;
  hrr_1min: number | null;
};

export type SleepSession = {
  id: string;
  start: number;
  end: number;
  start_offset_s: number | null;
  title: string | null;
  source: string;
};

export type SleepStage = { session_id: string; start: number; end: number; stage: number };
export type HrSample = { ts: number; bpm: number; source: string };

export function getFreshness() {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM meta");
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const last = one<{ date: string }>("SELECT max(date) AS date FROM daily WHERE hr_samples > 0");
  const lastCompute = m.last_compute ?? null;
  const stale = lastCompute ? Date.now() - Date.parse(lastCompute) > 30 * 3.6e6 : true;
  return { lastCompute, lastDay: last?.date ?? null, stale };
}

/** Last day that actually has heart-rate coverage. Days after it are empty rows. */
export function latestDate(): string {
  const r = one<{ date: string }>("SELECT max(date) AS date FROM daily WHERE hr_samples > 0");
  return r?.date ?? new Date().toISOString().slice(0, 10);
}

export function getDaily(date: string): Daily | undefined {
  return one<Daily>("SELECT * FROM daily WHERE date = ?", [date]);
}

export function getDailyRange(days: number, endDate?: string): Daily[] {
  const end = endDate ?? latestDate();
  return all<Daily>(
    "SELECT * FROM daily WHERE date <= ? AND date > date(?, ?) ORDER BY date",
    [end, end, `-${days} days`],
  );
}

export function getAllDaily(): Daily[] {
  return all<Daily>("SELECT * FROM daily WHERE hr_samples > 0 ORDER BY date");
}

export function getWorkouts(days: number, endDate?: string): WorkoutMetric[] {
  const end = endDate ?? latestDate();
  return all<WorkoutMetric>(
    "SELECT * FROM workout_metrics WHERE date <= ? AND date > date(?, ?) ORDER BY start DESC",
    [end, end, `-${days} days`],
  );
}

export function getWorkout(id: string): WorkoutMetric | undefined {
  return one<WorkoutMetric>("SELECT * FROM workout_metrics WHERE id = ?", [id]);
}

export function getWorkoutRaw(id: string) {
  return one<{ id: string; start: number; end: number; type_name: string; source: string; notes: string | null }>(
    "SELECT id, start, end, type_name, source, notes FROM workouts WHERE id = ?",
    [id],
  );
}

export function getHr(startMs: number, endMs: number): HrSample[] {
  return all<HrSample>("SELECT ts, bpm, source FROM hr WHERE ts >= ? AND ts <= ? ORDER BY ts", [startMs, endMs]);
}

export function getSpo2(startMs: number, endMs: number) {
  return all<{ ts: number; pct: number }>("SELECT ts, pct FROM spo2 WHERE ts >= ? AND ts <= ? ORDER BY ts", [
    startMs,
    endMs,
  ]);
}

/** Main sleep session whose end falls on the given local date (sleep is attributed to the wake day). */
export function getMainSleep(date: string): { session: SleepSession; stages: SleepStage[] } | null {
  const { startMs, endMs } = localDayBounds(date);
  const s = one<SleepSession>(
    `SELECT id, start, "end", start_offset_s, title, source FROM sleep_sessions
     WHERE "end" >= ? AND "end" < ? ORDER BY ("end" - start) DESC LIMIT 1`,
    [startMs, endMs],
  );
  if (!s) return null;
  const stages = all<SleepStage>(
    `SELECT session_id, start, "end", stage FROM sleep_stages WHERE session_id = ? ORDER BY start`,
    [s.id],
  );
  return { session: s, stages };
}

export function getSleepSessions(days: number, endDate?: string) {
  const end = endDate ?? latestDate();
  const { endMs } = localDayBounds(end);
  const startMs = endMs - days * 86400000;
  return all<SleepSession>(
    `SELECT id, start, "end", start_offset_s, title, source FROM sleep_sessions
     WHERE "end" >= ? AND "end" < ? ORDER BY start`,
    [startMs, endMs],
  );
}

export function getWorkoutTypeCounts(days: number) {
  const end = latestDate();
  return all<{ type: string; n: number; minutes: number; trimp: number }>(
    `SELECT type, count(*) AS n, round(sum(duration_min)) AS minutes, round(sum(trimp)) AS trimp
     FROM workout_metrics WHERE date <= ? AND date > date(?, ?) GROUP BY type ORDER BY minutes DESC`,
    [end, end, `-${days} days`],
  );
}

export function getWeekly(weeks: number) {
  const end = latestDate();
  return all<{
    week: string;
    days: number;
    recovery: number | null;
    rhr: number | null;
    sleep_h: number | null;
    strain: number | null;
    trimp: number | null;
    steps: number | null;
    spo2: number | null;
    vo2: number | null;
    sleep_perf: number | null;
  }>(
    `SELECT strftime('%Y-W%W', date) AS week, count(*) AS days,
       round(avg(recovery)) AS recovery, round(avg(rhr),1) AS rhr,
       round(avg(sleep_asleep_min)/60.0,1) AS sleep_h, round(avg(strain),1) AS strain,
       round(sum(trimp)) AS trimp, round(avg(steps)) AS steps, round(avg(spo2_night_mean),1) AS spo2,
       round(avg(vo2max_uth),1) AS vo2, round(avg(sleep_performance)) AS sleep_perf
     FROM daily WHERE hr_samples > 0 AND date <= ? AND date > date(?, ?)
     GROUP BY week ORDER BY week`,
    [end, end, `-${weeks * 7} days`],
  );
}

export function getProfile() {
  // The pipeline stores the HR max it used on every row; expose it for the glossary.
  const r = one<{ hr_max_used: number | null; weight_kg: number | null }>(
    "SELECT hr_max_used, weight_kg FROM daily WHERE hr_max_used IS NOT NULL ORDER BY date DESC LIMIT 1",
  );
  return { hrMax: r?.hr_max_used ?? null, weightKg: r?.weight_kg ?? null };
}

/** Epoch-ms bounds of a local calendar day in the pipeline's timezone. */
export function localDayBounds(date: string) {
  const offsetMin = tzOffsetMinutes(date);
  const startMs = Date.parse(`${date}T00:00:00Z`) - offsetMin * 60000;
  return { startMs, endMs: startMs + 86400000 };
}

function tzOffsetMinutes(date: string): number {
  const probe = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(probe);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - probe.getTime()) / 60000);
}
