import Link from "next/link";
import { cn } from "cn";
import { addDays, fmt } from "@/lib/format";

function Arrow({ dir }: { dir: "l" | "r" }) {
  return (
    <svg width="10" height="17" viewBox="0 0 10 17" fill="none" aria-hidden>
      <path d={dir === "l" ? "M8.5 1.5 1.5 8.5l7 7" : "M1.5 1.5l7 7-7 7"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DateNav({ date, latest, base, params = {} }: { date: string; latest: string; base: string; params?: Record<string, string> }) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const q = (d?: string) => {
    const u = new URLSearchParams({ ...params, ...(d ? { date: d } : {}) }).toString();
    return u ? `${base}?${u}` : base;
  };
  const atLatest = date >= latest;
  const btn = "pressable flex size-9 items-center justify-center rounded-full bg-card text-tint";
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Link href={q(prev)} className={btn} aria-label="Previous day">
        <Arrow dir="l" />
      </Link>
      <span className="subhead min-w-0 flex-1 text-center font-semibold sm:min-w-[11rem] sm:flex-none">
        <span className="sm:hidden">{fmt.weekday(date)} {fmt.dateShort(date)}</span>
        <span className="hidden sm:inline">{fmt.dateLong(date)}</span>
      </span>
      {atLatest ? (
        <span className={cn(btn, "text-label-3 pointer-events-none")}>
          <Arrow dir="r" />
        </span>
      ) : (
        <Link href={q(next)} className={btn} aria-label="Next day">
          <Arrow dir="r" />
        </Link>
      )}
      {!atLatest && (
        <Link href={q()} className="text-tint pressable subhead ml-1">
          Today
        </Link>
      )}
    </div>
  );
}

export function resolveDate(param: string | string[] | undefined, latest: string): string {
  const d = Array.isArray(param) ? param[0] : param;
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= latest ? d : latest;
}
