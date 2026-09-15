"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(res.status === 503 ? "Il recupero password non è ancora disponibile su questo ambiente." : data?.error ?? "Qualcosa è andato storto. Riprova.");
      setStatus("idle");
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← CoachBrain
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Recupera la password</h1>
          <p className="mt-1 text-sm text-muted">Ti invieremo un link per sceglierne una nuova.</p>
        </div>

        {status === "sent" ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm">
            <p>Se esiste un account con questa email, riceverai a breve un messaggio con le istruzioni per reimpostare la password.</p>
            <Link href="/login" className="mt-4 inline-block text-foreground underline underline-offset-4">
              Torna al login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="tu@esempio.com"
              />
            </div>

            {error && <p className="text-sm text-negative">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "Invio in corso…" : "Invia link di recupero"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted">
          Ricordi la password?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Accedi
          </Link>
        </p>
      </div>
    </main>
  );
}
