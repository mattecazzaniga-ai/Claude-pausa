"use client";

import Link from "next/link";

export function HomeClient() {
  return (
    <>
      {/* HERO */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-20 text-center sm:pt-28">
        <span className="mb-5 rounded-full border border-border bg-surface px-3 py-1 text-xs uppercase tracking-widest text-muted">
          Piattaforma AI per allenatori sportivi
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Tu alleni. Noi ricordiamo.</h1>
        <p className="mt-5 max-w-lg text-balance text-lg text-muted">
          Il tuo sistema di coaching capisce il tuo sport, i tuoi atleti e tutto quello che succede tra una sessione e
          l&apos;altra — così decidi meglio, più in fretta, e gestisci la tua attività senza perderti nei dettagli.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Inizia ad allenare
          </Link>
          <a
            href="#come-funziona"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Scopri come funziona
          </a>
        </div>

        <Link href="/login" className="mt-5 text-sm text-muted hover:text-foreground transition-colors">
          Hai già un account? Accedi
        </Link>
      </section>

      {/* CORE VALUE */}
      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Tutto quello che serve al tuo coaching. Connesso.
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Pillar
            title="Conosci i tuoi atleti"
            text="Sviluppo, punti di forza, criticità, valutazioni, obiettivi e competizioni in un unico profilo."
          />
          <Pillar
            title="Sai sempre cosa fare dopo"
            text="L'AI collega tutto quello che è successo e ti indica la prossima priorità di coaching."
          />
          <Pillar
            title="Gestisci l'allenamento"
            text="Sessioni sport-specifiche, libreria esercizi, allenamento dal telefono e feedback registrato."
          />
          <Pillar
            title="Gestisci la tua attività"
            text="Calendario, vendita di sessioni e pacchetti, pagamenti e crediti sempre sotto controllo."
          />
        </div>
      </section>

      {/* THE DIFFERENCE / LOOP */}
      <section id="come-funziona" className="border-y border-border bg-surface/50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Non un altro pianificatore di allenamenti.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-center text-muted">
            La maggior parte dei software per allenatori aiuta a organizzare le sessioni. Noi colleghiamo tutto quello
            che succede prima, durante e dopo — il tuo sport, i tuoi atleti, le valutazioni, gli obiettivi,
            l&apos;allenamento, le competizioni, il feedback, i pagamenti — così la prossima decisione si basa sul
            quadro completo, non solo sull&apos;ultima sessione.
          </p>

          <div className="mx-auto mt-10 flex max-w-xl flex-wrap items-center justify-center gap-2">
            {["Valutazione", "Priorità", "Obiettivo", "Allenamento", "Feedback", "Competizione", "Analisi AI"].map(
              (step, i, arr) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium">
                    {step}
                  </span>
                  {i < arr.length - 1 && <span className="text-muted">→</span>}
                </div>
              )
            )}
            <span className="text-muted">→</span>
            <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent">
              Prossima priorità
            </span>
          </div>
        </div>
      </section>

      {/* ATHLETE DEVELOPMENT */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Basta allenare nomi. Inizia ad allenare sviluppo.
            </h2>
            <p className="mt-4 text-muted">
              Ogni atleta ha un profilo vivo che collega prestazioni, valutazioni, obiettivi, allenamento e
              competizione — non fogli sparsi da ricordare a memoria.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="font-semibold">Marco</p>
            <div className="mt-3 space-y-2.5 text-sm">
              <Row label="Priorità attuale" value="Transizione difensiva" />
              <Row label="Ultima valutazione" value="7.2" />
              <Row label="Trend" value="↑ In miglioramento" valueClassName="text-improving" />
              <Row label="Prossima competizione" value="tra 6 giorni" />
            </div>
            <div className="mt-4 rounded-lg bg-surface-2 p-3">
              <p className="text-xs uppercase tracking-wider text-muted">Prossima azione</p>
              <p className="mt-1 text-sm">Drill di transizione sotto pressione</p>
            </div>
            <span className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-xs font-medium text-black">
              Costruisci sessione
            </span>
          </div>
        </div>
      </section>

      {/* TRAINING */}
      <section className="border-y border-border bg-surface/50 px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-4xl items-center gap-10 sm:grid-cols-2">
          <div className="order-2 rounded-xl border border-border bg-surface p-5 sm:order-1">
            <p className="text-xs uppercase tracking-wider text-muted">Sessione · 60 min</p>
            <div className="mt-3 space-y-2">
              {[
                ["Riscaldamento", "10'"],
                ["Tecnica", "20'"],
                ["Tattica", "15'"],
                ["Situazione di gioco", "15'"],
              ].map(([label, duration]) => (
                <div key={label} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
                  <span>{label}</span>
                  <span className="text-muted">{duration}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 sm:order-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Costruisci la prossima sessione in pochi secondi.</h2>
            <p className="mt-4 text-muted">
              Le priorità diventano una sessione già pronta, con esercizi dalla tua libreria organizzati in blocchi.
              Alleni dal telefono con Training Mode, e il feedback torna subito nello storico dell&apos;atleta.
            </p>
          </div>
        </div>
      </section>

      {/* BUSINESS / PAYMENTS */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Alleni gli atleti. Vieni pagato. Resti organizzato.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Vendi sessioni singole, crea pacchetti, incassa i pagamenti e tieni traccia automaticamente di ogni
            sessione — senza bisogno di sapere di contabilità.
          </p>
        </div>

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2">
          {["Crea offerta", "L'atleta acquista", "Sessione in calendario", "Sessione completata", "Credito scalato"].map(
            (step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium">{step}</span>
                {i < arr.length - 1 && <span className="text-muted">→</span>}
              </div>
            )
          )}
        </div>

        <div className="mx-auto mt-8 max-w-xs rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Pacchetto 10 sessioni</p>
          <p className="mt-1 text-2xl font-semibold">€330</p>
          <p className="mt-2 text-sm text-muted">6 sessioni rimanenti</p>
          <div className="mt-4 flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
            <span>Giovedì · 18:00</span>
            <span className="text-positive">✓ Pagato</span>
          </div>
        </div>
      </section>

      {/* AI GETS SMARTER */}
      <section className="border-y border-border bg-surface/50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Il tuo coaching migliora nel tempo.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Ogni valutazione, sessione, nota e competizione aggiunge contesto. Più alleni, più il sistema capisce i
            tuoi atleti e il tuo modo di lavorare.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-4">
            <Milestone day="Giorno 1" text="Sport configurato" />
            <Milestone day="Giorno 10" text="Lo storico dell'atleta si costruisce" />
            <Milestone day="Giorno 30" text="Emergono i pattern" />
            <Milestone day="Giorno 100" text="Il sistema conosce i tuoi atleti" />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pronto ad allenare con il quadro completo?</h2>
        <p className="mt-4 text-muted">Costruisci il tuo sistema di coaching attorno al modo in cui alleni davvero.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Inizia ad allenare
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Ho già un account
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted">
        Tu alleni. Noi ricordiamo. Sai sempre cosa fare dopo.
      </footer>
    </>
  );
}

function Pillar({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold text-accent">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{text}</p>
    </div>
  );
}

function Row({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-medium ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}

function Milestone({ day, text }: { day: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{day}</p>
      <p className="mt-1.5 text-sm text-muted">{text}</p>
    </div>
  );
}
