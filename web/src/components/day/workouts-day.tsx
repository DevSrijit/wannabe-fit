import Link from "next/link";
import { WorkoutZoneBar } from "@/components/charts/daily-charts";
import { HUE } from "@/components/charts/common";
import { Card, PageHeader, Stat } from "@/components/page";
import { Term } from "@/components/term";
import { DayControls } from "./controls";
import { fmt, titleCase } from "@/lib/format";
import { getWorkouts, latestDate } from "@/lib/queries";

export function WorkoutsDay({ date }: { date: string }) {
  const latest = latestDate();
  const rows = getWorkouts(1, date).filter((w) => w.date === date);
  const controls = <DayControls base="/workouts" date={date} latest={latest} />;
  const totalMin = rows.reduce((a, r) => a + r.duration_min, 0);
  return (
    <>
      <PageHeader
        title="Workouts"
        eyebrow={fmt.dateLong(date)}
        lede={rows.length ? `${rows.length} ${rows.length === 1 ? "session" : "sessions"}, ${fmt.hm(totalMin)} in total.` : "No session was logged on this day."}
        aside={controls}
      />
      <div className="space-y-3">
        {rows.map((w) => (
          <Card key={w.id} title={titleCase(w.type)} hue="strain" note={`${w.start.slice(11)} · ${fmt.hm(w.duration_min)}`} href={`/workouts/${w.id}`}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-6">
              <Stat label={<Term slug="strain">Strain</Term>} value={fmt.n(w.strain, 1)} hue={HUE.strain} />
              <Stat label={<Term slug="trimp">TRIMP</Term>} value={fmt.n(w.trimp, 0)} />
              <Stat label="Avg HR" value={fmt.n(w.hr_avg, 0)} unit="bpm" hue={HUE.heart} sub={w.pct_hrmax_avg != null ? `${fmt.n(w.pct_hrmax_avg, 0)}% of max` : undefined} />
              <Stat label="Peak" value={fmt.n(w.hr_max, 0)} unit="bpm" />
              <Stat label="kcal" value={fmt.n(w.kcal_hr, 0)} sub={w.kcal_device != null ? `watch ${fmt.n(w.kcal_device, 0)}` : undefined} />
              <Stat label={<Term slug="hrr">HRR 1 min</Term>} value={fmt.n(w.hrr_1min, 0)} unit="bpm" />
            </div>
            <div className="mt-4">
              <WorkoutZoneBar z={[w.z1, w.z2, w.z3, w.z4, w.z5]} height={12} />
              <div className="footnote text-label-2 num mt-1.5 flex flex-wrap gap-x-4">
                {[w.z1, w.z2, w.z3, w.z4, w.z5].map((m, i) => (
                  <span key={i}>z{i + 1} {fmt.n(m, 0)} min</span>
                ))}
                {w.distance_km != null && <span>{fmt.n(w.distance_km, 2)} km</span>}
                <span>{w.hr_samples} samples · {w.source}</span>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <p className="text-label-2 subhead">
              Sessions come from Nothing X and Google Fit. A rest day still adds strain from walking; see <Link href={`/strain?days=1&date=${date}`} className="text-tint">Strain</Link>.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
