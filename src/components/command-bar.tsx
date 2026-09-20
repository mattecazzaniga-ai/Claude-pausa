"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackClient } from "@/lib/track-client";

type AthleteResult = { id: string; name: string; sportName: string };
type TeamResult = { id: string; name: string; sportName: string };

type StaticAction = { label: string; href: string; keywords: string };

function staticActions(selfCoaching: boolean): StaticAction[] {
  const actions: StaticAction[] = [
    { label: selfCoaching ? "Il mio allenamento" : "Home", href: "/dashboard", keywords: "home dashboard oggi" },
  ];
  if (!selfCoaching) {
    actions.push(
      { label: "Atleti", href: "/athletes", keywords: "atleti roster" },
      { label: "Squadre", href: "/teams", keywords: "squadre team" },
    );
  }
  actions.push(
    { label: "Calendario", href: "/calendar", keywords: "calendario agenda pianifica" },
    { label: "Esercizi", href: "/exercises", keywords: "esercizi libreria" },
    { label: "Coach Brain", href: "/coach-brain", keywords: "coach brain metodologia memoria" },
  );
  if (!selfCoaching) actions.push({ label: "Pagamenti", href: "/payments", keywords: "pagamenti offerte" });
  return actions;
}

/**
 * Master prompt §26: one global entry point to "go anywhere" or "find
 * anyone" instead of hunting through nav + roster. Opt-in (⌘K / Ctrl+K),
 * never a permanent visible chrome element — reduces visible complexity per
 * §28 while still being one keystroke away.
 */
export function CommandBar({ selfCoaching }: { selfCoaching: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [athletes, setAthletes] = useState<AthleteResult[] | null>(null);
  const [teams, setTeams] = useState<TeamResult[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        close();
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mentathlos:open-command-bar", onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mentathlos:open-command-bar", onOpenRequest);
    };
  }, [close]);

  useEffect(() => {
    if (!open) return;
    trackClient("command_bar_used", {});
    inputRef.current?.focus();
    if (!selfCoaching && athletes === null) {
      fetch("/api/athletes")
        .then((r) => r.json())
        .then((d) => setAthletes((d.athletes ?? []).map((a: { id: string; name: string; sportName: string }) => ({ id: a.id, name: a.name, sportName: a.sportName }))))
        .catch(() => setAthletes([]));
    }
    if (!selfCoaching && teams === null) {
      fetch("/api/teams")
        .then((r) => r.json())
        .then((d) => setTeams((d.teams ?? []).map((t: { id: string; name: string; sportName: string }) => ({ id: t.id, name: t.name, sportName: t.sportName }))))
        .catch(() => setTeams([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per open, not on every keystroke
  }, [open, selfCoaching]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actions = staticActions(selfCoaching)
      .filter((a) => !q || a.label.toLowerCase().includes(q) || a.keywords.includes(q))
      .map((a) => ({ kind: "action" as const, id: a.href, label: a.label, sub: null as string | null, href: a.href }));

    const athleteMatches = (athletes ?? [])
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((a) => ({ kind: "athlete" as const, id: a.id, label: a.name, sub: a.sportName, href: `/athletes/${a.id}` }));

    const teamMatches = (teams ?? [])
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({ kind: "team" as const, id: t.id, label: t.name, sub: t.sportName, href: `/teams/${t.id}` }));

    return [...athleteMatches, ...teamMatches, ...actions];
  }, [query, athletes, teams, selfCoaching]);

  useEffect(() => setActiveIndex(0), [query]);

  function go(href: string) {
    close();
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg animate-scale-in overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[activeIndex]) {
              go(results[activeIndex].href);
            }
          }}
          placeholder="Vai a un atleta, una squadra o una sezione…"
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted"
        />
        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nessun risultato.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => go(r.href)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${
                  i === activeIndex ? "bg-surface-2" : ""
                }`}
              >
                <span className="truncate">{r.label}</span>
                {r.sub && <span className="shrink-0 text-xs text-muted">{r.sub}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
