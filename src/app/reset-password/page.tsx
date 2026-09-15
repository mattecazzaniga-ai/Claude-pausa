"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Le due password non coincidono.");
      return;
    }

    setStatus("loading");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Qualcosa è andato storto. Riprova.");
      setStatus("idle");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <p className="text-sm text-muted">Link non valido.</p>
          <Link href="/forgot-password" className="mt-4 inline-block text-foreground underline underline-offset-4">
            Richiedi un nuovo link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← CoachBrain
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Scegli una nuova password</h1>
        </div>

        {status === "done" ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm">
            <p>Password aggiornata. Ti stiamo reindirizzando al login…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Nuova password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Conferma password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-negative">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "Salvataggio…" : "Reimposta password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
