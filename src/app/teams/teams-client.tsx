"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackClient } from "@/lib/track-client";

type TeamListItem = { id: string; name: string; sportName: string; memberCount: number };
type AthleteOption = { id: string; name: string; sportName: string };

export function TeamsClient() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamListItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const res = await fetch("/api/teams");
    const data = await res.json();
    setTeams(data.teams ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Le tue squadre</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          + Nuova squadra
        </button>
      </div>

      {teams === null ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">Non hai ancora nessuna squadra.</p>
          <p className="mt-1 text-xs text-muted">
            Una squadra ti permette di generare una sessione unica per un gruppo di atleti, invece di una alla volta.
          </p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-accent underline underline-offset-4">
            Crea la prima
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t.sportName} · {t.memberCount} {t.memberCount === 1 ? "atleta" : "atleti"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && <NewTeamForm onClose={() => setShowForm(false)} onCreated={(id) => router.push(`/teams/${id}`)} />}
    </div>
  );
}

function NewTeamForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/athletes")
      .then((res) => res.json())
      .then((data) => setAthletes(data.athletes ?? []));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, athleteIds: Array.from(selected) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la creazione.");
      return;
    }
    trackClient("team_created", { teamId: data.team.id });
    onCreated(data.team.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-scale-in space-y-4 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuova squadra</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Nome</label>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Es. Under 16, Gruppo agonisti…"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Atleti (opzionale)</label>
          {athletes === null ? (
            <p className="text-sm text-muted">Caricamento…</p>
          ) : athletes.length === 0 ? (
            <p className="text-sm text-muted">Non hai ancora atleti — potrai aggiungerli dopo, dalla pagina della squadra.</p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {athletes.map((a) => (
                <label key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="accent-accent" />
                  {a.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creazione…" : "Crea squadra"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
