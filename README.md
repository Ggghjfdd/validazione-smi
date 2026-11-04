# Validazione sensibilità SMI

Sito per la linea mogul con sistema di visione SMI: prove di sensibilità (stampino assente, crollo amido), andamento della linea (efficienza, scarto, fermate) e caricamento dei log della visione.

- **index.html** — il sito (GitHub Pages). Home con tre pulsanti: *Fai una prova*, *Come va la linea*, *Carica dati*.
- **vecchia.html** — la versione precedente, tenuta per confronto.
- **supabase_setup.sql** — tabelle, ruoli e regole del database. Dati e accessi stanno su Supabase, dietro login: nel repository non ci sono dati di produzione.
- **Copia_file_SMI.bat** — da tenere sulla chiavetta, copia dal PC della visione i file che servono.
- **ISTRUZIONI.txt** — configurazione passo per passo.

La chiave Supabase nel codice è quella pubblica (*publishable*): i dati sono protetti dalle regole del database. Non inserire mai la chiave `service_role`.
