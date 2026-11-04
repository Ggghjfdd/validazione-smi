# Validazione sensibilità SMI

Sito per registrare le prove di sensibilità del sistema di visione SMI (simulazioni di stampino assente e crollo amido), consultare lo storico e calcolare efficienza e fermi della linea.

- **Sito:** pubblicato con GitHub Pages da questo repository (`index.html`).
- **Dati e accessi:** su Supabase, protetti da login e ruoli (`supabase_setup.sql`). In questo repository non ci sono dati di produzione.
- **Copia_file_SMI.bat:** da tenere sulla chiavetta, copia dal PC della visione i file che servono al sito.

La configurazione di Supabase (URL e chiave *anon public*) si trova in `index.html`, nel blocco `COLLEGAMENTO A SUPABASE`. La chiave anon è pensata per stare nel codice pubblico: i dati sono protetti dalle regole del database. Non inserire mai la chiave `service_role`.
