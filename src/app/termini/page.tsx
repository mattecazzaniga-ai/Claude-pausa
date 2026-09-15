import Link from "next/link";

export const metadata = { title: "Termini di servizio — CoachBrain" };

export default function TerminiPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← CoachBrain
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Termini di servizio</h1>
      <p className="mt-2 text-sm text-muted">Ultimo aggiornamento: da definire al lancio pubblico.</p>

      <div className="mt-4 rounded-md border border-dashed border-improving/40 bg-improving/10 p-4 text-sm text-improving">
        Prima della pubblicazione pubblica, completare qui ragione sociale, sede legale, legge applicabile e foro
        competente del soggetto che opera CoachBrain. Il resto di questo documento descrive accuratamente le
        condizioni d&apos;uso del software oggi.
      </div>

      <section className="mt-8 space-y-3 text-sm text-foreground/90">
        <h2 className="text-base font-semibold">1. Cos&apos;è CoachBrain</h2>
        <p>
          CoachBrain è un software che aiuta allenatori sportivi a gestire atleti, squadre, allenamenti, calendario,
          valutazioni e — dove attivato — la vendita di sessioni e pacchetti. Alcune funzionalità usano
          l&apos;intelligenza artificiale per analizzare lo storico registrato e proporre suggerimenti.
        </p>

        <h2 className="pt-3 text-base font-semibold">2. Account</h2>
        <p>
          Per usare CoachBrain è necessario creare un account con nome, email e password. Sei responsabile della
          riservatezza delle tue credenziali e di tutta l&apos;attività svolta con il tuo account.
        </p>

        <h2 className="pt-3 text-base font-semibold">3. Dati che inserisci</h2>
        <p>
          Gli atleti e le squadre che gestisci non sono utenti registrati di CoachBrain: sei tu, come coach, a
          inserire i loro dati. Dichiari e garantisci di avere un titolo legittimo per farlo (consenso
          dell&apos;atleta o, per i minori, di chi ne esercita la responsabilità genitoriale) e resti l&apos;unico
          responsabile dell&apos;accuratezza e della liceità dei dati che inserisci.
        </p>

        <h2 className="pt-3 text-base font-semibold">4. L&apos;intelligenza artificiale non sostituisce il tuo giudizio</h2>
        <p>
          Le raccomandazioni, le sintesi e le risposte generate dall&apos;AI sono un supporto alla decisione basato
          sui dati che hai registrato — non sono una diagnosi né un consiglio professionale, e non sostituiscono mai
          la valutazione del coach. Resti sempre tu a decidere cosa fare con un atleta o una squadra.
        </p>

        <h2 className="pt-3 text-base font-semibold">5. Piani e pagamenti del tuo account CoachBrain</h2>
        <p>
          CoachBrain offre un piano gratuito e piani a pagamento con funzionalità aggiuntive. I prezzi mostrati nella
          pagina Prezzi sono indicativi finché il sistema di fatturazione non è pienamente attivo; eventuali addebiti
          reali verranno sempre mostrati chiaramente prima della conferma.
        </p>

        <h2 className="pt-3 text-base font-semibold">6. Pagamenti che tu incassi dai tuoi atleti</h2>
        <p>
          Se attivi la vendita di sessioni o pacchetti, i pagamenti online dei tuoi atleti sono elaborati da Stripe
          secondo i termini di Stripe; CoachBrain non tocca né conserva mai i dati della carta. Per i pagamenti
          registrati manualmente, sei tu a confermarne la ricezione: CoachBrain si limita a tenerne traccia.
        </p>

        <h2 className="pt-3 text-base font-semibold">7. Uso consentito</h2>
        <p>
          Ti impegni a non usare CoachBrain per scopi illeciti, per inserire dati di terzi senza titolo legittimo, o
          per tentare di accedere a dati di altri coach.
        </p>

        <h2 className="pt-3 text-base font-semibold">8. Disponibilità del servizio</h2>
        <p>
          Facciamo il possibile per mantenere il servizio disponibile e affidabile, ma non garantiamo un
          funzionamento ininterrotto o privo di errori. Le funzionalità che dipendono da servizi di terze parti (AI,
          pagamenti online) potrebbero non essere disponibili se quei servizi non sono configurati o sono
          temporaneamente non raggiungibili.
        </p>

        <h2 className="pt-3 text-base font-semibold">9. Sospensione e cessazione</h2>
        <p>
          Puoi smettere di usare CoachBrain e richiedere la cancellazione del tuo account in qualsiasi momento. Ci
          riserviamo di sospendere un account in caso di uso in violazione di questi termini.
        </p>

        <h2 className="pt-3 text-base font-semibold">10. Modifiche a questi termini</h2>
        <p>Eventuali modifiche sostanziali a questi termini saranno comunicate prima di entrare in vigore.</p>

        <h2 className="pt-3 text-base font-semibold">11. Contatti</h2>
        <p>
          Per qualunque domanda su questi termini, scrivi a{" "}
          <a href="mailto:hello@coachbrain.app" className="text-accent underline underline-offset-4">
            hello@coachbrain.app
          </a>
          .
        </p>
      </section>
    </main>
  );
}
