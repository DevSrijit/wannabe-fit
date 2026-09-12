import { RecoveryChart, RhrChart, Spo2Chart, GenericLine } from "@/components/charts/daily-charts";
import { DataTable } from "@/components/data-table";
import { PageHeader, Panel, Stat, Explain } from "@/components/page";
import { RangeTabs } from "@/components/range-tabs";
import { resolveDays } from "@/components/range";
import { RecoveryDay } from "@/components/day/recovery-day";
import { resolveDate } from "@/components/date-nav";
import { Term } from "@/components/term";
import { bandColor, bandLabel, fmt } from "@/lib/format";
import { getDailyRange, latestDate } from "@/lib/queries";
import { HUE } from "@/components/charts/common";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recovery" };

export default async function Recovery({ searchParams }: PageProps<"/recovery">) {
  const sp = await searchParams;
  const days = await resolveDays(sp.days, 30);
  if (days === 1) return <RecoveryDay date={resolveDate(sp.date, latestDate())} />;
  const rows = getDailyRange(days);
  const scored = rows.filter((r) => r.recovery != null);
  const mean = (k: "recovery" | "rhr" | "spo2_night_mean") => {
    const v = scored.map((r) => r[k]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const bands = { green: 0, yellow: 0, red: 0 } as Record<string, number>;
  for (const r of scored) if (r.recovery_band) bands[r.recovery_band]++;
  const latest = rows[rows.length - 1];

  return (
    <>
      <PageHeader
        title="Recovery"
        lede={
          <>
            How ready the body was each morning. The score blends <Term slug="rhr">resting heart rate</Term> against its own baseline, <Term slug="sleep-performance">sleep performance</Term>, and overnight <Term slug="spo2">blood oxygen</Term>.
          </>
        }
        aside={<RangeTabs base="/recovery" days={days} />}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel><Stat label={`Mean recovery, ${days} days`} value={fmt.n(mean("recovery"), 0)} hue={bandColor(latest?.recovery_band)} sub={`${bands.green} green · ${bands.yellow} yellow · ${bands.red} red`} /></Panel>
        <Panel><Stat label="Mean resting HR" value={fmt.n(mean("rhr"), 1)} unit="bpm" hue={HUE.heart} sub={`baseline now ${fmt.n(latest?.rhr_base30, 1)} ± ${fmt.n(latest?.rhr_sd30, 1)}`} /></Panel>
        <Panel><Stat label="Mean night SpO2" value={fmt.n(mean("spo2_night_mean"), 1)} unit="%" hue={HUE.oxygen} /></Panel>
        <Panel><Stat label={<Term slug="vo2max">VO2max estimate</Term>} value={fmt.n(latest?.vo2max_uth, 1)} unit="ml/kg/min" sub="from HR max ÷ RHR baseline" /></Panel>
      </div>

      <Panel title="Recovery score" hue="good" note="Dots are colored by band. Bands: green 67+, yellow 34–66, red below 34.">
        <RecoveryChart data={rows} />
        <Explain>
          The score is not a measurement. It is a weighted opinion built from three overnight measurements. A single low morning after a late night is expected. Three low mornings in a row while training normally is a signal to back off. Because this watch records no HRV, resting heart rate carries half the weight, so anything that raises RHR (alcohol, heat, a late meal, illness) will pull the score down.
        </Explain>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title={<Term slug="rhr">Resting heart rate</Term>} hue="heart" note="Shaded band is the 30-day baseline ± 1 SD">
          <RhrChart data={rows} />
          <Explain>
            The lowest sustained 15-minute heart rate while asleep. Nights inside the band are ordinary. A night above the top edge means the body was working harder than usual to rest. A slow downward drift over months is aerobic fitness improving.
          </Explain>
        </Panel>
        <Panel title={<Term slug="spo2">Overnight blood oxygen</Term>} hue="oxygen" note="Mean and minimum inside the sleep session">
          <Spo2Chart data={rows} />
          <Explain>
            Normal sleep stays at 95% or above. The minimum is sensitive to one bad sensor contact, so a single dip is noise. Repeated minimums under 92% are worth mentioning to a doctor.
          </Explain>
        </Panel>
      </div>

      <Panel className="mt-3" title={<Term slug="vo2max">VO2max estimate</Term>} hue="heart" note="Uth 2004: 15.3 × HR max ÷ RHR baseline">
        <GenericLine data={rows} keys={[{ key: "vo2max_uth", label: "VO2max", color: HUE.heart }]} height={180} domain={[35, 65]} />
        <Explain>
          A population formula, not a lab test. It only moves when the RHR baseline moves, so read the direction over months. A measured HR max in the config would make it more honest.
        </Explain>
      </Panel>

      <Panel className="mt-3" title="Every morning">
        <DataTable
          rows={[...rows].reverse()}
          rowKey={(r) => r.date}
          cols={[
            { key: "date", label: "Date", render: (r) => <span className="text-foreground">{fmt.dateShort(r.date)} <span className="text-muted-foreground">{fmt.weekday(r.date)}</span></span> },
            { key: "rec", label: "Recovery", align: "right", render: (r) => <span style={{ color: bandColor(r.recovery_band) }}>{fmt.n(r.recovery, 0)} <span className="text-muted-foreground text-xs">{r.recovery != null ? bandLabel(r.recovery_band) : ""}</span></span> },
            { key: "rhr", label: "RHR", align: "right", render: (r) => fmt.n(r.rhr, 1) },
            { key: "base", label: "Baseline", align: "right", render: (r) => <span className="text-muted-foreground">{fmt.n(r.rhr_base30, 1)} ± {fmt.n(r.rhr_sd30, 1)}</span> },
            { key: "sleep", label: "Sleep perf", align: "right", render: (r) => r.sleep_performance == null ? "–" : `${fmt.n(r.sleep_performance, 0)}%` },
            { key: "spo2", label: "SpO2 min", align: "right", render: (r) => r.spo2_night_min == null ? "–" : `${fmt.n(r.spo2_night_min, 0)}%` },
            { key: "vo2", label: "VO2max", align: "right", render: (r) => fmt.n(r.vo2max_uth, 1) },
            { key: "cov", label: "Coverage", align: "right", render: (r) => r.hr_coverage_pct == null ? "–" : `${fmt.n(r.hr_coverage_pct, 0)}%` },
          ]}
        />
      </Panel>
    </>
  );
}
