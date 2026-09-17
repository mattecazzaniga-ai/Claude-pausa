"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";

type MemoryStatus = "TEMPORANEA" | "RILEVANTE" | "PERSISTENTE" | "STORICA";
type MemoryConfidence = "FACT" | "PATTERN" | "PREFERENCE" | "CONFIRMED";
type ReviewState = "ACTIVE" | "REJECTED";

type MemoryItem = {
  id: string;
  summary: string;
  status: MemoryStatus;
  confidence: MemoryConfidence;
  reviewState: ReviewState;
  evidenceCount: number;
  lastObservedAt: string;
  events: { id: string; note: string; occurredAt: string }[];
};

/** One human-readable line instead of stacking separate status/confidence/source badges — keeps each row scannable. */
function describe(m: MemoryItem): string {
  if (m.confidence === "CONFIRMED") return "Confermato da te";
  if (m.status === "TEMPORANEA") return "Nota del momento, non ancora un pattern";
  if (m.status === "STORICA") return "Non più attivo nelle decisioni recenti";
  if (m.evidenceCount > 1) return `Osservato ${m.evidenceCount} volte`;
  return "Osservazione singola";
}

/**
 * Master prompt §20-24 (Memory Timeline): everything MENTATHLOS has recorded
 * about this athlete/team, with a confirm/reject/undo control per item —
 * deliberately minimal (one line + one action) rather than a data dump of
 * every field, and renders nothing at all when there's simply nothing to
 * show yet, so it never adds clutter to a screen with no memory history.
 */
export function MemoryTimelineSection({ basePath }: { basePath: string }) {
  const [memories, setMemories] = useState<MemoryItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  useEffect(() => {
    fetch(`${basePath}/memories`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMemories(data?.memories ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  if (!memories || memories.length === 0) return null;

  const active = memories.filter((m) => m.reviewState === "ACTIVE");
  const rejected = memories.filter((m) => m.reviewState === "REJECTED");

  async function act(id: string, action: "confirm" | "reject" | "reactivate") {
    setBusyId(id);
    const res = await fetch(`${basePath}/memories/${id}/${action}`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) return;

    setMemories((prev) =>
      (prev ?? []).map((m) =>
        m.id === id
          ? { ...m, reviewState: action === "reject" ? "REJECTED" : "ACTIVE", confidence: action === "confirm" ? "CONFIRMED" : m.confidence }
          : m,
      ),
    );
    trackClient(
      basePath.includes("/teams/")
        ? action === "confirm"
          ? "team_memory_confirmed"
          : action === "reject"
            ? "team_memory_rejected"
            : "team_memory_reactivated"
        : action === "confirm"
          ? "athlete_memory_confirmed"
          : action === "reject"
            ? "athlete_memory_rejected"
            : "athlete_memory_reactivated",
      { memoryId: id },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">Memoria</h2>
      <p className="mb-3 text-xs text-muted">Quello che MENTATHLOS ha osservato nel tempo — conferma o correggi ciò che non ti convince.</p>

      {active.length === 0 ? (
        <p className="text-sm text-muted">Nessuna osservazione attiva al momento.</p>
      ) : (
        <div className="space-y-2">
          {active.map((m) => (
            <div key={m.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-foreground/90">{m.summary}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{describe(m)}</p>
                </div>
                {m.confidence !== "CONFIRMED" && (
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                    <button onClick={() => act(m.id, "confirm")} disabled={busyId === m.id} className="text-accent underline underline-offset-4 disabled:opacity-50">
                      Conferma
                    </button>
                    <button
                      onClick={() => act(m.id, "reject")}
                      disabled={busyId === m.id}
                      className="text-muted underline underline-offset-4 hover:text-negative disabled:opacity-50"
                    >
                      Rifiuta
                    </button>
                  </div>
                )}
              </div>

              {m.events.length > 1 && (
                <button
                  onClick={() => setExpandedId((prev) => (prev === m.id ? null : m.id))}
                  className="mt-1.5 text-[11px] text-muted underline underline-offset-4"
                >
                  {expandedId === m.id ? "Nascondi" : "Vedi"} cronologia ({m.events.length})
                </button>
              )}
              {expandedId === m.id && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {m.events.map((e) => (
                    <p key={e.id} className="text-[11px] text-muted">
                      {new Date(e.occurredAt).toLocaleDateString("it-IT")} — {e.note}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <button onClick={() => setShowRejected((v) => !v)} className="text-xs text-muted underline underline-offset-4">
            {showRejected ? "Nascondi" : "Mostra"} {rejected.length} rifiutati
          </button>
          {showRejected && (
            <div className="mt-2 space-y-2">
              {rejected.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 p-3 text-sm opacity-60">
                  <p className="text-foreground/80 line-through decoration-muted">{m.summary}</p>
                  <button
                    onClick={() => act(m.id, "reactivate")}
                    disabled={busyId === m.id}
                    className="shrink-0 text-[11px] text-accent underline underline-offset-4 disabled:opacity-50"
                  >
                    Riattiva
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
