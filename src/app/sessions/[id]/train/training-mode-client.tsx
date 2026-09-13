"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trackClient } from "@/lib/track-client";
import { VoiceInputButton } from "@/components/voice-input-button";
import type { TrainingSessionData } from "../types";

type FeedbackRating = "EXCELLENT" | "GOOD" | "AVERAGE" | "NEEDS_WORK";

const TYPE_LABEL: Record<string, string> = {
  WARMUP: "Riscaldamento",
  TECHNICAL: "Tecnica",
  TACTICAL: "Tattica",
  PHYSICAL: "Fisico",
  GAME: "Situazione di gioco",
  COOLDOWN: "Defaticamento",
};

const RATING_OPTIONS: { value: FeedbackRating; emoji: string; label: string }[] = [
  { value: "EXCELLENT", emoji: "🔥", label: "Eccellente" },
  { value: "GOOD", emoji: "👍", label: "Buono" },
  { value: "AVERAGE", emoji: "😐", label: "Nella media" },
  { value: "NEEDS_WORK", emoji: "⚠️", label: "Da migliorare" },
];

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Master prompt §31-34: a mobile-first, one-thing-at-a-time view for running
 * a session on the pitch/court — timer, coaching points, a note in a few
 * seconds — instead of the full read/edit session page built for desk use.
 */
export function TrainingModeClient({ initialData }: { initialData: TrainingSessionData }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(initialData.blocks[0].durationMinutes * 60);
  const [running, setRunning] = useState(false);
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});
  const [showNoteFor, setShowNoteFor] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const block = initialData.blocks[index];
  const isLast = index === initialData.blocks.length - 1;
  const totalSeconds = block.durationMinutes * 60;

  useEffect(() => {
    trackClient("training_mode_started", { sessionId: initialData.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount only
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function goToBlock(newIndex: number) {
    setIndex(newIndex);
    setSecondsLeft(initialData.blocks[newIndex].durationMinutes * 60);
    setRunning(false);
    setShowNoteFor(false);
  }

  function nextOrFinish() {
    if (isLast) setFinished(true);
    else goToBlock(index + 1);
  }

  if (finished) {
    return (
      <EndOfSessionScreen data={initialData} blockNotes={blockNotes} onDone={() => router.push(`/sessions/${initialData.id}`)} />
    );
  }

  const progressPct = totalSeconds > 0 ? Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/sessions/${initialData.id}`} className="text-sm text-muted hover:text-foreground">
            ✕ Esci
          </Link>
          <span className="text-xs text-muted">
            Blocco {index + 1} di {initialData.blocks.length}
          </span>
        </div>

        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${(index / initialData.blocks.length) * 100}%` }} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">{TYPE_LABEL[block.type]}</span>
          <h1 className="mt-3 text-2xl font-semibold">{block.exercise?.name ?? "Blocco libero"}</h1>
          {block.exercise?.description && <p className="mt-2 text-sm text-foreground/80">{block.exercise.description}</p>}
          {block.exercise?.coachingPoints && (
            <p className="mt-3 rounded-md bg-surface-2 p-3 text-sm text-muted">
              <span className="font-medium text-foreground/70">Punti chiave: </span>
              {block.exercise.coachingPoints}
            </p>
          )}
          {block.exercise?.equipment && <p className="mt-2 text-xs text-muted">Attrezzatura: {block.exercise.equipment}</p>}
          {block.rationale && (
            <p className="mt-3 rounded-md bg-surface-2 p-3 text-xs text-muted">
              <span className="font-medium text-foreground/70">Perché questo esercizio: </span>
              {block.rationale}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="none" className="text-surface-2" />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={2 * Math.PI * 70}
                strokeDashoffset={2 * Math.PI * 70 * (1 - progressPct / 100)}
                strokeLinecap="round"
                className="text-accent transition-all"
              />
            </svg>
            <span className="text-3xl font-semibold tabular-nums">{fmtTime(secondsLeft)}</span>
          </div>
          <button
            onClick={() => setRunning((r) => !r)}
            className="mt-4 rounded-full bg-accent px-8 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            {running ? "Pausa" : "Avvia"}
          </button>
        </div>

        <div className="mt-6">
          {!showNoteFor ? (
            <button
              onClick={() => setShowNoteFor(true)}
              className="w-full rounded-md border border-border py-2 text-sm text-muted hover:bg-surface-2"
            >
              + Aggiungi nota su questo blocco
            </button>
          ) : (
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="mb-2 flex justify-end">
                <VoiceInputButton
                  onResult={(text) =>
                    setBlockNotes((prev) => ({ ...prev, [block.id]: prev[block.id] ? `${prev[block.id]} ${text}` : text }))
                  }
                />
              </div>
              <textarea
                value={blockNotes[block.id] ?? ""}
                onChange={(e) => setBlockNotes((prev) => ({ ...prev, [block.id]: e.target.value }))}
                rows={2}
                placeholder="Es. Marco fatica sulla transizione difensiva…"
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-md">
        <button onClick={nextOrFinish} className="w-full rounded-md bg-accent py-3 text-sm font-medium text-black transition-opacity hover:opacity-90">
          {isLast ? "Termina allenamento" : "Blocco successivo →"}
        </button>
      </div>
    </div>
  );
}

function EndOfSessionScreen({
  data,
  blockNotes,
  onDone,
}: {
  data: TrainingSessionData;
  blockNotes: Record<string, string>;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [note, setNote] = useState(() =>
    Object.entries(blockNotes)
      .filter(([, text]) => text.trim())
      .map(([blockId, text]) => {
        const b = data.blocks.find((x) => x.id === blockId);
        return b?.exercise?.name ? `${b.exercise.name}: ${text}` : text;
      })
      .join("\n")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!rating) {
      setError("Scegli come è andata la sessione.");
      return;
    }
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/sessions/${data.id}/feedback`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, note: note.trim() || undefined }),
    });
    const result = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(result.error ?? "Errore durante il salvataggio.");
      return;
    }

    // A note tied to one athlete goes through the same pipeline as a manual
    // session note, so it still feeds the AI analysis loop rather than
    // being stuck only on the TrainingSession record.
    if (data.athlete && note.trim()) {
      await fetch(`/api/athletes/${data.athlete.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: note.trim() }),
      }).catch(() => {});
    }

    trackClient("session_feedback_recorded", { sessionId: data.id, rating });
    setBusy(false);
    onDone();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Come è andata?</h1>
          <p className="mt-1 text-sm text-muted">
            {data.athlete?.name ?? data.team?.name ?? "Sessione"} · {data.blocks.length} blocchi completati
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {RATING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRating(opt.value)}
              className={`rounded-lg border p-3 text-center text-sm transition-colors ${
                rating === opt.value ? "border-accent bg-accent/10" : "border-border hover:bg-surface-2"
              }`}
            >
              <span className="block text-2xl">{opt.emoji}</span>
              <span className="mt-1 block text-xs">{opt.label}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-muted">Qualcosa da ricordare? (opzionale)</label>
            <VoiceInputButton onResult={(text) => setNote((prev) => (prev ? `${prev} ${text}` : text))} />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <button
          onClick={save}
          disabled={busy || !rating}
          className="w-full rounded-md bg-accent py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Salvataggio…" : "Salva e termina"}
        </button>
      </div>
    </div>
  );
}
