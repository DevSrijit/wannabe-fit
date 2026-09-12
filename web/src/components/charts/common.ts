export const HUE = {
  strain: "var(--strain)",
  sleep: "var(--sleep)",
  heart: "var(--heart)",
  oxygen: "var(--oxygen)",
  good: "var(--good)",
  warn: "var(--warn)",
  low: "var(--low)",
  muted: "var(--muted-foreground)",
  border: "var(--border)",
};

/** Sequential ramp for the five zones: one hue, rising opacity with intensity. */
export const ZONE_FILL = [
  "color-mix(in oklch, var(--strain) 35%, transparent)",
  "color-mix(in oklch, var(--strain) 52%, transparent)",
  "color-mix(in oklch, var(--strain) 68%, transparent)",
  "color-mix(in oklch, var(--strain) 84%, transparent)",
  "var(--strain)",
];

export const STAGE = {
  awake: { label: "Awake", fill: "color-mix(in oklch, var(--foreground) 30%, transparent)" },
  light: { label: "Light", fill: "color-mix(in oklch, var(--sleep) 45%, transparent)" },
  rem: { label: "REM", fill: "color-mix(in oklch, var(--sleep) 72%, transparent)" },
  deep: { label: "Deep", fill: "var(--sleep)" },
};

export function bandFill(band: string | null | undefined): string {
  if (band === "green") return HUE.good;
  if (band === "yellow") return HUE.warn;
  if (band === "red") return HUE.low;
  return HUE.muted;
}

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--label-2)" },
} as const;

export function shortDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}
