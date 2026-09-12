import { BookOpen, Dumbbell, HeartPulse, LineChart } from "lucide-react";
import { PageHeader, List, Row, SectionTitle } from "@/components/page";
import { fmt } from "@/lib/format";
import { getDaily, getFreshness, getWorkouts, latestDate } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Browse" };

export default function Browse() {
  const latest = latestDate();
  const d = getDaily(latest);
  const fresh = getFreshness();
  const workouts = getWorkouts(7);
  const icon = "size-[18px]";
  return (
    <>
      <PageHeader title="Browse" lede="Everything that does not fit in the four main tabs." />
      <SectionTitle>Health categories</SectionTitle>
      <List>
        <Row href="/workouts" hue="strain" icon={<Dumbbell className={icon} />} title="Workouts" detail="Every session with its heart-rate trace" value={`${workouts.length} this week`} />
        <Row href="/heart-rate" hue="heart" icon={<HeartPulse className={icon} />} title="Heart rate" detail="Every sample of a day" value={d ? `${fmt.n(d.hr_avg, 0)} bpm avg` : undefined} />
        <Row href="/trends" hue="oxygen" icon={<LineChart className={icon} />} title="Trends" detail="Weekly means and correlations" />
        <Row href="/learn" hue="sleep" icon={<BookOpen className={icon} />} title="Learn" detail="Every metric, its formula, and its source" last />
      </List>

      <SectionTitle>Data source</SectionTitle>
      <List>
        <Row title="Device" value="CMF Watch Pro 2" />
        <Row title="Pipeline" value="Health Connect export" />
        <Row title="Last computed" value={fresh.lastCompute ? fmt.datetime(fresh.lastCompute) : "never"} />
        <Row title="Last day with data" value={fresh.lastDay ? fmt.dateShort(fresh.lastDay) : "–"} last />
      </List>
      {fresh.stale && (
        <p className="footnote text-label-2 mt-2 px-1">
          The data is more than a day old. Run <code className="text-foreground">vitals sync</code> to refresh it.
        </p>
      )}
    </>
  );
}
