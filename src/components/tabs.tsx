"use client";

import { useEffect, useRef, useState } from "react";

export type TabDef = { id: string; label: string; content: React.ReactNode };

/**
 * Every tab's content stays mounted (toggled with `hidden`, not unmounted) so
 * switching tabs never re-triggers a section's own data fetch or loses
 * in-progress form state — see the design-system rule on toggling visibility.
 *
 * The tab row scrolls horizontally when it doesn't fit (common on phones,
 * where a page with several tabs — Panoramica/Profilo/Sviluppo/Check-in/
 * Infortuni/... — easily overflows a narrow screen). The scrollbar itself is
 * hidden for a cleaner look, so without another cue a tab past the fold is
 * invisible and looks like it doesn't exist at all. The fade edges below are
 * that cue: shown only on the side that actually has more to scroll to.
 */
export function Tabs({ tabs, defaultTab }: { tabs: TabDef[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateFades() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  function scrollBy(delta: number) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  useEffect(() => {
    updateFades();
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateFades);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs.length]);

  return (
    <div>
      <div className="relative mb-6 border-b border-border">
        <div ref={scrollerRef} onScroll={updateFades} className="no-scrollbar flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                active === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canScrollLeft && (
          <button
            aria-label="Scorri a sinistra"
            onClick={() => scrollBy(-120)}
            className="absolute inset-y-0 left-0 flex w-6 items-center justify-start bg-gradient-to-r from-background to-transparent text-muted"
          >
            ‹
          </button>
        )}
        {canScrollRight && (
          <button
            aria-label="Scorri a destra"
            onClick={() => scrollBy(120)}
            className="absolute inset-y-0 right-0 flex w-6 items-center justify-end bg-gradient-to-l from-background to-transparent text-muted"
          >
            ›
          </button>
        )}
      </div>
      {tabs.map((t) => (
        <div key={t.id} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
