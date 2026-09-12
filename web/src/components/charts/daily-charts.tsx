"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,

  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Daily } from "@/lib/queries";
import { HUE, ZONE_FILL, STAGE, axisProps, bandFill, shortDate } from "./common";

const tick = (d: string) => shortDate(d);

export function RecoveryChart({ data, height = 240 }: { data: Daily[]; height?: number }) {
  const config = { recovery: { label: "Recovery", color: HUE.good } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <ReferenceArea y1={0} y2={33} fill={HUE.low} fillOpacity={0.06} />
        <ReferenceArea y1={33} y2={66} fill={HUE.warn} fillOpacity={0.05} />
        <ReferenceArea y1={66} y2={100} fill={HUE.good} fillOpacity={0.05} />
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis domain={[0, 100]} ticks={[0, 33, 66, 100]} {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent color={HUE.good} labelFormatter={(v) => shortDate(String(v))} />} />
        <Line dataKey="recovery" type="monotone" stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={1.5} dot={false} connectNulls tooltipType="none" />
        {/* dots colored by band, drawn as a second line with custom dot */}
        <Line
          dataKey="recovery"
          stroke="none"
          isAnimationActive={false}
          dot={(p) => {
            const { cx, cy, payload, index } = p as { cx: number; cy: number; payload: Daily; index: number };
            if (payload.recovery == null) return <g key={index} />;
            return <circle key={index} cx={cx} cy={cy} r={3.5} fill={bandFill(payload.recovery_band)} stroke="var(--card)" strokeWidth={1.5} />;
          }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

export function RhrChart({ data, height = 240 }: { data: Daily[]; height?: number }) {
  const rows = data.map((d) => ({
    ...d,
    band: d.rhr_base30 != null && d.rhr_sd30 != null ? [d.rhr_base30 - d.rhr_sd30, d.rhr_base30 + d.rhr_sd30] : null,
  }));
  const vals = rows.flatMap((r) => [r.rhr, r.rhr_base30, ...(r.band ?? [])]).filter((v): v is number => v != null);
  const lo = Math.floor((Math.min(...vals) - 3) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) + 3) / 5) * 5;
  const step = Math.max(5, Math.ceil((hi - lo) / 4 / 5) * 5);
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const config = {
    rhr: { label: "Resting HR", color: HUE.heart },
    rhr_base30: { label: "30-day baseline", color: HUE.muted },
    band: { label: "Baseline ± 1 SD", color: HUE.heart },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={rows} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis domain={[lo, hi]} ticks={ticks} allowDataOverflow {...axisProps} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => shortDate(String(v))}
              formatter={(value, name, item, index) => {
                const label = config[name as keyof typeof config]?.label ?? name;
                const text = Array.isArray(value) ? `${Math.round(value[0])} to ${Math.round(value[1])}` : typeof value === "number" ? value.toFixed(1) : String(value);
                return (
                  <div key={index} className="flex w-full items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color ?? config[name as keyof typeof config]?.color }} />
                      {label}
                    </span>
                    <span className="num font-medium text-foreground">{text}</span>
                  </div>
                );
              }}
            />
          }
        />
        <Area dataKey="band" stroke="none" fill={HUE.heart} fillOpacity={0.12} connectNulls isAnimationActive={false} />
        <Line dataKey="rhr_base30" stroke={HUE.muted} strokeDasharray="3 3" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} />
        <Line dataKey="rhr" stroke={HUE.heart} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: HUE.heart }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

export function StrainChart({ data, height = 220 }: { data: Daily[]; height?: number }) {
  const config = { strain: { label: "Strain", color: HUE.strain } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis domain={[0, 21]} ticks={[0, 7, 14, 21]} {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
        <ReferenceLine y={14} stroke={HUE.border} strokeDasharray="3 3" />
        <Bar dataKey="strain" fill={HUE.strain} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

export function ZonesChart({ data, height = 220 }: { data: Daily[]; height?: number }) {
  const config = {
    z1: { label: "Zone 1", color: ZONE_FILL[0] },
    z2: { label: "Zone 2", color: ZONE_FILL[1] },
    z3: { label: "Zone 3", color: ZONE_FILL[2] },
    z4: { label: "Zone 4", color: ZONE_FILL[3] },
    z5: { label: "Zone 5", color: ZONE_FILL[4] },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis unit="m" {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
        {(["z1", "z2", "z3", "z4", "z5"] as const).map((k, i) => (
          <Bar key={k} dataKey={k} stackId="z" fill={ZONE_FILL[i]} stroke="var(--card)" strokeWidth={1} isAnimationActive={false} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function PmcChart({ data, height = 260 }: { data: Daily[]; height?: number }) {
  const config = {
    ctl: { label: "Fitness (CTL)", color: HUE.strain },
    atl: { label: "Fatigue (ATL)", color: HUE.oxygen },
    tsb: { label: "Form (TSB)", color: HUE.sleep },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
        <ReferenceLine y={0} stroke={HUE.border} />
        <Bar dataKey="tsb" fill={HUE.sleep} fillOpacity={0.5} isAnimationActive={false} />
        <Line dataKey="ctl" stroke={HUE.strain} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        <Line dataKey="atl" stroke={HUE.oxygen} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

export function AcwrChart({ data, height = 200 }: { data: Daily[]; height?: number }) {
  const config = { acwr: { label: "ACWR", color: HUE.strain } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <ReferenceArea y1={0.8} y2={1.3} fill={HUE.good} fillOpacity={0.07} />
        <ReferenceArea y1={1.5} y2={3} fill={HUE.low} fillOpacity={0.06} />
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis domain={[0, 3]} ticks={[0, 0.8, 1.3, 1.5, 2, 3]} {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
        <Line dataKey="acwr" stroke={HUE.strain} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

export function SleepChart({ data, height = 240 }: { data: Daily[]; height?: number }) {
  const rows = data.map((d) => ({
    date: d.date,
    deep: d.sleep_deep_min == null ? null : d.sleep_deep_min / 60,
    rem: d.sleep_rem_min == null ? null : d.sleep_rem_min / 60,
    light: d.sleep_light_min == null ? null : d.sleep_light_min / 60,
    awake: d.sleep_awake_min == null ? null : d.sleep_awake_min / 60,
    need: d.sleep_need_min == null ? null : d.sleep_need_min / 60,
  }));
  const config = {
    deep: { label: STAGE.deep.label, color: STAGE.deep.fill },
    rem: { label: STAGE.rem.label, color: STAGE.rem.fill },
    light: { label: STAGE.light.label, color: STAGE.light.fill },
    awake: { label: STAGE.awake.label, color: STAGE.awake.fill },
    need: { label: "Need", color: HUE.muted },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={rows} margin={{ left: -12, right: 8, top: 8 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis unit="h" domain={[0, 12]} ticks={[0, 4, 8, 12]} {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} formatter={(v, name, item) => (
          <span className="flex w-full justify-between gap-4"><span className="text-muted-foreground">{String(item?.name ?? name)}</span><span className="num">{typeof v === "number" ? `${Math.floor(v)}h ${Math.round((v % 1) * 60).toString().padStart(2, "0")}m` : String(v)}</span></span>
        )} />} />
        {(["deep", "rem", "light", "awake"] as const).map((k) => (
          <Bar key={k} dataKey={k} name={STAGE[k].label} stackId="s" fill={STAGE[k].fill} stroke="var(--card)" strokeWidth={1} isAnimationActive={false} />
        ))}
        <Line dataKey="need" name="Need" type="step" stroke={HUE.muted} strokeDasharray="3 3" strokeWidth={1.25} dot={false} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

export function StepsChart({ data, height = 180 }: { data: Daily[]; height?: number }) {
  const config = { steps: { label: "Steps", color: HUE.oxygen } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: -4, right: 8, top: 8 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
        <ReferenceLine y={10000} stroke={HUE.border} strokeDasharray="3 3" />
        <Bar dataKey="steps" fill={HUE.oxygen} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

export function Spo2Chart({ data, height = 200 }: { data: Daily[]; height?: number }) {
  const config = {
    spo2_night_mean: { label: "Night mean", color: HUE.oxygen },
    spo2_night_min: { label: "Night minimum", color: HUE.oxygen },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <ReferenceArea y1={85} y2={92} fill={HUE.low} fillOpacity={0.06} />
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={tick} minTickGap={28} {...axisProps} />
        <YAxis domain={[85, 100]} ticks={[85, 90, 95, 100]} unit="%" {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
        <Line dataKey="spo2_night_mean" stroke={HUE.oxygen} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        <Line dataKey="spo2_night_min" stroke={HUE.oxygen} strokeOpacity={0.5} strokeWidth={1.25} dot={{ r: 2, strokeWidth: 0, fill: HUE.oxygen }} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

export function GenericLine({ data, keys, height = 200, domain, unit }: { data: Record<string, unknown>[]; keys: { key: string; label: string; color: string }[]; height?: number; domain?: [number, number]; unit?: string }) {
  const config = Object.fromEntries(keys.map((k) => [k.key, { label: k.label, color: k.color }])) as ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickFormatter={(v) => (String(v).includes("W") ? String(v).slice(5) : tick(String(v)))} minTickGap={28} {...axisProps} />
        <YAxis domain={domain} unit={unit} {...axisProps} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.map((k) => (
          <Line key={k.key} dataKey={k.key} stroke={k.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function WorkoutZoneBar({ z, height = 14 }: { z: number[]; height?: number }) {
  const total = z.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex w-full overflow-hidden rounded-sm" style={{ height, gap: 2 }}>
      {z.map((m, i) => (
        <div key={i} title={`Zone ${i + 1}: ${Math.round(m)} min`} style={{ width: `${(100 * m) / total}%`, background: ZONE_FILL[i] }} />
      ))}
    </div>
  );
}

