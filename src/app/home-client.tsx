"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingNav } from "@/components/landing-nav";
import { Reveal } from "@/components/reveal";

// Kept as one constant so the PRO price is a one-line edit once real billing exists.
const PRO_PRICE = "29";

export function HomeClient() {
  return (
    <>
      <LandingNav />
      <Hero />
      <ValueProposition />
      <HowItWorks />
      <AiSection />
      <PaymentsSection />
      <ProgressSection />
      <AudienceSection />
      <DifferentiationSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </>
  );
}

/* ---------------------------------- HERO --------------------------------- */

function Hero() {
  return (
    <section className="hero-backdrop relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 lg:pb-28 lg:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <Reveal>
          <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs uppercase tracking-widest text-muted">
            Piattaforma per allenatori sportivi
          </span>
          <h1 className="mt-5 text-balance font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Tutto il tuo coaching.
            <br />
            In un unico posto.
          </h1>
          <p className="mt-5 max-w-md text-balance text-lg text-muted">
            Gestisci atleti, allenamenti, calendario, progressi e pagamenti. Mentathlos organizza tutto il tuo lavoro
            e usa l&apos;AI per aiutarti a decidere cosa fare dopo.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Prova gratis
            </Link>
            <a
              href="#come-funziona"
              className="rounded-md border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              Scopri come funziona
            </a>
          </div>

          <p className="mt-6 flex items-center gap-1.5 text-sm text-muted">
            <CheckIcon /> Configurazione in pochi minuti, pensato per allenatori e coach.
          </p>
        </Reveal>

        <Reveal delay={120} className="relative">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <img src="/logo.png" alt="" className="h-4 w-4" />
                Mentathlos
              </div>
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
                <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
                <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
              </div>
            </div>

            <div className="bg-surface p-5">
              <p className="text-lg font-semibold">Buongiorno, Marco</p>
              <p className="mt-0.5 text-xs uppercase tracking-wider text-muted">Oggi</p>
              <div className="mt-3 space-y-1.5">
                {[
                  ["10:00", "Luca Rossi", "Personal"],
                  ["14:30", "Marco Bianchi", "Gruppo"],
                  ["17:00", "Anna Verdi", "Personal"],
                ].map(([time, name, type]) => (
                  <div key={time} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="text-muted">{time}</span>
                      <span>{name}</span>
                    </span>
                    <span className="text-xs text-muted">{type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
              <div className="bg-surface p-5">
                <p className="text-xs uppercase tracking-wider text-muted">I tuoi atleti</p>
                <p className="mt-2 text-2xl font-semibold">24</p>
                <p className="text-xs text-muted">atleti seguiti</p>
              </div>
              <div className="bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-accent">AI Insight</p>
                <p className="mt-1.5 text-xs text-foreground/90">
                  &ldquo;Luca è pronto per aumentare l&apos;intensità.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------- VALUE PROPOSITION ---------------------------- */

const FEATURES = [
  {
    icon: AthleteIcon,
    title: "Conosci davvero ogni atleta.",
    text: "Obiettivi, livello, valutazioni, punti di forza, criticità, note e storico sempre disponibili.",
  },
  {
    icon: CalendarIcon,
    title: "Organizza ogni sessione.",
    text: "Programma allenamenti, lezioni individuali e gruppi e tieni sotto controllo ciò che hai fatto e ciò che viene dopo.",
  },
  {
    icon: TrainingIcon,
    title: "Costruisci e salva le tue sessioni.",
    text: "Crea allenamenti, esercizi e programmi personalizzati e ritrovali quando ti servono.",
  },
  {
    icon: ProgressIcon,
    title: "Vedi se il lavoro sta funzionando.",
    text: "Segui valutazioni, metriche e storico per capire come evolve ogni atleta.",
  },
  {
    icon: PaymentIcon,
    title: "Gestisci anche il lato business.",
    text: "Crea prezzi e pacchetti, registra i pagamenti e controlla lezioni utilizzate, rimanenti e scadenze.",
  },
  {
    icon: AiIcon,
    title: "Un assistente che conosce il tuo lavoro.",
    text: "Mentathlos usa lo storico degli atleti e delle sessioni per aiutarti a capire cosa monitorare e come impostare il prossimo allenamento.",
  },
];

function ValueProposition() {
  return (
    <section id="funzioni" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-20 sm:px-6">
      <Reveal className="text-center">
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
          Tutto ciò che serve per allenare meglio.
        </h2>
        <p className="mt-3 text-muted">Un unico spazio per gestire il lavoro quotidiano del coach.</p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 60}>
            <div className="h-full rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40 hover:bg-surface-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <f.icon />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- HOW IT WORKS ------------------------------ */

const STEPS = [
  { n: "01", title: "Conosci", text: "Crea il profilo dell'atleta e registra obiettivi, livello e valutazioni." },
  { n: "02", title: "Allena", text: "Organizza la sessione e registra ciò che è successo." },
  { n: "03", title: "Aggiorna", text: "Aggiungi note, risultati e progressi." },
  { n: "04", title: "Continua", text: "Usa lo storico e l'AI per preparare ciò che viene dopo." },
];

function HowItWorks() {
  return (
    <section id="come-funziona" className="scroll-mt-16 border-y border-border bg-surface/50 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal className="max-w-xl">
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Dal primo allenamento al prossimo.</h2>
          <p className="mt-3 text-muted">
            Mentathlos conserva il contesto del tuo lavoro, così ogni sessione parte da ciò che è successo prima.
          </p>
        </Reveal>

        <div className="relative mt-12">
          <div className="absolute bottom-2 left-[17px] top-2 w-px bg-border" aria-hidden />
          <div className="space-y-9">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 80} className="relative flex gap-6">
                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background font-serif text-sm font-medium text-accent">
                  {s.n}
                </span>
                <div className="pt-1">
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="mt-12 flex flex-wrap items-center gap-2">
          {["Atleta", "Sessione", "Dati", "AI", "Prossimo allenamento"].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium">{step}</span>
              {i < arr.length - 1 && <span className="text-muted">→</span>}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------- AI ------------------------------------ */

function AiSection() {
  return (
    <section id="ai" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-20 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            Non devi ricordarti tutto.
            <br />
            Mentathlos sì.
          </h2>
          <p className="mt-4 text-muted">
            Dopo settimane di allenamenti, decine di atleti e centinaia di note, le informazioni iniziano a
            perdersi. Mentathlos costruisce uno storico del tuo lavoro e lo trasforma in informazioni utili.
          </p>
          <p className="mt-4 text-sm text-muted">
            L&apos;AI supporta le tue decisioni — non alleni al posto tuo, ti aiuta a vedere ciò che i dati raccontano.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="rounded-xl border border-border bg-surface p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-accent">
              <AiIcon className="h-3 w-3" /> AI Assistant
            </span>

            <div className="mt-4 space-y-3">
              <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-surface-2 px-3.5 py-2.5 text-sm">
                Cosa dovrei allenare con Luca nella prossima sessione?
              </div>
              <div className="max-w-[92%] rounded-lg rounded-tl-sm border border-border bg-background px-3.5 py-3 text-sm text-foreground/90">
                <p>
                  Negli ultimi allenamenti Luca ha mostrato un miglioramento nella tecnica di base, ma continua a
                  presentare alcune difficoltà nella gestione della pressione.
                </p>
                <p className="mt-2.5 font-medium">Per la prossima sessione suggerisco:</p>
                <ol className="mt-1.5 space-y-1 text-muted">
                  <li>01 — Esercizi tecnici sotto vincolo di tempo</li>
                  <li>02 — Situazioni di gioco a punteggio</li>
                  <li>03 — Debrief guidato a fine sessione</li>
                </ol>
                <p className="mt-2.5 text-xs uppercase tracking-wide text-muted">Obiettivo principale</p>
                <p className="text-sm">Reggere la pressione senza perdere qualità tecnica.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------- PAYMENTS ---------------------------------- */

function PaymentsSection() {
  return (
    <section className="border-y border-border bg-surface/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Pagamenti</p>
              <div className="space-y-2">
                <PaymentRow name="Luca Rossi" detail="8 lezioni · €160" status="6/8 utilizzate" statusTone="improving" meta="Prossimo rinnovo: 24 Set" />
                <PaymentRow name="Marco Bianchi" detail="4 lezioni · €100" status="4/4 utilizzate" statusTone="muted" meta="Pacchetto terminato" />
                <PaymentRow name="Anna Verdi" detail="€40" status="Pagato" statusTone="positive" meta="14 Set" />
              </div>
            </div>
          </Reveal>

          <Reveal delay={100} className="order-1 lg:order-2">
            <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              Allenare è il tuo lavoro.
              <br />
              Gestire l&apos;attività non dovrebbe esserlo.
            </h2>
            <p className="mt-4 text-muted">
              Crea i tuoi prezzi e pacchetti, registra i pagamenti e collega automaticamente le sessioni al saldo
              dell&apos;atleta — sai sempre chi ha pagato, quante lezioni restano e quando scadono.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function PaymentRow({
  name,
  detail,
  status,
  statusTone,
  meta,
}: {
  name: string;
  detail: string;
  status: string;
  statusTone: "positive" | "improving" | "muted";
  meta: string;
}) {
  const toneClass =
    statusTone === "positive" ? "bg-positive/15 text-positive" : statusTone === "improving" ? "bg-improving/15 text-improving" : "bg-surface-2 text-muted";
  return (
    <div className="flex items-center justify-between rounded-md bg-surface-2/60 px-3.5 py-3 text-sm">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <div className="text-right">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>{status}</span>
        <p className="mt-1 text-[11px] text-muted">{meta}</p>
      </div>
    </div>
  );
}

/* -------------------------------- PROGRESS --------------------------------- */

function ProgressSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            Il progresso non dovrebbe vivere nelle tue note.
          </h2>
          <p className="mt-4 text-muted">
            Trasforma valutazioni e storico degli allenamenti in una visione chiara dell&apos;evoluzione dei tuoi
            atleti.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Luca Rossi</p>
              <span className="text-xs text-improving">↑ In miglioramento</span>
            </div>

            <svg viewBox="0 0 200 60" className="mt-4 h-14 w-full text-accent">
              <polyline
                points="0,50 35,42 70,44 105,28 140,24 175,10 200,8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Ultima valutazione</p>
                <p className="font-medium">7.8 / 10</p>
              </div>
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Obiettivo attivo</p>
                <p className="font-medium">Gestione pressione</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------- AUDIENCE --------------------------------- */

const AUDIENCE = [
  { title: "Personal coach", text: "Gestisci clienti, sessioni, progressi e pagamenti." },
  { title: "Coach sportivi", text: "Segui ogni atleta e costruisci un percorso coerente." },
  { title: "Team & gruppi", text: "Organizza sessioni, gruppi e giocatori in modo semplice." },
  { title: "Academy & società", text: "Porta il tuo sistema di coaching a più atleti e coach." },
];

function AudienceSection() {
  return (
    <section className="border-y border-border bg-surface/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Costruito per chi allena.</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.title} delay={i * 60}>
              <div className="h-full rounded-xl border border-border bg-surface p-5">
                <h3 className="text-sm font-semibold">{a.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{a.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- DIFFERENTIATION ------------------------------ */

function DifferentiationSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
      <Reveal className="text-center">
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
          Più di un gestionale.
          <br />
          Più di un assistente AI.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Mentathlos unisce la gestione quotidiana del coach con un livello di intelligenza costruito attorno al suo
          lavoro.
        </p>
      </Reveal>

      <Reveal delay={100} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <div className="w-full rounded-xl border border-border bg-surface p-5 sm:w-56">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Gestione</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground/90">
            <li>Atleti</li>
            <li>Calendario</li>
            <li>Allenamenti</li>
            <li>Pagamenti</li>
          </ul>
        </div>

        <span className="text-xl text-muted">+</span>

        <div className="w-full rounded-xl border border-border bg-surface p-5 sm:w-56">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Intelligenza</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground/90">
            <li>Storico</li>
            <li>Contesto</li>
            <li>Insight</li>
            <li>AI</li>
          </ul>
        </div>

        <span className="text-xl text-muted">=</span>

        <div className="flex h-full w-full items-center justify-center rounded-xl bg-accent px-5 py-8 text-center sm:w-40">
          <p className="font-serif text-lg font-semibold text-black">Mentathlos</p>
        </div>
      </Reveal>
    </section>
  );
}

/* --------------------------------- PRICING --------------------------------- */

function PricingSection() {
  return (
    <section id="prezzi" className="scroll-mt-16 border-y border-border bg-surface/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            Scegli il piano che cresce con il tuo coaching.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <Reveal>
            <PricingCard
              name="Free"
              price="€0"
              period="/mese"
              features={["Gestione atleti", "Calendario", "Allenamenti", "Storico base"]}
              cta="Inizia gratis"
              href="/register"
            />
          </Reveal>
          <Reveal delay={80}>
            <PricingCard
              name="Pro"
              tagline="Per coach professionisti"
              price={`€${PRO_PRICE}`}
              period="/mese"
              features={["Atleti avanzati", "AI Coach", "Programmazione", "Progressi", "Pagamenti e pacchetti", "Analytics"]}
              cta="Prova gratis"
              href="/register"
              highlighted
            />
          </Reveal>
          <Reveal delay={160}>
            <PricingCard
              name="Academy"
              tagline="Per team e società"
              price="Su misura"
              features={["Soluzioni per realtà con più coach e atleti"]}
              cta="Contattaci"
              href="mailto:hello@coachbrain.app"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  name,
  tagline,
  price,
  period,
  features,
  cta,
  href,
  highlighted,
}: {
  name: string;
  tagline?: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-6 ${
        highlighted ? "border-accent bg-surface shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-surface"
      }`}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{name}</h3>
      {tagline && <p className="mt-0.5 text-xs text-muted">{tagline}</p>}
      <p className="mt-3 text-3xl font-semibold">
        {price}
        {period && <span className="text-base font-normal text-muted">{period}</span>}
      </p>
      <ul className="mt-5 flex-1 space-y-2 text-sm text-foreground/90">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-6 rounded-md px-4 py-2.5 text-center text-sm font-medium transition-opacity hover:opacity-90 ${
          highlighted ? "bg-accent text-black" : "border border-border"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

/* ----------------------------------- FAQ ------------------------------------ */

const FAQS = [
  { q: "Mentathlos è solo per personal trainer?", a: "No. È pensato per chiunque alleni: personal coach, allenatori sportivi, tecnici di squadra e società con più atleti." },
  { q: "Posso gestire più atleti?", a: "Sì, puoi creare e seguire tutti gli atleti che vuoi, ognuno con il proprio profilo, storico e calendario." },
  { q: "Posso creare pacchetti di allenamenti?", a: "Sì. Puoi creare offerte a sessione singola, pacchetti con un numero di lezioni e, in forma base, abbonamenti ricorrenti." },
  { q: "Posso registrare i pagamenti?", a: "Sì, sia online sia manualmente (contanti o bonifico), con lo storico completo di ogni acquisto." },
  { q: "Come funziona l'AI?", a: "Analizza lo storico reale di note, valutazioni e sessioni di un atleta e ti propone una priorità e un'azione concreta per la prossima sessione." },
  { q: "L'AI sostituisce il coach?", a: "No. L'AI supporta le tue decisioni, non le prende al posto tuo: la conferma finale è sempre tua." },
  { q: "Posso usare Mentathlos con il mio sport?", a: "Sì, il sistema si adatta al tuo sport specifico, terminologia inclusa, e non è limitato a una sola disciplina." },
];

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <Reveal className="text-center">
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Domande frequenti</h2>
      </Reveal>

      <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium"
                aria-expanded={isOpen}
              >
                {item.q}
                <span className={`ml-4 shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}>+</span>
              </button>
              <div
                className="grid overflow-hidden text-sm text-muted transition-all duration-200 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-4">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------- FINAL CTA --------------------------------- */

function FinalCta() {
  return (
    <section className="border-t border-border px-4 py-24 text-center sm:px-6">
      <Reveal className="mx-auto max-w-2xl">
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
          Porta il tuo coaching al livello successivo.
        </h2>
        <p className="mt-4 text-muted">
          Organizza i tuoi atleti, conserva tutto il tuo lavoro e usa l&apos;AI per prendere decisioni migliori.
        </p>
        <div className="mt-8">
          <Link
            href="/register"
            className="inline-block rounded-md bg-accent px-8 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Prova gratis
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted">Configuralo in pochi minuti.</p>
      </Reveal>
    </section>
  );
}

/* ---------------------------------- FOOTER ----------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-border px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div>
          <div className="flex items-center justify-center gap-2 font-semibold tracking-tight sm:justify-start">
            <img src="/logo.png" alt="" className="h-6 w-6" />
            Mentathlos
          </div>
          <p className="mt-2 max-w-xs text-sm text-muted">Il sistema operativo del tuo coaching.</p>
        </div>

        <div className="flex gap-10 text-sm text-muted">
          <div className="flex flex-col gap-2">
            <a href="#funzioni" className="hover:text-foreground">Funzioni</a>
            <a href="#ai" className="hover:text-foreground">AI</a>
            <a href="#prezzi" className="hover:text-foreground">Prezzi</a>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/login" className="hover:text-foreground">Accedi</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/termini" className="hover:text-foreground">Termini di servizio</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------- ICONS ----------------------------------- */

function iconProps(className?: string) {
  return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: className ?? "h-5 w-5" };
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...iconProps(`h-3.5 w-3.5 shrink-0 text-accent ${className}`)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function AthleteIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="7" r="3.2" />
      <path d="M5 21c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

function TrainingIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M6 8v8M18 8v8M2.5 12h3M18.5 12h3M6 12h12" />
    </svg>
  );
}

function ProgressIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M3.5 20.5V3.5M3.5 20.5h17" />
      <path d="M7 16l4-4.5 3 3 5-6" />
    </svg>
  );
}

function PaymentIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 14.5h4" />
    </svg>
  );
}

function AiIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M6 6l2.4 2.4M15.6 15.6 18 18M18 6l-2.4 2.4M8.4 15.6 6 18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
