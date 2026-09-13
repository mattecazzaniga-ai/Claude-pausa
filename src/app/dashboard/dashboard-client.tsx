"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRelativeDate } from "@/lib/format";

type Priority = { skill: string; reason: string };

type AthleteListItem = {
  id: string;
  name: string;
  level: string | null;
  sportName: string;
  lastSessionDate: string | null;
  priorityCount: number;
  topPriority: Priority | null;
};

type TeamListItem = {
  id: string;
  name: string;
  sportName: string;
  memberCount: number;
  topPriority: Priority | null;
};

export function DashboardClient({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [athletes, setAthletes] = useState<AthleteListItem[] | null>(null);
  const [teams, setTeams] = useState<TeamListItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [athletesRes, teamsRes] = await Promise.all([fetch("/api/athletes"), fetch("/api/teams")]);
    const athletesData = await athletesRes.json();
    const teamsData = await teamsRes.json();
    setAthletes(athletesData.athletes ?? []);
    setTeams(teamsData.teams ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <SportProfileCard />

      <UpcomingEventsCard />

      {aiConfigured && athletes && teams && <TodayFocusCard athletes={athletes} teams={teams} />}

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
              {a.topPriority && (
                <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                  {a.topPriority.skill}
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

/**
 * "Cosa alleniamo oggi?" — surfaces the single most useful next action
 * instead of making the coach open an athlete/team first: the top cached AI
 * priority for one athlete and one group, each one click away from a
 * generated session. No new AI call — reuses aiPriorities already computed
 * after the last note/evaluation.
 */
function TodayFocusCard({ athletes, teams }: { athletes: AthleteListItem[]; teams: TeamListItem[] }) {
  const router = useRouter();
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const athleteFocus = athletes.find((a) => a.topPriority);
  const teamFocus = teams.find((t) => t.topPriority);

  if (!athleteFocus && !teamFocus) return null;

  async function generateForAthlete(a: AthleteListItem) {
    if (!a.topPriority) return;
    setGeneratingKey(`athlete:${a.id}`);
    setError(null);
    const res = await fetch(`/api/athletes/${a.id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes: 60, objective: `Lavorare su: ${a.topPriority.skill}` }),
    });
    const data = await res.json();
    setGeneratingKey(null);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione della sessione.");
      return;
    }
    router.push(`/sessions/${data.sessionId}`);
  }

  async function generateForTeam(t: TeamListItem) {
    if (!t.topPriority) return;
    setGeneratingKey(`team:${t.id}`);
    setError(null);
    const res = await fetch(`/api/teams/${t.id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes: 60, objective: `Lavorare su: ${t.topPriority.skill}` }),
    });
    const data = await res.json();
    setGeneratingKey(null);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione della sessione.");
      return;
    }
    router.push(`/sessions/${data.sessionId}`);
  }

  return (
    <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Cosa alleniamo oggi?</h2>
      <div className="space-y-3">
        {athleteFocus?.topPriority && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {athleteFocus.name} — <span className="text-accent">{athleteFocus.topPriority.skill}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{athleteFocus.topPriority.reason}</p>
            </div>
            <button
              onClick={() => generateForAthlete(athleteFocus)}
              disabled={generatingKey === `athlete:${athleteFocus.id}`}
              className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generatingKey === `athlete:${athleteFocus.id}` ? "Generazione…" : "Genera sessione"}
            </button>
          </div>
        )}
        {teamFocus?.topPriority && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {teamFocus.name} — <span className="text-accent">{teamFocus.topPriority.skill}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{teamFocus.topPriority.reason}</p>
            </div>
            <button
              onClick={() => generateForTeam(teamFocus)}
              disabled={generatingKey === `team:${teamFocus.id}`}
              className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generatingKey === `team:${teamFocus.id}` ? "Generazione…" : "Genera sessione"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-negative">{error}</p>}
    </div>
  );
}

type SportProfile = {
  formats: string[];
  environment: string;
  equipment: string;
  scoringSystem: string;
  keyRules: string;
  terminology: string;
};

function SportProfileCard() {
  const [sportName, setSportName] = useState<string | null>(null);
  const [profile, setProfile] = useState<SportProfile | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coach/sport-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSportName(data.sportName);
          setProfile(data.profile);
        }
      });
  }, []);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    const res = await fetch("/api/coach/sport-profile", { method: "POST" });
    const data = await res.json();
    setRegenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la rigenerazione.");
      return;
    }
    setSportName(data.sportName);
    setProfile(data.profile);
  }

  if (!profile) return null;

  const hasContent = profile.environment || profile.equipment || profile.scoringSystem || profile.keyRules || profile.terminology;

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Profilo AI — {sportName}</span>
        <span className="text-xs text-muted">{expanded ? "Nascondi" : "Mostra"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          {hasContent ? (
            <>
              <p><span className="text-muted">Formato:</span> {profile.formats.join(", ") || "N/D"}</p>
              <p><span className="text-muted">Campo/ambiente:</span> {profile.environment || "N/D"}</p>
              <p><span className="text-muted">Attrezzatura:</span> {profile.equipment || "N/D"}</p>
              <p><span className="text-muted">Punteggio:</span> {profile.scoringSystem || "N/D"}</p>
              <p><span className="text-muted">Regole chiave:</span> {profile.keyRules || "N/D"}</p>
              <p><span className="text-muted">Terminologia:</span> {profile.terminology || "N/D"}</p>
            </>
          ) : (
            <p className="text-muted">Profilo non ancora generato (verrà creato alla prima nota/esercizio/sessione).</p>
          )}

          <p className="pt-1 text-xs text-muted">
            Trovi un termine sbagliato o preso da uno sport simile (es. termini da padel dentro il beach tennis)? Rigeneralo.
          </p>
          {error && <p className="text-xs text-negative">{error}</p>}
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="mt-1 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {regenerating ? "Rigenerazione…" : "Rigenera profilo con AI"}
          </button>
        </div>
      )}
    </div>
  );
}

type UpcomingEvent = {
  id: string;
  type: "TRAINING" | "EVALUATION" | "COMPETITION" | "OTHER";
  title: string;
  startAt: string;
  athlete: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
};

const EVENT_ICON: Record<UpcomingEvent["type"], string> = { TRAINING: "🏋️", EVALUATION: "📋", COMPETITION: "🏆", OTHER: "📌" };

/** Master prompt §18/31: "at a glance" — the coach shouldn't have to open the calendar to see what's coming up. */
function UpcomingEventsCard() {
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null);

  useEffect(() => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    fetch(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEvents(data ? (data.events ?? []).slice(0, 5) : []));
  }, []);

  if (events === null || events.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Prossimi eventi</h2>
        <Link href="/calendar" className="text-xs text-accent underline underline-offset-4">
          Apri calendario
        </Link>
      </div>
      <div className="space-y-1.5">
        {events.map((ev) => (
          <div key={ev.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
            <span>
              {EVENT_ICON[ev.type]} {ev.title}
              {(ev.athlete || ev.team) && <span className="text-muted"> · {ev.athlete?.name ?? ev.team?.name}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {new Date(ev.startAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}{" "}
              {new Date(ev.startAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
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
