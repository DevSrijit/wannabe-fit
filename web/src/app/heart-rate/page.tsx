import { HrTrace } from "@/components/charts/hr-trace";
import { GenericLine } from "@/components/charts/daily-charts";
import { HUE } from "@/components/charts/common";
import { DateNav, resolveDate } from "@/components/date-nav";
import { PageHeader, Panel, Stat, Explain } from "@/components/page";
import { Term } from "@/components/term";
import { fmt, titleCase } from "@/lib/format";
import { getDaily, getDailyRange, getHr, getMainSleep, getProfile, getSpo2, getWorkouts, latestDate, localDayBounds } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Heart rate" };

export default async function HeartRate({ searchParams }: PageProps<"/heart-rate">) {
  const sp = await searchParams;
  const latest = latestDate();
  const date = resolveDate(sp.date, latest);
  const { startMs, endMs } = localDayBounds(date);
  const hr = getHr(startMs, endMs);
  const spo2 = getSpo2(startMs, endMs);
  const d = getDaily(date);
  const sleep = getMainSleep(date);
  const workouts = getWorkouts(1, date).filter((w) => w.date === date);
  const wk = workouts.map((w) => {
    const start = Date.parse(`${w.start.replace(" ", "T")}:00+05:30`);
    return { start, end: start + w.duration_min * 60000, label: titleCase(w.type) };
  });
  const profile = getProfile();
  const rhrB = d?.rhr_base30 ?? 60;
  const hrMax = profile.hrMax ?? 190;
  const reserve = hrMax - rhrB;
  const zones = [0.5, 0.6, 0.7, 0.8, 0.9].map((f, i) => ({ lo: Math.round(rhrB + f * reserve), hi: Math.round(rhrB + (i === 4 ? 1.01 : f + 0.1) * reserve) }));
  const history = getDailyRange(60);
  const gaps = countGaps(hr);

  return (
    <>
      <PageHeader
        title="Heart rate"
        lede={<>Every sample the watch stored for the day. The indigo shade is the main sleep session, orange shades are workouts, and the faint horizontal bands are <Term slug="zones">zones</Term> 1–5.</>}
        aside={<DateNav date={date} latest={latest} base="/heart-rate" />}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Panel><Stat label="Samples" value={fmt.int(hr.length)} sub={`${gaps} gaps over 15 min`} /></Panel>
        <Panel><Stat label={<Term slug="hr-coverage">Coverage</Term>} value={fmt.n(d?.hr_coverage_pct, 0)} unit="%" /></Panel>
        <Panel><Stat label="Average" value={fmt.n(d?.hr_avg, 0)} unit="bpm" hue={HUE.heart} /></Panel>
        <Panel><Stat label="Peak" value={fmt.n(d?.hr_max, 0)} unit="bpm" /></Panel>
        <Panel className="max-sm:col-span-2"><Stat label={<Term slug="rhr">Resting</Term>} value={fmt.n(d?.rhr, 0)} unit="bpm" sub={d?.rhr_method?.replace(/_/g, " ")} /></Panel>
      </div>

      <Panel title="Heart rate" hue="heart" note={fmt.dateLong(date)}>
        {hr.length ? (
          <HrTrace data={hr} start={startMs} end={endMs} sleep={sleep ? { start: sleep.session.start, end: sleep.session.end } : null} workouts={wk} rhr={d?.rhr} zones={zones} height={340} />
        ) : (
          <p className="text-muted-foreground text-sm">No samples for this day.</p>
        )}
        <Explain>
          Background sampling on the CMF Watch Pro 2 is every 1–10 minutes; inside a workout it is every few seconds. The dashed line is the night’s resting heart rate, the lowest 15-minute mean inside the sleep shade. Gaps mean the watch was off the wrist, charging, or its sensor gave up.
        </Explain>
      </Panel>

      {spo2.length > 0 && (
        <Panel className="mt-3" title={<Term slug="spo2">Blood oxygen samples</Term>} hue="oxygen" note={`${spo2.length} readings`}>
          <div className="flex flex-wrap gap-1.5">
            {spo2.map((s) => (
              <span key={s.ts} className="num bg-fill-3 rounded-md px-2 py-1 text-xs" style={{ color: s.pct < 92 ? HUE.low : s.pct < 95 ? HUE.warn : undefined }} title={fmt.time(s.ts)}>
                {fmt.time(s.ts)} <span className="text-foreground">{fmt.n(s.pct, 0)}%</span>
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="mt-3" title="Daily average, peak, and resting over 60 days" hue="heart">
        <GenericLine
          data={history}
          keys={[
            { key: "hr_max", label: "Peak", color: HUE.strain },
            { key: "hr_avg", label: "Average", color: HUE.heart },
            { key: "rhr", label: "Resting", color: HUE.sleep },
          ]}
          height={220}
        />
        <Explain>
          The average of a full day sits around 70–85 bpm for most people and rises on training days. The resting line should drift down over months of consistent aerobic work.
        </Explain>
      </Panel>
    </>
  );
}

function countGaps(hr: { ts: number }[]): number {
  let n = 0;
  for (let i = 1; i < hr.length; i++) if (hr[i].ts - hr[i - 1].ts > 15 * 60000) n++;
  return n;
}
