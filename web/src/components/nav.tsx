"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BedDouble, Flame, HeartPulse, LayoutGrid } from "lucide-react";
import { cn } from "cn";
import { fmt } from "@/lib/format";

/* Five tabs, the way an iOS app keeps its tab bar. Browse holds the rest. */
export const TABS = [
  { href: "/", label: "Summary", icon: HeartPulse, match: (p: string) => p === "/" },
  { href: "/recovery", label: "Recovery", icon: Activity, match: (p: string) => p.startsWith("/recovery") },
  { href: "/sleep", label: "Sleep", icon: BedDouble, match: (p: string) => p.startsWith("/sleep") },
  { href: "/strain", label: "Strain", icon: Flame, match: (p: string) => p.startsWith("/strain") },
  {
    href: "/browse",
    label: "Browse",
    icon: LayoutGrid,
    match: (p: string) => ["/browse", "/workouts", "/heart-rate", "/trends", "/learn"].some((x) => p.startsWith(x)),
  },
] as const;

type Fresh = { lastCompute: string | null; lastDay: string | null; stale: boolean };

type TitleState = { title: string; collapsed: boolean; back?: { href: string; label: string } };
const TitleCtx = createContext<{ state: TitleState; set: (s: Partial<TitleState>) => void }>({
  state: { title: "", collapsed: false },
  set: () => {},
});

export function useTitle() {
  return useContext(TitleCtx);
}

export function Shell({ fresh, children }: { fresh: Fresh; children: React.ReactNode }) {
  const [state, setState] = useState<TitleState>({ title: "", collapsed: false });
  const ctx = useMemo(() => ({ state, set: (s: Partial<TitleState>) => setState((p) => ({ ...p, ...s })) }), [state]);
  const path = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  /* The document never scrolls; this container does. The browser's address bar then
     stays put, so the header and the tab bar never move. A new route starts at the top. */
  useEffect(() => {
    if (!window.location.hash) scroller.current?.scrollTo({ top: 0 });
  }, [path]);
  return (
    <TitleCtx.Provider value={ctx}>
      <div ref={scroller} className="scroll-root">
        <TopBar state={state} path={path} fresh={fresh} />
        <main className="mx-auto w-full max-w-[880px] px-4 pt-1 pb-32 sm:px-6 md:pt-6 md:pb-16">{children}</main>
      </div>
      <TabBar path={path} />
    </TitleCtx.Provider>
  );
}

function TopBar({ state, path, fresh }: { state: TitleState; path: string; fresh: Fresh }) {
  const collapsed = state.collapsed;
  return (
    <header
      className={cn(
        "safe-t sticky top-0 z-30 transition-[background-color,box-shadow] duration-200",
        collapsed ? "material hairline" : "bg-transparent",
      )}
    >
      <div className="relative mx-auto flex h-11 max-w-[880px] items-center px-4 sm:px-6 md:h-[52px]">
        {/* Back link, left */}
        {state.back && (
          <Link href={state.back.href} className="text-tint pressable flex items-center gap-0.5 -ml-1.5 body-text">
            <svg width="13" height="22" viewBox="0 0 13 22" fill="none" aria-hidden><path d="M11 2 2 11l9 9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="hidden sm:inline">{state.back.label}</span>
          </Link>
        )}

        {/* Compact centered title appears when the large title scrolls away */}
        <div
          className={cn(
            "headline pointer-events-none absolute inset-x-0 text-center transition-[opacity,transform] duration-200 md:hidden",
            collapsed ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
          )}
          aria-hidden={!collapsed}
        >
          {state.title}
        </div>

        {/* iPadOS-style floating tab bar on wider screens */}
        <nav className="glass absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full p-1 md:flex" aria-label="Sections">
          {TABS.map(({ href, label, match }) => {
            const active = match(path);
            return (
              <Link
                key={href}
                href={href}
                className={cn("pressable subhead rounded-full px-3.5 py-1.5 font-medium transition-colors", active ? "glass-lens text-foreground" : "text-label-2 hover:text-foreground")}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <SyncDot fresh={fresh} />
        </div>
      </div>
    </header>
  );
}

function SyncDot({ fresh }: { fresh: Fresh }) {
  return (
    <span className="caption text-label-2 flex items-center gap-1.5" title={fresh.lastCompute ? `Computed ${fmt.datetime(fresh.lastCompute)}` : "Never synced"}>
      <span className={cn("size-2 rounded-full", fresh.stale ? "bg-warn" : "bg-good")} aria-hidden />
      <span className="hidden sm:inline">{fresh.stale ? "Stale" : "Synced"}{fresh.lastCompute ? ` ${fmt.datetime(fresh.lastCompute)}` : ""}</span>
    </span>
  );
}

function TabBar({ path }: { path: string }) {
  const index = Math.max(0, TABS.findIndex((t) => t.match(path)));
  return (
    <nav
      className="fixed inset-x-0 z-30 flex justify-center px-4 md:hidden"
      style={{ bottom: "calc(10px + env(safe-area-inset-bottom))" }}
      aria-label="Tabs"
    >
      <div className="glass relative flex h-[62px] w-full max-w-[420px] items-stretch rounded-full p-1.5">
        {/* the lens slides under the active tab */}
        <span
          aria-hidden
          className="glass-lens absolute top-1.5 bottom-1.5 rounded-full transition-transform duration-300 ease-[cubic-bezier(.3,1.3,.4,1)]"
          style={{ width: `calc((100% - 12px) / ${TABS.length})`, left: 6, transform: `translateX(${index * 100}%)` }}
        />
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("pressable relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors", active ? "text-foreground" : "text-label-2")}
            >
              <Icon className="size-[24px]" strokeWidth={active ? 2.2 : 1.8} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
              <span className="caption-2 font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * The large title of a page. It reports itself to the top bar and tells the bar
 * when it has scrolled out of view so the compact title can appear.
 */
export function LargeTitle({ title, eyebrow, back }: { title: string; eyebrow?: React.ReactNode; back?: { href: string; label: string } }) {
  const { set } = useTitle();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    set({ title, back, collapsed: false });
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => set({ collapsed: !e.isIntersecting }), { root: el.closest(".scroll-root"), rootMargin: "-44px 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, back?.href]);
  return (
    <div ref={ref}>
      {eyebrow && <div className="footnote text-label-2 font-semibold uppercase tracking-wide">{eyebrow}</div>}
      <h1 className="large-title">{title}</h1>
    </div>
  );
}
