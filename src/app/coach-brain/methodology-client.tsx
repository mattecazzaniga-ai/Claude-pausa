"use client";

import { useState } from "react";
import { trackClient } from "@/lib/track-client";

type Category =
  | "FILOSOFIA"
  | "VOLUME"
  | "INTENSITA"
  | "RECUPERO"
  | "PROGRESSIONE"
  | "REGRESSIONE"
  | "PERIODIZZAZIONE"
  | "SCELTA_ESERCIZI"
  | "ESERCIZI_PREFERITI"
  | "ESERCIZI_DA_EVITARE"
  | "PRE_COMPETIZIONE"
  | "POST_COMPETIZIONE"
  | "LIVELLI_ETA"
  | "REGOLE_SPORT_SPECIFICHE"
  | "ALTRO";

type Principle = { id: string; text: string; category: Category };
type VersionHistoryItem = { id: string; version: number; changeSummary: string; createdAt: string; principleCount: number };

const CATEGORY_LABEL: Record<Category, string> = {
  FILOSOFIA: "Filosofia",
  VOLUME: "Volume",
  INTENSITA: "Intensità",
  RECUPERO: "Recupero",
  PROGRESSIONE: "Progressione",
  REGRESSIONE: "Regressione",
  PERIODIZZAZIONE: "Periodizzazione",
  SCELTA_ESERCIZI: "Scelta esercizi",
  ESERCIZI_PREFERITI: "Esercizi preferiti",
  ESERCIZI_DA_EVITARE: "Esercizi da evitare",
  PRE_COMPETIZIONE: "Pre-competizione",
  POST_COMPETIZIONE: "Post-competizione",
  LIVELLI_ETA: "Regole per livelli/età",
  REGOLE_SPORT_SPECIFICHE: "Regole sport-specifiche",
  ALTRO: "Altro",
};

/**
 * The "how I coach" half of the Coach Brain page (see coach-brain-client.tsx)
 * — previously its own /methodology page/route, merged in here because it
 * told the same story ("how MENTATHLOS understands your coaching") under a
 * different name. Renders just the two content cards; the page-level h1/
 * intro now lives once in CoachBrainClient.
 */
export function MethodologyClient({
  initialPrinciples,
  initialHistory,
}: {
  initialPrinciples: Principle[];
  initialHistory: VersionHistoryItem[];
}) {
  const [principles, setPrinciples] = useState(initialPrinciples);
  const [history, setHistory] = useState(initialHistory);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: { text: string; category: Category }[], changeSummary?: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/methodology", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ principles: next, changeSummary }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante il salvataggio.");
      return false;
    }
    setPrinciples(data.principles);
    setHistory((prev) => [
      { id: `v${data.version}`, version: data.version, changeSummary: changeSummary ?? "Aggiornamento", createdAt: new Date().toISOString(), principleCount: next.length },
      ...prev,
    ]);
    trackClient("methodology_saved", { version: data.version });
    return true;
  }

  async function removePrinciple(id: string) {
    const next = principles.filter((p) => p.id !== id).map((p) => ({ text: p.text, category: p.category }));
    await save(next);
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Principi attivi</h2>
          <div className="flex gap-3">
            <button onClick={() => setShowImportModal(true)} className="text-xs text-accent underline underline-offset-4">
              Importa da testo o file
            </button>
            <button onClick={() => setShowAddForm(true)} className="text-xs text-accent underline underline-offset-4">
              + Aggiungi principio
            </button>
          </div>
        </div>

        {error && <p className="mb-2 text-xs text-negative">{error}</p>}

        {principles.length === 0 ? (
          <p className="text-sm text-muted">
            Non hai ancora definito una metodologia. Scrivi i tuoi principi o importa un documento — MENTATHLOS li userà per adattare
            davvero sessioni e raccomandazioni.
          </p>
        ) : (
          <div className="space-y-2">
            {principles.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 p-3 text-sm">
                <div>
                  <span className="mb-1 inline-block rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                    {CATEGORY_LABEL[p.category]}
                  </span>
                  <p className="text-foreground/90">{p.text}</p>
                </div>
                <button
                  onClick={() => removePrinciple(p.id)}
                  disabled={busy}
                  className="shrink-0 text-[11px] text-muted transition-colors hover:text-negative disabled:opacity-50"
                >
                  Rimuovi
                </button>
              </div>
            ))}
          </div>
        )}

        {showAddForm && (
          <AddPrincipleForm
            onClose={() => setShowAddForm(false)}
            onAdd={async (text, category) => {
              const ok = await save([...principles.map((p) => ({ text: p.text, category: p.category })), { text, category }]);
              if (ok) setShowAddForm(false);
            }}
          />
        )}
      </div>

      {history.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Cronologia</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg bg-surface-2 p-3 text-xs">
                <p className="font-medium text-foreground/80">
                  v{h.version} · {new Date(h.createdAt).toLocaleDateString("it-IT")} · {h.principleCount} principi
                </p>
                <p className="mt-0.5 text-muted">{h.changeSummary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportMethodologyModal
          existingPrinciples={principles}
          onClose={() => setShowImportModal(false)}
          onSaved={(nextPrinciples) => {
            setShowImportModal(false);
            void (async () => {
              const ok = await save(nextPrinciples, "Importato da testo/file");
              if (ok) trackClient("methodology_imported", { added: nextPrinciples.length - principles.length });
            })();
          }}
        />
      )}
    </>
  );
}

function AddPrincipleForm({ onClose, onAdd }: { onClose: () => void; onAdd: (text: string, category: Category) => Promise<void> }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("ALTRO");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2) {
      setLocalError("Scrivi almeno qualche parola.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    await onAdd(text.trim(), category);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-scale-in space-y-4 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuovo principio</h2>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Principio</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Es. Non aumento volume e intensità contemporaneamente"
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
            {busy ? "Salvataggio…" : "Aggiungi"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

type DraftPrinciple = { text: string; category: Category };

/**
 * Master prompt §8-11: extract → coach reviews/edits/confirms → only then
 * active. Confirming here ADDS the reviewed principles to the existing
 * methodology rather than replacing it — importing another document is
 * additive by default, since silently discarding principles the coach
 * already entered would be a surprising, hard-to-undo side effect.
 */
function ImportMethodologyModal({
  existingPrinciples,
  onClose,
  onSaved,
}: {
  existingPrinciples: Principle[];
  onClose: () => void;
  onSaved: (nextPrinciples: DraftPrinciple[]) => void;
}) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [mode, setMode] = useState<"file" | "text">("text");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [rows, setRows] = useState<DraftPrinciple[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    if (mode === "file" && file) form.append("file", file);
    else if (mode === "text" && pastedText.trim()) form.append("text", pastedText.trim());
    else {
      setError("Carica un file o scrivi la tua metodologia.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/coach/methodology/import", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante l'analisi.");
      return;
    }
    setRows(data.principles);
    setStep("review");
  }

  function updateRow(i: number, patch: Partial<DraftPrinciple>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addRow() {
    setRows((prev) => [...prev, { text: "", category: "ALTRO" }]);
  }

  function confirm() {
    const valid = rows.filter((r) => r.text.trim().length >= 2);
    if (valid.length === 0) {
      setError("Nessun principio da salvare.");
      return;
    }
    onSaved([...existingPrinciples.map((p) => ({ text: p.text, category: p.category })), ...valid]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        {step === "upload" ? (
          <form onSubmit={analyze} className="space-y-3">
            <h2 className="text-lg font-semibold">Importa metodologia</h2>
            <p className="text-xs text-muted">
              Scrivi liberamente come alleni, o carica un documento (PDF, DOCX, CSV, TXT). L&apos;AI riconosce SOLO i principi realmente
              presenti — non ne inventa altri.
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`rounded-md px-3 py-1.5 ${mode === "text" ? "bg-accent text-black" : "border border-border text-muted"}`}
              >
                Scrivi il testo
              </button>
              <button
                type="button"
                onClick={() => setMode("file")}
                className={`rounded-md px-3 py-1.5 ${mode === "file" ? "bg-accent text-black" : "border border-border text-muted"}`}
              >
                Carica file
              </button>
            </div>

            {mode === "file" ? (
              <input
                type="file"
                accept=".pdf,.docx,.csv,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:font-medium file:text-black"
              />
            ) : (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={6}
                placeholder={
                  "Es. Preferisco la qualità al volume. Non aumento volume e intensità contemporaneamente. Negli atleti giovani privilegio tecnica e coordinazione…"
                }
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            )}

            {error && <p className="text-sm text-negative">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Analisi in corso…" : "Analizza con AI"}
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Abbiamo trovato questi principi</h2>
            <p className="text-xs text-muted">
              Controlla, modifica, elimina o aggiungi righe — verranno aggiunti alla tua metodologia attuale solo dopo la conferma.
            </p>

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="space-y-1.5 rounded-md bg-surface-2 p-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={row.category}
                      onChange={(e) => updateRow(i, { category: e.target.value as Category })}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                    >
                      {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeRow(i)} className="ml-auto text-xs text-negative">
                      Rimuovi
                    </button>
                  </div>
                  <input
                    value={row.text}
                    onChange={(e) => updateRow(i, { text: e.target.value })}
                    placeholder="Principio"
                    className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                </div>
              ))}
              {rows.length === 0 && <p className="text-sm text-muted">Nessun principio riconosciuto. Aggiungine uno manualmente.</p>}
            </div>

            <button type="button" onClick={addRow} className="text-xs text-accent underline underline-offset-4">
              + Aggiungi riga
            </button>

            {error && <p className="text-sm text-negative">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirm}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                Aggiungi {rows.filter((r) => r.text.trim().length >= 2).length} principi
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
