# CoachBrain

> Il secondo cervello per il tuo coaching. Scrivi due righe dopo ogni sessione — CoachBrain ricorda lo storico di ogni atleta e ti dice su cosa lavorare dopo, e perché.

MVP funzionante: un coach registra atleti, scrive una nota libera dopo ogni sessione, l'AI la trasforma in osservazioni strutturate collegate a una tassonomia di competenze configurabile per sport, e mantiene una sintesi/priorità sempre aggiornata per ogni atleta. Lancia con **Beach Tennis** come primo sport; l'architettura è sport-agnostica fin dall'inizio.

## 1. Cosa è stato costruito

- **Autenticazione coach**: registrazione/login con NextAuth + bcrypt, sessioni JWT.
- **Atleti**: profilo con nome, livello, obiettivi.
- **Note di sessione**: testo libero, salvate sempre (anche senza AI configurata).
- **Motore AI** (`src/lib/ai.ts`):
  - `extractTagsFromNote`: trasforma una nota in osservazioni strutturate (competenza + sentiment + frase di riferimento) usando **tool-use/function-calling** di Claude — output sempre in uno schema fisso, non un parsing di testo libero fragile. Modello: Haiku 4.5 (economico, adatto a un task di tagging su testo breve).
  - `generateAthleteSummary`: legge le ultime ~8 sessioni di UN atleta (non l'intero database del coach) e genera una sintesi narrativa + fino a 3 priorità concrete per la prossima sessione. Modello: Sonnet 5 (più capace, serve per un output che il coach legge e su cui agisce).
  - Nessun RAG/vector database: a questo volume di dati (decine di atleti, decine di note ciascuno) è over-engineering. Si aggiungerà solo se un coach accumula storico molto più grande.
- **Tassonomia sport-agnostica**: `Sport → SkillCategory → Skill` — aggiungere un nuovo sport è solo seed di nuove righe, zero codice.
- **Sport Profile**: oltre alla tassonomia di competenze, ogni sport ha un profilo (formato individuale/coppia/squadra, ambiente, attrezzatura, punteggio, regole chiave, terminologia), generato una volta via AI e passato a ogni prompt (nota, esercizio, sessione) — così l'output è davvero specifico per quello sport, non genericamente etichettato.
- **Squadre**: un coach può raggruppare atleti in una squadra (anche vuota, aggiungendo atleti in qualsiasi momento) e generare un'unica sessione di allenamento per l'intero gruppo, che aggrega le priorità dei singoli membri (nessuna differenziazione per sottogruppo/individuo ancora — è una feature a sé).
- **Cosa alleniamo oggi?**: la dashboard evidenzia la priorità AI più urgente per un atleta e per un gruppo, con generazione della sessione in un click.
- **Obiettivi**: obiettivi a breve/medio/lungo termine per atleta o squadra, quantitativi (con baseline/target/attuale e barra di progresso) o qualitativi, con stato (attivo/raggiunto/abbandonato).
- **Valutazioni periodiche**: valutazione iniziale e periodica per atleta o squadra, con criteri adattati allo sport (generati una volta via AI, più criteri personalizzati del coach) e diversi tipi di punteggio (scala, percentuale, tempo, ripetizioni, qualitativo...). Ogni valutazione periodica confronta automaticamente baseline/precedente/attuale e l'AI aggiorna le priorità dell'atleta — chiudendo il ciclo valutazione → allenamento.
- **Competizioni**: tornei/partite programmabili per atleta o squadra, con registrazione risultato e analisi AI "cosa abbiamo imparato" che aggiorna le priorità — stesso ciclo delle valutazioni.
- **Calendario**: vista settimanale degli eventi (allenamenti, competizioni), creazione manuale di eventi allenamento collegati a un atleta/squadra, generazione della sessione direttamente dall'evento. Le competizioni create dalla scheda atleta/squadra compaiono automaticamente in calendario, senza doverle reinserire. (Non ancora: drag&drop, viste giorno/mese, scheduling AI in linguaggio naturale, notifiche — restano per un giro successivo.)
- **Import valutazioni da file**: un coach può caricare la propria scheda di valutazione (PDF, DOCX, CSV, TXT o una foto) o incollarne il testo; l'AI ne riconosce la struttura reale (categorie, criteri, tipo di punteggio) senza inventare nulla, il coach rivede/modifica/elimina/aggiunge righe, e solo dopo conferma i criteri diventano personalizzati per il suo sport.
- **Preparazione pre-gara AI**: per una competizione non ancora disputata, l'AI genera un consiglio di preparazione basato su forma attuale, priorità di allenamento e giorni rimanenti — rigenerabile man mano che la data si avvicina. Non tocca mai le priorità (è una previsione, non un'osservazione).
- **Eventi ricorrenti in calendario**: un evento di allenamento può ripetersi su più giorni della settimana fino a una data di fine, generando automaticamente tutte le occorrenze.
- **Training Mode**: vista mobile-first per condurre l'allenamento sul campo, un blocco alla volta — timer, punti chiave, nota rapida (anche vocale) — con un "Come è andata?" a fine sessione che salva un feedback e, per le sessioni legate a un atleta, alimenta anche la sua sintesi AI.
- **Note vocali**: pulsante microfono (Web Speech API, nascosto se il browser non lo supporta) per dettare le note invece di scriverle.
- **Homepage aggiornata**: copy allineato a quello che il prodotto è oggi, non più solo alle note testuali del primissimo MVP.

### Redesign UX
Le pagine atleta e squadra usano una navigazione a tab (Panoramica / Sviluppo / Competizioni / Storico) invece di un'unica colonna di card impilate. La dashboard apre con un saluto e dà priorità a "Cosa alleniamo oggi?", poi ai prossimi eventi, poi al profilo sport (meno urgente).
- **Degrado senza AI**: se `GEMINI_API_KEY` non è configurata, l'app resta completamente usabile — le note si salvano, l'AI semplicemente non le elabora ancora (nessun errore, nessun blocco).
- **Analytics**: eventi minimi (`signup`, `athlete_created`, `session_note_created`, `ai_extraction_completed/failed`, `athlete_summary_viewed`) per capire l'uso reale prima di costruire altro.

## 2. Cosa NON è stato costruito (deliberatamente)

Per restare fedeli al principio "MVP minimo, non piattaforma gigante":

- Nessun pagamento/abbonamento (Stripe) — non è la parte da validare ora.
- Nessun calendario/booking — i coach di beach tennis/padel hanno già altri strumenti per questo.
- Nessun upload video/analisi computer vision — feature v2, tecnicamente pesante.
- Nessuna app multi-coach/academy — un coach = un account, per ora.
- Nessun input vocale — solo testo per l'MVP, il voice-to-text è un miglioramento successivo.
- Nessun pannello admin.

## 3. File principali

```
prisma/schema.prisma          Coach, Sport, SkillCategory, Skill, Athlete, SessionNote, NoteTag
prisma/seed.ts                 Tassonomia Beach Tennis (bozza) + coach/atleta demo con note già taggate
src/lib/ai.ts                  Motore AI: estrazione strutturata + sintesi/priorità
src/lib/auth.ts                NextAuth credentials
src/app/dashboard/             Lista atleti + creazione nuovo atleta
src/app/athletes/[id]/         Pagina atleta: sintesi AI, priorità, cattura nota, storico
src/app/api/athletes/**        CRUD atleti + creazione nota (trigger AI)
```

## 4. Variabili d'ambiente

| Variabile | Obbligatoria | Note |
|---|---|---|
| `DATABASE_URL` | Sì | Connessione PostgreSQL |
| `DIRECT_URL` | Solo con provider pooled (Supabase, ecc.) | Connessione diretta per le migration |
| `NEXTAUTH_SECRET` | Sì | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Sì | URL pubblico dell'app |
| `GEMINI_API_KEY` | No (ma senza, l'AI non funziona) | Chiave **gratuita** da **aistudio.google.com/apikey** — nessuna carta di credito richiesta. Piano free: 250 richieste/giorno con `gemini-2.5-flash`, ampiamente sufficiente per validare con pochi coach. Da giugno 2026 le chiavi nuove hanno formato `AQ.Ab...` (non più `AIzaSy...`) — è normale, l'SDK `@google/genai` che usiamo lo gestisce da solo. Nota: sul piano gratuito Google può usare i prompt per migliorare i propri modelli — da rivalutare prima di un lancio con molti coach esterni e dati sensibili. |
| `NEXT_PUBLIC_APP_URL` | Sì | Stesso URL pubblico |

## 5. Come avviarlo in locale

```bash
npm install
# Punta DATABASE_URL a un Postgres qualsiasi, poi:
npm run db:migrate
npm run db:seed
npm run dev
```

Login demo creato dal seed: `demo@coachbrain.app` / `demo1234` — include un atleta con due sessioni e una sintesi AI **pre-scritta** (per vedere subito come dovrebbe apparire il prodotto anche senza chiave API impostata). Le note *nuove* aggiunte in locale richiedono `GEMINI_API_KEY` per essere elaborate.

## 6. Deploy

Stessa infrastruttura di riferimento della fase di validazione precedente: Vercel + Postgres pooled (Supabase/Neon). Ricorda:
- `DATABASE_URL` deve essere la stringa **pooled** (porta 6543 su Supabase, con `?pgbouncer=true`), `DIRECT_URL` quella diretta.
- Il build (`npm run build`) esegue `prisma migrate deploy` automaticamente.
- Aggiungi `GEMINI_API_KEY` su Vercel per attivare l'AI in produzione.
- Se cambi la password del database su Supabase, aggiorna manualmente `DATABASE_URL` e `DIRECT_URL` su Vercel — non è automatico, e finché non lo fai il build fallisce con `P1000: Authentication failed`.
- `DIRECT_URL` deve usare l'host del **Session pooler** di Supabase (`aws-0-<regione>.pooler.supabase.com`, porta 5432), non quello di "Direct connection" (`db.<project-ref>.supabase.co`) — quest'ultimo è raggiungibile solo via IPv6 e il build di Vercel non riesce a connettersi (`P1001: Can't reach database server`).
- Se manca `?pgbouncer=true` in fondo a `DATABASE_URL`, le query a runtime falliscono con `PostgresError 42P05: prepared statement "s0" already exists` — Prisma usa prepared statement per default, incompatibili con il pooler di Supabase in modalità transaction senza questo parametro.

## 7. TODO / limitazioni note

- Tassonomia Beach Tennis è una bozza ragionevole ma va rivista con la tua esperienza reale da allenatore prima di darla a coach esterni.
- Nessun modo per un coach di modificare/aggiungere competenze dalla UI — richiede accesso diretto al database per ora (accettabile per i primi design partner, non per un lancio pubblico).
- Nessun retry automatico se la chiamata AI fallisce (la nota resta salvata ma non elaborata — il coach può solo aggiungerne una nuova per far ripartire la sintesi).
- Nessuna modifica/cancellazione di note già salvate dalla UI.
- Validare con coach reali (vedi documento strategico) prima di investire in altre feature.
