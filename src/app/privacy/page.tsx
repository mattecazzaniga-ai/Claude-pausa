import Link from "next/link";

export const metadata = { title: "Privacy Policy — Mentathlos" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Mentathlos
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Ultimo aggiornamento: da definire al lancio pubblico.</p>

      <div className="mt-4 rounded-md border border-dashed border-improving/40 bg-improving/10 p-4 text-sm text-improving">
        Prima della pubblicazione pubblica, completare qui ragione sociale, sede legale, P.IVA/C.F. e i riferimenti del
        Responsabile della Protezione Dati (se applicabile) del soggetto che opera Mentathlos come Titolare del
        trattamento. Il resto di questo documento descrive accuratamente come il software tratta i dati oggi.
      </div>

      <section className="mt-8 space-y-3 text-sm text-foreground/90">
        <h2 className="text-base font-semibold">1. Titolare del trattamento</h2>
        <p>
          Il Titolare del trattamento dei dati raccolti tramite Mentathlos è l&apos;operatore del servizio (ragione
          sociale da completare). Per qualunque richiesta relativa alla privacy, scrivi a{" "}
          <a href="mailto:privacy@coachbrain.app" className="text-accent underline underline-offset-4">
            privacy@coachbrain.app
          </a>
          .
        </p>

        <h2 className="pt-3 text-base font-semibold">2. Chi sono gli utenti e chi sono gli atleti</h2>
        <p>
          Chi crea un account su Mentathlos è l&apos;allenatore (il &ldquo;coach&rdquo;). Gli atleti e le squadre
          gestiti all&apos;interno dell&apos;account non sono utenti registrati: i loro dati (nome, livello,
          obiettivi, valutazioni, note di sessione, risultati di competizione) sono inseriti direttamente dal coach.
          Il coach è responsabile di avere un titolo legittimo per trattare questi dati (ad es. il consenso
          dell&apos;atleta o, per i minori, di chi ne esercita la responsabilità genitoriale) prima di inserirli nel
          sistema.
        </p>

        <h2 className="pt-3 text-base font-semibold">3. Quali dati raccogliamo</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-foreground">Dati dell&apos;account coach:</span> nome, email, password
            (memorizzata come hash, mai in chiaro).
          </li>
          <li>
            <span className="font-medium text-foreground">Dati inseriti dal coach:</span> profili atleta/squadra,
            note di sessione, valutazioni, obiettivi, competizioni, calendario, esercizi e sessioni di allenamento.
          </li>
          <li>
            <span className="font-medium text-foreground">Dati di pagamento:</span> se il coach vende sessioni o
            pacchetti, i pagamenti online sono elaborati da Stripe — Mentathlos non riceve né conserva mai i dati
            della carta di pagamento. Per i pagamenti registrati manualmente (contanti, bonifico), conserviamo solo
            importo, data e stato.
          </li>
          <li>
            <span className="font-medium text-foreground">Dati tecnici minimi:</span> un cookie di sessione
            necessario per l&apos;autenticazione (nessun cookie di tracciamento o pubblicitario di terze parti) e un
            registro interno anonimo degli eventi principali dell&apos;app (es. &ldquo;sessione creata&rdquo;) usato
            solo per capire come funziona il prodotto, mai condiviso con terzi a scopo pubblicitario.
          </li>
        </ul>

        <h2 className="pt-3 text-base font-semibold">4. Come vengono usati i dati</h2>
        <p>
          I dati inseriti servono a far funzionare le funzionalità che il coach usa attivamente: tenere lo storico di
          un atleta, generare sessioni di allenamento, calcolare valutazioni e progressi, gestire calendario e
          pagamenti. Alcune di queste funzionalità usano l&apos;intelligenza artificiale (vedi punto 5).
        </p>

        <h2 className="pt-3 text-base font-semibold">5. Elaborazione tramite intelligenza artificiale</h2>
        <p>
          Le funzionalità AI di Mentathlos (analisi delle note, sintesi dell&apos;atleta, generazione di sessioni,
          raccomandazioni, chat con l&apos;assistente) inviano il testo pertinente — dati dell&apos;atleta e note
          inserite dal coach — all&apos;API Gemini di Google per l&apos;elaborazione. Questi dati sono trattati da
          Google secondo i termini del servizio Gemini API. Mentathlos non usa questi dati per addestrare modelli
          propri. Se la chiave API AI non è configurata, queste funzionalità sono semplicemente disattivate e i dati
          restano solo nel database di Mentathlos.
        </p>

        <h2 className="pt-3 text-base font-semibold">6. Conservazione dei dati</h2>
        <p>
          I dati restano archiviati finché l&apos;account del coach è attivo. Il coach può eliminare in autonomia,
          in qualsiasi momento e direttamente dal prodotto, un singolo atleta, una squadra, una valutazione, un
          obiettivo, una competizione o una sessione — l&apos;eliminazione rimuove definitivamente anche tutti i
          record collegati (note, sessioni, valutazioni, eventi di calendario, acquisti). Per richiedere la
          cancellazione dell&apos;intero account coach, scrivi a{" "}
          <a href="mailto:privacy@coachbrain.app" className="text-accent underline underline-offset-4">
            privacy@coachbrain.app
          </a>
          .
        </p>

        <h2 className="pt-3 text-base font-semibold">7. Con chi condividiamo i dati</h2>
        <p>
          I dati non vengono venduti né condivisi a scopo pubblicitario. Sono condivisi solo con i fornitori
          strettamente necessari a far funzionare il servizio: Google (API Gemini, per le funzionalità AI) e Stripe
          (per i pagamenti online, solo se il coach li attiva).
        </p>

        <h2 className="pt-3 text-base font-semibold">8. I tuoi diritti</h2>
        <p>
          In qualità di coach, hai diritto ad accedere, correggere ed esportare i tuoi dati e quelli che hai inserito,
          e a richiederne la cancellazione. Molte di queste azioni sono già disponibili direttamente nel prodotto; per
          le altre, scrivi a{" "}
          <a href="mailto:privacy@coachbrain.app" className="text-accent underline underline-offset-4">
            privacy@coachbrain.app
          </a>
          .
        </p>

        <h2 className="pt-3 text-base font-semibold">9. Sicurezza</h2>
        <p>
          Le password sono conservate come hash, mai in chiaro. Le comunicazioni con il servizio avvengono via HTTPS.
          L&apos;accesso ai dati di ogni coach è isolato: nessun coach può vedere gli atleti, le squadre o i
          pagamenti di un altro.
        </p>

        <h2 className="pt-3 text-base font-semibold">10. Modifiche a questa policy</h2>
        <p>Eventuali modifiche sostanziali a questa policy saranno comunicate agli utenti prima di entrare in vigore.</p>
      </section>
    </main>
  );
}
