"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError("Email o password non corrette.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← CoachBrain
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Bentornato</h1>
          <p className="mt-1 text-sm text-muted">Accedi per vedere i tuoi atleti.</p>
        </div>

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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-negative">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Non hai un account?{" "}
          <Link href="/register" className="text-foreground underline underline-offset-4">
            Creane uno
          </Link>
        </p>

        <p className="mt-6 rounded-md border border-border bg-surface-2 p-3 text-center text-xs text-muted">
          Account demo: <span className="text-foreground">demo@coachbrain.app</span> / demo1234
        </p>
      </div>
    </main>
  );
}
