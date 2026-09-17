"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";

type InjuryType = "INFORTUNIO" | "FASTIDIO" | "DOLORE_RIFERITO" | "LIMITAZIONE" | "PROBLEMA_RICORRENTE" | "ALTRO";
type InjurySide = "LEFT" | "RIGHT" | "BILATERAL" | "NOT_APPLICABLE";
type InjuryOrigin = "ALLENAMENTO" | "PARTITA" | "COMPETIZIONE" | "INSORGENZA_GRADUALE" | "FUORI_DALLO_SPORT" | "NON_NOTO";
type InjuryStatus = "ACTIVE" | "MONITORING" | "RETURNING" | "RESOLVED" | "ARCHIVED";
type OverallStatus = "NONE" | "MONITORED" | "PARTIAL" | "ACTIVE_INJURY";

type InjuryEvent = { id: string; date: string; note: string };
type Injury = {
  id: string;
  type: InjuryType;
  bodyRegion: string;
  side: InjurySide;
  areaDetail: string | null;
  origin: InjuryOrigin;
  status: InjuryStatus;
  startDate: string;
  resolvedDate: string | null;
  description: string | null;
  reportedLimitations: string | null;
  coachNotes: string | null;
  events: InjuryEvent[];
};

const TYPE_LABEL: Record<InjuryType, string> = {
  INFORTUNIO: "Infortunio",
  FASTIDIO: "Fastidio",
  DOLORE_RIFERITO: "Dolore riferito",
  LIMITAZIONE: "Limitazione",
  PROBLEMA_RICORRENTE: "Problema ricorrente",
  ALTRO: "Altro",
};

const SIDE_LABEL: Record<InjurySide, string> = {
  LEFT: "sinistro",
  RIGHT: "destro",
  BILATERAL: "bilaterale",
  NOT_APPLICABLE: "",
};

const ORIGIN_LABEL: Record<InjuryOrigin, string> = {
  ALLENAMENTO: "Allenamento",
  PARTITA: "Partita",
  COMPETIZIONE: "Competizione",
  INSORGENZA_GRADUALE: "Insorgenza graduale",
  FUORI_DALLO_SPORT: "Fuori dallo sport",
  NON_NOTO: "Non noto",
};

const STATUS_LABEL: Record<InjuryStatus, string> = {
  ACTIVE: "Attivo",
  MONITORING: "Monitoraggio",
  RETURNING: "Rientro progressivo",
  RESOLVED: "Risolto",
  ARCHIVED: "Archiviato",
};

const STATUS_STYLE: Record<InjuryStatus, string> = {
  ACTIVE: "bg-negative/15 text-negative",
  MONITORING: "bg-improving/15 text-improving",
  RETURNING: "bg-accent/15 text-accent",
  RESOLVED: "bg-positive/15 text-positive",
  ARCHIVED: "bg-surface-2 text-muted",
};

const OVERALL_CONFIG: Record<OverallStatus, { emoji: string; label: string }> = {
  NONE: { emoji: "🟢", label: "Nessuna limitazione registrata" },
  MONITORED: { emoji: "🟡", label: "Fastidio monitorato" },
  PARTIAL: { emoji: "🟠", label: "Limitazione parziale" },
  ACTIVE_INJURY: { emoji: "🔴", label: "Infortunio / indisponibilità" },
};

const BODY_AREA_SUGGESTIONS = ["Spalla", "Gomito", "Polso", "Schiena bassa", "Anca", "Ginocchio", "Caviglia", "Piede", "Collo", "Coscia", "Polpaccio"];

/** Compact status indicator meant for the athlete page header — its own small fetch, independent of the full section below. */
export function InjuryStatusBadge({ basePath }: { basePath: string }) {
  const [status, setStatus] = useState<OverallStatus | null>(null);

  useEffect(() => {
    fetch(`${basePath}/injuries`)
      .then((r) => r.json())
      .then((data) => setStatus(data.overallStatus ?? "NONE"))
      .catch(() => {});
  }, [basePath]);

  if (!status) return null;
  const config = OVERALL_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
      <span>{config.emoji}</span>
      {config.label}
    </span>
  );
}

/**
 * Injuries & Discomfort (master prompt §13-20). Deliberately no interactive
 * body-map SVG here — a free-text area field with common suggestions gets
 * the same structured-enough data without a large diagram-drawing effort
 * that would otherwise dominate this phase's scope. No document/photo
 * attachment upload either: this environment has no blob storage
 * configured to actually persist a file.
 */
export function InjuriesSection({ basePath }: { basePath: string }) {
  const [injuries, setInjuries] = useState<Injury[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`${basePath}/injuries`);
    const data = await res.json();
    if (res.ok) setInjuries(data.injuries ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  async function updateStatus(injury: Injury, status: InjuryStatus) {
    setError(null);
    const res = await fetch(`${basePath}/injuries/${injury.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolvedDate: status === "RESOLVED" ? new Date().toISOString() : undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Errore durante l'aggiornamento.");
      return;
    }
    trackClient("injury_updated", { status });
    load();
  }

  async function deleteInjury(injuryId: string) {
    if (!confirm("Eliminare questo episodio? L'azione non è reversibile.")) return;
    setError(null);
    const res = await fetch(`${basePath}/injuries/${injuryId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Errore durante l'eliminazione.");
      return;
    }
    trackClient("injury_deleted", {});
    load();
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Infortuni & Fastidi</h2>
        <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
          + Registra problema
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {injuries === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : injuries.length === 0 ? (
        <p className="text-sm text-muted">🟢 Nessuna limitazione registrata.</p>
      ) : (
        <div className="space-y-3">
          {injuries.map((inj) => (
            <InjuryCard key={inj.id} injury={inj} basePath={basePath} onStatusChange={updateStatus} onDelete={deleteInjury} onEventAdded={load} />
          ))}
        </div>
      )}

      {showForm && (
        <NewInjuryForm
          basePath={basePath}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function InjuryCard({
  injury,
  basePath,
  onStatusChange,
  onDelete,
  onEventAdded,
}: {
  injury: Injury;
  basePath: string;
  onStatusChange: (injury: Injury, status: InjuryStatus) => void;
  onDelete: (id: string) => void;
  onEventAdded: () => void;
}) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventNote, setEventNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventNote.trim()) return;
    setBusy(true);
    const res = await fetch(`${basePath}/injuries/${injury.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: eventNote.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      trackClient("injury_event_added", {});
      setEventNote("");
      setShowEventForm(false);
      onEventAdded();
    }
  }

  const sideText = injury.side !== "NOT_APPLICABLE" ? ` (${SIDE_LABEL[injury.side]})` : "";

  return (
    <div className="rounded-lg bg-surface-2 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {TYPE_LABEL[injury.type]} — {injury.bodyRegion}
            {sideText}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Dal {new Date(injury.startDate).toLocaleDateString("it-IT")}
            {injury.resolvedDate && ` · Risolto il ${new Date(injury.resolvedDate).toLocaleDateString("it-IT")}`}
            {" · "}
            Origine: {ORIGIN_LABEL[injury.origin]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={injury.status}
            onChange={(e) => onStatusChange(injury, e.target.value as InjuryStatus)}
            className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${STATUS_STYLE[injury.status]}`}
          >
            {(Object.keys(STATUS_LABEL) as InjuryStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button onClick={() => onDelete(injury.id)} className="text-[11px] text-muted transition-colors hover:text-negative">
            Elimina
          </button>
        </div>
      </div>

      {injury.description && <p className="mt-2 text-foreground/80">{injury.description}</p>}
      {injury.reportedLimitations && (
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-foreground/70">Limitazioni riferite: </span>
          {injury.reportedLimitations}
        </p>
      )}
      {injury.coachNotes && (
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-foreground/70">Note coach: </span>
          {injury.coachNotes}
        </p>
      )}

      {injury.events.length > 0 && (
        <div className="mt-3 space-y-1 border-l-2 border-border pl-3">
          {injury.events.map((ev) => (
            <p key={ev.id} className="text-xs text-muted">
              <span className="font-medium text-foreground/70">{new Date(ev.date).toLocaleDateString("it-IT")}</span> — {ev.note}
            </p>
          ))}
        </div>
      )}

      {showEventForm ? (
        <form onSubmit={addEvent} className="mt-3 flex gap-2">
          <input
            value={eventNote}
            onChange={(e) => setEventNote(e.target.value)}
            placeholder="Es. Ridotto volume dei salti"
            className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
            {busy ? "…" : "Aggiungi"}
          </button>
          <button type="button" onClick={() => setShowEventForm(false)} className="text-xs text-muted">
            Annulla
          </button>
        </form>
      ) : (
        <button onClick={() => setShowEventForm(true)} className="mt-3 text-xs text-accent underline underline-offset-4">
          + Aggiungi evento alla timeline
        </button>
      )}
    </div>
  );
}

function NewInjuryForm({
  basePath,
  onClose,
  onCreated,
  onError,
}: {
  basePath: string;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [type, setType] = useState<InjuryType>("FASTIDIO");
  const [bodyRegion, setBodyRegion] = useState("");
  const [side, setSide] = useState<InjurySide>("NOT_APPLICABLE");
  const [origin, setOrigin] = useState<InjuryOrigin>("NON_NOTO");
  const [description, setDescription] = useState("");
  const [reportedLimitations, setReportedLimitations] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyRegion.trim()) {
      setLocalError("Indica l'area interessata.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    onError(null);

    const res = await fetch(`${basePath}/injuries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        bodyRegion: bodyRegion.trim(),
        side,
        origin,
        description: description.trim() || undefined,
        reportedLimitations: reportedLimitations.trim() || undefined,
        coachNotes: coachNotes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setLocalError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    trackClient("injury_recorded", { type });
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Registra un problema</h2>
        <p className="text-xs text-muted">Dati registrati, non una diagnosi — servono a MENTATHLOS per adattare le sessioni future.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InjuryType)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {(Object.keys(TYPE_LABEL) as InjuryType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Lato</label>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as InjurySide)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="NOT_APPLICABLE">Non applicabile</option>
              <option value="LEFT">Sinistro</option>
              <option value="RIGHT">Destro</option>
              <option value="BILATERAL">Bilaterale</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Area interessata</label>
          <input
            list="body-area-suggestions"
            value={bodyRegion}
            onChange={(e) => setBodyRegion(e.target.value)}
            placeholder="Es. Spalla, Ginocchio, Schiena bassa…"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <datalist id="body-area-suggestions">
            {BODY_AREA_SUGGESTIONS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Origine riferita</label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as InjuryOrigin)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(ORIGIN_LABEL) as InjuryOrigin[]).map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABEL[o]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Descrizione (opzionale)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Limitazioni riferite (opzionale)</label>
          <textarea
            value={reportedLimitations}
            onChange={(e) => setReportedLimitations(e.target.value)}
            rows={2}
            placeholder="Es. Evitare movimenti overhead"
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Note coach (opzionale)</label>
          <textarea
            value={coachNotes}
            onChange={(e) => setCoachNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {localError && <p className="text-sm text-negative">{localError}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Salvataggio…" : "Salva"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
