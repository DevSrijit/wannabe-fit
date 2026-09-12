import type { Daily } from "./queries";
import { fmt } from "./format";

/** Plain-language reading of the day, from rules only. No model, no guessing. */
export function verdict(d: Daily, prev: Daily | undefined): string[] {
  const out: string[] = [];
  if (d.recovery == null) {
    out.push("No recovery score yet. It needs a night of heart-rate data plus a 30-day baseline.");
  } else {
    const z = d.rhr != null && d.rhr_base30 != null && d.rhr_sd30 ? (d.rhr - d.rhr_base30) / Math.max(1.5, d.rhr_sd30) : null;
    const rhrText =
      d.rhr == null || d.rhr_base30 == null
        ? "Resting heart rate is missing"
        : `Resting heart rate was ${fmt.n(d.rhr, 0)} bpm, ${fmt.n(Math.abs(d.rhr - d.rhr_base30), 1)} ${d.rhr >= d.rhr_base30 ? "above" : "below"} your baseline`;
    out.push(
      d.recovery_band === "green"
        ? `Recovered. ${rhrText}${z != null && z < -0.5 ? ", a good sign" : ""}. Train as planned.`
        : d.recovery_band === "yellow"
          ? `Adequate. ${rhrText}. Keep the session moderate and see how it feels.`
          : `Low. ${rhrText}. A rest day or an easy walk is the right call.`,
    );
  }
  if (d.sleep_asleep_min != null && d.sleep_need_min != null) {
    const gap = d.sleep_need_min - d.sleep_asleep_min;
    out.push(
      gap <= 15
        ? `Sleep covered the full need of ${fmt.hm(d.sleep_need_min)}.`
        : `Sleep was ${fmt.hm(d.sleep_asleep_min)} against a need of ${fmt.hm(d.sleep_need_min)}, short by ${fmt.hm(gap)}.`,
    );
  } else {
    out.push("No sleep session was recorded for this night.");
  }
  if (prev?.strain != null) {
    out.push(
      prev.strain >= 14
        ? `Yesterday's strain of ${fmt.n(prev.strain, 1)} was high, which raised tonight's sleep need.`
        : prev.strain >= 10
          ? `Yesterday's strain of ${fmt.n(prev.strain, 1)} was moderate.`
          : `Yesterday was light (strain ${fmt.n(prev.strain, 1)}).`,
    );
  }
  if (d.acwr != null && d.acwr > 1.5) out.push(`Load is climbing fast: the acute:chronic ratio is ${fmt.n(d.acwr, 2)}. Hold volume steady this week.`);
  if (d.hr_coverage_pct != null && d.hr_coverage_pct < 50) out.push(`Heart-rate coverage was only ${fmt.n(d.hr_coverage_pct, 0)}%, so treat every number for this day with caution.`);
  return out;
}

export function rhrComponent(d: Daily): number | null {
  if (d.rhr == null || d.rhr_base30 == null) return null;
  const z = (d.rhr - d.rhr_base30) / Math.max(1.5, d.rhr_sd30 ?? 3);
  return Math.min(100, Math.max(0, 70 - 20 * z));
}

export function spo2Component(d: Daily): number | null {
  if (d.spo2_night_min == null) return null;
  return Math.min(100, Math.max(0, ((d.spo2_night_min - 88) / 7) * 100));
}
