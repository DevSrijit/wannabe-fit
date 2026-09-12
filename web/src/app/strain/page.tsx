import { AcwrChart, PmcChart, StrainChart, ZonesChart, GenericLine } from "@/components/charts/daily-charts";
import { HUE } from "@/components/charts/common";
import { DataTable } from "@/components/data-table";
import { PageHeader, Panel, Stat, Explain } from "@/components/page";
import { RangeTabs } from "@/components/range-tabs";
import { resolveDays } from "@/components/range";
import { StrainDay } from "@/components/day/strain-day";
import { resolveDate } from "@/components/date-nav";
import { Term } from "@/components/term";
import { fmt } from "@/lib/format";
import { getDailyRange, getProfile, latestDate } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strain" };

export default async function Strain({ searchParams }: PageProps<"/strain">) {
  const sp = await searchParams;
  const days = await resolveDays(sp.days, 30);
  if (days === 1) return <StrainDay date={resolveDate(sp.date, latestDate())} />;
  const rows = getDailyRange(days);
  const pmc = getDailyRange(90);
  const latest = rows[rows.length - 1];
  const sum = (k: "trimp" | "z1" | "z2" | "z3" | "z4" | "z5") => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const strains = rows.map((r) => r.strain).filter((v): v is number => v != null);
  const meanStrain = strains.length ? strains.reduce((a, b) => a + b, 0) / strains.length : null;
  const profile = getProfile();
  const rhrB = latest?.rhr_base30 ?? 60;
  const hrMax = profile.hrMax ?? 190;
  const reserve = hrMax - rhrB;
  const zoneBpm = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((f) => Math.round(rhrB + f * reserve));

  return (
    <>
      <PageHeader
        title="Strain"
        lede={
          <>
            Cardiovascular load from every heart-rate sample above 30% of reserve, not only from logged workouts. <Term slug="strain">Strain</Term> is the daily headline; <Term slug="trimp">TRIMP</Term> is the research unit underneath it that the fitness model runs on.
          </>
        }
        aside={<RangeTabs base="/strain" days={days} />}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel><Stat label="Mean day strain" value={fmt.n(meanStrain, 1)} hue={HUE.strain} sub={`hardest ${fmt.n(Math.max(...strains, 0), 1)}`} /></Panel>
        <Panel><Stat label={`TRIMP, ${days} days`} value={fmt.n(sum("trimp"), 0)} sub={`${fmt.n(sum("trimp") / (days / 7), 0)} per week`} /></Panel>
        <Panel><Stat label={<Term slug="ctl">Fitness (CTL)</Term>} value={fmt.n(latest?.ctl, 1)} sub={<><Term slug="atl">fatigue</Term> {fmt.n(latest?.atl, 1)} · <Term slug="tsb">form</Term> {fmt.signed(latest?.tsb, 1)}</>} /></Panel>
        <Panel><Stat label={<Term slug="acwr">Acute:chronic ratio</Term>} value={fmt.n(latest?.acwr, 2)} hue={latest?.acwr != null && latest.acwr > 1.5 ? HUE.low : latest?.acwr != null && latest.acwr < 0.8 ? HUE.warn : undefined} sub="0.8–1.3 is the safe range" /></Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={<Term slug="strain">Day strain</Term>} hue="strain" note="0–21; the dashed line at 14 marks a high day">
          <StrainChart data={rows} />
          <Explain>
            Logarithmic on purpose. Going from 10 to 14 takes far less work than going from 17 to 21. Because it is built from zone minutes, a long walk in zone 1 adds almost nothing while an hour of tempo in zone 3 adds a lot.
          </Explain>
        </Panel>
        <Panel title={<>Minutes in <Term slug="zones">zones</Term></>} hue="strain" note={`Boundaries today: ${zoneBpm.slice(0, 5).map((b, i) => `z${i + 1} ${b}`).join(" · ")} bpm`}>
          <ZonesChart data={rows} />
          <Explain>
            Zones are fractions of heart-rate reserve (HR max {fmt.n(hrMax, 0)} minus RHR baseline {fmt.n(rhrB, 0)}). Zone 1 starts at {zoneBpm[0]} bpm and zone 5 at {zoneBpm[4]} bpm. A well-built week keeps most minutes in zones 1–2 with one or two sessions that reach 4–5.
          </Explain>
        </Panel>
      </div>

      <Panel className="mt-3" title="Fitness, fatigue, and form" hue="strain" note="Banister impulse-response model over 90 days">
        <PmcChart data={pmc} />
        <Explain>
          <Term slug="ctl">Fitness</Term> is a 42-day weighted average of TRIMP and moves slowly. <Term slug="atl">Fatigue</Term> is the 7-day version and moves fast. <Term slug="tsb">Form</Term> is the gap between them: negative while you build, positive when you taper. The bars show form; a run of bars below −30 means the load is ahead of what the body has adapted to.
        </Explain>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title={<Term slug="acwr">Acute:chronic workload ratio</Term>} hue="strain" note="7-day mean ÷ 28-day mean">
          <AcwrChart data={pmc} />
          <Explain>
            The green band (0.8–1.3) is where injury rates are lowest in the team-sport literature. Above 1.5 the ratio flags a spike. The thresholds are contested; use the ratio as a reason to look, not as a rule.
          </Explain>
        </Panel>
        <Panel title={<Term slug="kcal-hr">Calories from heart rate</Term>} hue="strain" note="Keytel 2005, active minutes only">
          <GenericLine data={rows} keys={[{ key: "kcal_hr", label: "kcal (HR)", color: HUE.strain }, { key: "kcal_active_device", label: "kcal (watch, active)", color: HUE.muted }]} height={200} />
          <Explain>
            Two independent estimates of the same thing. The heart-rate one counts only minutes above 30% of reserve. The watch’s active figure uses its own step and motion model. When they disagree by a lot the watch usually counted walking that never raised the heart rate.
          </Explain>
        </Panel>
      </div>

      <Panel className="mt-3" title="Every day" hue="strain">
        <DataTable
          rows={[...rows].reverse()}
          rowKey={(r) => r.date}
          cols={[
            { key: "date", label: "Date", render: (r) => <span>{fmt.dateShort(r.date)} <span className="text-muted-foreground">{fmt.weekday(r.date)}</span></span> },
            { key: "strain", label: "Strain", align: "right", render: (r) => <span style={{ color: HUE.strain }}>{fmt.n(r.strain, 1)}</span> },
            { key: "trimp", label: "TRIMP", align: "right", render: (r) => fmt.n(r.trimp, 0) },
            { key: "z", label: "z1 / z2 / z3 / z4 / z5 min", align: "right", render: (r) => <span className="text-muted-foreground">{[r.z1, r.z2, r.z3, r.z4, r.z5].map((z) => fmt.n(z, 0)).join(" / ")}</span> },
            { key: "kcal", label: "kcal HR", align: "right", render: (r) => fmt.n(r.kcal_hr, 0) },
            { key: "ctl", label: "CTL", align: "right", render: (r) => fmt.n(r.ctl, 1) },
            { key: "atl", label: "ATL", align: "right", render: (r) => fmt.n(r.atl, 1) },
            { key: "tsb", label: "TSB", align: "right", render: (r) => fmt.signed(r.tsb, 1) },
            { key: "acwr", label: "ACWR", align: "right", render: (r) => fmt.n(r.acwr, 2) },
            { key: "steps", label: "Steps", align: "right", render: (r) => fmt.int(r.steps) },
          ]}
        />
      </Panel>
    </>
  );
}
