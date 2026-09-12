"use client";

import { useEffect, useRef, useState } from "react";
import { STAGE } from "./common";
import type { SleepStage } from "@/lib/queries";
import { fmt } from "@/lib/format";

const ROW: Record<number, { row: number; key: keyof typeof STAGE } | undefined> = {
  1: { row: 0, key: "awake" },
  7: { row: 0, key: "awake" },
  6: { row: 1, key: "rem" },
  4: { row: 2, key: "light" },
  2: { row: 2, key: "light" },
  5: { row: 3, key: "deep" },
};

/**
 * Stage-by-time chart of one night. Rows: awake, REM, light, deep, from top to bottom,
 * the way sleep labs draw it, so the line "sinks" into deeper sleep.
 */
export function Hypnogram({ start, end, stages }: { start: number; end: number; stages: SleepStage[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 480;
  const H = 150;
  const padL = 44;
  const padR = 8;
  const rowH = 30;
  const span = end - start || 1;
  const x = (t: number) => padL + ((t - start) / span) * (W - padL - padR);
  const labels = ["Awake", "REM", "Light", "Deep"];
  const ticks: number[] = [];
  const every = narrow ? 2 * 3600000 : 3600000;
  for (let t = Math.ceil(start / every) * every; t <= end; t += every) ticks.push(t);
  return (
    <div ref={ref} className="w-full">
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label="Sleep stages through the night">
      {labels.map((l, i) => (
        <g key={l}>
          <line x1={padL} x2={W - padR} y1={i * rowH + rowH / 2 + 4} y2={i * rowH + rowH / 2 + 4} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={padL - 8} y={i * rowH + rowH / 2 + 8} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">{l}</text>
        </g>
      ))}
      {stages.map((s, i) => {
        const r = ROW[s.stage];
        if (!r) return null;
        const x0 = x(s.start);
        const x1 = x(s.end);
        return (
          <rect key={i} x={x0} y={r.row * rowH + 6} width={Math.max(1, x1 - x0 - 1)} height={rowH - 4} rx={3} fill={STAGE[r.key].fill}>
            <title>{`${STAGE[r.key].label}: ${fmt.time(s.start)}–${fmt.time(s.end)} (${Math.round((s.end - s.start) / 60000)} min)`}</title>
          </rect>
        );
      })}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{fmt.time(t)}</text>
      ))}
    </svg>
    </div>
  );
}
