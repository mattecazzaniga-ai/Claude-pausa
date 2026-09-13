"use client";

import { useState } from "react";

export type TabDef = { id: string; label: string; content: React.ReactNode };

/**
 * Every tab's content stays mounted (toggled with `hidden`, not unmounted) so
 * switching tabs never re-triggers a section's own data fetch or loses
 * in-progress form state — see the design-system rule on toggling visibility.
 */
export function Tabs({ tabs, defaultTab }: { tabs: TabDef[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div>
      <div className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-border">
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
      {tabs.map((t) => (
        <div key={t.id} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
