import { TZ } from "./tz";

export const fmt = {
  n(v: number | null | undefined, digits = 0): string {
    if (v == null || Number.isNaN(v)) return "–";
    return v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  },
  int(v: number | null | undefined): string {
    return fmt.n(v, 0);
  },
  hm(min: number | null | undefined): string {
    if (min == null) return "–";
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
  },
  time(ms: number): string {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
  },
  dateLong(date: string): string {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`),
    );
  },
  dateShort(date: string): string {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  },
  weekday(date: string): string {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  },
  datetime(iso: string): string {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  },
  signed(v: number | null | undefined, digits = 0): string {
    if (v == null) return "–";
    const s = fmt.n(Math.abs(v), digits);
    return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
  },
};

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function bandColor(band: string | null | undefined): string {
  if (band === "green") return "var(--good)";
  if (band === "yellow") return "var(--warn)";
  if (band === "red") return "var(--low)";
  return "var(--muted-foreground)";
}

export function bandLabel(band: string | null | undefined): string {
  if (band === "green") return "Recovered";
  if (band === "yellow") return "Adequate";
  if (band === "red") return "Low";
  return "No score";
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
