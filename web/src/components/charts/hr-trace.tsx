"use client";

import { Area, ComposedChart, CartesianGrid, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { HUE, axisProps } from "./common";
import { fmt } from "@/lib/format";

export type Trace = { ts: number; bpm: number }[];

export function HrTrace({
  data,
  start,
  end,
  sleep,
  workouts,
  rhr,
  zones,
  height = 300,
}: {
  data: Trace;
  start: number;
  end: number;
  sleep?: { start: number; end: number } | null;
  workouts?: { start: number; end: number; label: string }[];
  rhr?: number | null;
  zones?: { lo: number; hi: number }[]; // absolute bpm boundaries of z1..z5
  height?: number;
}) {
  const config = { bpm: { label: "Heart rate", color: HUE.heart } } satisfies ChartConfig;
  const ticks: number[] = [];
  for (let t = Math.ceil(start / 3600000) * 3600000; t <= end; t += 3 * 3600000) ticks.push(t);
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        {zones?.map((z, i) => (
          <ReferenceArea key={i} y1={z.lo} y2={z.hi} fill={HUE.strain} fillOpacity={0.03 + i * 0.03} ifOverflow="hidden" />
        ))}
        {sleep && <ReferenceArea x1={Math.max(sleep.start, start)} x2={Math.min(sleep.end, end)} fill={HUE.sleep} fillOpacity={0.1} ifOverflow="hidden" />}
        {workouts?.map((w, i) => {
          /* A label only when the window is wide enough to hold it. */
          const wide = (w.end - w.start) / (end - start) > 0.06;
          return (
            <ReferenceArea
              key={i}
              x1={w.start}
              x2={w.end}
              fill={HUE.strain}
              fillOpacity={0.07}
              ifOverflow="hidden"
              label={wide && w.label ? { value: w.label, position: "insideTop", fontSize: 10, fill: "var(--muted-foreground)" } : undefined}
            />
          );
        })}
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis dataKey="ts" type="number" domain={[start, end]} ticks={ticks} tickFormatter={(v) => fmt.time(v)} {...axisProps} />
        <YAxis domain={[40, "auto"]} {...axisProps} />
        {rhr != null && <ReferenceLine y={rhr} stroke={HUE.heart} strokeDasharray="3 3" label={{ value: `RHR ${Math.round(rhr)}`, position: "right", fontSize: 10, fill: "var(--muted-foreground)" }} />}
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload?.ts ? fmt.time(p[0].payload.ts) : "")} />}
          cursor={{ stroke: "var(--border)" }}
        />
        <Area dataKey="bpm" stroke="none" fill={HUE.heart} fillOpacity={0.08} isAnimationActive={false} />
        <Line dataKey="bpm" stroke={HUE.heart} strokeWidth={1.25} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}
