"use client";

import Link from "next/link";
import { cn } from "cn";
import { RANGE_COOKIE, RANGE_LABEL, RANGE_OPTIONS } from "./range-options";

/** A UISegmentedControl. A click stores the choice in a cookie so every tab keeps it. */
export function RangeTabs({ base, days }: { base: string; days: number }) {
  return (
    <div className="bg-fill-3 inline-flex rounded-[9px] p-0.5" role="tablist" aria-label="Range">
      {RANGE_OPTIONS.map((n) => (
        <Link
          key={n}
          href={`${base}?days=${n}`}
          role="tab"
          aria-selected={days === n}
          onClick={() => {
            document.cookie = `${RANGE_COOKIE}=${n}; path=/; max-age=31536000; samesite=lax`;
          }}
          className={cn(
            "footnote pressable min-w-12 rounded-[7px] px-3 py-1 text-center font-semibold transition-colors",
            days === n ? "bg-[#636366] text-white shadow-[0_3px_8px_rgba(0,0,0,.12),0_3px_1px_rgba(0,0,0,.04)]" : "text-foreground/85",
          )}
        >
          {RANGE_LABEL[n]}
        </Link>
      ))}
    </div>
  );
}
