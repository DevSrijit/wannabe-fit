import { GenericLine } from "@/components/charts/daily-charts";
import { HUE } from "@/components/charts/common";
import { DataTable } from "@/components/data-table";
import { PageHeader, Panel, Explain } from "@/components/page";
import { Term } from "@/components/term";
import { fmt } from "@/lib/format";
import { getAllDaily, getWeekly } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trends" };

export default function Trends() {
  const weeks = getWeekly(16).map((w) => ({ ...w, date: w.week }));
  const all = getAllDaily();
  const corr = pearson(all.map((d) => [d.strain, d.recovery]));
  const corrSleep = pearson(all.map((d) => [d.sleep_asleep_min, d.recovery]));
  const corrRhr = pearson(all.map((d) => [d.sleep_asleep_min, d.rhr]));
  const dow = dayOfWeek(all);

  return (
    <>
      <PageHeader title="Trends" lede={<>Weekly means since the watch started recording, and a few relationships between the numbers. {all.length} days with heart-rate data.</>} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Recovery and sleep performance, weekly mean" hue="good">
          <GenericLine data={weeks} keys={[{ key: "recovery", label: "Recovery", color: HUE.good }, { key: "sleep_perf", label: "Sleep performance", color: HUE.sleep }]} domain={[0, 100]} />
        </Panel>
        <Panel title="Resting heart rate, weekly mean" hue="heart">
          <GenericLine data={weeks} keys={[{ key: "rhr", label: "RHR", color: HUE.heart }]} unit="" />
        </Panel>
        <Panel title="Strain and weekly TRIMP" hue="strain">
          <GenericLine data={weeks} keys={[{ key: "strain", label: "Mean day strain", color: HUE.strain }]} domain={[0, 21]} />
        </Panel>
        <Panel title="Sleep, hours per night" hue="sleep">
          <GenericLine data={weeks} keys={[{ key: "sleep_h", label: "Asleep", color: HUE.sleep }]} domain={[0, 12]} unit="h" />
        </Panel>
        <Panel title="Steps per day, weekly mean" hue="oxygen">
          <GenericLine data={weeks} keys={[{ key: "steps", label: "Steps", color: HUE.oxygen }]} />
        </Panel>
        <Panel title={<Term slug="vo2max">VO2max estimate</Term>} hue="heart">
          <GenericLine data={weeks} keys={[{ key: "vo2", label: "VO2max", color: HUE.heart }]} domain={[35, 65]} />
        </Panel>
      </div>

      <Panel className="mt-3" title="What moves with what" note="Pearson correlation across all scored days">
        <div className="grid gap-4 sm:grid-cols-3">
          <Corr label="Day strain – next-morning recovery" r={corr} n={all.length} note="Negative means harder days lead to lower scores the next morning, as expected." />
          <Corr label="Sleep duration – recovery" r={corrSleep} n={all.length} note="Positive is expected because sleep performance is 35% of the score." />
          <Corr label="Sleep duration – resting HR" r={corrRhr} n={all.length} note="Negative means longer nights come with a lower resting heart rate." />
        </div>
        <Explain>
          Correlation is not cause and with two months of data the numbers are rough. Values under 0.2 in absolute size are noise. They become useful after six months.
        </Explain>
      </Panel>

      <Panel className="mt-3" title="By day of the week" note="Means over the whole record">
        <DataTable
          rows={dow}
          rowKey={(r) => r.day}
          cols={[
            { key: "day", label: "Day", render: (r) => r.day },
            { key: "n", label: "Days", align: "right", render: (r) => r.n },
            { key: "rec", label: "Recovery", align: "right", render: (r) => fmt.n(r.recovery, 0) },
            { key: "sleep", label: "Asleep", align: "right", render: (r) => fmt.hm(r.sleep) },
            { key: "bed", label: "Bedtime", align: "right", render: (r) => r.bed },
            { key: "strain", label: "Strain", align: "right", render: (r) => fmt.n(r.strain, 1) },
            { key: "steps", label: "Steps", align: "right", render: (r) => fmt.int(r.steps) },
          ]}
        />
      </Panel>

      <Panel className="mt-3" title="Week by week">
        <DataTable
          rows={[...weeks].reverse()}
          rowKey={(r) => r.week}
          cols={[
            { key: "week", label: "Week", render: (r) => r.week },
            { key: "days", label: "Days", align: "right", render: (r) => r.days },
            { key: "rec", label: "Recovery", align: "right", render: (r) => fmt.n(r.recovery, 0) },
            { key: "rhr", label: "RHR", align: "right", render: (r) => fmt.n(r.rhr, 1) },
            { key: "sleep", label: "Sleep h", align: "right", render: (r) => fmt.n(r.sleep_h, 1) },
            { key: "perf", label: "Sleep perf", align: "right", render: (r) => fmt.n(r.sleep_perf, 0) },
            { key: "strain", label: "Strain", align: "right", render: (r) => fmt.n(r.strain, 1) },
            { key: "trimp", label: "TRIMP", align: "right", render: (r) => fmt.n(r.trimp, 0) },
            { key: "steps", label: "Steps", align: "right", render: (r) => fmt.int(r.steps) },
            { key: "spo2", label: "SpO2", align: "right", render: (r) => fmt.n(r.spo2, 1) },
            { key: "vo2", label: "VO2max", align: "right", render: (r) => fmt.n(r.vo2, 1) },
          ]}
        />
      </Panel>
    </>
  );
}

function Corr({ label, r, n, note }: { label: string; r: number | null; n: number; note: string }) {
  return (
    <div className="bg-fill-3 rounded-xl p-4">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="num display mt-1 text-4xl">{r == null ? "–" : (r >= 0 ? "+" : "−") + Math.abs(r).toFixed(2)}</div>
      <div className="text-muted-foreground mt-1 text-xs">r, n = {n}. {note}</div>
    </div>
  );
}

function pearson(pairs: (number | null)[][]): number | null {
  const p = pairs.filter((x): x is [number, number] => x[0] != null && x[1] != null);
  if (p.length < 10) return null;
  const mx = p.reduce((a, [x]) => a + x, 0) / p.length;
  const my = p.reduce((a, [, y]) => a + y, 0) / p.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of p) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

function dayOfWeek(all: ReturnType<typeof getAllDaily>) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const acc = names.map((day) => ({ day, n: 0, recovery: [] as number[], sleep: [] as number[], bed: [] as number[], strain: [] as number[], steps: [] as number[] }));
  for (const d of all) {
    const i = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    const a = acc[i];
    a.n++;
    if (d.recovery != null) a.recovery.push(d.recovery);
    if (d.sleep_asleep_min != null) a.sleep.push(d.sleep_asleep_min);
    if (d.strain != null) a.strain.push(d.strain);
    if (d.steps != null) a.steps.push(d.steps);
    if (d.sleep_start) { const [h, m] = d.sleep_start.split(":").map(Number); const v = h * 60 + m; a.bed.push(v < 720 ? v + 1440 : v); }
  }
  const mean = (v: number[]) => (v.length ? v.reduce((x, y) => x + y, 0) / v.length : null);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((i) => {
    const a = acc[i];
    const b = mean(a.bed);
    const bed = b == null ? "–" : `${String(Math.floor((b % 1440) / 60)).padStart(2, "0")}:${String(Math.round(b % 60)).padStart(2, "0")}`;
    return { day: a.day, n: a.n, recovery: mean(a.recovery), sleep: mean(a.sleep), bed, strain: mean(a.strain), steps: mean(a.steps) };
  });
}
