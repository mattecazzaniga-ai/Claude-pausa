import Link from "next/link";

export const metadata = { title: "Termini di servizio — CoachBrain" };

export default function TerminiPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← CoachBrain
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Termini di servizio</h1>
      <p className="mt-4 rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
        Questa pagina è un segnaposto. I termini di servizio completi (condizioni d&apos;uso, limiti di
        responsabilità, gestione dell&apos;account, condizioni di recesso) verranno pubblicati prima del lancio
        pubblico del servizio.
      </p>
    </main>
  );
}
