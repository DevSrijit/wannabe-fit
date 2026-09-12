import Link from "next/link";
import { WorkoutZoneBar } from "@/components/charts/daily-charts";
import { HUE, ZONE_FILL } from "@/components/charts/common";
import { Card, Chevron, List, PageHeader, Row, SectionTitle, Stat } from "@/components/page";
import { Term } from "@/components/term";
import { DayControls } from "./controls";
import { fmt, titleCase } from "@/lib/format";
import { getDaily, getProfile, getWorkouts, latestDate } from "@/lib/queries";

export function StrainDay({ date }: { date: string }) {
  const latest = latestDate();
  const d = getDaily(date);
  const workouts = getWorkouts(1, date).filter((w) => w.date === date);
  const profile = getProfile();
  const controls = <DayControls base="/strain" date={date} latest={latest} />;
  if (!d) {
    return (
      <>
        <PageHeader title="Strain" eyebrow={fmt.dateLong(date)} aside={controls} />
        <Card><p className="text-label-2 body-text">No data for this day.</p></Card>
      </>
    );
  }
  const rhrB = d.rhr_base30 ?? 60;
  const hrMax = profile.hrMax ?? 190;
  const reserve = hrMax - rhrB;
  const bounds = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((f) => Math.round(rhrB + f * reserve));
  const z = [d.z1, d.z2, d.z3, d.z4, d.z5].map((v) => v ?? 0);
  const zTotal = z.reduce((a, b) => a + b, 0);
  const inWorkouts = workouts.reduce((a, w) => a + w.trimp, 0);
  const level = d.strain == null ? "" : d.strain >= 18 ? "all out" : d.strain >= 14 ? "high" : d.strain >= 10 ? "moderate" : "light";

  return (
    <>
      <PageHeader
        title="Strain"
        eyebrow={fmt.dateLong(date)}
        lede={`A ${level} day at ${fmt.n(d.strain, 1)} of 21. ${fmt.n(zTotal, 0)} minutes above zone 1, ${workouts.length} logged ${workouts.length === 1 ? "session" : "sessions"}, ${fmt.int(d.steps)} steps.`}
        aside={controls}
      />

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label={<Term slug="strain">Day strain</Term>} value={fmt.n(d.strain, 1)} hue={HUE.strain} sub="of 21" />
          <Stat label={<Term slug="trimp">TRIMP</Term>} value={fmt.n(d.trimp, 0)} sub={<><Term slug="trimp-edwards">Edwards</Term> {fmt.n(d.trimp_edwards, 0)}</>} />
          <Stat label={<Term slug="kcal-hr">Active kcal (HR)</Term>} value={fmt.n(d.kcal_hr, 0)} sub={`watch ${fmt.n(d.kcal_active_device, 0)} active`} />
          <Stat label="Steps" value={fmt.int(d.steps)} sub={d.distance_km != null ? `${fmt.n(d.distance_km, 1)} km` : undefined} />
        </div>
      </Card>

      <SectionTitle>Minutes in zones</SectionTitle>
      <Card>
        {zTotal > 0 ? <WorkoutZoneBar z={z} height={18} /> : <div className="bg-fill-3 h-[18px] rounded-sm" />}
        <ul className="mt-3 divide-y divide-border/70">
          {z.map((m, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <span className="size-3 rounded-sm" style={{ background: ZONE_FILL[i] }} />
              <span className="subhead w-16">Zone {i + 1}</span>
              <span className="text-label-2 footnote flex-1">{bounds[i]} to {bounds[i + 1]} bpm</span>
              <span className="num subhead">{fmt.n(m, 0)} min</span>
              <span className="num text-label-2 subhead w-12 text-right">{zTotal ? `${fmt.n((100 * m) / zTotal, 0)}%` : ""}</span>
            </li>
          ))}
        </ul>
        <p className="footnote text-label-2 mt-2">
          <Term slug="zones">Zones</Term> are fractions of heart-rate reserve: HR max {fmt.n(hrMax, 0)} minus the resting baseline {fmt.n(rhrB, 0)}. Every sample of the day counts, not only workouts.
        </p>
      </Card>

      <SectionTitle>Sessions</SectionTitle>
      {workouts.length ? (
        <List>
          {workouts.map((w, i) => (
            <Link key={w.id} href={`/workouts/${w.id}`} className="pressable block">
              <div className={`flex items-center gap-3 px-4 py-3 ${i < workouts.length - 1 ? "hairline" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="body-text">{titleCase(w.type)} <span className="text-label-2">{w.start.slice(11)} · {fmt.hm(w.duration_min)}</span></div>
                  <div className="footnote text-label-2 num">strain {fmt.n(w.strain, 1)} · TRIMP {fmt.n(w.trimp, 0)} · avg {fmt.n(w.hr_avg, 0)} bpm · peak {fmt.n(w.hr_max, 0)}</div>
                  <div className="mt-1.5 w-40"><WorkoutZoneBar z={[w.z1, w.z2, w.z3, w.z4, w.z5]} height={8} /></div>
                </div>
                <Chevron />
              </div>
            </Link>
          ))}
        </List>
      ) : (
        <Card><p className="text-label-2 subhead">No logged session. The strain above came from everyday movement.</p></Card>
      )}
      <p className="footnote text-label-2 mt-2 px-1">
        TRIMP inside sessions {fmt.n(inWorkouts, 0)} of {fmt.n(d.trimp, 0)} for the day. The rest is walking and stairs between them.
      </p>

      <SectionTitle>Heart rate</SectionTitle>
      <List>
        <Row title="Average" value={`${fmt.n(d.hr_avg, 0)} bpm`} />
        <Row title="Peak" detail={`${fmt.n(d.hr_max != null ? (100 * d.hr_max) / hrMax : null, 0)}% of HR max ${fmt.n(hrMax, 0)}`} value={`${fmt.n(d.hr_max, 0)} bpm`} />
        <Row title="Resting" value={`${fmt.n(d.rhr, 0)} bpm`} />
        <Row href={`/heart-rate?date=${date}`} title="Full trace" detail={`${fmt.int(d.hr_samples)} samples, ${fmt.n(d.hr_coverage_pct, 0)}% coverage`} last />
      </List>

      <SectionTitle>Calories</SectionTitle>
      <List>
        <Row title={<Term slug="kcal-hr">From heart rate</Term>} detail="Keytel 2005, minutes above 30% of reserve" value={`${fmt.n(d.kcal_hr, 0)} kcal`} />
        <Row title="Watch, active" detail="its own step and motion model" value={`${fmt.n(d.kcal_active_device, 0)} kcal`} />
        <Row title="Watch, total" detail="includes resting metabolism" value={`${fmt.n(d.kcal_total_device, 0)} kcal`} last />
      </List>
    </>
  );
}
