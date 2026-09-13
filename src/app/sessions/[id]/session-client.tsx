"use client";

import { useState } from "react";
import { trackClient } from "@/lib/track-client";
import type { TrainingSessionData, SessionBlockData } from "./types";

const TYPE_LABEL: Record<string, string> = {
  WARMUP: "Riscaldamento",
  TECHNICAL: "Tecnica",
  TACTICAL: "Tattica",
  PHYSICAL: "Fisico",
  GAME: "Situazione di gioco",
  COOLDOWN: "Defaticamento",
};

const TYPE_COLOR: Record<string, string> = {
  WARMUP: "bg-improving/15 text-improving",
  TECHNICAL: "bg-accent/15 text-accent",
  TACTICAL: "bg-accent-2/15 text-accent-2",
  PHYSICAL: "bg-negative/15 text-negative",
  GAME: "bg-positive/15 text-positive",
  COOLDOWN: "bg-surface-2 text-muted",
};

export function SessionClient({ initialData }: { initialData: TrainingSessionData }) {
  const [data, setData] = useState(initialData);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function replaceBlock(blockId: string) {
    setReplacingId(blockId);
    setError(null);
    const res = await fetch(`/api/sessions/${data.id}/blocks/${blockId}/replace`, { method: "POST" });
    const result = await res.json();
    setReplacingId(null);

    if (!res.ok) {
      setError(result.error ?? "Errore durante la sostituzione.");
      return;
    }

    const updatedBlock: SessionBlockData = {
      id: result.block.id,
      order: result.block.order,
      type: result.block.type,
      durationMinutes: result.block.durationMinutes,
      rationale: result.block.rationale,
      exercise: result.block.exercise
        ? {
            id: result.block.exercise.id,
            name: result.block.exercise.name,
            description: result.block.exercise.description,
            coachingPoints: result.block.exercise.coachingPoints,
            commonMistakes: result.block.exercise.commonMistakes,
            equipment: result.block.exercise.equipment,
            source: result.block.exercise.source,
            skills: result.block.exercise.skills.map((s: { skill: { name: string } }) => s.skill.name),
          }
        : null,
    };

    setData((prev) => ({ ...prev, blocks: prev.blocks.map((b) => (b.id === blockId ? updatedBlock : b)) }));
    trackClient("session_block_replaced", { sessionId: data.id, blockId });
  }

  const totalPlanned = data.blocks.reduce((sum, b) => sum + b.durationMinutes, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      <div className="mb-6 rounded-xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wider text-muted">Sessione — {data.durationMinutes} min</p>
        <h1 className="mt-1 text-xl font-semibold">{data.objective || "Sessione di allenamento"}</h1>
        <p className="mt-1 text-xs text-muted">
          {data.blocks.length} blocchi · {totalPlanned} min pianificati
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <div className="space-y-3">
        {data.blocks.map((block, i) => (
          <div key={block.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_COLOR[block.type]}`}>
                {i + 1}. {TYPE_LABEL[block.type]}
              </span>
              <span className="text-xs text-muted">{block.durationMinutes} min</span>
            </div>

            {block.exercise ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{block.exercise.name}</h3>
                  {block.exercise.source === "AI_GENERATED" && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">generato da AI</span>
                  )}
                </div>
                {block.exercise.description && <p className="mt-1 text-sm text-foreground/80">{block.exercise.description}</p>}
                {block.exercise.coachingPoints && (
                  <p className="mt-2 text-xs text-muted">
                    <span className="font-medium text-foreground/70">Punti chiave:</span> {block.exercise.coachingPoints}
                  </p>
                )}
                {block.exercise.equipment && (
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-medium text-foreground/70">Attrezzatura:</span> {block.exercise.equipment}
                  </p>
                )}
                {block.exercise.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {block.exercise.skills.map((s, j) => (
                      <span key={j} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Nessun esercizio assegnato.</p>
            )}

            {block.rationale && (
              <p className="mt-3 rounded-md bg-surface-2 p-2.5 text-xs text-muted">
                <span className="font-medium text-foreground/70">Perché questo esercizio: </span>
                {block.rationale}
              </p>
            )}

            <button
              onClick={() => replaceBlock(block.id)}
              disabled={replacingId === block.id}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {replacingId === block.id ? "Sostituzione in corso…" : "Sostituisci esercizio"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
