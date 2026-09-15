"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

// Only fires when the root layout itself crashes, so it has to render the
// full <html>/<body> — there's no parent layout left to fall back on.
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="it" className="dark">
      <body className="antialiased">
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Qualcosa è andato storto</h1>
            <p className="mt-2 text-sm text-muted">
              Si è verificato un errore imprevisto a livello dell&apos;applicazione. Il problema è già stato segnalato.
            </p>
            <a
              href="/"
              className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Torna alla home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
