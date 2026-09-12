"use client";

import Link from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { TERM_BY_SLUG } from "@/lib/glossary";

/** A metric name with a dotted underline. Hover or focus to read what it means. */
export function Term({ slug, children, className }: { slug: string; children?: React.ReactNode; className?: string }) {
  const t = TERM_BY_SLUG[slug];
  if (!t) return <span className={className}>{children ?? slug}</span>;
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link href={`/learn#${t.slug}`} className={`term ${className ?? ""}`}>
          {children ?? t.name}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 space-y-2 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,.6)] ring-white/10">
        <p className="headline">{t.name}</p>
        <p className="subhead text-label-2">{t.short}</p>
        <p className="subhead">{t.read}</p>
        <Link href={`/learn#${t.slug}`} className="text-tint footnote inline-block font-medium">
          Formula and sources
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}
