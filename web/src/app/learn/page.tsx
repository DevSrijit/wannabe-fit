import { Card, PageHeader, SectionTitle } from "@/components/page";
import { GROUPS, TERMS } from "@/lib/glossary";
import { fmt } from "@/lib/format";
import { getDaily, getProfile, latestDate } from "@/lib/queries";

export const metadata = { title: "Learn" };
export const dynamic = "force-dynamic";

const HUE_VAR: Record<string, string> = { strain: "var(--strain)", sleep: "var(--sleep)", heart: "var(--heart)", oxygen: "var(--oxygen)", good: "var(--good)", neutral: "var(--muted-foreground)" };

export default function Learn() {
  const latest = latestDate();
  const d = getDaily(latest);
  const profile = getProfile();
  const current: Record<string, string> = d
    ? {
        recovery: fmt.n(d.recovery, 0),
        rhr: `${fmt.n(d.rhr, 1)} bpm`,
        "rhr-baseline": `${fmt.n(d.rhr_base30, 1)} ± ${fmt.n(d.rhr_sd30, 1)} bpm`,
        spo2: `mean ${fmt.n(d.spo2_night_mean, 1)}%, min ${fmt.n(d.spo2_night_min, 0)}%`,
        "sleep-performance": `${fmt.n(d.sleep_performance, 0)}%`,
        "sleep-need": fmt.hm(d.sleep_need_min),
        "sleep-debt": `${fmt.n(d.sleep_debt7_h, 1)} h`,
        "sleep-stages": `deep ${fmt.hm(d.sleep_deep_min)}, REM ${fmt.hm(d.sleep_rem_min)}, light ${fmt.hm(d.sleep_light_min)}`,
        "sleep-efficiency": `${fmt.n(d.sleep_efficiency, 0)}%`,
        "sleep-consistency": fmt.n(d.sleep_consistency, 0),
        strain: fmt.n(d.strain, 1),
        trimp: fmt.n(d.trimp, 0),
        "trimp-edwards": fmt.n(d.trimp_edwards, 0),
        zones: `${[d.z1, d.z2, d.z3, d.z4, d.z5].map((z) => fmt.n(z, 0)).join(" / ")} min`,
        "hr-max": `${fmt.n(profile.hrMax, 1)} bpm`,
        "kcal-hr": `${fmt.n(d.kcal_hr, 0)} kcal`,
        ctl: fmt.n(d.ctl, 1),
        atl: fmt.n(d.atl, 1),
        tsb: fmt.signed(d.tsb, 1),
        acwr: fmt.n(d.acwr, 2),
        vo2max: `${fmt.n(d.vo2max_uth, 1)} ml/kg/min`,
        "hr-coverage": `${fmt.n(d.hr_coverage_pct, 0)}%`,
      }
    : {};

  return (
    <>
      <PageHeader
        title="Learn"
        lede={<>Every number on this site, what it means, the exact formula the pipeline uses, how to read it, and where the idea comes from. The value shown beside each term is from {fmt.dateLong(latest)}.</>}
      />
      <div className="scrollbar-none -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {GROUPS.map((g) => (
          <a key={g} href={`#group-${g.toLowerCase()}`} className="bg-card pressable subhead shrink-0 rounded-full px-3.5 py-1.5 font-medium">{g}</a>
        ))}
      </div>
      {GROUPS.map((g) => (
        <section key={g} id={`group-${g.toLowerCase()}`} className="scroll-mt-16">
          <SectionTitle>{g}</SectionTitle>
          <div className="space-y-3">
            {TERMS.filter((t) => t.group === g).map((t) => (
              <Card key={t.slug} title={t.name} hue={HUE_VAR[t.hue]} note={<code className="caption">{t.column}</code>} id={t.slug} className="scroll-mt-16">
                {current[t.slug] && (
                  <div className="num display mb-3 text-[26px]">
                    {current[t.slug]} <span className="footnote text-label-2 font-normal">now</span>
                  </div>
                )}
                <div className="subhead max-w-prose space-y-2.5">
                  <p className="body-text">{t.short}</p>
                  <p><span className="text-label-2">Why it matters.</span> {t.why}</p>
                  <pre className="bg-background num whitespace-pre-wrap rounded-lg px-4 py-3 font-sans text-[13px] leading-relaxed">{t.formula}</pre>
                  <p><span className="text-label-2">How to read it.</span> {t.read}</p>
                  <p><span className="text-label-2">Source.</span> {t.source}</p>
                  {t.caveat && <p><span className="text-label-2">Caveat.</span> {t.caveat}</p>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
