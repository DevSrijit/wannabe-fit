import { Hypnogram } from "@/components/charts/hypnogram";
import { HUE, STAGE } from "@/components/charts/common";
import { Card, List, PageHeader, Row, SectionTitle, Stat } from "@/components/page";
import { Term } from "@/components/term";
import { DayControls } from "./controls";
import { addDays, fmt } from "@/lib/format";
import { getDaily, getMainSleep, latestDate } from "@/lib/queries";

const STAGE_KEY: Record<number, keyof typeof STAGE | undefined> = { 1: "awake", 7: "awake", 6: "rem", 4: "light", 2: "light", 5: "deep" };

export function SleepDay({ date }: { date: string }) {
  const latest = latestDate();
  const d = getDaily(date);
  const prev = getDaily(addDays(date, -1));
  const sleep = getMainSleep(date);
  const controls = <DayControls base="/sleep" date={date} latest={latest} />;
  if (!d || !sleep || d.sleep_asleep_min == null) {
    return (
      <>
        <PageHeader title="Sleep" eyebrow={fmt.dateLong(date)} aside={controls} />
        <Card><p className="text-label-2 body-text">The watch recorded no sleep session ending on this day.</p></Card>
      </>
    );
  }
  const stages = [
    ["deep", d.sleep_deep_min],
    ["rem", d.sleep_rem_min],
    ["light", d.sleep_light_min],
    ["awake", d.sleep_awake_min],
  ] as const;
  const asleep = d.sleep_asleep_min || 1;
  const strainTerm = prev?.strain != null ? (60 * prev.strain) / 21 : 0;
  const debtTerm = d.sleep_need_min != null ? d.sleep_need_min - 480 - strainTerm : null;
  const segments = sleep.stages.filter((s) => STAGE_KEY[s.stage]);

  return (
    <>
      <PageHeader
        title="Sleep"
        eyebrow={fmt.dateLong(date)}
        lede={`Fell asleep at ${fmt.time(sleep.session.start)}, woke at ${fmt.time(sleep.session.end)}. ${fmt.hm(d.sleep_asleep_min)} asleep of ${fmt.hm(d.sleep_need_min)} needed, ${fmt.n(d.sleep_performance, 0)}% performance.`}
        aside={controls}
      />

      <Card title="The night" hue="sleep" note={`${fmt.time(sleep.session.start)} – ${fmt.time(sleep.session.end)}`}>
        <Hypnogram start={sleep.session.start} end={sleep.session.end} stages={sleep.stages} />
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Asleep" value={fmt.hm(d.sleep_asleep_min)} hue={HUE.sleep} />
          <Stat label="In bed" value={fmt.hm(d.sleep_tib_min)} />
          <Stat label={<Term slug="sleep-efficiency">Efficiency</Term>} value={fmt.n(d.sleep_efficiency, 0)} unit="%" />
          <Stat label="Awakenings" value={fmt.n(d.sleep_awakenings, 0)} sub={`${fmt.hm(d.sleep_awake_min)} awake`} />
        </div>
      </Card>

      <SectionTitle>Stages</SectionTitle>
      <Card>
        <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-sm">
          {stages.map(([k, v]) => (
            <div key={k} style={{ width: `${(100 * (v ?? 0)) / (asleep + (d.sleep_awake_min ?? 0))}%`, background: STAGE[k].fill }} />
          ))}
        </div>
        <ul className="mt-3 divide-y divide-border/70">
          {stages.map(([k, v]) => (
            <li key={k} className="flex items-center gap-3 py-2.5">
              <span className="size-3 rounded-sm" style={{ background: STAGE[k].fill }} />
              <span className="subhead flex-1">{STAGE[k].label}</span>
              <span className="num subhead">{fmt.hm(v)}</span>
              <span className="num text-label-2 subhead w-12 text-right">{k === "awake" ? "" : `${fmt.n((100 * (v ?? 0)) / asleep, 0)}%`}</span>
            </li>
          ))}
        </ul>
        <p className="footnote text-label-2 mt-2">
          Percentages are of time asleep. Healthy adults in a sleep lab spend about 13 to 23% in deep and 20 to 25% in REM. Wrist staging over-counts light sleep.
        </p>
      </Card>

      <SectionTitle>Why the need was {fmt.hm(d.sleep_need_min)}</SectionTitle>
      <List>
        <Row title="Base" detail="every night starts here" value="8h 00m" />
        <Row title="Yesterday's strain" detail={prev?.strain != null ? `60 min × ${fmt.n(prev.strain, 1)} ÷ 21` : "no strain recorded"} value={`+ ${fmt.hm(strainTerm)}`} />
        <Row title={<Term slug="sleep-debt">Debt carried</Term>} detail="half the 7-night debt, capped at 60 min" value={`+ ${fmt.hm(Math.max(0, debtTerm ?? 0))}`} />
        <Row title={<Term slug="sleep-need">Need</Term>} value={<span className="text-foreground font-semibold">{fmt.hm(d.sleep_need_min)}</span>} last />
      </List>

      <SectionTitle>Regularity</SectionTitle>
      <List>
        <Row title="Bedtime" detail={prev?.sleep_start ? `yesterday ${prev.sleep_start}` : undefined} value={d.sleep_start ?? "–"} />
        <Row title="Wake time" detail={prev?.sleep_end ? `yesterday ${prev.sleep_end}` : undefined} value={d.sleep_end ?? "–"} />
        <Row title={<Term slug="sleep-consistency">Consistency</Term>} detail="spread of bed and wake times over 7 nights" value={fmt.n(d.sleep_consistency, 0)} />
        <Row title={<Term slug="sleep-debt">Debt, 7 nights</Term>} detail="missed against the 8 h base" value={`${fmt.n(d.sleep_debt7_h, 1)} h`} last />
      </List>

      <SectionTitle>Timeline</SectionTitle>
      <List>
        {segments.map((s, i) => {
          const k = STAGE_KEY[s.stage]!;
          return (
            <Row
              key={i}
              icon={<span className="size-3 rounded-sm" style={{ background: STAGE[k].fill }} />}
              hue="transparent"
              title={STAGE[k].label}
              detail={`${fmt.time(s.start)} – ${fmt.time(s.end)}`}
              value={`${Math.round((s.end - s.start) / 60000)} min`}
              last={i === segments.length - 1}
            />
          );
        })}
      </List>
    </>
  );
}
