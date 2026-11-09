# Dashboard produzione – Linea NID 1 (Perfetti Van Melle)

Riassunto del progetto per riprendere il lavoro in una nuova chat. Stato aggiornato al 9 novembre 2026, versione pubblicata **v12 · 6 nov 16:15**.

## 1. Cosa fa
Una pagina web "in vetro" che mostra in tempo reale la produzione della **linea NID 1** (Mogul, stampi in amido), leggendo i log del sistema di visione **SMI / Eagle Inspector (Smart Eagle)**:
- cassette contate e scartate (con %), pedane (**80 cassette = 1 pedana**), velocità rispetto allo standard di **24 cassette/min**;
- produzioni divise per **turno**: Mattino 06–14, Pomeriggio 14–22, Notte 22–06;
- **OEE** per turno, cioè disponibilità × prestazione × qualità;
- **fermi**, **cambi prodotto**, stato "In marcia / Linea ferma da X min", **espulsione ON/OFF**;
- finestra di dettaglio per ogni produzione: riepilogo, andamento orario, velocità, fermi, allarmi e **parametri di analisi** del prodotto;
- schermata **"NON CHIUDERE / DO NOT CLOSE"** sul PC della linea.

## 2. Dove sta tutto
| Cosa | Dove |
|---|---|
| Dashboard (da qualsiasi PC o telefono) | https://ggghjfdd.github.io/validazione-smi/produzione.html |
| Lettore (**solo** PC della linea) | https://ggghjfdd.github.io/validazione-smi/produzione.html#lettore |
| Repository GitHub (pubblico) | `ggghjfdd/validazione-smi`, ramo `main`, GitHub Pages |
| Pagina pubblicata (un solo file) | `produzione.html` nella radice del repo |
| Codice sorgente | `dashboard-nid1/src/` (core.js, app.js, style.css, index.html) |
| Build | `cd dashboard-nid1 && python3 build.py` → `dist/produzione.html` (incorpora `logo.png` e `caramelle.jpg`), poi va copiato nella radice come `produzione.html` |
| Database | Supabase `https://sszxyritwrkxaictcaaa.supabase.co`, chiave pubblica `sb_publishable_HkYiyUEqlWXJo_CDyD9Eqw_k8-4cY-3` (la service_role non va mai messa nel sito) |
| SQL delle tabelle | `dashboard-nid1/supabase_smi.sql` (già eseguito) |

**Login:** gli stessi account Supabase del sito Validazione SMI. Le registrazioni libere devono restare disattivate in Supabase → Authentication.

**Tabelle Supabase** (RLS: solo utenti autenticati, realtime attivo):
- `smi_dati(id, dati jsonb, aggiornato)`, con le righe `storico` (produzioni, minuti, fermi, stato), `parametri`, `allarmi`, `vivo` (battito del lettore, conteggio in diretta) e `pc_linea` (quale PC è il lettore);
- `smi_comandi`: richieste "Aggiorna" dalla dashboard al lettore.

## 3. Il PC della linea
- Windows 11, Microsoft Edge, utente "Starch Mould 2". I file SMI stanno in **C:\SMI**.
- Il **lettore** è una scheda di Edge (File System Access API) che rilegge i file ogni 2–5 s e li invia a Supabase. Ha solo il permesso di **lettura**.
- La prima volta chiede **email e password**, poi si dà un nome al PC, si sceglie la cartella e si preme **Avvia**: quel PC diventa "il PC della linea". Ce n'è uno solo: se se ne configura un altro, il vecchio si spegne da solo.
- In Edge va scelto **"Consenti a ogni visita"** per la cartella. Così dopo un riavvio o un aggiornamento il lettore riparte da solo.
- Sulla schermata "Non chiudere": pulsante **🔒 Gestione** (con password) per cambiare cartella, fermare o **Reimposta da zero**; in basso a destra lo stato dell'ultimo invio e la versione.
- Quando c'è una nuova versione sul sito, la pagina si ricarica da sola, ma solo se il permesso è "a ogni visita". C'è un watchdog: se non riesce a inviare per 3 minuti, ricarica la pagina.
- Il PC viene riconosciuto da un codice salvato in Edge, non dall'IP. Se si cancellano i dati di navigazione, va riconfigurato.
- Consigliati: in Edge "Non sospendere mai questi siti" → `ggghjfdd.github.io`; un collegamento in `shell:startup` verso l'indirizzo `#lettore`, con l'opzione Esegui "Ridotto a icona".

## 4. File SMI e cosa contengono
- **event.log**: la fonte principale.
  - `PRODUCT CHANGED <prodotto>`
  - `INSPECTION COUNTERS`: contatori progressivi, scritti **solo ogni ora e a ogni stop** (`Total number of products / Rejected / Uninspected / Starch Rejected / Residual Rejected`)
  - `COUNTERS RESET`, `INSPECTION STARTED/STOPPED`
  - `ANALYSIS MODE SET LEARNING/ANALYSIS`
  - `REJECT SIGNAL On/Off`: **espulsione** (verificato: con Off nei trace non c'è nessun "Perform eject")
  - `ANALYSIS SETTINGS CHANGED`
- **system_event_trace*.log**: ogni cassetta (`InspectTriggerReceived`) e ogni espulsione (`Perform eject`) al microsecondo. Vengono scritti **solo quando l'ispezione si ferma**, quindi non servono in diretta.
- **analysis_time.log**: **4 righe per cassetta**, cresce in diretta e ruota in `.bak` a circa 500 KB. Da qui vengono il conteggio in diretta e l'orario dell'ultima cassetta (data di modifica del file).
- **error.log**: allarmi. MQTT, DOA ed "eject item not found" sono rumore e vengono filtrati.
- **SMI_ANALYSIS.ini**: parametri per prodotto, con chiave `PARAMETRO + nome prodotto + indice camera` (es. `GREYLEVEL_THRESHOLDgelees0`).
- **EI_SYSTEM.ini**: lista dei prodotti, prodotto attivo, interfacce OPC ed esterna (spente).
- **Statistics_*.xml / Graphs_bak.xml**: di una vecchia bilancia, non c'entrano. Si ignorano.

## 5. Regole di calcolo concordate
- **Produzione**: dal cambio prodotto al successivo. Una pausa di oltre 4 h senza conteggi apre una nuova produzione. Le "prove" sotto le 80 cassette sono nascoste di default.
- **Fermo**: "Ispezione fermata" (stop di almeno 1 min) oppure "Nessuna cassetta" (ispezione attiva ma niente cassette per almeno 2 min).
- **Cambio prodotto**: dall'ultima cassetta del vecchio prodotto alla prima del nuovo. Conta **come fermo** nell'OEE ed è registrato in una vista a parte. Quando cambia il prodotto, in primo piano compare subito il nome del nuovo, con l'etichetta "In avvio".
- **Ore senza produzione** (notti o weekend con la linea spenta): **escluse** da fermi e OEE.
- **OEE**: Disponibilità = minuti in produzione / minuti programmati; Prestazione = cassette / (minuti in produzione × 24); Qualità = buone / contate. Verde ≥ 85%, giallo ≥ 65%, rosso sotto.
- **Avviamento / learning**: un intervallo con LEARNING e scarti oltre il 30% viene segnalato, e si mostra anche la % di scarti senza avviamento.

## 6. Limiti noti
- **Gli scarti si aggiornano solo ogni ora**: SMI non li scrive in diretta. Per averli in diretta servirebbe `LOG_RESULTS=1` in SMI_IMAGE.ini, da chiedere al fornitore.
- Il conteggio in diretta delle cassette funziona solo mentre il lettore è acceso. Ricorda il conteggio tra un riavvio e l'altro, fino a 3 h.
- L'inizio di una produzione corrisponde all'avvio dell'ispezione, che può anticipare di qualche minuto la prima cassetta.
- Se il lettore è spento, la dashboard mostra l'ultimo stato noto con un "?".

## 7. Aperto / prossimi passi
- **Verificare che la v12 funzioni sul PC della linea**: in basso a destra deve comparire "ultimo invio … · v12" e sulla dashboard il pallino verde "Lettore collegato". Il 6/11 alle 15:58 il lettore si era bloccato e la v12 è la correzione.
- **Comando a distanza** (cambio prodotto, start/stop, learning, reset): il programma SMI ha già un'interfaccia **OPC** (KEPServerEX, voci `product`, `start`, `stop`, `learn_product`, `reset_counters`), ma è spenta (`m_use_opc_communication=0`). Va attivata dal fornitore Smart Eagle, d'accordo con la qualità. Servirebbe poi un piccolo programma sul PC della linea, perché una pagina web può solo leggere file. Alternativa semplice: accesso remoto allo schermo (risulta già OpenVPN per l'assistenza del fornitore).
- Idea: mail al fornitore per OPC e `LOG_RESULTS`.
