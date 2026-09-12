import Link from "next/link";
import { WorkoutZoneBar } from "@/components/charts/daily-charts";
import { HUE } from "@/components/charts/common";
import { DataTable } from "@/components/data-table";
import { PageHeader, Panel, Stat, Explain } from "@/components/page";
import { RangeTabs } from "@/components/range-tabs";
import { resolveDays } from "@/components/range";
import { WorkoutsDay } from "@/components/day/workouts-day";
import { resolveDate } from "@/components/date-nav";
import { Term } from "@/components/term";
import { fmt, titleCase } from "@/lib/format";
import { getWorkouts, getWorkoutTypeCounts, latestDate } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workouts" };

export default async function Workouts({ searchParams }: PageProps<"/workouts">) {
  const sp = await searchParams;
  const days = await resolveDays(sp.days, 30);
  if (days === 1) return <WorkoutsDay date={resolveDate(sp.date, latestDate())} />;
  const rows = getWorkouts(days);
  const types = getWorkoutTypeCounts(days);
  const totalMin = rows.reduce((a, r) => a + r.duration_min, 0);
  const totalTrimp = rows.reduce((a, r) => a + r.trimp, 0);
  const hrr = rows.map((r) => r.hrr_1min).filter((v): v is number => v != null);

  return (
    <>
      <PageHeader
        title="Workouts"
        lede={
          <>
            Sessions from Nothing X and from Google Fit’s automatic detection. A Fit session is dropped only when it overlaps a tracked one by more than half. Each row links to the heart-rate trace and the full breakdown.
          </>
        }
        aside={<RangeTabs base="/workouts" days={days} />}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel><Stat label={`Sessions, ${days} days`} value={rows.length} sub={`${fmt.n(rows.length / (days / 7), 1)} per week`} /></Panel>
        <Panel><Stat label="Time" value={fmt.hm(totalMin)} /></Panel>
        <Panel><Stat label={<Term slug="trimp">TRIMP in sessions</Term>} value={fmt.n(totalTrimp, 0)} hue={HUE.strain} /></Panel>
        <Panel><Stat label={<Term slug="hrr">Mean 1-min HR recovery</Term>} value={hrr.length ? fmt.n(hrr.reduce((a, b) => a + b, 0) / hrr.length, 0) : "–"} unit="bpm" sub={`${hrr.length} sessions measured`} /></Panel>
      </div>

      <Panel title="By type" hue="strain">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <div key={t.type} className="flex items-baseline justify-between bg-fill-3 rounded-lg px-4 py-3">
              <span>{titleCase(t.type)}<span className="text-muted-foreground ml-2 text-xs">{t.n}×</span></span>
              <span className="num text-muted-foreground text-sm">{fmt.hm(t.minutes)} · TRIMP {fmt.n(t.trimp, 0)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-3" title="Every session" hue="strain">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          cols={[
            { key: "when", label: "When", render: (r) => <Link href={`/workouts/${r.id}`} className="text-foreground hover:underline">{fmt.dateShort(r.date)} <span className="text-muted-foreground">{r.start.slice(11)}</span></Link> },
            { key: "type", label: "Type", render: (r) => <span>{titleCase(r.type)}<span className="text-muted-foreground ml-1.5 text-xs">{r.source}</span></span> },
            { key: "dur", label: "Duration", align: "right", render: (r) => fmt.hm(r.duration_min) },
            { key: "hr", label: "Avg / max HR", align: "right", render: (r) => <span>{fmt.n(r.hr_avg, 0)} <span className="text-muted-foreground">/ {fmt.n(r.hr_max, 0)}</span></span> },
            { key: "pct", label: <Term slug="pct-hrmax">% max</Term>, align: "right", render: (r) => r.pct_hrmax_avg == null ? "–" : `${fmt.n(r.pct_hrmax_avg, 0)}%` },
            { key: "zones", label: "Zones", render: (r) => <div className="w-28"><WorkoutZoneBar z={[r.z1, r.z2, r.z3, r.z4, r.z5]} height={10} /></div> },
            { key: "strain", label: "Strain", align: "right", render: (r) => <span style={{ color: HUE.strain }}>{fmt.n(r.strain, 1)}</span> },
            { key: "trimp", label: "TRIMP", align: "right", render: (r) => fmt.n(r.trimp, 0) },
            { key: "kcal", label: "kcal HR / watch", align: "right", render: (r) => <span>{fmt.n(r.kcal_hr, 0)} <span className="text-muted-foreground">/ {fmt.n(r.kcal_device, 0)}</span></span> },
            { key: "dist", label: "km", align: "right", render: (r) => fmt.n(r.distance_km, 2) },
            { key: "hrr", label: <Term slug="hrr">HRR</Term>, align: "right", render: (r) => r.hrr_1min == null ? <span className="text-muted-foreground">–</span> : fmt.n(r.hrr_1min, 0) },
          ]}
        />
        <Explain>
          Sessions with few heart-rate samples (short walks) get a strain near zero even when they were long. That is correct: strain counts cardiovascular work, and an easy walk is mostly below 30% of reserve.
        </Explain>
      </Panel>
    </>
  );
}
