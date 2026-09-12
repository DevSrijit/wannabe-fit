import Link from "next/link";
import { cn } from "cn";
import { LargeTitle } from "@/components/nav";

export function PageHeader({
  title,
  eyebrow,
  lede,
  aside,
  back,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  lede?: React.ReactNode;
  aside?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-5 pt-2">
      <LargeTitle title={title} eyebrow={eyebrow} back={back} />
      {lede && <p className="subhead text-label-2 mt-2 max-w-[62ch]">{lede}</p>}
      {aside && <div className="mt-4">{aside}</div>}
    </header>
  );
}

/** Section heading between groups of cards, like "Favorites" in the Health app. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="mt-7 mb-2.5 flex items-baseline justify-between px-0.5">
      <h2 className="title-2">{children}</h2>
      {action && (
        <Link href={action.href} className="text-tint pressable body-text">
          {action.label}
        </Link>
      )}
    </div>
  );
}

const HUE_VAR: Record<string, string> = {
  strain: "var(--strain)",
  sleep: "var(--sleep)",
  heart: "var(--heart)",
  oxygen: "var(--oxygen)",
  good: "var(--good)",
  warn: "var(--warn)",
  low: "var(--low)",
};

/**
 * A Health-style card: a coloured category title with an optional chevron link on the
 * right, then the content. `Panel` is kept as an alias for the older pages.
 */
export function Card({
  title,
  icon,
  hue,
  note,
  href,
  children,
  className,
  flush,
  id,
}: {
  id?: string;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  hue?: keyof typeof HUE_VAR | string;
  note?: React.ReactNode;
  href?: string;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  const color = hue ? (HUE_VAR[hue] ?? hue) : undefined;
  const titleNode = title && (
    <h3 className="headline flex items-center gap-1.5" style={color ? { color } : undefined}>
      {icon}
      <span>{title}</span>
    </h3>
  );
  /* A long note reads as a subtitle under the title. A short one sits on the right. */
  const noteBelow = typeof note === "string" && note.length > 20;
  const noteNode = ((note && !noteBelow) || href) && (
    <span className="text-label-2 subhead flex shrink-0 items-center gap-1 text-right">
      {!noteBelow && note}
      {href && <Chevron />}
    </span>
  );
  /* A title that is plain text links as one piece. A title with a Term inside keeps
     its own link, so only the right side becomes the link. */
  const plain = typeof title === "string";
  const head = (title || note) && (
    <div className={cn("flex items-center justify-between gap-3", flush ? "px-4 pt-3.5" : "mb-3")}>
      {href && plain ? (
        <Link href={href} className="pressable flex flex-1 items-center justify-between gap-3">
          {titleNode}
          {noteNode}
        </Link>
      ) : (
        <>
          {titleNode}
          {href ? (
            <Link href={href} className="pressable">
              {noteNode}
            </Link>
          ) : (
            noteNode
          )}
        </>
      )}
    </div>
  );
  return (
    <section id={id} className={cn("bg-card rounded-xl", flush ? "" : "p-4", className)}>
      {head}
      {noteBelow && <p className={cn("footnote text-label-2 -mt-2 mb-3", flush && "px-4")}>{note}</p>}
      {children}
    </section>
  );
}

export const Panel = Card;

export function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden className="text-label-3 shrink-0">
      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A large value with a small unit on the baseline, as Health shows "72 BPM". */
export function Stat({
  label,
  value,
  unit,
  sub,
  hue,
  big,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  hue?: string;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="footnote text-label-2">{label}</div>
      <div className={cn("num display mt-1 flex items-baseline gap-1", big ? "text-5xl" : "text-[26px]")} style={hue ? { color: hue } : undefined}>
        <span>{value}</span>
        {unit && <span className="subhead text-label-2 font-semibold">{unit}</span>}
      </div>
      {sub && <div className="caption text-label-2 mt-1">{sub}</div>}
    </div>
  );
}

export function Explain({ children }: { children: React.ReactNode }) {
  return <p className="footnote text-label-2 mt-3.5 max-w-prose">{children}</p>;
}

/** Inset grouped list, the UIKit table style. Wrap `Row` children. */
export function List({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-card overflow-hidden rounded-xl", className)}>{children}</div>;
}

export function Row({
  href,
  icon,
  hue,
  title,
  detail,
  value,
  last,
}: {
  href?: string;
  icon?: React.ReactNode;
  hue?: keyof typeof HUE_VAR | string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  last?: boolean;
}) {
  const color = hue ? (HUE_VAR[hue] ?? hue) : undefined;
  const inner = (
    <>
      {icon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: color ?? "var(--fill)" }}>
          {icon}
        </span>
      )}
      <div className={cn("flex min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pr-4", !last && "hairline")}>
        <div className="min-w-0">
          <div className="body-text truncate">{title}</div>
          {detail && <div className="footnote text-label-2 truncate">{detail}</div>}
        </div>
        <div className="text-label-2 body-text num flex shrink-0 items-center gap-2">
          {value}
          {href && <Chevron />}
        </div>
      </div>
    </>
  );
  const cls = "flex min-h-[44px] items-center gap-3 pl-4";
  return href ? (
    <Link href={href} className={cn(cls, "pressable")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
