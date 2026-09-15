"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Qualcosa è andato storto</h1>
        <p className="mt-2 text-sm text-muted">Si è verificato un errore imprevisto. Il problema è già stato segnalato.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Riprova
          </button>
          <Link href="/dashboard" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Torna alla dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
