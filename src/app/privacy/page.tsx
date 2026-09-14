import Link from "next/link";

export const metadata = { title: "Privacy Policy — CoachBrain" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← CoachBrain
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
        Questa pagina è un segnaposto. Il testo legale completo (finalità del trattamento, base giuridica, dati
        raccolti, conservazione, diritti dell&apos;interessato) verrà pubblicato prima del lancio pubblico del
        servizio.
      </p>
    </main>
  );
}
