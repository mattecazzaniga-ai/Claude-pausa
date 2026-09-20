"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

type Priority = { skill: string; reason: string };
type OverallInjuryStatus = "NONE" | "MONITORED" | "PARTIAL" | "ACTIVE_INJURY";

type AthleteListItem = {
  id: string;
  name: string;
  level: string | null;
  sportName: string;
  lastSessionDate: string | null;
  priorityCount: number;
  topPriority: Priority | null;
  overallInjuryStatus: OverallInjuryStatus;
};

type TeamListItem = {
  id: string;
  name: string;
  sportName: string;
  memberCount: number;
  topPriority: Priority | null;
};

type CalendarEvent = {
  id: string;
  type: "TRAINING" | "EVALUATION" | "COMPETITION" | "OTHER";
  title: string;
  startAt: string;
  athleteId: string | null;
  teamId: string | null;
  trainingSessionId: string | null;
  athlete: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
};

const EVENT_ICON: Record<CalendarEvent["type"], string> = { TRAINING: "🏋️", EVALUATION: "📋", COMPETITION: "🏆", OTHER: "📌" };
const STALE_DAYS = 14;
const SOON_DAYS = 7;

/**
 * Product restructure §4/§35: Home answers "what do I do today", not "here's
 * a pile of stats". The roster itself now lives on /athletes — this page
 * only ever shows information a coach could act on right now. Reuses data
 * every other part of the app already fetches (calendar, athlete/team
 * priorities, injury status) — no new AI calls, no new backend entity.
 */
export function DashboardClient() {
  const { data: session } = useSession();
  const [athletes, setAthletes] = useState<AthleteListItem[] | null>(null);
  const [teams, setTeams] = useState<TeamListItem[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);

  useEffect(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    Promise.all([
      fetch("/api/athletes").then((r) => r.json()),
      fetch("/api/teams").then((r) => r.json()),
      fetch(`/api/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`).then((r) => r.json()),
    ]).then(([a, t, c]) => {
      setAthletes(a.athletes ?? []);
      setTeams(t.teams ?? []);
      setEvents(c.events ?? []);
    });
  }, []);

  const firstName = session?.user?.name?.split(" ")[0];

  const todayEvents = useMemo(() => {
    if (!events) return null;
    const now = new Date();
    return events.filter((e) => new Date(e.startAt).toDateString() === now.toDateString());
  }, [events]);

  const needsAttention = useMemo(() => {
    if (!athletes || !events) return null;
    const soonCompetitionAthleteIds = new Set(
      events
        .filter((e) => e.type === "COMPETITION" && e.athleteId && new Date(e.startAt).getTime() - Date.now() < SOON_DAYS * 24 * 60 * 60 * 1000)
        .map((e) => e.athleteId as string),
    );
    const now = Date.now();
    return athletes
      .map((a) => {
        if (a.overallInjuryStatus === "ACTIVE_INJURY" || a.overallInjuryStatus === "PARTIAL") {
          return { athlete: a, reason: "Infortunio o limitazione attiva" };
        }
        if (soonCompetitionAthleteIds.has(a.id)) {
          return { athlete: a, reason: "Competizione imminente" };
        }
        if (a.lastSessionDate && now - new Date(a.lastSessionDate).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000) {
          return { athlete: a, reason: "Nessuna sessione da oltre 2 settimane" };
        }
        return null;
      })
      .filter((x): x is { athlete: AthleteListItem; reason: string } => x !== null)
      .slice(0, 5);
  }, [athletes, events]);

  const todaySessionCount = todayEvents?.filter((e) => e.type === "TRAINING").length ?? 0;
  const todayCompetitionCount = todayEvents?.filter((e) => e.type === "COMPETITION").length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        {greeting()}{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="mb-6 text-sm text-muted">Il tuo allenamento, oggi.</p>

      {todayEvents && needsAttention && (
        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          <StatPill count={todaySessionCount} label={todaySessionCount === 1 ? "sessione oggi" : "sessioni oggi"} />
          {todayCompetitionCount > 0 && (
            <StatPill count={todayCompetitionCount} label={todayCompetitionCount === 1 ? "competizione oggi" : "competizioni oggi"} />
          )}
          {needsAttention.length > 0 && (
            <StatPill count={needsAttention.length} label={needsAttention.length === 1 ? "atleta richiede attenzione" : "atleti richiedono attenzione"} accent />
          )}
        </div>
      )}

      {todayEvents && todayEvents.length > 0 && (
        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Oggi</h2>
          <div className="space-y-2">
            {todayEvents.map((ev) => (
              <TodayEventRow key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}

      {needsAttention && needsAttention.length > 0 && (
        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Richiede attenzione</h2>
          <div className="space-y-2">
            {needsAttention.map(({ athlete, reason }) => (
              <Link
                key={athlete.id}
                href={`/athletes/${athlete.id}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm transition-colors hover:bg-surface"
              >
                <span className="font-medium">{athlete.name}</span>
                <span className="text-xs text-muted">{reason}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {athletes && teams && <RecommendationCard athletes={athletes} teams={teams} />}

      {events && events.length > 0 && <UpcomingEventsCard events={events} />}

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Link href="/athletes" className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2">
          + Nuovo atleta
        </Link>
        <Link href="/calendar" className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2">
          Pianifica
        </Link>
        <Link href="/coach-brain" className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2">
          Coach Brain
        </Link>
      </div>
    </div>
  );
}

function StatPill({ count, label, accent }: { count: number; label: string; accent?: boolean }) {
  if (count === 0) return null;
  return (
    <span className={`rounded-full px-3 py-1 tabular-nums ${accent ? "bg-accent/15 text-accent" : "bg-surface-2 text-foreground/80"}`}>
      {count} {label}
    </span>
  );
}

function TodayEventRow({ event }: { event: CalendarEvent }) {
  const subject = event.athlete?.name ?? event.team?.name;
  const href = event.type === "TRAINING" && event.trainingSessionId
    ? `/sessions/${event.trainingSessionId}`
    : event.athleteId
      ? `/athletes/${event.athleteId}`
      : event.teamId
        ? `/teams/${event.teamId}`
        : null;
  const actionLabel = event.type === "TRAINING" && event.trainingSessionId ? "Apri sessione" : "Apri";

  const content = (
    <>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {EVENT_ICON[event.type]} {event.title}
          {subject && <span className="font-normal text-muted"> · {subject}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {new Date(event.startAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {href && <span className="shrink-0 text-xs text-accent underline underline-offset-4">{actionLabel}</span>}
    </>
  );

  if (!href) {
    return <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3">{content}</div>;
  }
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 transition-colors hover:bg-surface">
      {content}
    </Link>
  );
}

/**
 * "MENTATHLOS consiglia" — the single most useful next action instead of
 * making the coach open an athlete/team first: the top cached AI priority
 * for one athlete and one group, each one click away from a generated
 * session. No new AI call — reuses aiPriorities already computed after the
 * last note/evaluation/competition.
 */
function RecommendationCard({ athletes, teams }: { athletes: AthleteListItem[]; teams: TeamListItem[] }) {
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
    <section className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">MENTATHLOS consiglia</h2>
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
    </section>
  );
}

/** Master prompt §18/31: "at a glance" — the coach shouldn't have to open the calendar to see what's coming up. */
function UpcomingEventsCard({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.startAt).toDateString() !== now.toDateString()).slice(0, 5);
  if (upcoming.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Prossimi eventi</h2>
        <Link href="/calendar" className="text-xs text-accent underline underline-offset-4">
          Apri calendario
        </Link>
      </div>
      <div className="space-y-1.5">
        {upcoming.map((ev) => (
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
    </section>
  );
}
