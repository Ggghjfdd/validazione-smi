/* ==========================================================================
   SMI CORE — lettura dei file del sistema di ispezione SMI (Eagle Inspector)
   Tutti gli orari sono "ora locale della macchina" salvati come millisecondi
   pseudo-UTC: così il calcolo è identico su qualsiasi PC, a qualsiasi fuso.
   ========================================================================== */
const SMI = (() => {
  const CASSETTE_PER_PEDANA = 80;
  const VELOCITA_STD = 24;              // cassette / minuto
  const PAUSA_NUOVA_PRODUZIONE = 4 * 3600e3; // 4 h senza conteggi = nuova produzione
  const SOGLIA_SETUP = 0.30;            // intervallo con LEARNING e scarti > 30% = avviamento
  const TURNI = [
    { n: 1, nome: 'Mattino', da: 6, a: 14 },
    { n: 2, nome: 'Pomeriggio', da: 14, a: 22 },
    { n: 3, nome: 'Notte', da: 22, a: 6 },
  ];

  /* ---------- tempo ---------- */
  const ms = (y, mo, d, h = 0, mi = 0, s = 0, f = 0) => Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +f);
  const pad = n => String(n).padStart(2, '0');
  const fmtData = t => { const d = new Date(t); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
  const fmtOra = t => { const d = new Date(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const isoGiorno = t => new Date(t).toISOString().slice(0, 10);
  // "adesso" nello stesso sistema pseudo-UTC (ora locale del browser)
  const adesso = () => { const d = new Date(); return ms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()); };

  function turnoDi(t) {
    const d = new Date(t), h = d.getUTCHours();
    let n, giorno = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (h >= 6 && h < 14) n = 1; else if (h >= 14 && h < 22) n = 2; else { n = 3; if (h < 6) giorno -= 864e5; }
    const T = TURNI[n - 1];
    const inizio = giorno + T.da * 3600e3;
    return { key: `${isoGiorno(giorno)}_${n}`, giorno, n, nome: T.nome, inizio, fine: inizio + 8 * 3600e3 };
  }

  /* ---------- event.log ---------- */
  const RE_EV = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d) (.+?) id: (\d+) message: ?(.*?)\s*$/;
  const RE_CNT = /Total number of products: (\d+) Rejected: (\d+) Uninspected: (\d+) Starch Rejected: (\d+) Residual Rejected: (\d+)/;
  const ZERO = { t: 0, r: 0, u: 0, s: 0, re: 0 };

  function parseEventLog(text) {
    const runs = [], intervalliMarcia = [], cambiImpostazioni = [], fermi = [], storiaProdotti = [];
    let prodotto = null, prev = { ...ZERO }, prevTs = null, learn = false, modo = 'ANALYSIS';
    let inMarcia = false, marciaDa = null, cur = null, ultimoTs = null;
    let espulsione = null, espulsioneDa = null; const storiaEspulsione = [];

    const chiudi = () => { if (cur && cur.ore.length) runs.push(cur); cur = null; };
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const m = RE_EV.exec(line); if (!m) continue;
      const ts = ms(m[1], m[2], m[3], m[4], m[5], m[6]);
      const tipo = m[7].trim(), msg = m[9];
      ultimoTs = ts;
      switch (tipo) {
        case 'PRODUCT CHANGED':
          if (msg && msg !== prodotto) { chiudi(); prodotto = msg; storiaProdotti.push([ts, msg]); }
          break;
        case 'COUNTERS RESET':
        case 'SYSTEM STARTUP INITIALISATION COMPLETED':
          prev = { ...ZERO }; prevTs = ts; break;
        case 'ANALYSIS MODE SET':
          modo = msg; if (msg === 'LEARNING' || msg === 'UPDATE') learn = true; break;
        case 'REJECT SIGNAL': { // comando di espulsione delle cassette scartate acceso/spento
          const on = /^on$/i.test(msg);
          if (on !== espulsione) { espulsione = on; espulsioneDa = ts; storiaEspulsione.push([ts, on ? 1 : 0]); }
          break;
        }
        case 'ANALYSIS SETTINGS CHANGED':
          cambiImpostazioni.push({ ts, prodotto: msg }); break;
        case 'INSPECTION STARTED':
          if (!inMarcia) { inMarcia = true; marciaDa = ts; } break;
        case 'INSPECTION STOPPED':
        case 'SYSTEM SHUTDOWN':
          if (inMarcia) { intervalliMarcia.push([marciaDa, ts]); fermi.push(ts); }
          inMarcia = false; break;
        case 'INSPECTION COUNTERS': {
          const c = RE_CNT.exec(msg); if (!c) break;
          const v = { t: +c[1], r: +c[2], u: +c[3], s: +c[4], re: +c[5] };
          const base = (v.t < prev.t || v.r < prev.r) ? ZERO : prev;
          const d = { t: v.t - base.t, r: Math.max(0, v.r - base.r), u: Math.max(0, v.u - base.u), s: Math.max(0, v.s - base.s), re: Math.max(0, v.re - base.re) };
          if (d.t > 0 || d.r > 0) {
            if (cur && cur.ultimo && ts - cur.ultimo > PAUSA_NUOVA_PRODUZIONE) chiudi();
            if (!cur) cur = { prodotto: prodotto || '(prodotto sconosciuto)', ore: [], ultimo: null };
            const da = prevTs != null ? prevTs : ts - 3600e3;
            cur.ore.push({ da, ts, ...d, setup: learn && d.t > 0 && d.r / d.t > SOGLIA_SETUP });
            cur.ultimo = ts;
          }
          prev = v; prevTs = ts; learn = false;
          break;
        }
      }
    }
    if (inMarcia) intervalliMarcia.push([marciaDa, null]);
    chiudi();
    return { runs, intervalliMarcia, cambiImpostazioni, fermi, storiaProdotti, stato: { prodotto, inMarcia, modo, ultimoTs, ultimiContatori: prev, ultimiContatoriTs: prevTs, espulsione, espulsioneDa, storiaEspulsione: storiaEspulsione.slice(-200), cambioProdottoTs: storiaProdotti.length ? storiaProdotti[storiaProdotti.length - 1][0] : null } };
  }

  function sovrapposizione(intervalli, a, b, fineAperta) {
    let tot = 0;
    for (const [x, y0] of intervalli) { const y = y0 == null ? fineAperta : y0; const s = Math.max(a, x), e = Math.min(b, y); if (e > s) tot += e - s; }
    return tot;
  }

  function somma(arr) {
    const o = { t: 0, r: 0, u: 0, s: 0, re: 0, setupT: 0, setupR: 0 };
    for (const h of arr) { o.t += h.t; o.r += h.r; o.u += h.u; o.s += h.s; o.re += h.re; if (h.setup) { o.setupT += h.t; o.setupR += h.r; } }
    return o;
  }

  function costruisciProduzioni(ev, oraFine) {
    const { runs, intervalliMarcia, cambiImpostazioni, fermi } = ev;
    const fineAperta = oraFine || ev.stato.ultimoTs;
    return runs.map((run, i) => {
      // inizio reale: primo avvio ispezione dentro il primo intervallo con conteggi
      const h0 = run.ore[0];
      let inizio = h0.da;
      for (const [x] of intervalliMarcia) if (x >= h0.da && x <= h0.ts) { inizio = x; break; }
      const fine = run.ore[run.ore.length - 1].ts;
      const tot = somma(run.ore);
      const segmenti = new Map();
      for (const h of run.ore) {
        const T = turnoDi(h.ts - 1000);
        if (!segmenti.has(T.key)) segmenti.set(T.key, { ...T, ore: [] });
        segmenti.get(T.key).ore.push(h);
      }
      const turni = [...segmenti.values()].map(s => {
        const a = Math.max(s.inizio, inizio), b = Math.min(s.fine, fine);
        const marciaMin = sovrapposizione(intervalliMarcia, a, b, fineAperta) / 60e3;
        return { key: s.key, giorno: s.giorno, n: s.n, nome: s.nome, inizio: a, fine: b, ...somma(s.ore), marciaMin: Math.round(marciaMin) };
      });
      const marciaMin = sovrapposizione(intervalliMarcia, inizio, fine, fineAperta) / 60e3;
      return {
        id: `${run.prodotto}|${inizio}`, prodotto: run.prodotto, inizio, fine, ...tot,
        marciaMin: Math.round(marciaMin),
        fermi: fermi.filter(t => t > inizio && t < fine).length,
        cambiImpostazioni: cambiImpostazioni.filter(c => c.ts >= inizio - 3600e3 && c.ts <= fine && c.prodotto === run.prodotto).map(c => c.ts),
        turni,
        ore: run.ore.map(h => [h.da, h.ts, h.t, h.r, h.s, h.re, h.u, h.setup ? 1 : 0]),
      };
    });
  }

  /* ---------- system_event_trace*.log ---------- */
  const RE_TR = /^(\d{4})(\d\d)(\d\d) (\d\d):(\d\d):(\d\d)\.\d+ (.*)$/;
  const BUCO_LINEA = 2 * 60e3; // 2 minuti senza cassette con ispezione attiva = fermo linea
  /* Alcuni trace (circa uno su quattro) hanno gli orari in UTC invece che in ora locale: 1 h indietro
     d'inverno, 2 h d'estate. Il nome del file invece è sempre in ora locale ed è l'istante in cui il file
     è stato scritto, cioè subito dopo l'ultima riga. Lo scarto tra i due, arrotondato all'ora, è la correzione. */
  const RE_NOME_TR = /(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)/;
  function correzioneTrace(righe, nome) {
    const n = nome && RE_NOME_TR.exec(nome); if (!n) return 0;
    let ultima = null;
    for (let i = righe.length - 1; i >= 0 && i >= righe.length - 50; i--) { const m = RE_TR.exec(righe[i]); if (m) { ultima = ms(m[1], m[2], m[3], m[4], m[5], m[6]); break; } }
    if (ultima == null) return 0;
    const d = ms(n[1], n[2], n[3], n[4], n[5], n[6]) - ultima, ore = Math.round(d / 3600e3);
    return ore !== 0 && Math.abs(ore) <= 3 && Math.abs(d - ore * 3600e3) < 5 * 60e3 ? ore * 3600e3 : 0;
  }
  function parseTrace(text, minuti /* Map */, trigger /* array di ts */, nome) {
    let primo = null, ultimo = null, n = 0, e = 0;
    const righe = text.split(/\r?\n/), corr = correzioneTrace(righe, nome);
    for (const line of righe) {
      const isT = line.includes('InspectTriggerReceived'), isE = !isT && line.includes('Perform eject');
      if (!isT && !isE) continue;
      const m = RE_TR.exec(line); if (!m) continue;
      const k = ms(m[1], m[2], m[3], m[4], m[5]) + corr;
      let b = minuti.get(k); if (!b) minuti.set(k, b = [0, 0]);
      if (isT) {
        b[0]++; n++;
        if (trigger) trigger.push(ms(m[1], m[2], m[3], m[4], m[5], m[6]) + corr);
      } else { b[1]++; e++; }
      if (primo == null) primo = k; ultimo = k;
    }
    return { primo, ultimo, cassette: n, scarti: e, correzione: corr };
  }

  /* ---------- error.log ---------- */
  const RE_ERR = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d) (\S+) id: (\d+) info: (.*?) severity: (\d+)\s*$/;
  const TRADUZIONI = [
    [/Consecutive rejects/i, 'Scarti consecutivi'],
    [/Not all images captured/i, 'Immagini non acquisite prima del trigger successivo'],
    [/Capture interrupted|Erfassung unterbrochen/i, 'Acquisizione interrotta'],
    [/Uninspected image/i, 'Immagine non ispezionata'],
    [/eject item .* not found/i, 'Espulsione: elemento non trovato'],
    [/Cameras with serial numbers .* not found/i, 'Telecamera non trovata'],
    [/Pylon error/i, 'Errore telecamera (Pylon)'],
    [/RetrieveResult/i, 'Errore telecamera (Pylon)'],
    [/MqttPublisher|MqttClient/i, 'MQTT non connesso'],
    [/DOA command/i, 'Timeout comando DOA'],
    [/no available image sets/i, 'Buffer immagini pieno'],
    [/Consecutive capture errors/i, 'Errori di acquisizione consecutivi'],
    [/No IO controllers/i, 'Scheda I/O non trovata'],
    [/Open input file failed/i, 'File immagine non trovato'],
  ];
  const traduci = info => { for (const [re, t] of TRADUZIONI) if (re.test(info)) return t; return info.replace(/\d+/g, 'N').slice(0, 80); };
  const RUMORE = new Set(['MQTT non connesso', 'Timeout comando DOA', 'Espulsione: elemento non trovato']);

  function parseErrorLog(text, giorni = 30, riferimento) {
    const righe = text.split(/\r?\n/);
    let fine = riferimento || 0;
    if (!fine) for (let i = righe.length - 1; i >= 0; i--) { const m = RE_ERR.exec(righe[i]); if (m) { fine = ms(m[1], m[2], m[3], m[4], m[5], m[6]); break; } }
    const da = fine - giorni * 864e5;
    const eventi = [];
    for (const line of righe) {
      const m = RE_ERR.exec(line); if (!m) continue;
      const ts = ms(m[1], m[2], m[3], m[4], m[5], m[6]); if (ts < da) continue;
      const tipo = traduci(m[9]);
      eventi.push([ts, tipo, RUMORE.has(tipo) ? 1 : 0, m[9].slice(0, 160)]);
    }
    return eventi;
  }

  /* ---------- ini ---------- */
  function parseIni(text) {
    const out = {}; let sez = '';
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim(); if (!line || line.startsWith(';')) continue;
      const s = /^\[(.+)\]$/.exec(line); if (s) { sez = s[1]; out[sez] = out[sez] || {}; continue; }
      const i = line.indexOf('='); if (i < 0) continue;
      (out[sez] = out[sez] || {})[line.slice(0, i)] = line.slice(i + 1).trim();
    }
    return out;
  }

  function prodottiDaSistema(iniSistema) {
    const p = iniSistema && iniSistema.PRODUCT_SETTINGS; if (!p) return { nomi: [], attivo: null };
    const nomi = []; for (let i = 0; i < +p.NUMBER_OF_PRODUCTS; i++) if (p['PRODUCT_NAME' + i]) nomi.push(p['PRODUCT_NAME' + i]);
    return { nomi, attivo: nomi[+p.ACTIVE_PRODUCT_NUMBER] || null };
  }

  function parametriPerProdotto(iniAnalisi, nomi) {
    const sez = iniAnalisi && iniAnalisi.ANALYSIS_SETTINGS; if (!sez) return {};
    const tutti = [...new Set([...nomi, 'default product'])].sort((a, b) => b.length - a.length);
    const out = {}; const generali = {};
    for (const [k, v] of Object.entries(sez)) {
      let trovato = false;
      for (const n of tutti) {
        const i = k.lastIndexOf(n);
        if (i > 0 && /^\d*$/.test(k.slice(i + n.length))) {
          const param = k.slice(0, i), cam = k.slice(i + n.length) || '-';
          ((out[n] = out[n] || {})[cam] = out[n][cam] || {})[param] = v;
          trovato = true; break;
        }
      }
      if (!trovato) generali[k] = v;
    }
    out.__generali = generali;
    return out;
  }

  /* ---------- fermi ----------
     due tipi:
       'ispezione' = l'operatore ha fermato l'ispezione (INSPECTION STOPPED → STARTED in event.log)
       'linea'     = ispezione attiva ma nessuna cassetta per ≥ 2 minuti (dai file system_event_trace)
  */
  function calcolaFermi(ev, buchi, fineDati, giorni) {
    const da0 = fineDati - giorni * 864e5;
    const IM = ev.intervalliMarcia, out = [];
    const prodottoAl = t => { let p = null; for (const [ts, n] of ev.storiaProdotti) { if (ts <= t) p = n; else break; } return p; };
    for (let i = 0; i < IM.length; i++) {
      const stop = IM[i][1]; if (stop == null) continue;
      const ripresa = i + 1 < IM.length ? IM[i + 1][0] : null;
      if (ripresa != null && ripresa - stop < 60e3) continue; // riavvio rapido, non è un fermo
      if ((ripresa ?? fineDati) < da0) continue;
      out.push({ da: stop, a: ripresa, tipo: 'ispezione', prodotto: prodottoAl(stop) });
    }
    for (const [a, b] of buchi) {
      if (b < da0) continue;
      // conta solo se l'ispezione era attiva per tutto il buco (altrimenti è già un fermo ispezione)
      const coperto = IM.some(([x, y]) => x <= a && (y == null || y >= b));
      if (!coperto) continue;
      out.push({ da: a, a: b, tipo: 'linea', prodotto: prodottoAl(a) });
    }
    return out.sort((x, y) => x.da - y.da).map(f => ({ ...f, turno: turnoDi(f.da).key }));
  }

  /* ---------- cambi prodotto ----------
     dal momento in cui finisce il vecchio prodotto (ultima cassetta) alla prima cassetta del nuovo.
     Se la pausa è più lunga di 4 h (linea spenta, weekend) il cambio parte dall'ora in cui è
     stato scelto il nuovo prodotto; se anche quello è oltre le 4 h, non è un cambio "in turno". */
  const MAX_PAUSA = 4 * 3600e3;
  function calcolaCambi(produzioni, storiaProdotti) {
    const ps = produzioni.filter(p => p.t >= 1), out = [];
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1], b = ps[i];
      if (a.prodotto === b.prodotto) continue;
      let ts = null; for (const [t, n] of storiaProdotti) if (n === b.prodotto && t >= a.inizio && t <= b.inizio + 60e3) ts = t;
      let da = a.fine;
      if (b.inizio - da > MAX_PAUSA) { if (ts && b.inizio - ts <= MAX_PAUSA) da = Math.min(ts, b.inizio); else continue; }
      out.push({ da, a: Math.max(da, b.inizio), ts, dal: a.prodotto, al: b.prodotto, turno: turnoDi(da).key });
    }
    return out;
  }

  /* ---------- modello completo ---------- */
  function costruisciModello(f) {
    // f = { eventLog, traces:[testo], errorLog, analysisIni, systemIni, giorniMinuti }
    const ev = parseEventLog(f.eventLog || '');
    const produzioni = costruisciProduzioni(ev);
    const minuti = new Map(); const tracce = []; const trigger = [];
    // ogni trace è { nome, testo } (il nome serve a correggere l'ora); accetto anche il solo testo
    for (const t of f.traces || []) tracce.push(typeof t === 'string' ? parseTrace(t, minuti, trigger) : parseTrace(t.testo, minuti, trigger, t.nome));
    // i trace possono sovrapporsi: unisco tutte le cassette e cerco i buchi una volta sola
    trigger.sort((a, b) => a - b);
    const buchi = [];
    for (let i = 1; i < trigger.length; i++) if (trigger[i] - trigger[i - 1] >= BUCO_LINEA) buchi.push([trigger[i - 1], trigger[i]]);
    const fineDati = Math.max(ev.stato.ultimoTs || 0, ...[...minuti.keys()].slice(-1));
    const giorniMin = f.giorniMinuti || 7;
    const minutiArr = [...minuti.entries()].filter(([k]) => k >= fineDati - giorniMin * 864e5).sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, v[0], v[1]]);
    const sistema = f.systemIni ? parseIni(f.systemIni) : null;
    const { nomi, attivo } = prodottiDaSistema(sistema);
    const nomiTutti = [...new Set([...nomi, ...produzioni.map(p => p.prodotto)])];
    const parametri = f.analysisIni ? parametriPerProdotto(parseIni(f.analysisIni), nomiTutti) : {};
    const allarmi = f.errorLog ? parseErrorLog(f.errorLog, 30) : [];
    const fermi = calcolaFermi(ev, buchi, fineDati, f.giorniFermi || 60);
    for (const p of produzioni) {
      const dentro = fermi.filter(x => x.da < p.fine && (x.a ?? fineDati) > p.inizio);
      p.fermi = dentro.length;
      p.fermoMin = Math.round(dentro.reduce((s, x) => s + Math.min(p.fine, x.a ?? fineDati) - Math.max(p.inizio, x.da), 0) / 60e3);
    }
    return {
      versione: 1,
      generato: adesso(),
      fineDati,
      stato: { ...ev.stato, prodottoAttivoIni: attivo, inMarciaDa: ev.intervalliMarcia.length ? ev.intervalliMarcia[ev.intervalliMarcia.length - 1] : null },
      produzioni,
      minuti: minutiArr,
      allarmi,
      fermi,
      cambi: calcolaCambi(produzioni, ev.storiaProdotti),
      parametri,
      prodotti: nomiTutti,
    };
  }

  /* ---------- periodi esclusi ("spacchettare" una produzione) ----------
     Un periodo escluso { id, da, a, motivo, chi, quando } toglie dalla produzione le cassette e gli scarti
     di quel periodo (es. cassette neutre lette perché l'ispezione era rimasta accesa).
     I contatori di SMI sono orari: dentro ogni ora la parte esclusa si ricava dai trace minuto per minuto
     (cassette e espulsioni esatte); se per quell'ora i trace mancano, in proporzione al tempo. */
  function quotaEsclusa(h, xa, xb, minuti) {
    const [da, ts, t, r] = h;
    const a = Math.max(da, xa), b = Math.min(ts, xb);
    if (b <= a || t <= 0) return null;
    const m0 = Math.floor(da / 60e3) * 60e3;
    let sc = 0, se = 0, xc = 0, xe = 0;
    for (const [k, c, e] of minuti) {
      if (k < m0 || k >= ts) continue;
      sc += c; se += e;
      if (k >= Math.floor(a / 60e3) * 60e3 && k < b) { xc += c; xe += e; }
    }
    let ct, cr;
    if (sc >= 0.9 * t && sc <= 1.1 * t + 2) { // i trace coprono quest'ora
      ct = Math.min(t, Math.round(xc * t / sc));
      cr = se > 0 && Math.abs(se - r) <= Math.max(3, 0.1 * r) ? Math.min(r, Math.round(xe * r / se)) : Math.round(r * ct / t);
    } else {
      const f = (b - a) / (ts - da);
      ct = Math.round(t * f); cr = Math.round(r * f);
    }
    return { t: ct, r: Math.min(cr, ct), min: (b - a) / 60e3 };
  }

  function applicaEsclusioni(modello, esclusioni) {
    if (!modello || !modello.produzioni || !esclusioni || !esclusioni.length) return modello;
    const minuti = modello.minuti || [];
    const produzioni = modello.produzioni.map(p0 => {
      const E = esclusioni.filter(x => x.a > p0.inizio && x.da < p0.fine).sort((x, y) => x.da - y.da);
      if (!E.length) return p0;
      const periodi = E.map(x => ({ ...x, t: 0, r: 0, min: 0 }));
      const ore = p0.ore.map(h0 => {
        const h = h0.slice();
        let dt = 0, dr = 0;
        for (const x of periodi) {
          const q = quotaEsclusa(h0, x.da, x.a, minuti); if (!q) continue;
          x.t += q.t; x.r += q.r; x.min += q.min; dt += q.t; dr += q.r;
        }
        dt = Math.min(dt, h0[2]); dr = Math.min(dr, h0[3]);
        if (!dt && !dr) return h;
        const ds = h0[3] ? Math.round(h0[4] * dr / h0[3]) : 0;
        h[2] -= dt; h[3] -= dr; h[4] -= ds; h[5] = Math.max(0, h[5] - (dr - ds));
        h[6] = Math.max(0, h[6] - (h0[2] ? Math.round(h0[6] * dt / h0[2]) : 0));
        return h;
      });
      // ricalcolo totali e turni con le ore corrette (stessa regola di costruisciProduzioni)
      const tot = { t: 0, r: 0, s: 0, re: 0, u: 0, setupT: 0, setupR: 0 };
      const perTurno = new Map();
      for (const h of ore) {
        const [, ts, t, r, s, re, u, setup] = h;
        tot.t += t; tot.r += r; tot.s += s; tot.re += re; tot.u += u; if (setup) { tot.setupT += t; tot.setupR += r; }
        const k = turnoDi(ts - 1000).key; const o = perTurno.get(k) || { t: 0, r: 0, s: 0, re: 0, u: 0, setupT: 0, setupR: 0 };
        o.t += t; o.r += r; o.s += s; o.re += re; o.u += u; if (setup) { o.setupT += t; o.setupR += r; }
        perTurno.set(k, o);
      }
      const minIn = (a, b) => E.reduce((s, x) => s + Math.max(0, Math.min(b, x.a) - Math.max(a, x.da)), 0) / 60e3;
      const turni = p0.turni.map(tt => ({ ...tt, ...(perTurno.get(tt.key) || {}), marciaMin: Math.max(0, Math.round(tt.marciaMin - minIn(tt.inizio, tt.fine))) }));
      return {
        ...p0, ...tot, ore, turni,
        marciaMin: Math.max(0, Math.round(p0.marciaMin - minIn(p0.inizio, p0.fine))),
        escluse: { t: p0.t - tot.t, r: p0.r - tot.r, periodi: periodi.map(x => ({ ...x, min: Math.round(x.min) })) },
      };
    });
    return { ...modello, produzioni };
  }

  /* periodi sospetti dentro una produzione: almeno 3 minuti e 20 cassette di fila con oltre l'80% espulse
     (tipico delle cassette neutre lette con l'ispezione accesa). Servono le espulsioni dei trace. */
  function periodiSospetti(p, minuti, esclusioni = []) {
    const out = []; let cur = null;
    const chiudi = () => { if (cur && cur.t >= 20 && cur.a - cur.da >= 3 * 60e3 && cur.r / cur.t >= 0.8) out.push(cur); cur = null; };
    for (const [k, c, e] of minuti) {
      if (k < p.inizio - 60e3 || k > p.fine) continue;
      if (esclusioni.some(x => k >= x.da && k < x.a)) { chiudi(); continue; }
      if (c >= 2 && e / c >= 0.7) {
        if (cur && k - cur.a > 2 * 60e3) chiudi();
        if (!cur) cur = { da: k, a: k + 60e3, t: 0, r: 0 };
        cur.a = k + 60e3; cur.t += c; cur.r += e;
      } else if (c >= 2) chiudi();
    }
    chiudi();
    return out;
  }

  /* ---------- utilità di presentazione ---------- */
  const pedane = n => Math.floor(n / CASSETTE_PER_PEDANA);
  const perc = (a, b) => b > 0 ? (100 * a / b) : 0;

  return { applicaEsclusioni, periodiSospetti, MAX_PAUSA, calcolaCambi, calcolaFermi, CASSETTE_PER_PEDANA, VELOCITA_STD, TURNI, ms, fmtData, fmtOra, isoGiorno, adesso, turnoDi, parseEventLog, costruisciProduzioni, parseTrace, parseErrorLog, parseIni, parametriPerProdotto, costruisciModello, pedane, perc, traduci };
})();
if (typeof module !== 'undefined') module.exports = SMI;
