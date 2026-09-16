"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trackClient } from "@/lib/track-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selfCoaching, setSelfCoaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, selfCoaching }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Qualcosa è andato storto.");
      setLoading(false);
      return;
    }

    trackClient("signup");

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Mentathlos
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Crea il tuo account</h1>
          <p className="mt-1 text-sm text-muted">Gratis per iniziare, nessuna carta richiesta.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Nome</label>
            <input
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Mario Rossi"
            />
          </div>
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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Almeno 8 caratteri"
            />
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3 text-sm">
            <input
              type="checkbox"
              checked={selfCoaching}
              onChange={(e) => setSelfCoaching(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Mi alleno da solo</span>
              <span className="block text-xs text-muted">
                Niente gestione di altri atleti o squadre: solo il tuo allenamento personale, con check-in di prontezza e sforzo percepito.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-negative">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creazione account…" : "Crea account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Hai già un account?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Accedi
          </Link>
        </p>
      </div>
    </main>
  );
}
