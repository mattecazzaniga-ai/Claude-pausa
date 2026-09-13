"use client";

import Link from "next/link";

export function HomeClient() {
  return (
    <>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-20 text-center sm:pt-28">
        <span className="mb-5 rounded-full border border-border bg-surface px-3 py-1 text-xs uppercase tracking-widest text-muted">
          Il tuo sport. I tuoi atleti. Il tuo modo di allenare.
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          Tu alleni. Noi ricordiamo.
        </h1>
        <p className="mt-5 max-w-lg text-balance text-lg text-muted">
          Un sistema AI che conosce il tuo sport, ricorda ogni atleta e ogni squadra, impara come alleni e ti aiuta a
          decidere cosa fare — e perché — alla prossima sessione.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Inizia gratis
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Ho già un account
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          <Step
            number="1"
            title="Valuta e osserva"
            text="Una valutazione adattata al tuo sport, o due righe dopo ogni sessione: l'AI struttura tutto e lo collega allo storico dell'atleta."
          />
          <Step
            number="2"
            title="L'AI trova la priorità"
            text="Confronta valutazioni, note e competizioni nel tempo — non solo l'ultima sessione — e ti spiega perché una cosa conta più delle altre."
          />
          <Step
            number="3"
            title="Alleni con uno scopo"
            text="Sessione generata dalla tua libreria esercizi, calendario aggiornato, e la priorità che cambia man mano che l'atleta migliora."
          />
        </div>

        <div className="mt-10 rounded-xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-wider text-muted">Esempio reale</p>
          <p className="mt-3 text-sm text-foreground/90">
            &ldquo;Luca sta consolidando bene il servizio, con una percentuale di prime in netto miglioramento nelle
            ultime due sessioni. La priorità resta la difesa sulla palla profonda: lo stesso ritardo nel
            posizionamento è comparso in entrambe le ultime sessioni, in particolare nei momenti di pressione.&rdquo;
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-negative/15 px-2.5 py-1 text-negative">Difesa/Bagher — ricorrente</span>
            <span className="rounded-full bg-improving/15 px-2.5 py-1 text-improving">Servizio — in miglioramento</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted">
        CoachBrain — non un gestionale. Il sistema che ricorda per te, così puoi pensare solo ad allenare.
      </footer>
    </>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
        {number}
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{text}</p>
    </div>
  );
}
