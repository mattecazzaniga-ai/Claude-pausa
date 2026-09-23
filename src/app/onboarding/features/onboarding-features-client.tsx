"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeatureDef, FeatureId } from "@/lib/features";

export function OnboardingFeaturesClient({ features }: { features: FeatureDef[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<FeatureId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: FeatureId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function continueToApp() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: Array.from(selected) }),
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
    <div className="w-full max-w-lg animate-fade-in">
      <div className="mb-6 text-center">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Cosa ti interessa di più?</h1>
        <p className="mt-1 text-sm text-muted">
          Scegli le aree che usi più spesso: le troverai in evidenza nella tua Home. Puoi comunque esplorare tutto
          dal menu in alto.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {features.map((f) => {
            const isSelected = selected.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                aria-pressed={isSelected}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-colors ${
                  isSelected ? "border-accent bg-accent/10" : "border-border bg-surface-2 hover:border-accent/40"
                }`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{f.label}</span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                      isSelected ? "border-accent bg-accent text-black" : "border-border text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                </span>
                <span className="text-xs text-muted">{f.description}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-negative">{error}</p>}

        <button
          type="button"
          onClick={continueToApp}
          disabled={busy}
          className="mt-5 w-full rounded-md bg-accent py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Configurazione…" : selected.size > 0 ? `Continua con ${selected.size} selezionate` : "Continua"}
        </button>
      </div>
    </div>
  );
}
