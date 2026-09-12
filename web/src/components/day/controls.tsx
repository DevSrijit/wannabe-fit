import { DateNav } from "@/components/date-nav";
import { RangeTabs } from "@/components/range-tabs";

/** The range control with "D" selected, and a day picker under it. */
export function DayControls({ base, date, latest }: { base: string; date: string; latest: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <RangeTabs base={base} days={1} />
      <DateNav date={date} latest={latest} base={base} params={{ days: "1" }} />
    </div>
  );
}

export function dayTitle(date: string, latest: string, page: string) {
  return date === latest ? `${page} today` : page;
}
