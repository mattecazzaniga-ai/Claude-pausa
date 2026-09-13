"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackClient } from "@/lib/track-client";

type EventType = "TRAINING" | "EVALUATION" | "COMPETITION" | "OTHER";

type CalendarEvent = {
  id: string;
  type: EventType;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  notes: string | null;
  trainingSessionId: string | null;
  athlete: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  competition: { id: string; type: string; result: string } | null;
};

type Option = { id: string; name: string };

const TYPE_ICON: Record<EventType, string> = { TRAINING: "🏋️", EVALUATION: "📋", COMPETITION: "🏆", OTHER: "📌" };
const TYPE_LABEL: Record<EventType, string> = { TRAINING: "Allenamento", EVALUATION: "Valutazione", COMPETITION: "Competizione", OTHER: "Altro" };

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function CalendarClient() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [athletes, setAthletes] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  async function loadEvents() {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    const res = await fetch(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const data = await res.json();
    if (res.ok) setEvents(data.events ?? []);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the visible week changes
  }, [weekStart]);

  useEffect(() => {
    Promise.all([fetch("/api/athletes").then((r) => r.json()), fetch("/api/teams").then((r) => r.json())]).then(([a, t]) => {
      setAthletes((a.athletes ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
      setTeams((t.teams ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    });
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Calendario</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-surface-2">
            ←
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
            Oggi
          </button>
          <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-surface-2">
            →
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            + Nuovo evento
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        {days[0].toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – {days[6].toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
      </p>

      {events === null ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((e) => sameDay(new Date(e.startAt), day)).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
            const isToday = sameDay(day, today);
            return (
              <div key={day.toISOString()} className={`rounded-xl border p-3 ${isToday ? "border-accent/40 bg-accent/5" : "border-border bg-surface"}`}>
                <p className={`mb-2 text-xs font-medium uppercase tracking-wider ${isToday ? "text-accent" : "text-muted"}`}>
                  {day.toLocaleDateString("it-IT", { weekday: "short" })} {day.getDate()}
                </p>
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-muted">—</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="block w-full rounded-md bg-surface-2 p-2 text-left text-xs transition-colors hover:bg-border"
                      >
                        <p className="font-medium">
                          {TYPE_ICON[ev.type]} {timeLabel(ev.startAt)} {ev.title}
                        </p>
                        {(ev.athlete || ev.team) && <p className="mt-0.5 text-muted">{ev.athlete?.name ?? ev.team?.name}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <NewEventForm
          athletes={athletes}
          teams={teams}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            loadEvents();
          }}
        />
      )}

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onChanged={() => {
            setSelectedEvent(null);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}

function NewEventForm({
  athletes,
  teams,
  onClose,
  onCreated,
}: {
  athletes: Option[];
  teams: Option[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"TRAINING" | "OTHER">("TRAINING");
  const [subject, setSubject] = useState(""); // "athlete:id" or "team:id" or ""
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Seleziona una data.");
      return;
    }
    setBusy(true);
    setError(null);
    const [kind, id] = subject.split(":");
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title,
        startAt: new Date(`${date}T${startTime}`).toISOString(),
        endAt: new Date(`${date}T${endTime}`).toISOString(),
        athleteId: kind === "athlete" ? id : undefined,
        teamId: kind === "team" ? id : undefined,
        location: location || undefined,
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la creazione.");
      return;
    }
    trackClient("calendar_event_created", {});
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-scale-in space-y-3 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuovo evento</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Titolo</label>
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Es. Allenamento tecnico"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "TRAINING" | "OTHER")}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="TRAINING">Allenamento</option>
              <option value="OTHER">Altro</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Per chi</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Nessuno</option>
              {athletes.map((a) => (
                <option key={a.id} value={`athlete:${a.id}`}>
                  {a.name}
                </option>
              ))}
              {teams.map((t) => (
                <option key={t.id} value={`team:${t.id}`}>
                  {t.name} (squadra)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Data</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Inizio</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Fine</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Luogo (opzionale)"
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Note (opzionale)"
          className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creazione…" : "Crea evento"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

function EventDetailPanel({ event, onClose, onChanged }: { event: CalendarEvent; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateSession() {
    setBusy(true);
    setError(null);
    const subjectPath = event.athlete ? `/api/athletes/${event.athlete.id}/sessions` : event.team ? `/api/teams/${event.team.id}/sessions` : null;
    if (!subjectPath) {
      setError("Collega l'evento a un atleta o a una squadra per generare una sessione.");
      setBusy(false);
      return;
    }
    const durationMinutes = Math.max(10, Math.round((+new Date(event.endAt) - +new Date(event.startAt)) / 60000));
    const res = await fetch(subjectPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "Errore durante la generazione della sessione.");
      return;
    }
    await fetch(`/api/calendar/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainingSessionId: data.sessionId }),
    });
    trackClient("calendar_session_generated", { eventId: event.id });
    router.push(`/sessions/${data.sessionId}`);
  }

  async function deleteEvent() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/calendar/${event.id}`, { method: "DELETE" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante l'eliminazione.");
      return;
    }
    trackClient("calendar_event_deleted", { eventId: event.id });
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm animate-scale-in space-y-3 rounded-xl border border-border bg-surface p-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{TYPE_LABEL[event.type]}</p>
          <h2 className="text-lg font-semibold">{event.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {new Date(event.startAt).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })} · {timeLabel(event.startAt)}–{timeLabel(event.endAt)}
          </p>
          {event.location && <p className="text-sm text-muted">{event.location}</p>}
          {(event.athlete || event.team) && <p className="mt-1 text-sm">{event.athlete?.name ?? event.team?.name}</p>}
          {event.notes && <p className="mt-2 text-sm text-foreground/80">{event.notes}</p>}
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {event.athlete && (
            <Link href={`/athletes/${event.athlete.id}`} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2">
              Apri atleta
            </Link>
          )}
          {event.team && (
            <Link href={`/teams/${event.team.id}`} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2">
              Apri squadra
            </Link>
          )}
          {event.type === "TRAINING" &&
            (event.trainingSessionId ? (
              <Link href={`/sessions/${event.trainingSessionId}`} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black">
                Apri sessione
              </Link>
            ) : (
              <button
                onClick={generateSession}
                disabled={busy}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
              >
                {busy ? "Generazione…" : "Genera sessione"}
              </button>
            ))}
          {event.type !== "COMPETITION" && (
            <button
              onClick={deleteEvent}
              disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-negative hover:bg-surface-2 disabled:opacity-50"
            >
              Elimina
            </button>
          )}
        </div>

        <button onClick={onClose} className="w-full rounded-md border border-border py-2 text-sm hover:bg-surface-2">
          Chiudi
        </button>
      </div>
    </div>
  );
}
