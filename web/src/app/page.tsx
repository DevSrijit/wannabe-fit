import Link from "next/link";
import { RecoveryRing } from "@/components/charts/recovery-ring";
import { Hypnogram } from "@/components/charts/hypnogram";
import { RecoveryChart, StrainChart, WorkoutZoneBar } from "@/components/charts/daily-charts";
import { DateNav, resolveDate } from "@/components/date-nav";
import { Card, Chevron, PageHeader, SectionTitle, Stat } from "@/components/page";
import { Term } from "@/components/term";
import { addDays, fmt, titleCase } from "@/lib/format";
import { getDaily, getDailyRange, getMainSleep, getWorkouts, latestDate } from "@/lib/queries";
import { rhrComponent, spo2Component, verdict } from "@/lib/verdict";

export const dynamic = "force-dynamic";

export default async function Today({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const latest = latestDate();
  const date = resolveDate(sp.date, latest);
  const d = getDaily(date);
  const prev = getDaily(addDays(date, -1));
  const sleep = getMainSleep(date);
  const recent = getDailyRange(14, date);
  const workouts = getWorkouts(1, date).filter((w) => w.date === date);
  const eyebrow = date === latest ? "Today" : fmt.dateLong(date);

  if (!d) {
    return (
      <>
        <PageHeader title="Summary" eyebrow={eyebrow} aside={<DateNav date={date} latest={latest} base="/" />} />
        <Card>
          <p className="text-label-2 body-text">No data for this day.</p>
        </Card>
      </>
    );
  }

  const lines = verdict(d, prev);
  const rhrC = rhrComponent(d);
  const spo2C = spo2Component(d);
  const zones = [d.z1, d.z2, d.z3, d.z4, d.z5].map((v) => v ?? 0);
  const rings = [
    { value: rhrC, color: "var(--heart)", label: "Resting HR" },
    { value: d.sleep_performance, color: "var(--sleep)", label: "Sleep" },
    { value: spo2C, color: "var(--oxygen)", label: "Blood oxygen" },
  ];

  return (
    <>
      <PageHeader title="Summary" eyebrow={eyebrow} aside={<DateNav date={date} latest={latest} base="/" />} />

      <Card title={<Term slug="recovery">Recovery</Term>} hue="good" note="Overnight" href="/recovery">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <RecoveryRing score={d.recovery} band={d.recovery_band} rings={rings} />
          <div className="w-full min-w-0 flex-1">
            <ul className="divide-y divide-border/70">
              <RingRow color="var(--heart)" label={<Term slug="rhr">Resting heart rate</Term>} value={rhrC} weight={50} detail={`${fmt.n(d.rhr, 0)} bpm against a ${fmt.n(d.rhr_base30, 0)} baseline`} />
              <RingRow color="var(--sleep)" label={<Term slug="sleep-performance">Sleep performance</Term>} value={d.sleep_performance} weight={35} detail={`${fmt.hm(d.sleep_asleep_min)} of ${fmt.hm(d.sleep_need_min)} needed`} />
              <RingRow color="var(--oxygen)" label={<Term slug="spo2">Blood oxygen</Term>} value={spo2C} weight={15} detail={`min ${fmt.n(d.spo2_night_min, 0)}%, mean ${fmt.n(d.spo2_night_mean, 1)}%`} />
            </ul>
            <p className="footnote mt-3.5 max-w-prose">{lines.join(" ")}</p>
          </div>
        </div>
      </Card>

      <SectionTitle>Last night</SectionTitle>
      <Card
        title={<Term slug="sleep-stages">Sleep</Term>}
        hue="sleep"
        note={d.sleep_start && d.sleep_end ? `${d.sleep_start} – ${d.sleep_end}` : "no session"}
        href="/sleep"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Asleep" value={fmt.hm(d.sleep_asleep_min)} hue="var(--sleep)" />
          <Stat label={<Term slug="sleep-need">Need</Term>} value={fmt.hm(d.sleep_need_min)} />
          <Stat label={<Term slug="sleep-performance">Performance</Term>} value={fmt.n(d.sleep_performance, 0)} unit="%" />
          <Stat label={<Term slug="sleep-debt">Debt, 7 days</Term>} value={fmt.n(d.sleep_debt7_h, 1)} unit="h" />
        </div>
        {sleep ? (
          <div className="mt-5">
            <Hypnogram start={sleep.session.start} end={sleep.session.end} stages={sleep.stages} />
            <div className="footnote text-label-2 mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <span>Deep {fmt.hm(d.sleep_deep_min)}</span>
              <span>REM {fmt.hm(d.sleep_rem_min)}</span>
              <span>Light {fmt.hm(d.sleep_light_min)}</span>
              <span>Awake {fmt.hm(d.sleep_awake_min)}</span>
              <span><Term slug="sleep-efficiency">Efficiency</Term> {fmt.n(d.sleep_efficiency, 0)}%</span>
              <span><Term slug="sleep-consistency">Consistency</Term> {fmt.n(d.sleep_consistency, 0)}</span>
            </div>
          </div>
        ) : (
          <p className="text-label-2 subhead mt-5">The watch recorded no sleep session ending on this day.</p>
        )}
      </Card>

      <SectionTitle>Activity</SectionTitle>
      <Card title={<Term slug="strain">Strain</Term>} hue="strain" note="Load and fitness" href="/strain">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Day strain" value={fmt.n(d.strain, 1)} hue="var(--strain)" sub="of 21" />
          <Stat label={<Term slug="trimp">TRIMP</Term>} value={fmt.n(d.trimp, 0)} />
          <Stat label={<Term slug="kcal-hr">Active kcal (HR)</Term>} value={fmt.n(d.kcal_hr, 0)} sub={`watch ${fmt.n(d.kcal_active_device, 0)} active, ${fmt.n(d.kcal_total_device, 0)} total`} />
          <Stat label="Steps" value={fmt.int(d.steps)} sub={d.distance_km != null ? `${fmt.n(d.distance_km, 1)} km` : undefined} />
        </div>
        <div className="mt-5">
          <div className="footnote text-label-2 mb-1.5 flex justify-between">
            <span>
              Minutes in <Term slug="zones">zones</Term> 1 to 5
            </span>
            <span className="num">{fmt.n(zones.reduce((a, b) => a + b, 0), 0)} min above zone 1</span>
          </div>
          {zones.some((z) => z > 0) ? <WorkoutZoneBar z={zones} /> : <div className="bg-fill-3 h-3.5 rounded-sm" />}
          <div className="footnote text-label-2 num mt-1.5 flex gap-4">
            {zones.map((z, i) => (
              <span key={i}>z{i + 1} {fmt.n(z, 0)}</span>
            ))}
          </div>
        </div>
        {workouts.length > 0 && (
          <ul className="mt-4 divide-y divide-border/70 border-t border-border/70">
            {workouts.map((w) => (
              <li key={w.id}>
                <Link href={`/workouts/${w.id}`} className="pressable flex items-center justify-between gap-4 py-2.5">
                  <span className="subhead">
                    {titleCase(w.type)}
                    <span className="text-label-2 ml-2">{w.start.slice(11)} · {fmt.hm(w.duration_min)}</span>
                  </span>
                  <span className="num text-label-2 subhead flex items-center gap-2">
                    strain <span className="text-foreground">{fmt.n(w.strain, 1)}</span> · {fmt.n(w.hr_avg, 0)} bpm
                    <Chevron />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionTitle>Two weeks</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Recovery" hue="good" note="14 days" href="/recovery">
          <RecoveryChart data={recent} height={180} />
        </Card>
        <Card title="Strain" hue="strain" note="14 days" href="/strain">
          <StrainChart data={recent} height={180} />
        </Card>
      </div>

      <SectionTitle>Heart</SectionTitle>
      <Card title="Heart rate" hue="heart" note="Full trace" href={`/heart-rate?date=${date}`}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
          <Stat label="Average" value={fmt.n(d.hr_avg, 0)} unit="bpm" hue="var(--heart)" />
          <Stat label="Peak" value={fmt.n(d.hr_max, 0)} unit="bpm" />
          <Stat label={<Term slug="rhr">Resting</Term>} value={fmt.n(d.rhr, 0)} unit="bpm" sub={d.rhr_method?.replace(/_/g, " ")} />
          <Stat label={<Term slug="rhr-baseline">Baseline</Term>} value={fmt.n(d.rhr_base30, 0)} unit="bpm" sub={`± ${fmt.n(d.rhr_sd30, 1)} sd`} />
          <Stat label={<Term slug="hr-coverage">Coverage</Term>} value={fmt.n(d.hr_coverage_pct, 0)} unit="%" sub={`${fmt.int(d.hr_samples)} samples`} />
        </div>
      </Card>
    </>
  );
}

function RingRow({ color, label, value, weight, detail }: { color: string; label: React.ReactNode; value: number | null; weight: number; detail: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0">
      <span className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="subhead">{label}</div>
        <div className="caption text-label-2">{detail}</div>
      </div>
      <div className="text-right">
        <div className="num display text-[22px]">{value == null ? "–" : Math.round(value)}</div>
        <div className="caption text-label-2">{weight}% weight</div>
      </div>
    </li>
  );
}
