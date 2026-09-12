import { SleepChart, GenericLine } from "@/components/charts/daily-charts";
import { Hypnogram } from "@/components/charts/hypnogram";
import { HUE, STAGE } from "@/components/charts/common";
import { DataTable } from "@/components/data-table";
import { PageHeader, Panel, Stat, Explain } from "@/components/page";
import { RangeTabs } from "@/components/range-tabs";
import { resolveDays } from "@/components/range";
import { SleepDay } from "@/components/day/sleep-day";
import { resolveDate } from "@/components/date-nav";
import { Term } from "@/components/term";
import { fmt } from "@/lib/format";
import { getDailyRange, getMainSleep, latestDate } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sleep" };

export default async function Sleep({ searchParams }: PageProps<"/sleep">) {
  const sp = await searchParams;
  const days = await resolveDays(sp.days, 30);
  if (days === 1) return <SleepDay date={resolveDate(sp.date, latestDate())} />;
  const rows = getDailyRange(days);
  const nights = rows.filter((r) => r.sleep_asleep_min != null);
  const latest = latestDate();
  const last = getMainSleep(latest);
  const lastRow = rows.find((r) => r.date === latest);
  const avg = (k: keyof (typeof nights)[number]) => {
    const v = nights.map((r) => r[k]).filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const asleep = avg("sleep_asleep_min");
  const deep = avg("sleep_deep_min");
  const rem = avg("sleep_rem_min");
  const light = avg("sleep_light_min");
  const total = (deep ?? 0) + (rem ?? 0) + (light ?? 0) || 1;

  return (
    <>
      <PageHeader
        title="Sleep"
        lede={
          <>
            Each night is attributed to the morning it ended on. <Term slug="sleep-need">Need</Term> moves with yesterday’s strain and with the week’s <Term slug="sleep-debt">debt</Term>, so the target is personal and changes daily.
          </>
        }
        aside={<RangeTabs base="/sleep" days={days} />}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel><Stat label={`Mean asleep, ${nights.length} nights`} value={fmt.hm(asleep)} hue={HUE.sleep} /></Panel>
        <Panel><Stat label={<Term slug="sleep-performance">Mean performance</Term>} value={fmt.n(avg("sleep_performance"), 0)} unit="%" /></Panel>
        <Panel><Stat label={<Term slug="sleep-consistency">Consistency now</Term>} value={fmt.n(lastRow?.sleep_consistency, 0)} sub="bed and wake time regularity, 7 nights" /></Panel>
        <Panel><Stat label={<Term slug="sleep-debt">Debt now</Term>} value={fmt.n(lastRow?.sleep_debt7_h, 1)} unit="h" sub="missed against 8 h base, 7 nights" /></Panel>
      </div>

      {last && lastRow && (
        <Panel
          hue="sleep"
          title="Last night"
          note={`${fmt.time(last.session.start)} – ${fmt.time(last.session.end)}, woke ${fmt.dateShort(latest)}`}
          href="/"
        >
          <Hypnogram start={last.session.start} end={last.session.end} stages={last.stages} />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Stat label="Asleep" value={fmt.hm(lastRow.sleep_asleep_min)} />
            <Stat label="In bed" value={fmt.hm(lastRow.sleep_tib_min)} />
            <Stat label="Deep" value={fmt.hm(lastRow.sleep_deep_min)} hue={STAGE.deep.fill} />
            <Stat label="REM" value={fmt.hm(lastRow.sleep_rem_min)} hue={STAGE.rem.fill} />
            <Stat label="Light" value={fmt.hm(lastRow.sleep_light_min)} />
            <Stat label="Awakenings" value={fmt.n(lastRow.sleep_awakenings, 0)} sub={`${fmt.hm(lastRow.sleep_awake_min)} awake`} />
          </div>
          <Explain>
            The rows follow the convention of a sleep lab: the line sinks as sleep deepens. Deep sleep clusters in the first half of the night and REM in the second half, so cutting a night short at the alarm mostly costs REM. Wrist staging is approximate; trust the total and the timing more than the split.
          </Explain>
        </Panel>
      )}

      <Panel className="mt-3" title="Sleep against need" hue="sleep" note="Stacked stages; the dashed step is the night's need">
        <SleepChart data={rows} />
        <Explain>
          When the bar reaches the dashed line the night was complete and <Term slug="sleep-performance">performance</Term> is 100%. The line rises the morning after a hard day and while debt is outstanding.
        </Explain>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Stage mix over the period" hue="sleep">
          <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded-sm">
            {[["deep", deep], ["rem", rem], ["light", light]].map(([k, v]) => (
              <div key={String(k)} style={{ width: `${(100 * ((v as number) ?? 0)) / total}%`, background: STAGE[k as keyof typeof STAGE].fill }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Deep" value={`${fmt.n((100 * (deep ?? 0)) / total, 0)}%`} sub={`${fmt.hm(deep)} · typical 13–23%`} />
            <Stat label="REM" value={`${fmt.n((100 * (rem ?? 0)) / total, 0)}%`} sub={`${fmt.hm(rem)} · typical 20–25%`} />
            <Stat label="Light" value={`${fmt.n((100 * (light ?? 0)) / total, 0)}%`} sub={`${fmt.hm(light)} · typical 50–60%`} />
          </div>
          <Explain>
            Typical ranges are for healthy adults from polysomnography. A wrist device tends to over-count light sleep. Compare your own months against each other, not against the textbook.
          </Explain>
        </Panel>
        <Panel title={<Term slug="sleep-consistency">Consistency and performance</Term>} hue="sleep">
          <GenericLine
            data={rows}
            keys={[
              { key: "sleep_consistency", label: "Consistency", color: HUE.sleep },
              { key: "sleep_performance", label: "Performance", color: HUE.oxygen },
            ]}
            height={200}
            domain={[0, 100]}
          />
          <Explain>
            Consistency drops 25 points for every hour of spread in bed and wake times across the week. It is the metric that rewards boring habits, and it matters more than most people expect.
          </Explain>
        </Panel>
      </div>

      <Panel className="mt-3" title="Every night" hue="sleep">
        <DataTable
          rows={[...rows].reverse()}
          rowKey={(r) => r.date}
          cols={[
            { key: "date", label: "Woke on", render: (r) => <span>{fmt.dateShort(r.date)} <span className="text-muted-foreground">{fmt.weekday(r.date)}</span></span> },
            { key: "window", label: "Bed – wake", render: (r) => r.sleep_start ? `${r.sleep_start} – ${r.sleep_end}` : "–" },
            { key: "asleep", label: "Asleep", align: "right", render: (r) => fmt.hm(r.sleep_asleep_min) },
            { key: "need", label: "Need", align: "right", render: (r) => <span className="text-muted-foreground">{fmt.hm(r.sleep_need_min)}</span> },
            { key: "perf", label: "Perf", align: "right", render: (r) => r.sleep_performance == null ? "–" : `${fmt.n(r.sleep_performance, 0)}%` },
            { key: "deep", label: "Deep", align: "right", render: (r) => fmt.hm(r.sleep_deep_min) },
            { key: "rem", label: "REM", align: "right", render: (r) => fmt.hm(r.sleep_rem_min) },
            { key: "eff", label: "Eff", align: "right", render: (r) => r.sleep_efficiency == null ? "–" : `${fmt.n(r.sleep_efficiency, 0)}%` },
            { key: "wake", label: "Wakes", align: "right", render: (r) => fmt.n(r.sleep_awakenings, 0) },
            { key: "cons", label: "Consistency", align: "right", render: (r) => fmt.n(r.sleep_consistency, 0) },
          ]}
        />
      </Panel>
    </>
  );
}
