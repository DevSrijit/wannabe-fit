import { notFound } from "next/navigation";
import { HrTrace } from "@/components/charts/hr-trace";
import { WorkoutZoneBar } from "@/components/charts/daily-charts";
import { HUE, ZONE_FILL } from "@/components/charts/common";
import { PageHeader, Panel, Stat, Explain } from "@/components/page";
import { Term } from "@/components/term";
import { fmt, titleCase } from "@/lib/format";
import { getDaily, getHr, getProfile, getWorkout, getWorkoutRaw } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/workouts/[id]">) {
  const { id } = await params;
  const w = getWorkout(id);
  return { title: w ? `${titleCase(w.type)} · ${w.date}` : "Workout" };
}

export default async function Workout({ params }: PageProps<"/workouts/[id]">) {
  const { id } = await params;
  const w = getWorkout(id);
  const raw = getWorkoutRaw(id);
  if (!w || !raw) notFound();
  const pad = 5 * 60000;
  const hr = getHr(raw.start - pad, raw.end + pad);
  const day = getDaily(w.date);
  const profile = getProfile();
  const rhrB = day?.rhr_base30 ?? 60;
  const hrMax = profile.hrMax ?? 190;
  const reserve = hrMax - rhrB;
  const zones = [0.5, 0.6, 0.7, 0.8, 0.9].map((f, i) => ({ lo: Math.round(rhrB + f * reserve), hi: Math.round(rhrB + (i === 4 ? 1.01 : f + 0.1) * reserve) }));
  const z = [w.z1, w.z2, w.z3, w.z4, w.z5];
  const zTotal = z.reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title={titleCase(w.type)}
        lede={
          <>
            {fmt.dateLong(w.date)}, {w.start.slice(11)} · {fmt.hm(w.duration_min)} · recorded by {w.source}
            {raw.notes ? ` · ${raw.notes}` : ""}
          </>
        }
        back={{ href: "/workouts", label: "Workouts" }}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Panel><Stat label={<Term slug="strain">Strain</Term>} value={fmt.n(w.strain, 1)} hue={HUE.strain} /></Panel>
        <Panel><Stat label={<Term slug="trimp">TRIMP</Term>} value={fmt.n(w.trimp, 0)} sub={<>Edwards {fmt.n(w.trimp_edwards, 0)}</>} /></Panel>
        <Panel><Stat label="Average HR" value={fmt.n(w.hr_avg, 0)} unit="bpm" hue={HUE.heart} sub={w.pct_hrmax_avg != null ? `${fmt.n(w.pct_hrmax_avg, 0)}% of max` : undefined} /></Panel>
        <Panel><Stat label="Peak HR" value={fmt.n(w.hr_max, 0)} unit="bpm" /></Panel>
        <Panel><Stat label={<Term slug="kcal-hr">kcal from HR</Term>} value={fmt.n(w.kcal_hr, 0)} sub={w.kcal_device != null ? `watch ${fmt.n(w.kcal_device, 0)}` : "watch: none"} /></Panel>
        <Panel><Stat label={<Term slug="hrr">HR recovery, 1 min</Term>} value={fmt.n(w.hrr_1min, 0)} unit="bpm" sub={w.hrr_1min == null ? "no samples after the end" : w.hrr_1min >= 20 ? "good" : w.hrr_1min >= 12 ? "average" : "poor"} /></Panel>
      </div>

      <Panel title="Heart rate through the session" hue="heart" note={`${w.hr_samples} samples · shaded bands are zones 1–5`}>
        {hr.length ? (
          <HrTrace data={hr} start={raw.start - pad} end={raw.end + pad} workouts={[{ start: raw.start, end: raw.end, label: "" }]} zones={zones} rhr={day?.rhr_base30} />
        ) : (
          <p className="text-muted-foreground text-sm">No heart-rate samples were recorded during this session.</p>
        )}
        <Explain>
          Five minutes before and after the session are included so the warm-up and the recovery drop are visible. The 1-minute recovery figure compares the last 15 seconds of the session with the window 50–75 seconds after it.
        </Explain>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title={<>Time in <Term slug="zones">zones</Term></>} hue="strain">
          <WorkoutZoneBar z={z} height={18} />
          <ul className="mt-4 space-y-2 text-sm">
            {z.map((m, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="size-3 rounded-sm" style={{ background: ZONE_FILL[i] }} />
                <span className="w-16">Zone {i + 1}</span>
                <span className="text-muted-foreground w-28 text-xs">{zones[i].lo}–{zones[i].hi} bpm</span>
                <span className="num ml-auto">{fmt.n(m, 0)} min</span>
                <span className="num text-muted-foreground w-10 text-right text-xs">{zTotal ? fmt.n((100 * m) / zTotal, 0) : 0}%</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Context">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Distance</dt><dd className="num">{w.distance_km != null ? `${fmt.n(w.distance_km, 2)} km` : "–"}</dd>
            <dt className="text-muted-foreground">Pace</dt><dd className="num">{w.distance_km && w.distance_km >= 0.5 ? `${fmt.hm(w.duration_min / w.distance_km)} / km` : "–"}</dd>
            <dt className="text-muted-foreground">Recovery that morning</dt><dd className="num">{fmt.n(day?.recovery, 0)}</dd>
            <dt className="text-muted-foreground">Day strain</dt><dd className="num">{fmt.n(day?.strain, 1)}</dd>
            <dt className="text-muted-foreground">RHR baseline used</dt><dd className="num">{fmt.n(rhrB, 1)} bpm</dd>
            <dt className="text-muted-foreground">HR max used</dt><dd className="num">{fmt.n(hrMax, 1)} bpm</dd>
            <dt className="text-muted-foreground">Sleep the night before</dt><dd className="num">{fmt.hm(day?.sleep_asleep_min)}</dd>
          </dl>
        </Panel>
      </div>
    </>
  );
}
