import { RecoveryRing } from "@/components/charts/recovery-ring";
import { HUE } from "@/components/charts/common";
import { Card, List, PageHeader, Row, SectionTitle, Stat } from "@/components/page";
import { Term } from "@/components/term";
import { DayControls } from "./controls";
import { addDays, bandLabel, fmt } from "@/lib/format";
import { getDaily, getMainSleep, getSpo2, latestDate } from "@/lib/queries";
import { rhrComponent, spo2Component, verdict } from "@/lib/verdict";

export function RecoveryDay({ date }: { date: string }) {
  const latest = latestDate();
  const d = getDaily(date);
  const prev = getDaily(addDays(date, -1));
  const sleep = getMainSleep(date);
  const spo2 = sleep ? getSpo2(sleep.session.start, sleep.session.end) : [];
  const controls = <DayControls base="/recovery" date={date} latest={latest} />;
  if (!d) {
    return (
      <>
        <PageHeader title="Recovery" eyebrow={fmt.dateLong(date)} aside={controls} />
        <Card><p className="text-label-2 body-text">No data for this day.</p></Card>
      </>
    );
  }
  const rhrC = rhrComponent(d);
  const spo2C = spo2Component(d);
  const z = d.rhr != null && d.rhr_base30 != null && d.rhr_sd30 ? (d.rhr - d.rhr_base30) / Math.max(d.rhr_sd30, 1.5) : null;
  const rings = [
    { value: rhrC, color: "var(--heart)", label: "Resting HR" },
    { value: d.sleep_performance, color: "var(--sleep)", label: "Sleep" },
    { value: spo2C, color: "var(--oxygen)", label: "Blood oxygen" },
  ];
  const w = (c: number | null, k: number) => (c == null ? null : (c * k) / 100);
  const parts = [w(rhrC, 50), w(d.sleep_performance, 35), w(spo2C, 15)];
  const dRhr = d.rhr != null && prev?.rhr != null ? d.rhr - prev.rhr : null;
  const dRec = d.recovery != null && prev?.recovery != null ? d.recovery - prev.recovery : null;

  return (
    <>
      <PageHeader title="Recovery" eyebrow={fmt.dateLong(date)} lede={verdict(d, prev).join(" ")} aside={controls} />

      <Card>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
          <RecoveryRing score={d.recovery} band={d.recovery_band} rings={rings} />
          <div className="grid w-full grid-cols-2 gap-x-6 gap-y-4">
            <Stat label="Score" value={fmt.n(d.recovery, 0)} sub={bandLabel(d.recovery_band)} />
            <Stat label="Against yesterday" value={fmt.signed(dRec, 0)} sub={prev?.recovery != null ? `was ${fmt.n(prev.recovery, 0)}` : "no score yesterday"} />
            <Stat label={<Term slug="rhr">Resting HR</Term>} value={fmt.n(d.rhr, 0)} unit="bpm" hue={HUE.heart} sub={dRhr == null ? undefined : `${fmt.signed(dRhr, 0)} bpm on yesterday`} />
            <Stat label={<Term slug="spo2">SpO2 low</Term>} value={fmt.n(d.spo2_night_min, 0)} unit="%" hue={HUE.oxygen} sub={`mean ${fmt.n(d.spo2_night_mean, 1)}%`} />
          </div>
        </div>
      </Card>

      <SectionTitle>How the score was built</SectionTitle>
      <List>
        <Row
          hue="heart"
          icon={<Dot />}
          title={<Term slug="rhr">Resting heart rate</Term>}
          detail={
            z == null
              ? "no baseline yet"
              : `${fmt.n(d.rhr, 1)} bpm against ${fmt.n(d.rhr_base30, 1)} ± ${fmt.n(d.rhr_sd30, 1)}, z = ${fmt.signed(z, 2)}, 70 − 20z = ${fmt.n(rhrC, 0)}`
          }
          value={`${fmt.n(rhrC, 0)} × 0.50 = ${fmt.n(parts[0], 1)}`}
        />
        <Row
          hue="sleep"
          icon={<Dot />}
          title={<Term slug="sleep-performance">Sleep performance</Term>}
          detail={`${fmt.hm(d.sleep_asleep_min)} asleep of ${fmt.hm(d.sleep_need_min)} needed`}
          value={`${fmt.n(d.sleep_performance, 0)} × 0.35 = ${fmt.n(parts[1], 1)}`}
        />
        <Row
          hue="oxygen"
          icon={<Dot />}
          title={<Term slug="spo2">Blood oxygen</Term>}
          detail={`lowest ${fmt.n(d.spo2_night_min, 0)}%, mapped 88% → 0 and 95% → 100`}
          value={`${fmt.n(spo2C, 0)} × 0.15 = ${fmt.n(parts[2], 1)}`}
        />
        <Row title="Recovery" value={<span className="text-foreground font-semibold">{parts.every((p) => p != null) ? fmt.n(parts.reduce((a, b) => (a ?? 0) + (b ?? 0), 0), 0) : fmt.n(d.recovery, 0)}</span>} last />
      </List>
      <p className="footnote text-label-2 mt-2 px-1">
        Bands: 67 and above is recovered, 34 to 66 is adequate, below 34 is low. Nothing here is a forecast. Every input was measured overnight.
      </p>

      <SectionTitle>The night behind it</SectionTitle>
      <List>
        <Row title="Sleep window" value={d.sleep_start ? `${d.sleep_start} – ${d.sleep_end}` : "none"} />
        <Row title="Time asleep" detail={`in bed ${fmt.hm(d.sleep_tib_min)}`} value={fmt.hm(d.sleep_asleep_min)} />
        <Row title={<Term slug="sleep-need">Sleep need</Term>} detail={`debt over 7 nights ${fmt.n(d.sleep_debt7_h, 1)} h`} value={fmt.hm(d.sleep_need_min)} />
        <Row title="Resting HR method" detail="lowest 15-minute mean inside the sleep window" value={d.rhr_method?.replace(/_/g, " ") ?? "–"} />
        <Row title={<Term slug="rhr-baseline">30-day baseline</Term>} value={`${fmt.n(d.rhr_base30, 1)} ± ${fmt.n(d.rhr_sd30, 1)} bpm`} />
        <Row title="Heart-rate samples in the day" detail={`${fmt.n(d.hr_coverage_pct, 0)}% coverage`} value={fmt.int(d.hr_samples)} last />
      </List>

      {spo2.length > 0 && (
        <>
          <SectionTitle>Blood oxygen readings while asleep</SectionTitle>
          <Card>
            <div className="flex flex-wrap gap-1.5">
              {spo2.map((s) => (
                <span key={s.ts} className="num bg-fill-3 caption rounded-md px-2 py-1" style={{ color: s.pct < 92 ? HUE.low : s.pct < 95 ? HUE.warn : undefined }}>
                  {fmt.time(s.ts)} <span className="text-foreground">{fmt.n(s.pct, 0)}%</span>
                </span>
              ))}
            </div>
            <p className="footnote text-label-2 mt-3">
              {spo2.length} readings. Values under 95% are amber, under 92% red. One low reading is usually a loose strap.
            </p>
          </Card>
        </>
      )}
    </>
  );
}

function Dot() {
  return <span className="size-2.5 rounded-full bg-white/90" />;
}
