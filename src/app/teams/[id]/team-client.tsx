"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { trackClient } from "@/lib/track-client";
import type { TeamData } from "./types";
import { ObjectivesSection } from "@/components/objectives-section";
import { EvaluationsSection } from "@/components/evaluations-section";
import { CompetitionsSection } from "@/components/competitions-section";
import { Tabs } from "@/components/tabs";

export function TeamClient({ initialData, aiConfigured }: { initialData: TeamData; aiConfigured: boolean }) {
  const router = useRouter();
  const [team, setTeam] = useState(initialData);
  const [sessionDuration, setSessionDuration] = useState("60");
  const [sessionObjective, setSessionObjective] = useState("");
  const [generating, setGenerating] = useState(false);
  const [addingId, setAddingId] = useState("");
  const [busyAdd, setBusyAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateSession(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/teams/${team.id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationMinutes: Number(sessionDuration) || 60,
        objective: sessionObjective || undefined,
      }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione della sessione.");
      return;
    }
    trackClient("team_session_generated", { teamId: team.id });
    router.push(`/sessions/${data.sessionId}`);
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addingId) return;
    setBusyAdd(true);
    setError(null);
    const res = await fetch(`/api/teams/${team.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: addingId }),
    });
    const data = await res.json();
    setBusyAdd(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante l'aggiunta.");
      return;
    }
    const added = team.availableAthletes.find((a) => a.id === addingId);
    setTeam((prev) => ({
      ...prev,
      members: added ? [...prev.members, { id: added.id, name: added.name, level: null }] : prev.members,
      availableAthletes: prev.availableAthletes.filter((a) => a.id !== addingId),
    }));
    setAddingId("");
    trackClient("team_member_added", { teamId: team.id, athleteId: addingId });
  }

  async function removeMember(athleteId: string) {
    setRemovingId(athleteId);
    setError(null);
    const res = await fetch(`/api/teams/${team.id}/members/${athleteId}`, { method: "DELETE" });
    setRemovingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Errore durante la rimozione.");
      return;
    }
    const removed = team.members.find((m) => m.id === athleteId);
    setTeam((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== athleteId),
      availableAthletes: removed ? [...prev.availableAthletes, { id: removed.id, name: removed.name }] : prev.availableAthletes,
    }));
    trackClient("team_member_removed", { teamId: team.id, athleteId });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {team.sportName} · {team.members.length} {team.members.length === 1 ? "atleta" : "atleti"}
        </p>
      </div>

      {!aiConfigured && (
        <div className="mb-6 rounded-lg border border-improving/30 bg-improving/10 px-4 py-3 text-sm text-improving">
          L&apos;AI non è ancora configurata (manca GEMINI_API_KEY) — la generazione di sessioni per squadra richiede l&apos;AI.
        </div>
      )}

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Panoramica",
            content: (
              <>
                {/* Session generator — one plan for the whole team, aggregating member priorities */}
                {aiConfigured && (
                  <form onSubmit={generateSession} className="mb-6 rounded-xl border border-border bg-surface p-5">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Genera sessione di squadra</h2>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted">Durata (min)</label>
                        <input
                          type="number"
                          min={10}
                          max={240}
                          value={sessionDuration}
                          onChange={(e) => setSessionDuration(e.target.value)}
                          className="w-24 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="mb-1.5 block text-xs font-medium text-muted">Obiettivo specifico (opzionale)</label>
                        <input
                          value={sessionObjective}
                          onChange={(e) => setSessionObjective(e.target.value)}
                          placeholder="Es. lavoro sulla copertura del campo in coppia"
                          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={generating || team.members.length === 0}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {generating ? "Generazione…" : "Genera con AI"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted">Una sessione unica per tutta la squadra, basata sulle priorità aggregate dei membri.</p>
                  </form>
                )}

                {/* Members */}
                <div className="rounded-xl border border-border bg-surface p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Atleti</h2>
                  {team.members.length === 0 ? (
                    <p className="text-sm text-muted">Nessun atleta ancora in questa squadra.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {team.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
                          <span>{m.name}</span>
                          <div className="flex items-center gap-2">
                            {m.level && <span className="text-xs text-muted">{m.level}</span>}
                            <button
                              onClick={() => removeMember(m.id)}
                              disabled={removingId === m.id}
                              className="text-xs text-muted transition-colors hover:text-negative disabled:opacity-50"
                            >
                              {removingId === m.id ? "…" : "Rimuovi"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={addMember} className="mt-4 flex gap-2">
                    {team.availableAthletes.length > 0 ? (
                      <>
                        <select
                          value={addingId}
                          onChange={(e) => setAddingId(e.target.value)}
                          className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                        >
                          <option value="">Aggiungi atleta…</option>
                          {team.availableAthletes.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={!addingId || busyAdd}
                          className="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
                        >
                          {busyAdd ? "…" : "Aggiungi"}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-muted">
                        Tutti i tuoi atleti di questo sport sono già in questa squadra. Crea un nuovo atleta dal tuo elenco per poterlo aggiungere qui.
                      </p>
                    )}
                  </form>
                </div>
              </>
            ),
          },
          {
            id: "development",
            label: "Sviluppo",
            content: (
              <>
                <ObjectivesSection basePath={`/api/teams/${team.id}/objectives`} initialGoals={team.goals} />
                <EvaluationsSection basePath={`/api/teams/${team.id}`} />
              </>
            ),
          },
          {
            id: "competitions",
            label: "Competizioni",
            content: <CompetitionsSection basePath={`/api/teams/${team.id}`} />,
          },
          {
            id: "history",
            label: "Storico",
            content:
              team.sessions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                  Nessuna sessione generata ancora per questa squadra.
                </p>
              ) : (
                <div className="space-y-2">
                  {team.sessions.map((s) => (
                    <a
                      key={s.id}
                      href={`/sessions/${s.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
                    >
                      <div>
                        <p className="font-medium">{s.objective || "Sessione di allenamento"}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(s.createdAt)} · {s.durationMinutes} min
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
