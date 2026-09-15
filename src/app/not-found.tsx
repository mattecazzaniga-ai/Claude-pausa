import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-muted">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pagina non trovata</h1>
        <p className="mt-2 text-sm text-muted">La pagina che cerchi non esiste o è stata spostata.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Torna alla home
        </Link>
      </div>
    </main>
  );
}
