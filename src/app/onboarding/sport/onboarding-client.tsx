"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingSportClient({ sports }: { sports: { id: string; name: string }[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sports;
    return sports.filter((s) => s.name.toLowerCase().includes(q));
  }, [sports, query]);

  async function selectSport(sportId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/sport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Errore, riprova.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/sport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customName: customName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Errore, riprova.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="mb-6 text-center">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Seleziona il tuo sport</h1>
        <p className="mt-1 text-sm text-muted">
          CoachBrain adatta competenze, esercizi e sessioni al tuo sport specifico.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        {!customMode ? (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca il tuo sport…"
              className="mb-3 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="max-h-72 space-y-1 overflow-y-auto no-scrollbar">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  disabled={busy}
                  onClick={() => selectSport(s.id)}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  {s.name}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted">Nessun risultato.</p>}
            </div>
            <button
              onClick={() => setCustomMode(true)}
              className="mt-3 w-full rounded-md border border-dashed border-border py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              Il mio sport non è in lista
            </button>
          </>
        ) : (
          <form onSubmit={submitCustom} className="space-y-3">
            <label className="block text-xs font-medium text-muted">Nome dello sport</label>
            <input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Es. Kitesurf, Scherma, ecc."
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !customName.trim()}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Configurazione…" : "Continua"}
              </button>
              <button
                type="button"
                onClick={() => setCustomMode(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
              >
                Indietro
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
