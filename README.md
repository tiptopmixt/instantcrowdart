# ⚡ InstantCrowdChat

**Instant crowd chat. 24 hours. Then it's gone.**

Una PWA statica (vanilla JS) con un'unica chat di gruppo anonima attiva alla volta.
Gli sconosciuti entrano da un link condiviso nelle storie social, un assistente AI media la
conversazione parlando la lingua di ciascuno, e il gruppo ha 24 ore per trasformare un desiderio
comune in qualcosa di reale. Nessun denaro: si "scommette" solo un'idea.

La **prima sfida è meta**: costruire questa app insieme ai suoi utenti (chat `FOUND1`, stato `founding`).

---

## 🧱 Stack

- **Frontend**: vanilla JS + PWA (manifest + service worker + icone SVG), mobile-first, hash routing
  (`#/c/CODICE`) → funziona su GitHub Pages senza configurazione server.
- **Backend**: Supabase (progetto condiviso con l'app aicalendar — tutte le tabelle hanno prefisso `icc_`).
- **AI**: Anthropic, chiamata **solo** dalle Edge Function Supabase con il secret `ANTHROPIC_API_KEY`
  (mai nel frontend). `claude-haiku-4-5` per moderazione/traduzione, `claude-sonnet-4-6` per
  onboarding/recap/feedback.
- **Realtime**: Supabase Realtime (messaggi live) + Presence (utenti online).
- **Auth**: accesso anonimo (`signInAnonymously`) con nickname casuale tipo "Blue Fox 42".

---

## 📁 Struttura

```
instantcrowdchat/
├── index.html            # shell dell'app
├── manifest.json         # PWA
├── service-worker.js     # cache app-shell (mai le API)
├── css/styles.css        # dark mode, mascotte, bolle chat
├── icons/                # icone PWA (SVG)
├── js/                   # config, auth, router, realtime, data, pagine
└── supabase/
    ├── migrations/
    │   ├── 0001_icc_init.sql   # tabelle + RLS + seed sfida fondativa
    │   └── 0002_icc_cron.sql   # manutenzione oraria (pg_cron + pg_net)
    └── functions/              # 6 Edge Function Deno + _shared/
```

---

## 🚀 Setup passo-passo

### 1. Database (SQL Editor)

Apri **Supabase → SQL Editor** e incolla/esegui **in ordine**:

1. `supabase/migrations/0001_icc_init.sql`
   Crea le tabelle `icc_*`, abilita RLS con tutte le policy, aggiunge le tabelle alla
   publication Realtime e inserisce la **sfida fondativa** (`FOUND1`) con il messaggio di benvenuto AI.

2. `supabase/migrations/0003_icc_readonly.sql`
   Impone il **read-only lato server**: dopo la scadenza (o a chat chiusa) nessuno può più
   inserire messaggi (policy RLS non aggirabile). Il voto finale resta consentito.

3. *(Opzionale ma consigliato)* `supabase/migrations/0002_icc_cron.sql`
   Pianifica la manutenzione oraria. **Prima di eseguirlo**:
   - abilita le estensioni `pg_cron` e `pg_net` in *Database → Extensions*;
   - sostituisci nel file `PASTE_SERVICE_ROLE_KEY_HERE` con la tua **service_role key**
     (*Project Settings → API*), e verifica `app.icc_functions_url`.

> Le migrazioni si eseguono **manualmente** nello SQL Editor (convenzione del progetto).

> ⚠️ **Abilita gli accessi anonimi**: *Authentication → Sign In / Providers → Anonymous Sign-ins → ON*.
> Senza questo, `signInAnonymously()` fallisce e l'app non parte.

### 2. Secret Anthropic (una volta)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Verifica:
supabase secrets list
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili
automaticamente dentro le Edge Function.

### 3. Deploy delle Edge Function

```bash
supabase functions deploy icc-onboarding
supabase functions deploy icc-moderate
supabase functions deploy icc-summarize
supabase functions deploy icc-translate
supabase functions deploy icc-feedback
supabase functions deploy icc-close-chat
```

> Le funzioni usano `_shared/` (CORS, client Anthropic con retry/backoff, client service-role):
> viene incluso automaticamente nel bundle di ciascuna funzione.

### 4. Configurazione frontend

In `js/config.js`:

- `SUPABASE_ANON_KEY` → incolla la **anon/public key** (*Project Settings → API*).
- `ADMIN_USER_ID` → dopo il primo accesso anonimo, copia il tuo `auth.uid()` (lo trovi in
  *Authentication → Users*) e incollalo qui **e** in `supabase/functions/icc-close-chat/index.ts`
  (`ADMIN_USER_ID`). Solo l'admin può avviare una nuova sfida quando l'esperimento finisce.
- `ADSENSE_PUB_ID` → il tuo publisher id (placeholder `ca-pub-XXXXXXXX`).

### 5. Deploy su GitHub Pages

Essendo tutto statico:

**Opzione A — repo dedicato**
1. Copia il contenuto di `instantcrowdchat/` in un nuovo repo.
2. *Settings → Pages → Source: Deploy from a branch* → `main` / `root`.
3. L'app sarà su `https://<utente>.github.io/<repo>/`. L'hash routing (`#/c/CODE`) funziona senza
   altre configurazioni.

**Opzione B — sottocartella dell'attuale repo**
1. *Settings → Pages* → sorgente `main` / cartella `/root`.
2. Visita `https://<utente>.github.io/<repo>/instantcrowdchat/`.

> Nota PWA: il service worker usa percorsi **relativi**, quindi funziona anche in sottocartella.

---

## 🔄 Ciclo di vita di una sfida

1. **Founding** (`FOUND1`): non scade durante la fase sperimentale. L'AI fa da facilitatore di prodotto.
2. **Active/Extended**: countdown di 24h. Chiunque può proporre **+24h** (passa con ≥65% di sì dei
   partecipanti, una volta per periodo).
3. **Scadenza** → `icc-close-chat` posta il recap finale, apre il **voto 1–10** e imposta stato `closed`
   con finestra di rating di 1h.
4. **Finalizzazione** (dopo la finestra, via cron):
   - media ≥ 8 con ≥ 5 votanti → salvataggio in **Hall of Fame**, le idee più votate diventano
     `adopted` (Co-creators Wall), poi i dati della chat vengono cancellati;
   - altrimenti → **tutto cancellato**, la homepage mostra *"The experiment is over."* e (solo admin)
     il pulsante *Start new challenge*.

---

## 🧪 Testare e resettare il timer

C'è un **pannello Admin** in-app, visibile solo all'utente il cui id combacia con `ADMIN_USER_ID`
(pulsante ⚙︎ in basso a sinistra su homepage e chat). Da lì puoi:

- **Start TEST challenge (10 min)** → crea una sfida con timer corto per vedere l'intero ciclo
  (scadenza → chat in sola lettura → recap finale → voto → Hall of Fame o cancellazione).
- **Start challenge (24h)** → avvia la sfida vera.
- **Reset timer to 24h** / **Set timer: 10 min / 1 hour** → cambia la scadenza della chat corrente.
- **Close challenge now** → forza subito recap finale + voto.

Flusso di test consigliato:
1. Login (una volta) per generare il tuo user id anonimo → copialo in `ADMIN_USER_ID`
   (in [`js/config.js`](js/config.js) **e** in `icc-close-chat/index.ts`) e ridispiega la funzione.
2. Apri il pannello Admin → *Start TEST challenge (10 min)*.
3. Prova onboarding, messaggi, traduzione, voti. Allo scadere la chat diventa **sola lettura**.
4. Quando sei pronto per il lancio reale: *Start challenge (24h)* (o *Reset timer to 24h*).

> In alternativa via SQL Editor:
> ```sql
> -- timer corto per test
> update icc_chats set status='active', expires_at = now() + interval '10 minutes' where short_code='FOUND1';
> -- reset a 24h
> update icc_chats set status='active', expires_at = now() + interval '24 hours' where short_code='FOUND1';
> ```

## ⚖️ Nota legale (consenso utenti)

Prima di entrare, ogni utente deve **accettare esplicitamente** un disclaimer (gate di consenso,
[`js/legal.js`](js/legal.js), salvato in `localStorage`). Il testo chiarisce che:
è un esperimento anonimo di 24h; nessun denaro coinvolto; si condividono solo idee pubbliche;
in caso di fallimento tutto viene cancellato; nessuna garanzia; **nessuna pretesa** di compenso,
proprietà o diritti, ora o in futuro; età minima 16 anni. Il link *"What is this? · Terms"* resta
sempre accessibile dal footer.

> ⚠️ **Non è consulenza legale.** Il disclaimer è un testo standard di buon senso: falla rivedere da
> un legale per la tua giurisdizione (specie GDPR/consenso minori) prima del lancio pubblico. Per
> renderlo più solido, valuta di localizzarlo nelle lingue principali (l'assistente AI parla già la
> lingua di ciascuno, ma il consenso legale è mostrato in inglese).

## 🌍 Multilingua

- **UI** interamente in **inglese** (stringhe in `js/i18n.js`, pronte per altre lingue).
- L'**AI parla sempre la lingua di ciascuno** nei flussi privati (onboarding, feedback, traduzione,
  motivi di moderazione).
- **Barra bandiere**: sopra la chat, mostra in tempo reale le lingue dei partecipanti attivi.
- Ogni messaggio ha l'icona 🌐 **translate** (via `icc-translate`, risultato solo per chi lo chiede).
  I messaggi utente **non** sono tradotti automaticamente (controllo dei costi).

---

## 🧩 Edge Function

| Funzione | Modello | Ruolo |
|---|---|---|
| `icc-onboarding` | sonnet | mini-dialogo privato all'ingresso, salva sintesi + lingua, presenta il nuovo arrivato |
| `icc-moderate` | haiku | filtra insulti/spam/dati personali; a 3 violazioni blocca; retry/backoff, mai messaggi persi ("queued") |
| `icc-summarize` | sonnet | recap pinnato, proposta/voto obiettivo, coordinamento; tally voti obiettivo ed estensione; stats live |
| `icc-translate` | haiku | traduce un singolo messaggio nella lingua del richiedente |
| `icc-feedback` | sonnet | affina l'idea dell'utente e la salva in `icc_ideas` (sintesi in inglese) |
| `icc-close-chat` | sonnet | recap finale, voto, Hall of Fame o cancellazione; avvio nuova sfida (admin) |

---

## 💡 Note

- **AdSense**: un solo banner 320x50 in fondo alle pagine, nessun popup/interstitial. Sostituisci
  `ca-pub-XXXXXXXX` e lo slot prima del lancio (vedi TODO in `index.html` e `js/components.js`).
- **Modelli**: gli ID sono centralizzati in `supabase/functions/_shared/anthropic.ts` — aggiornali lì
  se Anthropic cambia gli identificatori.
- **Privacy/anonimato**: la moderazione blocca telefono, email, indirizzi e nomi reali completi.
