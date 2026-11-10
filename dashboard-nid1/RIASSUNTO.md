# Dashboard produzione – Linea NID 1 (Perfetti Van Melle)

> **Prompt per riprendere il lavoro in una nuova conversazione.** Incolla tutto questo testo (o allega il file) come primo messaggio.
> Stato aggiornato al **10 novembre 2026**. Versione pubblicata: **v23 · 10 nov 14:00**.
> Lingua di lavoro: **italiano**. L'utente lavora in produzione (non è uno sviluppatore): spiegazioni semplici, passi concreti sul PC della linea, niente gergo.

---

## 0. Come lavorare (istruzioni per l'assistente)

- Il codice è nel repo **pubblico** GitHub `ggghjfdd/validazione-smi`, ramo `main`, pubblicato con GitHub Pages. Clonarlo con `git clone --depth 1 https://github.com/ggghjfdd/validazione-smi` (per fare push serve agganciare il repo con accesso in scrittura).
- **Flusso di ogni modifica:**
  1. modificare i sorgenti in `dashboard-nid1/src/` (`core.js`, `app.js`, `style.css`, `index.html`);
  2. aumentare la versione in `app.js` → `CONFIG.VERSIONE: 'vNN · giorno mese hh:mm'`;
  3. `cd dashboard-nid1 && python3 build.py` → crea `dist/produzione.html` (un solo file con `logo.png` e `caramelle.jpg` incorporati). Se in `dashboard-nid1/` c'è `model.json` crea anche `dist/anteprima.html` con quei dati (utile per provare nel browser; poi cancellare `model.json`);
  4. `cp dist/produzione.html ../produzione.html` (la pagina pubblicata è `produzione.html` nella radice);
  5. commit e push su `main`. `dashboard-nid1/dist/` è in `.gitignore`.
- Il PC della linea si **aggiorna da solo** alla nuova versione entro pochi minuti (solo se il permesso cartella è "a ogni visita"); altrimenti F5 sulla scheda del lettore.
- `node --check` sui file JS prima di pubblicare. Per provare la pagina: Chromium/Playwright sono nel container (`/usr/bin/google-chrome`), con le richieste a Supabase bloccate e `dist/anteprima.html`.
- `core.js` è puro (funziona anche in Node: `require('./core.js')` espone `SMI`), `app.js` è l'interfaccia + il lettore.
- Le date interne sono **ms "pseudo-UTC"**: `SMI.ms(anno, mese, giorno, h, m, s)` costruisce l'ora locale italiana come se fosse UTC (quindi `new Date(t).toISOString()` mostra l'ora locale). `SMI.adesso()` = ora corrente in quel formato. Usare sempre queste funzioni, mai `Date.now()` per confronti coi log.
- Mai toccare i file di SMI né le sue impostazioni: il lettore ha solo permesso di **lettura**. Le modifiche a SMI le fa il fornitore **Smart Eagle**, d'accordo con la qualità.
- La chiave `service_role` di Supabase non va **mai** messa nel sito.

---

## 1. Cosa fa

Pagina web "in vetro" (tema scuro) che mostra in tempo reale la produzione della **linea NID 1** (Mogul, stampi in amido), leggendo i log del sistema di visione **SMI / Eagle Inspector** (fornitore **Smart Eagle**):

- cassette contate e scartate (con %), pedane (**80 cassette = 1 pedana**), velocità rispetto allo standard di **24 cassette/min**;
- produzioni divise per **turno**: Mattino 06–14, Pomeriggio 14–22, Notte 22–06;
- **OEE** per turno = disponibilità × prestazione × qualità;
- **fermi**, **cambi prodotto**, stato "In marcia / Linea ferma da X min", **espulsione ON/OFF**;
- finestra di dettaglio per ogni produzione con schede: **Riepilogo** (con periodi esclusi), **Andamento** (orario, velocità), **Parametri di analisi** (con ultime modifiche), **Fermi**, **Allarmi**, **Foto scarti**;
- viste nella pagina principale: **Produzioni, Per turno, Fermi, Cambi prodotto, Parametri**;
- schermata **"NON CHIUDERE / DO NOT CLOSE"** sul PC della linea (il lettore).

## 2. Dove sta tutto

| Cosa | Dove |
|---|---|
| Dashboard (qualsiasi PC/telefono) | https://ggghjfdd.github.io/validazione-smi/produzione.html |
| Lettore (**solo** PC della linea) | https://ggghjfdd.github.io/validazione-smi/produzione.html#lettore |
| Repo | `ggghjfdd/validazione-smi`, ramo `main`, GitHub Pages |
| Pagina pubblicata | `produzione.html` nella radice |
| Sorgenti | `dashboard-nid1/src/` (core.js, app.js, style.css, index.html) |
| Build | `dashboard-nid1/build.py` |
| SQL tabelle | `dashboard-nid1/supabase_smi.sql` (già eseguito) |
| SQL foto | `dashboard-nid1/supabase_foto.sql` (eseguito dall'utente il 9/11) |
| Script PC linea | `Attiva_parametri_dashboard.bat` (radice; eseguito il 9/11), `Copia_file_SMI.bat` (copia i file SMI su chiavetta) |
| Altri file in radice | `index.html`, `vecchia.html`, `README.md`, `ISTRUZIONI.txt`, `supabase_setup.sql` (sito "Validazione SMI", separato) |
| Database | Supabase `https://sszxyritwrkxaictcaaa.supabase.co`, chiave pubblica `sb_publishable_HkYiyUEqlWXJo_CDyD9Eqw_k8-4cY-3` |
| Libreria | `@supabase/supabase-js@2.45.4` da jsdelivr |

**Login:** stessi account Supabase del sito Validazione SMI (email + password). Le registrazioni libere devono restare **disattivate** in Supabase → Authentication. Il pulsante 🔒 Gestione del lettore chiede di nuovo email e password.

### Supabase
- Tabella `smi_dati(id, dati jsonb, aggiornato)` – RLS: solo utenti autenticati, realtime attivo. Righe:
  - `storico`: produzioni, minuti, fermi, stato, prodotti
  - `parametri`: `{prodotto: {camera: {PARAMETRO: valore}}}`
  - `allarmi`
  - `vivo`: battito del lettore, stato, `extra` (conteggio in diretta: `cassette`, `scarti`, `velocita1` su 2 min, `velocita5`, `ultimaCassetta`, `ultimoScarto`), elenco file, `erroriFile`, `nParametri`, `app` (versione)
  - `pc_linea`: quale PC è il lettore
  - `esclusioni`: `{lista: [{id, da, a, motivo, chi, quando}]}` – periodi esclusi dal conteggio
  - `storia_parametri`: `{inizio, ultimo: {t, h, par}, modifiche: [{prodotto, cam, p, da, a, t, stimata}]}` (max 5000)
  - `foto`: `{lista: [[t, percorso, prodotto]]}` (ultime 400)
- Tabella `smi_comandi`: richieste "Aggiorna" dalla dashboard al lettore.
- Storage bucket privato **`smi-foto`** (solo autenticati; JPEG max 2 MB): foto degli scarti, percorso `AAAA-MM-GG/hhmmss_N.jpg`.

## 3. Il PC della linea

- Windows 11, Microsoft Edge, utente "Starch Mould 2". File SMI in **C:\SMI**; foto in **D:\images**; backup impostazioni SMI in **D:\backup** (20 copie, giornaliere – non ancora usati).
- Il **lettore** è una scheda di Edge (File System Access API) che rilegge i file ogni 2–5 s, rifà la scansione delle cartelle ogni 60 s e invia a Supabase. Solo **lettura**.
- Prima configurazione: email e password → nome del PC → scegliere la cartella → **Avvia**. Un solo PC lettore: configurandone un altro, il vecchio si spegne.
- Cartelle da dare al lettore (🔒 Gestione → **Aggiungi cartella**), sempre con **"Consenti a ogni visita"**:
  1. **C:\SMI** (comprende la sottocartella `copie_dashboard`)
  2. **D:\images** (per scarti in diretta e foto) – l'utente ha confermato "Fatto" il 9/11, **da verificare che funzioni**.
- Schermata "Non chiudere": 🔒 Gestione (cambia/aggiungi cartella, ferma, Reimposta da zero), elenco "File letti", "Registro", in basso a destra ultimo invio + versione.
- Watchdog: se non riesce a inviare per 3 minuti ricarica la pagina. Nuova versione sul sito → si ricarica da sola.
- Il PC è riconosciuto da un codice salvato in Edge (non dall'IP): cancellando i dati di navigazione va riconfigurato.
- Consigliati: Edge → Impostazioni → Sistema e prestazioni → "Non sospendere mai questi siti" → `ggghjfdd.github.io`; collegamento in `shell:startup` verso `#lettore` con Esegui "Ridotto a icona".
- **Edge non può leggere i file `.ini`** (errore "Name is not allowed"). Per questo `Attiva_parametri_dashboard.bat` (eseguito una volta) crea `C:\SMI\copie_dashboard\copia.vbs` e un'attività pianificata **"SMI copia ini dashboard"** che ogni 5 minuti copia `SMI_ANALYSIS.ini` → `SMI_ANALYSIS.ini.txt` ed `EI_SYSTEM.ini` → `EI_SYSTEM.ini.txt`. Il lettore legge le copie `.ini.txt`. Per togliere: `schtasks /delete /tn "SMI copia ini dashboard" /f`.
- In alternativa al collegamento diretto: l'utente può zippare C:\SMI e allegarlo in chat (fatto il 9/11 con `New_folder.zip`). Per collegare Claude direttamente al PC servirebbe l'app Claude desktop su quel PC (non fatto; da sentire l'IT).

## 4. File SMI e cosa contengono

- **event.log** – fonte principale. Formato: `AAAA-MM-GG hh:mm:ss TIPO id: N message: …`. Eventi:
  - `PRODUCT CHANGED <prodotto>`
  - `INSPECTION COUNTERS`: contatori progressivi `Total number of products / Rejected / Uninspected / Starch Rejected / Residual Rejected`, scritti **solo ogni ora e a ogni stop**
  - `COUNTERS RESET`, `INSPECTION STARTED/STOPPED`, `SYSTEM STARTUP INITIALISATION COMPLETED` (azzera), `SYSTEM SHUTDOWN`
  - `ANALYSIS MODE SET LEARNING/ANALYSIS`
  - `REJECT SIGNAL On/Off` = **espulsione** (verificato: con Off nei trace non c'è nessun "Perform eject")
  - `ANALYSIS SETTINGS CHANGED <prodotto>` = qualcuno ha cambiato i parametri
  - `NON-INSPECTING MODE STARTED` – significato **non chiaro**: 384 volte, mai un evento di fine, 166 volte con ispezione ferma (es. 9/11 alle 08:01, 08:05, 08:08, 08:24). Forse cassette passate senza ispezione: da chiedere al fornitore.
- **system_event_trace\<AAAAMMGG>T\<hhmmss>.log** – ogni cassetta (`InspectTriggerReceived: Current product N`) ed espulsione (`Eject position reached for item id N` + `Perform eject`) al microsecondo. Scritti **solo quando l'ispezione si ferma**. ⚠️ Circa **1 file su 4 ha gli orari in UTC** (−1 h d'inverno, −2 h d'estate); il **nome del file è sempre in ora locale** e corrisponde a subito dopo l'ultima riga → correzione = differenza nome/ultima riga arrotondata all'ora (v14). Molti trace sono da 0 KB.
- **analysis_time.log** – **4 righe per cassetta** (tempi di analisi, nessun legame con gli scarti: verificato), cresce in diretta, ruota in `.bak` a circa 500 KB. Da qui conteggio in diretta e ora ultima cassetta (data di modifica del file).
- **error.log** – allarmi. MQTT, DOA ed "eject item not found" sono rumore e vengono filtrati.
- **SMI_ANALYSIS.ini** – parametri per prodotto, chiave `PARAMETRO + nome prodotto + indice camera` (es. `GREYLEVEL_THRESHOLDgelees0`). 124 parametri per prodotto.
- **EI_SYSTEM.ini** – lista prodotti (`PRODUCT_SETTINGS`: `NUMBER_OF_PRODUCTS`, `PRODUCT_NAMEi`), prodotto attivo, interfacce OPC ed esterna (spente). Contiene `m_uses_trigger_for_counting=1`, `m_log_product_counters=0`, `LOG_UNINSPECTED_NR=1`.
- **SMI_IMAGE.ini** – `SAVE_REJECTED_IMAGES=1`, `SAVE_ACCEPTED_IMAGES=0`, `OUTPUT_IMAGE_FILE_NAME=D:\images\image`, `SAVE_ZIP_ARCHIVE_SIZE=1000`, `LOG_RESULTS=0` (`RESULT_LOG_FILE_NAME=SMI_result.log`, `m_log_results_only_for_rejects=1`, `m_log_time_in_result_log=1`), `m_log_analysis_settings_changes=0` (dir `D:\eagleinspector\asc`), `MAX_LOG_FILE_SIZE=500000`, `LOG_ANALYSIS_TIME=1`.
- **D:\images** – per ogni cassetta scartata **2 BMP** (le due metà della telecamera, 1280×1024, ~3,8 MB) `imageN.bmp` e `imageN+1.bmp` (N pari); **`image_last_number.dat`** = progressivo (+2 per scarto). I file vengono **riusati/sovrascritti** (data creazione vecchia, data modifica recente) → progressivo circolare.
- Altri: `baumer.log`, `error_eng.log`, `SMISYS_SYSTEM.ini`, `eagle configuration.ini`, cartella `EAGLE Crash Log`. **Statistics_*.xml / Graphs_bak.xml** sono di una vecchia bilancia: si ignorano.
- Prodotti visti: goleador, farfallina, gran golia, golia, maialini, morositas berries lampone mora, gelees, "default product" (ignorato).

## 5. Regole di calcolo concordate

- **Produzione**: dal cambio prodotto al successivo. Una pausa > 4 h senza conteggi apre una nuova produzione. Le "prove" sotto 80 cassette sono nascoste di default.
- **Fermo**: "Ispezione fermata" (stop ≥ 1 min) oppure "Nessuna cassetta" (ispezione attiva ma niente cassette per ≥ 2 min).
- **Cambio prodotto**: dall'ultima cassetta del vecchio prodotto alla prima del nuovo; conta **come fermo** nell'OEE ed è in una vista a parte. Al cambio compare subito il nuovo prodotto con l'etichetta "In avvio".
- **Ore senza produzione** (notti/weekend a linea spenta): **escluse** da fermi e OEE.
- **OEE**: Disponibilità = minuti in produzione / minuti programmati; Prestazione = cassette / (minuti in produzione × 24); Qualità = buone / contate. Verde ≥ 85%, giallo ≥ 65%, rosso sotto.
- **Avviamento / learning**: intervallo con LEARNING e scarti > 30% segnalato; si mostra anche la % di scarti senza avviamento.
- **Velocità in diretta** (v13): misurata tra due scritture di SMI su analysis_time.log (con la data di modifica del file), su 2 minuti. Prima usava l'ora di lettura e arrivava a 27/min.
- **Periodi esclusi** (v15): togliono cassette e scarti di un intervallo da produzione, turni e OEE (per tutti). Ripartizione esatta dai trace minuto per minuto se coprono l'ora (±10%), altrimenti in proporzione al tempo. Proposte automatiche "Possibili cassette neutre": ≥ 3 min e ≥ 20 cassette con > 80% espulse (minuti con ≥ 70%). Funzionano solo con espulsione accesa. Motivi: cassette neutre / prova-avviamento / altro. Ripristinabili. In modalità file restano in localStorage.
- **Storico parametri** (v19): il lettore confronta SMI_ANALYSIS.ini a ogni cambiamento (accetta una nuova fotografia solo se uguale per 2 letture di fila) e salva le differenze. Ora della modifica = ultimo `ANALYSIS SETTINGS CHANGED` di quel prodotto dopo la fotografia precedente, altrimenti stimata (segnata "≈"). Vista **Parametri**: grafico scarti per produzione (pallini proporzionali alle cassette) con linee gialle tratteggiate sulle modifiche + tabella con scarti nelle **8 ore di produzione prima/dopo** (senza learning e periodi esclusi), ▼/▲. Registrazione attiva solo da quando il lettore legge i parametri (9/11 pomeriggio): il passato non c'è.
- **Scarti in diretta** (v20): scarti dell'ultimo contatore orario + (progressivo foto da quell'ora) / 2. Testo "+ ≈N in diretta (foto degli scarti)". Se il progressivo torna indietro, riparte da lì. Da verificare che allo scoccare dell'ora non faccia salti.
- **Foto scarti** (v21): il lettore unisce le due BMP in un JPEG (larghezza max 1600 px, qualità 0,72), carica in `smi-foto`, tiene le ultime **400** cassette scartate (cancella le vecchie), solo scarti successivi all'attivazione. Scheda "Foto scarti" nella produzione, clic per ingrandire (URL firmati 1 h). Da valutare con qualità/IT: foto del prodotto su servizio esterno.

## 6. Verifiche fatte sui log reali (9/11)

- Contatori orari di event.log = cassette dei trace (±1): es. 537/1.277/408 contro 538/1.276/408.
- analysis_time.log / 4 = trace: 13.578 contro 13.580 dal 6/11. Il conteggio in diretta è corretto.
- Su tutto lo storico (apr 2025 → nov 2026, ~540.000 cassette) i contatori **non salgono con l'ispezione ferma** (solo 851 cassette in 3 anomalie). Quindi con ispezione spenta le cassette **non sono contate** da nessuna parte e la dashboard segna fermo.
- L'utente ha osservato che **la luce del sensore cassette si accende anche con ispezione disattivata**: il segnale arriva alla scheda SMI ma il programma non lo registra.
- 9/11 mattina: riavvii di SMI alle 07:38, 07:49, 07:53; ispezione ripartita solo alle **09:20** (contatori 08:00 e 09:00 a zero). Fino a ~2.000 cassette potenzialmente non contate se la linea girava (domanda all'utente rimasta senza risposta).
- **Goleador 9/11**: periodi 100% espulsi **11:00–11:17** (408 cassette, cassette neutre con ispezione rimasta accesa – confermato dall'utente) e **06:42–07:32** (1.161 cassette, probabilmente neutre o prodotto impostato male, da far verificare). Escludendo entrambi gli scarti passano da 45,6% a 4,9%.
- **"Morositas" del 9/11 mattina** (l'utente: "impossibile che sia stato fatto"): in SMI era rimasto impostato *morositas berries lampone mora* da venerdì 6/11 19:21; il 9/11 dalle 06:36 alle 06:41 passano **119 cassette** contate come Morositas, poi alle **06:42:14** il prodotto viene cambiato in *goleador*. È un prodotto non aggiornato su SMI, non una produzione vera.

## 7. Storia delle versioni (9 novembre 2026)

- **v12** (6/11): correzione del blocco del lettore del 6/11 15:58.
- **v13**: velocità in diretta tra le scritture di SMI.
- **v14**: correzione ora dei trace in UTC (minuti con più di 26 cassette da 86 a 2 sugli ultimi 7 giorni, max 28 invece di 49).
- **v15**: periodi esclusi dal conteggio + proposte automatiche.
- **v16**: diagnostica nella scheda Parametri (spiega perché mancano).
- **v17**: scansione robusta (un file in errore non blocca gli altri) + ricerca degli ini per nome.
- **v18**: lettura delle copie `.ini.txt` + `Attiva_parametri_dashboard.bat`.
- **v19**: storico modifiche parametri + vista Parametri.
- **v20**: scarti in diretta da `D:\images\image_last_number.dat`.
- **v21**: foto degli scarti (Supabase Storage `smi-foto`).
- **v22** (10/11): download delle foto (singola o zip, JSZip 3.10.1 da cdnjs caricato al bisogno), **Segna come prova**, pagina **#prove** (archivio prove) e pagina **#analisi** (efficienze e fermi). Codice nuovo in `src/pagine.js` (inserito da build.py al posto di `/*PAGINE*/`).

### Prove (v22)
- Dalla scheda Foto scarti: clic su una foto → Scarica / Segna come prova; oppure spunta più foto → Scarica selezionate (zip) / Segna N come prova (stesso `gruppo`).
- Ogni prova è una riga `prova_<id>` di `smi_dati` con: `id, t, foto ('prove/<id>.jpg', copia permanente: non viene cancellata dalla rotazione delle 400), fotoOrig, prodotto, gruppo, operatore, tipo, esito (valutare/corretto/falso), note, parametri ({camera:{PARAMETRO:valore}} al momento t, ricostruiti dai valori attuali tornando indietro con storia_parametri), parametriCerti, produzione {id, inizio, t, r}, chi, creato, modificato, modificatoDa, eliminata`.
- Le righe `prova_%` sono escluse dal caricamento principale e lette solo dalla pagina Prove. smi_dati non ha policy di DELETE: l'eliminazione è `eliminata: true` + cancellazione della foto.
- Pagina #prove: filtri (testo, date, prodotto, tipo, operatore, esito), raggruppa per giorno/prodotto/tipo/operatore/esito, vista foto o tabella, dettaglio con modifica dei campi e tabella completa dei parametri (evidenziati quelli diversi da ora), confronto parametri tra prove selezionate, export CSV (tutti i campi + tutti i parametri `camN PARAMETRO`, separatore `;`), zip delle foto con il CSV dentro.
- Tipi proposti: Prova parametri, Campione difettoso, Cassette neutre, Avviamento / learning, Verifica qualità, Altro (campo libero con suggerimenti). Ultimo operatore ricordato nel browser.

### Efficienze e fermi (v22)
- Pagina #analisi: filtri date (rapidi Oggi/7/30/Tutto), turno, prodotto; export CSV turni e fermi.
- KPI: OEE, Disponibilità, Prestazione, Qualità, cassette/pedane, fermi, cambi prodotto, cassette perse (per velocità + scarti); barra del tempo programmato; OEE per giorno; tabelle per turno e per prodotto; fermi per motivo, durata, prodotto, turno, ora del giorno; 15 fermi più lunghi; tabella di tutti i turni.
- Senza prodotto: dati da `oeeTurno()` per ogni turno. Con un prodotto: dalle produzioni di quel prodotto divise per turno (cambi non contati).
- Il periodo analizzabile dipende da quanti giorni di minuti/fermi il lettore manda nello storico.

## 8. Limiti noti

- Contatori ufficiali SMI solo **ogni ora**; in diretta: cassette da analysis_time.log, scarti dal progressivo foto (se D:\images è collegata).
- **Con ispezione spenta SMI non conta nulla**: quelle cassette mancano e risultano come fermo.
- Le proposte "cassette neutre" funzionano solo con espulsione accesa.
- Conteggio in diretta solo con lettore acceso; ricorda il conteggio fino a 3 h tra un riavvio e l'altro. Possibile perdita di 1–2 cassette a ogni rotazione di analysis_time.log.
- Inizio produzione = avvio ispezione (può anticipare di qualche minuto la prima cassetta).
- Totali per turno: i contatori orari possono attribuire al turno successivo le cassette tra l'ultima scrittura e il cambio turno, se mancano i trace di quell'ora.
- Se il prodotto non viene cambiato in SMI all'avvio, le prime cassette finiscono sotto il prodotto precedente (caso Morositas).
- Se il lettore è spento la dashboard mostra l'ultimo stato noto con un "?".

## 9. Aperto / prossimi passi

1. **Verificare v20/v21 sul PC della linea**: in basso a destra "v21"; nell'elenco file `image_last_number…`; nel Registro nessuna riga "Foto scarti: …" (se c'è, dice il motivo); in dashboard "+ ≈N in diretta (foto degli scarti)" e scheda "Foto scarti" popolata. Controllare che allo scoccare dell'ora gli scarti non facciano salti.
2. **Verificare i parametri**: SMI_ANALYSIS.ini.txt ed EI_SYSTEM.ini.txt nell'elenco file; scheda "Parametri di analisi" piena; nel Registro "Storico parametri: prima fotografia salvata".
3. **Correzione prodotto sbagliato** (proposta il 9/11, l'utente non ha ancora risposto):
   a) pulsante "Correggi prodotto" nella finestra di una produzione per unirla a quella successiva (come i periodi esclusi: vale per tutti, annullabile);
   b) segnalazione automatica: produzione di pochi minuti seguita subito da un `PRODUCT CHANGED` → "probabile prodotto non aggiornato su SMI", con proposta di unione.
4. **Mail a Smart Eagle** (da preparare) con le domande:
   - conteggio cassette anche con ispezione spenta, scritto nel log (il sensore si accende comunque; `m_uses_trigger_for_counting=1`, `m_log_product_counters=0`);
   - significato di `NON-INSPECTING MODE STARTED` e del contatore `Uninspected` (sale anche quando tutte le cassette dei trace risultano analizzate);
   - `LOG_RESULTS=1` in SMI_IMAGE.ini per gli scarti in diretta con orario (alternativa alle foto);
   - attivazione interfaccia **OPC** per il comando a distanza (KEPServerEX, voci `product`, `start`, `stop`, `learn_product`, `reset_counters`; oggi `m_use_opc_communication=0`), servirebbe poi un piccolo programma sul PC della linea. Alternativa: accesso remoto allo schermo (c'è già OpenVPN per l'assistenza del fornitore).
5. **Contatore indipendente** (alternativa hardware): uscita della fotocellula in parallelo su un modulo contatore (rete/USB) o su un ingresso libero del PLC del Mogul; lavoro della manutenzione elettrica, verificando di non disturbare il segnale a SMI.
6. **Registro dell'ispezione** per turno (proposto, non fatto): riga temporale con ispezione ON/OFF, espulsione ON/OFF, learning, con evidenza dei periodi lunghi a ispezione spenta.
7. **Storico parametri passato**: farsi mandare **D:\backup** zippato per ricostruire le modifiche delle ultime settimane.
8. Correzione esatta dei totali per turno e del `COUNTERS RESET` usando i trace (proposto, non fatto).

## Aggiornamento v23 (10 nov 2026)
- **Nuova prova a mano** (pulsante "+ Nuova prova" nella pagina Prove, oppure "+ Nuova prova su questo colaggio" nel Riepilogo di una produzione): data/ora, prodotto, colaggio, codice, operatore, tipo, esito, note, allegati; i parametri sono quelli del prodotto a quell'ora.
- **Colaggio** = una produzione della dashboard (campo `produzione` della prova: {id, inizio, fine, prodotto, t, r}) + campo libero `codiceColaggio` (lotto). Si sceglie dall'elenco (ultime 300 produzioni), proposto in automatico in base all'ora. Raggruppamento "Colaggio" nella pagina Prove; pannello "Prove su questo colaggio" nella finestra della produzione; "Apri colaggio" dal dettaglio della prova.
- **Allegati** (foto e documenti, max 50 MB l'uno) nello spazio privato Supabase **`smi-allegati`** → va creato eseguendo **`dashboard-nid1/supabase_allegati.sql`** (consegnato il 10/11, da confermare che sia stato eseguito). Campo `allegati: [{percorso, nome, tipo, dimensione, caricato, chi}]`; percorsi `prove/<id>/…` o `gruppi/<gruppo>/…` (condivisi tra le prove salvate insieme: si cancellano solo quando nessuna prova li usa). Nel dettaglio: aggiungi/togli/scarica; le immagini si ingrandiscono. Lo zip delle prove ha una cartella per prova con foto, allegati e prove.csv.
- **Segnalibri dei parametri**: elenchi di parametri condivisi (riga `viste_parametri` di smi_dati: {lista:[{id, nome, parametri:[chiavi], chi, aggiornato}]}). Barra "Segnalibro" nella scheda Parametri di una produzione, nel dettaglio e nel confronto delle prove: scegliendo un segnalibro si vedono solo quei parametri (classe `fuori-vista` sugli elementi `[data-pk]`). Scelta ricordata nel browser; link `produzione.html?parametri=<nome>` (o `?parametri=principali`) da salvare nei preferiti. Preimpostato "Parametri principali".

## Aggiornamento v24 (10 nov 2026)
- Campo **"Dove si trova il difetto"** nelle prove (SX / CENTRO / DX, anche insieme) → `posizioneDifetto: ['sx','centro','dx']`. Durante le prove gli operatori fanno apposta dei difetti sulle cassette.
- Pulsante **"⬇ Excel prove"** nella pagina Prove: file .xlsx (SheetJS 0.18.5 da cdnjs, caricato al bisogno), foglio "Prove", una riga per prova tra quelle filtrate (o solo le selezionate), in ordine di tempo. Colonne concordate con l'utente:
  `(n.) · Prodotto · Data · Turno · Total · Accepted products · Rejected products · SMI · Starch · Residual · Largest defect threshold pixels (= MINIMUM_DEFECT_SIZE) · Largest defect threshold pixels (= MINIMUM_SUM_OF_DEFECT_SIZES) · Greylevel threshold (= GREYLEVEL_THRESHOLD) · Erodi / dilata dimensione orrizontale pixel (= ERODE_DILATE_HOR_SIZE) · Erodi / dilata … (= ERODE_DILATE_VER_SIZE) · Difetto stampa SX · CENTRO · DX (X se presente) · Umidità amido colaggio`.
  Conteggi = **produzione (colaggio) della prova** (Total = cassette, Accepted = Total − Rejected, Starch/Residual = contatori SMI della produzione). Parametri = quelli salvati nella prova (camera 0).
  **Da completare**: colonna **SMI** (l'utente deve dire cosa contiene) e **Umidità amido colaggio** (da decidere se campo % nella prova o valore per colaggio): per ora vuote.
- Il vecchio export è diventato "CSV completo" (tutti i campi e tutti i parametri).
