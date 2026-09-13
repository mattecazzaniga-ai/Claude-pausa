"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRelativeDate } from "@/lib/format";

type AthleteListItem = {
  id: string;
  name: string;
  level: string | null;
  sportName: string;
  lastSessionDate: string | null;
  priorityCount: number;
};

export function DashboardClient() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<AthleteListItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const res = await fetch("/api/athletes");
    const data = await res.json();
    setAthletes(data.athletes ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">I tuoi atleti</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          + Nuovo atleta
        </button>
      </div>

      {athletes === null ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">Non hai ancora nessun atleta.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-accent underline underline-offset-4">
            Aggiungi il primo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {athletes.map((a) => (
            <Link
              key={a.id}
              href={`/athletes/${a.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {a.sportName}
                  {a.level ? ` · ${a.level}` : ""}
                  {a.lastSessionDate ? ` · ultima sessione ${formatRelativeDate(a.lastSessionDate)}` : " · nessuna sessione ancora"}
                </p>
              </div>
              {a.priorityCount > 0 && (
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                  {a.priorityCount} priorità
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <NewAthleteForm
          onClose={() => setShowForm(false)}
          onCreated={(id) => router.push(`/athletes/${id}`)}
        />
      )}
    </div>
  );
}

function NewAthleteForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [objectives, setObjectives] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/athletes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, level: level || undefined, objectives: objectives || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la creazione.");
      return;
    }
    onCreated(data.athlete.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-scale-in space-y-4 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuovo atleta</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Nome</label>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Nome e cognome"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Livello (opzionale)</label>
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Es. Principiante, Intermedio, Agonista"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Obiettivi (opzionale)</label>
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Su cosa state lavorando in generale"
          />
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creazione…" : "Crea atleta"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
