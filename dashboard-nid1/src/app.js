/* ==========================================================================
   DASHBOARD LINEA SMI — interfaccia, lettore, Supabase
   ========================================================================== */
const CONFIG = {
  SUPABASE_URL: 'https://sszxyritwrkxaictcaaa.supabase.co',
  SUPABASE_KEY: 'sb_publishable_HkYiyUEqlWXJo_CDyD9Eqw_k8-4cY-3',
  NOME_LINEA: 'Linea NID 1',
  VERSIONE: 'v21 · 9 nov 16:15',
};
const S = {
  modo: null,             // 'demo' | 'remoto' | 'file' | 'lettore'
  modello: null, vivo: null, aggiornatoVivo: null,
  grezzo: null, esclusioni: [], foto: [], storiaPar: [], storiaParDa: null, // grezzo = dati come arrivano da SMI; modello = grezzo meno i periodi esclusi
  periodo: '7', prodotto: '', prove: false, vista: 'produzioni',
  sb: null, utente: null,
};
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('it-IT');
const n0 = v => nf.format(Math.round(v || 0));
const n1 = v => (v || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pc = (a, b) => b > 0 ? n1(100 * a / b) + '%' : '—';
const durata = min => { min = Math.round(min || 0); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h ${String(m).padStart(2, '0')}′` : `${m}′`; };
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const giornoLungo = t => { const d = new Date(t); return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const giornoCorto = t => { const d = new Date(t); return `${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`; };
const ICONE = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg>',
  agg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  cartella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  pc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  esci: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

/* ---------- riferimento temporale ---------- */
const rif = () => (S.modo === 'remoto' || S.modo === 'lettore') ? SMI.adesso() : (S.modello?.fineDati || SMI.adesso());

/* ---------- toast ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.innerHTML = msg; t.classList.add('vis'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('vis'), 3200); }

/* ==========================================================================
   GRAFICI SVG (con tooltip)
   ========================================================================== */
const grafici = new Map();
const ro = new ResizeObserver(es => { for (const e of es) { const f = grafici.get(e.target); if (f) f(); } });
function montaGrafico(el, disegna) { grafici.set(el, () => disegna(el)); ro.observe(el); disegna(el); }

function scalaNice(max) { if (max <= 0) return { max: 10, passo: 2 }; const p = Math.pow(10, Math.floor(Math.log10(max))); const r = max / p; const s = r <= 1.2 ? .25 : r <= 2.5 ? .5 : r <= 5 ? 1 : 2; const passo = s * p; return { max: Math.ceil(max / passo) * passo, passo }; }

function graficoBarre(el, dati, { altezza = 220, etichetta = d => SMI.fmtOra(d.t0) } = {}) {
  // dati: [{t0, buone, scarti, setup}]
  const W = Math.max(280, el.clientWidth), H = altezza, mL = 44, mR = 8, mT = 10, mB = 26;
  if (!dati.length) { el.innerHTML = '<div class="vuoto">Nessun dato in questo intervallo</div>'; return; }
  const maxV = Math.max(...dati.map(d => d.buone + d.scarti));
  const { max, passo } = scalaNice(maxV);
  const iw = W - mL - mR, ih = H - mT - mB, bw = iw / dati.length, larg = Math.max(2, Math.min(28, bw * .66));
  const y = v => mT + ih - (v / max) * ih;
  let g = '<g class="griglia-l">';
  for (let v = 0; v <= max + 1e-9; v += passo) g += `<line x1="${mL}" x2="${W - mR}" y1="${y(v)}" y2="${y(v)}"/>`;
  g += '</g><g class="asse">';
  for (let v = 0; v <= max + 1e-9; v += passo) g += `<text x="${mL - 8}" y="${y(v) + 4}" text-anchor="end">${n0(v)}</text>`;
  const ogni = Math.ceil(dati.length / Math.max(2, Math.floor(iw / 56)));
  dati.forEach((d, i) => { if (i % ogni === 0) g += `<text x="${mL + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle">${etichetta(d)}</text>`; });
  g += '</g>';
  let b = '';
  dati.forEach((d, i) => {
    const x = mL + bw * i + (bw - larg) / 2, r = Math.min(4, larg / 2);
    const yB = y(d.buone), yS = y(d.buone + d.scarti);
    if (d.buone > 0) b += barraArrot(x, yB, larg, mT + ih - yB, r, d.scarti > 0 ? 0 : r, 'var(--blue)');
    if (d.scarti > 0) { const hS = Math.max(1.5, yB - yS - (d.buone > 0 ? 2 : 0)); b += barraArrot(x, yB - (d.buone > 0 ? 2 : 0) - hS, larg, hS, r, r, 'var(--crit)'); }
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">${g}${b}<rect class="hit" x="${mL}" y="${mT}" width="${iw}" height="${ih}" fill="transparent"/><line class="cursore" y1="${mT}" y2="${mT + ih}" stroke="rgba(255,255,255,.25)" opacity="0"/></svg><div class="tip"></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cur = el.querySelector('.cursore');
  svg.addEventListener('mousemove', ev => {
    const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width);
    const i = Math.floor((x - mL) / bw); if (i < 0 || i >= dati.length) return nascondi();
    const d = dati[i], tot = d.buone + d.scarti, cx = mL + bw * i + bw / 2;
    cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.setAttribute('opacity', 1);
    tip.innerHTML = `<b>${d.titolo || (giornoCorto(d.t0) + ' · ' + SMI.fmtOra(d.t0) + '–' + SMI.fmtOra(d.t0 + 3600e3))}</b><br><span class="k">Cassette</span> ${n0(tot)}<br><span class="k">Scarti</span> ${n0(d.scarti)} (${pc(d.scarti, tot)})${d.setup ? '<br><span class="k">⚙︎ avviamento / learning</span>' : ''}`;
    tip.style.left = (cx / W * r.width) + 'px'; tip.style.top = (y(tot) / H * r.height - 8) + 'px'; tip.style.opacity = 1;
  });
  const nascondi = () => { tip.style.opacity = 0; cur.setAttribute('opacity', 0); };
  svg.addEventListener('mouseleave', nascondi);
}
function barraArrot(x, y, w, h, rTop, rBot, col) {
  if (h <= 0) return '';
  rTop = Math.min(rTop, h / 2); rBot = Math.min(rBot, h / 2);
  return `<path fill="${col}" d="M${x},${y + rTop} a${rTop},${rTop} 0 0 1 ${rTop},${-rTop} h${w - 2 * rTop} a${rTop},${rTop} 0 0 1 ${rTop},${rTop} v${h - rTop - rBot} a${rBot},${rBot} 0 0 1 ${-rBot},${rBot} h${-(w - 2 * rBot)} a${rBot},${rBot} 0 0 1 ${-rBot},${-rBot} z"/>`;
}

function graficoLinea(el, punti, { altezza = 220, riferimento = SMI.VELOCITA_STD, unita = 'cass./min', da, a } = {}) {
  // punti: [{t, v}] ordinati, interruzioni se gap > 3 min
  const W = Math.max(280, el.clientWidth), H = altezza, mL = 36, mR = 10, mT = 12, mB = 26;
  if (!punti.length) { el.innerHTML = '<div class="vuoto">Nessun dato di velocità in questo intervallo</div>'; return; }
  const t0 = da ?? punti[0].t, t1 = a ?? punti[punti.length - 1].t + 60e3;
  const { max, passo } = scalaNice(Math.max(riferimento * 1.25, ...punti.map(p => p.v)));
  const iw = W - mL - mR, ih = H - mT - mB;
  const x = t => mL + (t - t0) / Math.max(1, t1 - t0) * iw, y = v => mT + ih - (v / max) * ih;
  let g = '<g class="griglia-l">';
  for (let v = 0; v <= max + 1e-9; v += passo) g += `<line x1="${mL}" x2="${W - mR}" y1="${y(v)}" y2="${y(v)}"/>`;
  g += '</g><g class="asse">';
  for (let v = 0; v <= max + 1e-9; v += passo) g += `<text x="${mL - 8}" y="${y(v) + 4}" text-anchor="end">${n0(v)}</text>`;
  const span = t1 - t0, step = [15, 30, 60, 120, 180, 240, 360, 720, 1440].map(m => m * 60e3).find(s => span / s <= Math.max(2, iw / 70)) || 1440 * 60e3;
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) g += `<text x="${x(t)}" y="${H - 6}" text-anchor="middle">${step >= 864e5 ? giornoCorto(t) : SMI.fmtOra(t)}</text>`;
  g += '</g>';
  let d = '', area = '', prev = null, seg = [];
  const flush = () => { if (seg.length) { d += 'M' + seg.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('L'); area += `M${x(seg[0].t).toFixed(1)},${y(0)}L` + seg.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('L') + `L${x(seg[seg.length - 1].t).toFixed(1)},${y(0)}Z`; } seg = []; };
  for (const p of punti) { if (prev && p.t - prev.t > (p.gap || 3 * 60e3)) flush(); seg.push(p); prev = p; }
  flush();
  const rifY = y(riferimento);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}"><defs><linearGradient id="gArea${el.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1fc28a" stop-opacity=".28"/><stop offset="1" stop-color="#1fc28a" stop-opacity="0"/></linearGradient></defs>${g}
    <path d="${area}" fill="url(#gArea${el.id})"/><path d="${d}" fill="none" stroke="var(--aqua)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <g class="rif"><line x1="${mL}" x2="${W - mR}" y1="${rifY}" y2="${rifY}"/><text x="${W - mR}" y="${rifY - 6}" text-anchor="end">Standard ${riferimento}</text></g>
    <line class="cursore" y1="${mT}" y2="${mT + ih}" stroke="rgba(255,255,255,.25)" opacity="0"/><circle class="pt" r="5" fill="var(--aqua)" stroke="#0b1430" stroke-width="2" opacity="0"/>
    <rect x="${mL}" y="${mT}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="tip"></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cur = el.querySelector('.cursore'), pt = el.querySelector('.pt');
  svg.addEventListener('mousemove', ev => {
    const r = svg.getBoundingClientRect(), xm = (ev.clientX - r.left) * (W / r.width);
    const tm = t0 + (xm - mL) / iw * (t1 - t0);
    let best = null, bd = Infinity; for (const p of punti) { const dd = Math.abs(p.t - tm); if (dd < bd) { bd = dd; best = p; } }
    if (!best) return;
    const cx = x(best.t), cy = y(best.v);
    cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.setAttribute('opacity', 1);
    pt.setAttribute('cx', cx); pt.setAttribute('cy', cy); pt.setAttribute('opacity', 1);
    tip.innerHTML = `<b>${giornoCorto(best.t)} · ${SMI.fmtOra(best.t)}${best.fine ? '–' + SMI.fmtOra(best.fine) : ''}</b><br><span class="k">Velocità</span> ${n1(best.v)} ${unita}${best.e != null ? `<br><span class="k">Scarti</span> ${n0(best.e)}` : ''}`;
    tip.style.left = (cx / W * r.width) + 'px'; tip.style.top = (cy / H * r.height - 10) + 'px'; tip.style.opacity = 1;
  });
  svg.addEventListener('mouseleave', () => { tip.style.opacity = 0; cur.setAttribute('opacity', 0); pt.setAttribute('opacity', 0); });
}

/* ---------- dati per i grafici ---------- */
function orarie(produzioni, da, a) {
  const b = new Map();
  for (const p of produzioni) for (const [hda, ts, t, r, , , , setup] of p.ore) {
    if (ts <= da || ts > a + 1000) continue;
    const k = Math.floor((ts - 1000) / 3600e3) * 3600e3;
    const o = b.get(k) || { t0: k, buone: 0, scarti: 0, setup: 0 };
    o.buone += Math.max(0, t - r); o.scarti += r; o.setup |= setup; b.set(k, o);
  }
  const out = []; for (let k = Math.floor(da / 3600e3) * 3600e3; k <= a; k += 3600e3) out.push(b.get(k) || { t0: k, buone: 0, scarti: 0, setup: 0 });
  return out;
}
function puntiVelocita(modello, produzioni, da, a) {
  // 1° scelta: minuti dai trace (precisi). Media mobile su 3 minuti.
  const min = (modello.minuti || []).filter(m => m[0] >= da && m[0] <= a);
  if (min.length >= 10) {
    return min.map((m, i) => { const w = min.slice(Math.max(0, i - 1), i + 2).filter(z => Math.abs(z[0] - m[0]) <= 60e3); return { t: m[0], v: w.reduce((s, z) => s + z[1], 0) / w.length, e: m[2] }; });
  }
  // altrimenti: velocità media per intervallo dai contatori orari
  const out = [];
  for (const p of produzioni) for (const [hda, ts, t, r] of p.ore) {
    if (ts < da || hda > a) continue;
    const minuti = (ts - hda) / 60e3; if (minuti < 2) continue;
    out.push({ t: hda, v: t / minuti, fine: ts, gap: 3700e3 }, { t: ts - 1, v: t / minuti, fine: ts, gap: 3700e3 });
  }
  return out.sort((x, y) => x.t - y.t);
}
function velocitaAttuale(modello) {
  if (S.vivo?.extra?.velocita1 != null && S.modo !== 'demo' && S.modo !== 'file' && lettoreCollegato()) return { v: S.vivo.extra.velocita1, fonte: 'in diretta' };
  const m = modello.minuti || []; const r = rif();
  const ult = m.filter(x => x[0] > r - 6 * 60e3 && x[0] <= r);
  if (ult.length) return { v: ult.reduce((s, x) => s + x[1], 0) / ult.length, fonte: 'ultimi minuti' };
  return null;
}

/* ==========================================================================
   STATO LINEA E FERMI
   ========================================================================== */
const inDiretta = () => S.modo === 'remoto' || S.modo === 'lettore';
function lettoreCollegato() {
  if (!inDiretta()) return true;
  if (S.modo === 'lettore') return L.attivo;
  const age = S.aggiornatoVivo ? (Date.now() - S.aggiornatoVivo) / 1000 : Infinity;
  return age < Math.max(30, (S.vivo?.intervallo || 5) * 3 + 20);
}
function statoLinea() {
  const m = S.modello, st = m?.stato || {}, ora = rif();
  // in diretta, se il lettore non invia dati non possiamo sapere se la linea gira
  if (inDiretta() && !lettoreCollegato()) {
    // ultimo stato noto al momento dell'ultimo invio
    const batt = S.vivo?.battito, ult = S.vivo?.extra?.ultimaCassetta;
    let fermaDa = null;
    if (!st.inMarcia) fermaDa = st.inMarciaDa?.[1] ?? st.ultimoTs;
    else if (batt && ult && batt - ult > 2 * 60e3) fermaDa = ult;
    return { ignoto: true, da: S.aggiornatoVivo, inMarcia: !!st.inMarcia, fermaDa, battito: batt };
  }
  const ult = inDiretta() ? S.vivo?.extra?.ultimaCassetta : null;
  const cIn = cambioInCorso();
  if (cIn?.inCorso) return { ferma: true, cambio: true, da: cIn.da, motivo: `cambio prodotto da ${cIn.dal} a ${cIn.al}`, c: cIn };
  if (!st.inMarcia) {
    const da = st.inMarciaDa?.[1] ?? st.ultimoTs;
    return { ferma: true, da, motivo: 'ispezione fermata', tipo: 'ispezione' };
  }
  let ultima = ult;
  // i file trace vengono scritti solo quando l'ispezione si ferma: in diretta non servono a capire se la linea gira
  if (!ultima && !inDiretta()) { const mm = (m.minuti || []).filter(x => x[1] > 0); if (mm.length) ultima = mm[mm.length - 1][0] + 59e3; }
  if (!ultima && inDiretta() && S.vivo?.extra?.velocita1 > 0) ultima = ora;
  if (ultima && ora - ultima > 2 * 60e3) return { ferma: true, da: ultima, motivo: 'nessuna cassetta', tipo: 'linea' };
  return { ferma: false, da: st.inMarciaDa?.[0], ultima };
}
const durataDa = ms => durata(Math.max(0, ms) / 60e3);
function htmlStatoLinea() {
  const s = statoLinea(), ora = rif();
  if (s.ignoto && s.fermaDa) return `<div class="stato-linea ferma"><span class="ico">${ICONE.stop}</span><div><b>Linea ferma da ${durataDa(ora - s.fermaDa)}</b><span>dalle ${giornoCorto(s.fermaDa)} ${SMI.fmtOra(s.fermaDa)} · ultimo dato alle ${s.battito ? SMI.fmtOra(s.battito) : '—'}, poi il lettore si è spento: potrebbe essere ripartita</span></div></div>`;
  if (s.ignoto && s.battito) return `<div class="stato-linea ignoto"><span class="ico">${ICONE.pc}</span><div><b>Ultimo dato alle ${SMI.fmtOra(s.battito)}: la linea era in marcia</b><span>Poi il lettore sul PC della linea si è spento, quindi non so cosa sia successo dopo. Sul PC della linea clicca <b style="display:inline;font-size:inherit;color:var(--text-1)">"Clicca qui per riavviare"</b>.</span></div></div>`;
  if (s.ignoto) return `<div class="stato-linea ignoto"><span class="ico">${ICONE.pc}</span><div><b>Non so se la linea è ferma: il lettore è spento</b><span>Nessun dato dal PC della linea${s.da ? ' dalle ' + new Date(s.da).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}. Sul PC della linea clicca <b style="display:inline;font-size:inherit;color:var(--text-1)">"Clicca qui per riavviare"</b>.</span></div></div>`;
  if (s.cambio) {
    const dur = ora - s.da;
    return `<div class="stato-linea cambio"><span class="ico">${ICONE.agg}</span><div><b>Cambio prodotto in corso${inDiretta() || dur >= 60e3 ? ' da ' + durataDa(dur) : ''}</b><span style="text-transform:none"><span style="text-transform:capitalize">${esc(s.c.dal)}</span> → <b style="display:inline;font-size:inherit;color:#fff3d6;text-transform:capitalize">${esc(s.c.al)}</b> · nuovo prodotto scelto alle ${SMI.fmtOra(s.c.ts)} · la produzione sta per ripartire</span></div></div>`;
  }
  if (s.ferma) {
    const dur = ora - (s.da || ora);
    const testo = inDiretta() || dur >= 60e3 ? `Linea ferma da ${durataDa(dur)}` : `Linea ferma`;
    return `<div class="stato-linea ferma"><span class="ico">${ICONE.stop}</span><div><b>${testo}</b><span>dalle ${s.da ? giornoCorto(s.da) + ' ' + SMI.fmtOra(s.da) : '—'} · ${s.motivo}</span></div></div>`;
  }
  const agoUlt = s.ultima ? Math.max(0, (ora - s.ultima) / 1000) : null;
  return `<div class="stato-linea marcia"><span class="ico">${ICONE.play}</span><div><b>In marcia${s.da ? ' da ' + durataDa(ora - s.da) : ''}</b><span>${agoUlt != null ? (agoUlt < 90 ? 'ultima cassetta ' + Math.round(agoUlt) + ' s fa' : 'ultima cassetta alle ' + SMI.fmtOra(s.ultima)) : 'ispezione attiva'}</span></div></div>`;
}
const ICONA_ESP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 4 14h16z"/><path d="M4 19h16"/></svg>';
function pillEspulsione() {
  const st = S.modello?.stato; if (!st || st.espulsione == null) return '';
  const da = st.espulsioneDa ? `dalle ${giornoCorto(st.espulsioneDa)} ${SMI.fmtOra(st.espulsioneDa)}` : '';
  return st.espulsione
    ? `<span class="pill esp-on" title="Espulsione attiva ${esc(da)}: le cassette scartate vengono espulse">${ICONA_ESP}<span class="testo-pill">Espulsione </span>ON</span>`
    : `<span class="pill esp-off" title="Espulsione SPENTA ${esc(da)}: le cassette scartate NON vengono espulse">${ICONA_ESP}<span class="testo-pill">Espulsione </span>OFF</span>`;
}
function avvisoEspulsione() {
  const st = S.modello?.stato; if (!st || st.espulsione !== false) return '';
  return `<div class="avviso-esp">${ICONA_ESP}<span><b>Espulsione spenta</b> dalle ${st.espulsioneDa ? giornoCorto(st.espulsioneDa) + ' ' + SMI.fmtOra(st.espulsioneDa) : '—'}: le cassette scartate <b>non</b> vengono tolte dalla linea.</span></div>`;
}
function pillStatoLinea() {
  if (!S.modello?.stato) return '';
  const s = statoLinea(), ora = rif();
  if (s.ignoto && s.fermaDa) return `<span class="pill ferma-pill" title="Ultimo stato noto: il lettore non invia dati"><span class="dot off"></span>Ferma da ${durataDa(ora - s.fermaDa)}?</span>`;
  if (s.ignoto) return `<span class="pill" title="Il lettore non invia dati"><span class="dot"></span>Stato sconosciuto</span>`;
  if (s.cambio) return `<span class="pill cambio-pill" title="Cambio prodotto: ${esc(s.c.dal)} → ${esc(s.c.al)}"><span class="dot file"></span>Cambio prodotto${inDiretta() ? ' da ' + durataDa(ora - s.da) : ''}</span>`;
  return s.ferma ? `<span class="pill ferma-pill" title="${esc('Dalle ' + (s.da ? SMI.fmtOra(s.da) : '') + ' · ' + s.motivo)}"><span class="dot off"></span>Ferma${inDiretta() ? ' da ' + durataDa(ora - (s.da || ora)) : ''}</span>`
    : `<span class="pill"><span class="dot on"></span>In marcia</span>`;
}
/* ---------- produzioni, cambi e finestre "programmate" ----------
   Le ore senza nessuna produzione (linea spenta, weekend) NON contano né nei fermi né nell'OEE.
   Contano: le produzioni, le pause tra una produzione e l'altra (se < 4 h) e i cambi prodotto. */
const prodOrdinate = () => (S.modello?.produzioni || []).filter(p => p.t >= 1);
function ultimaAttivita() {
  const ps = prodOrdinate(); let t = ps.length ? ps[ps.length - 1].fine : 0;
  if (inDiretta()) { const u = S.vivo?.extra?.ultimaCassetta; if (u) t = Math.max(t, u); if (S.vivo?.extra?.velocita1 > 0) t = Math.max(t, rif()); }
  return t;
}
// cambio prodotto fatto dopo l'ultima produzione con cassette: la nuova produzione sta per partire
function cambioInCorso() {
  const st = S.modello?.stato; const ps = prodOrdinate(); const last = ps[ps.length - 1];
  if (!st?.prodotto || !last || st.prodotto === last.prodotto || !st.cambioProdottoTs || st.cambioProdottoTs < last.inizio) return null;
  const ex = inDiretta() ? S.vivo?.extra : null;
  const partita = ex?.primaDa && ex.primaDa >= st.cambioProdottoTs - 60e3 && ex.cassette > 0 ? ex.primaDa : null;
  let da = last.fine; if (st.cambioProdottoTs - da > SMI.MAX_PAUSA) da = st.cambioProdottoTs;
  return { da, a: partita, ts: st.cambioProdottoTs, dal: last.prodotto, al: st.prodotto, inCorso: !partita, cassette: partita ? ex.cassette : 0 };
}
function tuttiICambi() {
  const l = (S.modello?.cambi || []).map(c => ({ ...c }));
  const c = cambioInCorso(); if (c) l.push({ ...c, a: c.a ?? null, turno: SMI.turnoDi(c.da).key });
  return l;
}
const fineC = c => c.a ?? rif();
function finestre() {
  const ps = prodOrdinate(), out = [], r = rif();
  ps.forEach((p, i) => {
    let fine = p.fine; const nx = ps[i + 1];
    if (nx && nx.inizio - p.fine <= SMI.MAX_PAUSA) fine = nx.inizio;
    if (!nx) fine = Math.max(p.fine, Math.min(r, ultimaAttivita() + SMI.MAX_PAUSA));
    out.push([p.inizio, fine]);
  });
  for (const c of tuttiICambi()) out.push([c.da, fineC(c)]);
  return out;
}
const dentro = (t, F) => F.some(([a, b]) => t >= a && t < b);
// fermi grezzi (dai log) + quello in corso adesso
function fermiGrezzi() {
  const m = S.modello; const lista = (m?.fermi || []).map(f => ({ ...f }));
  const s = m?.stato ? statoLinea() : null;
  if (s?.ferma && !s.ignoto && !s.cambio && s.tipo === 'linea' && !lista.some(f => f.a == null)) lista.push({ da: s.da, a: null, tipo: 'linea', prodotto: m.stato.prodotto });
  return lista;
}
// fermi tagliati sulle finestre programmate e senza la parte che è un cambio prodotto
function tuttiIFermi() {
  const F = finestre(), C = tuttiICambi().map(c => [c.da, fineC(c)]), r = rif(), out = [];
  for (const f of fermiGrezzi()) {
    const fine = f.a ?? r;
    for (const [a, b] of F) {
      let x = Math.max(f.da, a), y = Math.min(fine, b); if (y - x < 60e3) continue;
      // togli la parte sovrapposta a un cambio prodotto
      for (const [ca, cb] of C) { if (ca <= x && cb >= y) { x = y; break; } if (ca <= x && cb > x) x = cb; if (cb >= y && ca < y) y = ca; }
      if (y - x < 60e3) continue;
      out.push({ ...f, da: x, a: (f.a == null && y >= r - 1000) ? null : y, turno: SMI.turnoDi(x).key });
    }
  }
  // tolgo i doppioni (stesso fermo in due finestre sovrapposte)
  out.sort((p, q) => p.da - q.da);
  return out.filter((f, i) => !i || f.da >= (out[i - 1].a ?? r));
}
const fineF = f => f.a ?? rif();
function fineProd(p) {
  const ps = prodOrdinate(), i = ps.findIndex(x => x.id === p.id);
  if (i === ps.length - 1 && !cambioInCorso()) return Math.max(p.fine, Math.min(rif(), ultimaAttivita()));
  return p.fine;
}
function fermiDi(p) {
  const a = fineProd(p);
  const lista = tuttiIFermi().filter(f => f.da < a && fineF(f) > p.inizio);
  const min = lista.reduce((s, f) => s + Math.max(0, Math.min(a, fineF(f)) - Math.max(p.inizio, f.da)), 0) / 60e3;
  return { lista, n: lista.length, min };
}
const TIPO_FERMO = { ispezione: 'Ispezione fermata', linea: 'Nessuna cassetta' };
function tabellaFermi(lista, { mostraProdotto = true } = {}) {
  if (!lista.length) return '<div class="vuoto">Nessun fermo nel periodo scelto.</div>';
  const tot = lista.reduce((s, f) => s + fineF(f) - f.da, 0);
  return `<div class="scroll-x"><table class="tabella"><thead><tr><th>Giorno</th><th>Dalle</th><th>Alle</th><th>Durata</th><th class="sx">Motivo</th>${mostraProdotto ? '<th class="sx">Prodotto</th>' : ''}<th class="sx">Turno</th></tr></thead><tbody>
    ${lista.slice().reverse().map(f => { const T = SMI.turnoDi(f.da); const lungo = fineF(f) - f.da >= 15 * 60e3; return `<tr><td>${giornoCorto(f.da)}</td><td>${SMI.fmtOra(f.da)}</td><td>${f.a ? SMI.fmtOra(f.a) : '<span class="live-badge rosso">IN CORSO</span>'}</td><td class="${lungo ? 'r' : ''}"><b>${durataDa(fineF(f) - f.da)}</b></td><td style="text-align:left"><span class="tipo-f ${f.tipo}">${TIPO_FERMO[f.tipo]}</span></td>${mostraProdotto ? `<td style="text-align:left;text-transform:capitalize">${esc(f.prodotto || '—')}</td>` : ''}<td style="text-align:left">${T.nome} ${giornoCorto(T.giorno)}</td></tr>`; }).join('')}
  </tbody><tfoot><tr><td colspan="3"><b>${lista.length} fermi</b></td><td><b>${durataDa(tot)}</b></td><td colspan="${mostraProdotto ? 3 : 2}"></td></tr></tfoot></table></div>
  <div class="nota"><b>Ispezione fermata</b>: l'operatore ha fermato l'ispezione (dal file event.log). <b>Nessuna cassetta</b>: ispezione attiva ma nessuna cassetta per almeno 2 minuti (dai file system_event_trace e, in diretta, da analysis_time.log). I riavvii più brevi di 1 minuto non sono contati.</div>`;
}
// barra del tempo: produzioni in blu, fermi in rosso
function lineaTempo(da, a, produzioni, fermi, cambi = []) {
  const L = a - da; if (L <= 0) return '';
  const pos = t => Math.max(0, Math.min(100, (t - da) / L * 100));
  const seg = (x, y, cls, tit) => { const l = pos(x), w = pos(y) - l; return w > 0 ? `<i class="${cls}" style="left:${l}%;width:${Math.max(w, .35)}%" title="${esc(tit)}"></i>` : ''; };
  let h = '';
  for (const p of produzioni) h += seg(p.inizio, p.fine, 'p', `${p.prodotto} ${SMI.fmtOra(p.inizio)}–${SMI.fmtOra(p.fine)}`);
  for (const f of fermi) h += seg(f.da, fineF(f), 'f', `Fermo ${SMI.fmtOra(f.da)}–${f.a ? SMI.fmtOra(f.a) : 'in corso'} · ${durataDa(fineF(f) - f.da)} · ${TIPO_FERMO[f.tipo]}`);
  for (const c of cambi) h += seg(c.da, fineC(c), 'c', `Cambio prodotto ${c.dal} → ${c.al} · ${SMI.fmtOra(c.da)}–${c.a ? SMI.fmtOra(c.a) : 'in corso'} · ${durataDa(fineC(c) - c.da)}`);
  const tacche = []; const passo = L > 36 * 3600e3 ? 6 * 3600e3 : L > 12 * 3600e3 ? 2 * 3600e3 : L > 4 * 3600e3 ? 3600e3 : 30 * 60e3;
  for (let t = Math.ceil(da / passo) * passo; t <= a; t += passo) tacche.push(`<span style="left:${pos(t)}%">${SMI.fmtOra(t)}</span>`);
  return `<div class="tempo"><div class="tempo-barra">${h}</div><div class="tempo-tacche">${tacche.join('')}</div></div>
    <div class="legenda" style="margin-top:8px"><span><i style="background:var(--blue)"></i>In produzione</span><span><i style="background:var(--crit)"></i>Fermo</span><span><i style="background:var(--warn)"></i>Cambio prodotto</span><span><i style="background:rgba(255,255,255,.12)"></i>Nessuna produzione (non conta)</span></div>`;
}
function cardFermiOggi() {
  const m = S.modello; if (!m?.stato) return '';
  const r = rif(), T = SMI.turnoDi(r), da = T.giorno + 6 * 3600e3, a = da + 24 * 3600e3;
  const fermi = tuttiIFermi().filter(f => fineF(f) > da && f.da < a);
  const clip = f => Math.min(fineF(f), Math.min(a, r)) - Math.max(f.da, da);
  const tot = fermi.reduce((s, f) => s + Math.max(0, clip(f)), 0);
  const lungo = fermi.reduce((b, f) => !b || clip(f) > clip(b) ? f : b, null);
  const prod = m.produzioni.filter(p => p.fine > da && p.inizio < a).map(p => ({ ...p, fine: fineProd(p) }));
  const cambi = tuttiICambi().filter(c => fineC(c) > da && c.da < a);
  const totC = cambi.reduce((s, c) => s + Math.max(0, Math.min(fineC(c), a, r) - Math.max(c.da, da)), 0);
  return `<section class="vetro card" style="margin-bottom:16px">
    <h2>Fermi e cambi di oggi <span class="chip">${giornoCorto(T.giorno)} · 06:00 → 06:00</span><span class="spazio"></span><button class="btn" id="vediFermi" style="text-transform:none;letter-spacing:0">Tutti i fermi ›</button></h2>
    <div class="turno-kpi kpi-fermi" style="margin-top:0;margin-bottom:16px">
      <div class="mini"><div class="lab">Numero di fermi</div><div class="val">${fermi.length}</div></div>
      <div class="mini"><div class="lab">Tempo totale fermo</div><div class="val r">${durataDa(tot)}</div></div>
      <div class="mini"><div class="lab">Fermo più lungo</div><div class="val">${lungo ? durataDa(clip(lungo)) : '—'}</div>${lungo ? `<div class="lab">${SMI.fmtOra(lungo.da)} · ${TIPO_FERMO[lungo.tipo].toLowerCase()}</div>` : ''}</div>
      <div class="mini"><div class="lab">Cambi prodotto</div><div class="val" style="color:#ffe2a6">${cambi.length}${cambi.length ? ` <span style="font-size:13px;color:var(--text-2)">${durataDa(totC)}</span>` : ''}</div>${cambi.length ? `<div class="lab" style="text-transform:capitalize">ultimo: ${esc(cambi[cambi.length - 1].al)}</div>` : ''}</div>
    </div>
    ${lineaTempo(da, a, prod, fermi, cambi)}
    ${(() => { const ev = [...fermi.map(f => ({ ...f, k: 'f' })), ...cambi.map(c => ({ ...c, k: 'c' }))].sort((x, y) => x.da - y.da).slice(-6).reverse();
      return ev.length ? `<div class="fermi-recenti">${ev.map(e => e.k === 'f'
        ? `<div class="allarme"><span class="ora">${SMI.fmtOra(e.da)} → ${e.a ? SMI.fmtOra(e.a) : 'adesso'}</span><span><b>${durataDa(fineF(e) - e.da)}</b> · ${TIPO_FERMO[e.tipo]}</span><span class="conta" style="text-transform:capitalize;font-weight:500">${esc(e.prodotto || '')}</span></div>`
        : `<div class="allarme cambio"><span class="ora">${SMI.fmtOra(e.da)} → ${e.a ? SMI.fmtOra(e.a) : 'adesso'}</span><span><b>${durataDa(fineC(e) - e.da)}</b> · Cambio prodotto</span><span class="conta" style="text-transform:capitalize;font-weight:500">${esc(e.dal)} → ${esc(e.al)}</span></div>`).join('')}</div>` : ''; })()}
  </section>`;
}
function tabellaCambi(lista) {
  if (!lista.length) return '<div class="vuoto">Nessun cambio prodotto nel periodo scelto.</div>';
  const tot = lista.reduce((s, c) => s + fineC(c) - c.da, 0);
  return `<div class="scroll-x"><table class="tabella"><thead><tr><th>Giorno</th><th>Dalle</th><th>Alle</th><th>Durata</th><th class="sx">Da prodotto</th><th class="sx">A prodotto</th><th>Scelto alle</th><th class="sx">Turno</th></tr></thead><tbody>
    ${lista.slice().reverse().map(c => { const T = SMI.turnoDi(c.da); return `<tr><td>${giornoCorto(c.da)}</td><td>${SMI.fmtOra(c.da)}</td><td>${c.a ? SMI.fmtOra(c.a) : '<span class="live-badge giallo">IN CORSO</span>'}</td><td><b>${durataDa(fineC(c) - c.da)}</b></td><td style="text-align:left;text-transform:capitalize">${esc(c.dal)}</td><td style="text-align:left;text-transform:capitalize"><b>${esc(c.al)}</b></td><td>${c.ts ? SMI.fmtOra(c.ts) : '—'}</td><td style="text-align:left">${T.nome} ${giornoCorto(T.giorno)}</td></tr>`; }).join('')}
  </tbody><tfoot><tr><td colspan="3"><b>${lista.length} cambi</b></td><td><b>${durataDa(tot)}</b></td><td colspan="4"></td></tr></tfoot></table></div>
  <div class="nota">Il cambio va dall'<b>ultima cassetta del vecchio prodotto</b> alla <b>prima cassetta del nuovo</b> e nell'OEE conta come fermo. Se la linea è rimasta spenta più di 4 ore (per esempio nel weekend), il cambio parte da quando è stato scelto il nuovo prodotto.</div>`;
}
function elencoCambi() {
  const r = rif();
  const lim = { oggi: SMI.turnoDi(r).giorno + 6 * 3600e3, '7': r - 7 * 864e5, '30': r - 30 * 864e5, tutto: -Infinity }[S.periodo];
  let l = tuttiICambi().filter(c => fineC(c) >= lim);
  if (S.prodotto) l = l.filter(c => c.al === S.prodotto || c.dal === S.prodotto);
  return tabellaCambi(l);
}
function elencoFermi() {
  const r = rif();
  const lim = { oggi: SMI.turnoDi(r).giorno + 6 * 3600e3, '7': r - 7 * 864e5, '30': r - 30 * 864e5, tutto: -Infinity }[S.periodo];
  let l = tuttiIFermi().filter(f => fineF(f) >= lim);
  if (S.prodotto) l = l.filter(f => f.prodotto === S.prodotto);
  return tabellaFermi(l);
}

/* ==========================================================================
   OEE PER TURNO
   OEE = Disponibilità × Prestazione × Qualità
     Disponibilità = tempo in produzione senza fermi / tempo del turno trascorso
     Prestazione   = cassette contate / (tempo in produzione × 24 al minuto)
     Qualità       = cassette buone / cassette contate
   ========================================================================== */
function oeeTurno(key) {
  const m = S.modello; const [g, n] = key.split('_');
  const T = SMI.turnoDi(Date.parse(g + 'T00:00:00Z') + ({ 1: 7, 2: 15, 3: 23 })[n] * 3600e3);
  const r = rif(), da = T.inizio, a = Math.min(T.fine, r);
  if (a <= da) return { futuro: true, T };
  let t = 0, rej = 0; const prod = new Set();
  for (const p of m.produzioni) for (const tt of p.turni) if (tt.key === key) { t += tt.t; rej += tt.r; prod.add(p.prodotto); }
  if (inDiretta() && SMI.turnoDi(r).key === key && S.vivo?.extra?.cassette) { t += S.vivo.extra.cassette; rej += Math.min(S.vivo.extra.scarti || 0, S.vivo.extra.cassette); }
  const cIn = cambioInCorso(); if (cIn && SMI.turnoDi(r).key === key) prod.add(cIn.al);
  const F = finestre().filter(([x, y]) => y > da && x < a);
  const fermi = tuttiIFermi().filter(f => fineF(f) > da && f.da < a);
  const cambi = tuttiICambi().filter(c => fineC(c) > da && c.da < a);
  // minuto per minuto: è programmato? è fermo / cambio?
  let pianificato = 0, fermo = 0, cambio = 0;
  for (let x = da; x < a; x += 60e3) {
    const c = x + 30e3; if (!dentro(c, F)) continue;
    pianificato++;
    if (cambi.some(k => c >= k.da && c < fineC(k))) cambio++;
    else if (fermi.some(f => c >= f.da && c < fineF(f))) fermo++;
  }
  if (!pianificato) return { T, key, t, r: rej, prod, vuoto: true, pianificato: 0, inProd: 0, fermoMin: 0, cambioMin: 0 };
  const inProd = pianificato - fermo - cambio;
  const A = inProd / pianificato;
  const P = inProd ? t / (inProd * SMI.VELOCITA_STD) : 0;
  const Q = t ? (t - rej) / t : 0;
  return { T, key, t, r: rej, prod, pianificato, inProd, fermoMin: fermo, cambioMin: cambio, A, P, Q, oee: A * P * Q, inCorso: r < T.fine };
}
const classeOee = v => v >= .85 ? 'buono' : v >= .65 ? 'medio' : 'basso';
const pct0 = v => Math.round((v || 0) * 100) + '%';

/* ==========================================================================
   VISTA DASHBOARD
   ========================================================================== */
function produzioniFiltrate() {
  const m = S.modello, r = rif();
  let p = m.produzioni.slice();
  if (!S.prove) p = p.filter(x => x.t >= SMI.CASSETTE_PER_PEDANA);
  if (S.prodotto) p = p.filter(x => x.prodotto === S.prodotto);
  const lim = { oggi: SMI.turnoDi(r).giorno, '7': r - 7 * 864e5, '30': r - 30 * 864e5, tutto: -Infinity }[S.periodo];
  return p.filter(x => x.fine >= lim);
}
function conLive(p, isUltima) {
  if (!isUltima || !S.vivo?.extra?.cassette || S.modo === 'demo' || S.modo === 'file' || cambioInCorso()) return p;
  const sc = Math.min(S.vivo.extra.scarti || 0, S.vivo.extra.cassette);
  return { ...p, t: p.t + S.vivo.extra.cassette, extraLive: S.vivo.extra.cassette, r: p.r + sc, scartiLive: S.vivo.extra.scarti != null ? sc : null };
}

function vistaDashboard() {
  const m = S.modello;
  if (!m || !m.produzioni) return `<div class="centro"><div class="vetro card" style="max-width:520px;text-align:center"><h2 style="justify-content:center">Nessun dato</h2><p class="nota">Il lettore sul PC della linea non ha ancora inviato dati. Apri <b>#lettore</b> su quel PC, oppure carica i file a mano dal menu.</p></div></div>`;
  const r = rif();
  const tutte = m.produzioni.filter(x => x.t >= 1);
  let ultimaRaw = tutte[tutte.length - 1];
  const cIn = cambioInCorso(), precedente = cIn ? ultimaRaw : null;
  if (cIn) ultimaRaw = { id: '__nuova', nuova: true, prodotto: cIn.al, inizio: cIn.a || cIn.ts, fine: rif(), t: cIn.cassette, r: 0, s: 0, re: 0, u: 0, setupT: 0, setupR: 0, marciaMin: cIn.a ? (rif() - cIn.a) / 60e3 : 0, turni: [], ore: [], fermi: 0, cambiImpostazioni: [], extraLive: cIn.cassette };
  const ultima = ultimaRaw ? conLive(ultimaRaw, true) : null;
  const inMarcia = !statoLinea().ferma;
  const vel = velocitaAttuale(m);
  const banner = S.modo === 'demo'
    ? `<div class="vetro banner"><span class="chip info">Anteprima</span><span>Dati reali dai log che mi hai mandato, fermi al <b>${SMI.fmtData(m.fineDati)} ${SMI.fmtOra(m.fineDati)}</b>. Una volta collegato il lettore, la pagina si aggiorna da sola.</span></div>`
    : S.modo === 'file' ? `<div class="vetro banner"><span class="chip info">File caricati</span><span>Stai guardando i file caricati a mano, con dati fino al <b>${SMI.fmtData(m.fineDati)} ${SMI.fmtOra(m.fineDati)}</b>.</span></div>` : '';

  // --- produzione corrente/ultima
  let hero = '';
  if (ultima) {
    const scartiNetti = ultima.r - ultima.setupR, totNetti = ultima.t - ultima.setupT;
    const resa = ultima.marciaMin > 0 ? ultima.t / (ultima.marciaMin * SMI.VELOCITA_STD) : 0;
    const velMedia = ultima.marciaMin > 0 ? ultima.t / ultima.marciaMin : 0;
    const resto = ultima.t % SMI.CASSETTE_PER_PEDANA;
    const v = vel && (inMarcia || S.modo === 'demo') ? vel.v : velMedia;
    const velCls = v >= 22 ? '' : v >= 18 ? 'bassa' : 'critica';
    hero = `
    <section class="vetro card">
      <h2>${ultima.nuova ? 'Nuovo prodotto' : inMarcia ? 'Produzione in corso' : 'Ultima produzione'}${ultima.nuova ? '<span class="spazio"></span><span class="chip giallo">In avvio</span>' : ''}</h2>
      <div id="statoLinea">${htmlStatoLinea()}</div>${avvisoEspulsione()}
      <div class="prodotto-nome">${esc(ultima.prodotto)}</div>
      ${ultima.nuova
        ? `<div class="sotto"><span>Scelto ${giornoLungo(cIn.ts)} alle ${SMI.fmtOra(cIn.ts)}</span><span>·</span><span style="text-transform:none">prima: <b style="text-transform:capitalize;color:var(--text-1)">${esc(precedente.prodotto)}</b>, ${n0(precedente.t)} cassette, finita alle ${SMI.fmtOra(precedente.fine)}</span></div>`
        : `<div class="sotto"><span>Iniziata ${giornoLungo(ultima.inizio)} alle ${SMI.fmtOra(ultima.inizio)}</span><span>·</span><span>In marcia ${durata(ultima.marciaMin)}</span><span>·</span><span>${(() => { const f = fermiDi(ultima); return `${f.n} fermi (${durata(f.min)})`; })()}</span></div>`}
      <div class="kpi">
        <div class="tile"><div class="lab">Cassette contate</div><div class="val">${n0(ultima.t)}</div><div class="det">${ultima.nuova ? 'dalla prima cassetta del nuovo prodotto' : `contatori SMI delle ${m.stato?.ultimiContatoriTs ? SMI.fmtOra(m.stato.ultimiContatoriTs) : '—'}${ultima.extraLive ? ` + ≈${n0(ultima.extraLive)} in diretta` : ''}`}</div></div>
        <div class="tile scarti"><div class="lab">Cassette scartate</div><div class="val">${n0(ultima.r)}<small>${pc(ultima.r, ultima.scartiLive != null ? ultima.t : ultimaRaw.t)}</small></div><div class="det">${ultima.setupT ? `${pc(scartiNetti, totNetti)} senza avviamento` : `Amido ${n0(ultima.s)} · Residui ${n0(ultima.re)}`}<br><span style="color:var(--text-3)">${ultima.scartiLive != null ? `contatori delle ${m.stato?.ultimiContatoriTs ? SMI.fmtOra(m.stato.ultimiContatoriTs) : '—'} + ≈${n0(ultima.scartiLive)} in diretta (foto degli scarti)` : `aggiornati alle ${m.stato?.ultimiContatoriTs ? SMI.fmtOra(m.stato.ultimiContatoriTs) : '—'} (ogni ora)`}</span></div></div>
        <div class="tile"><div class="lab">Pedane</div><div class="val">${n0(SMI.pedane(ultima.t))}<small>+ ${resto}/80</small></div><div class="barra"><i style="width:${resto / 80 * 100}%"></i></div></div>
        <div class="tile"><div class="lab">Velocità</div><div class="val">${n1(v)}<small>/min</small></div><div class="barra vel ${velCls}"><i style="width:${Math.min(100, v / SMI.VELOCITA_STD * 100)}%"></i></div><div class="det">${vel && (inMarcia || S.modo === 'demo') ? vel.fonte : 'media produzione'} · resa ${Math.round(resa * 100)}%</div></div>
      </div>
      <div class="nota">Clicca sulla produzione nell'elenco qui sotto per vedere andamento, turni e <b>parametri di analisi</b>.</div>
    </section>`;
  }

  // --- turno
  const T = SMI.turnoDi(r);
  const turni3 = [1, 2, 3].map(n => ({ n, ...oeeTurno(`${SMI.isoGiorno(T.giorno)}_${n}`), nome: SMI.TURNI[n - 1].nome, orario: n === 1 ? '06–14' : n === 2 ? '14–22' : '22–06' }));
  const tc = turni3[T.n - 1];
  const barraApq = (lab, v, tit) => `<div class="apq" title="${esc(tit)}"><div class="apq-t"><span>${lab}</span><b>${pct0(v)}</b></div><div class="barra"><i style="width:${Math.min(100, v * 100)}%"></i></div></div>`;
  const turno = `
    <section class="vetro card turno-box">
      <h2>Turno ${inDiretta() ? 'attuale' : 'del momento'}<span class="spazio"></span><span class="chip">${giornoCorto(T.giorno)}</span></h2>
      <div class="turno-testa">
        <div><div class="grande">${tc.nome} <span style="color:var(--text-3);font-weight:500">${tc.orario}</span></div>
          <div class="sotto" style="text-transform:capitalize">${tc.prod?.size ? [...tc.prod].map(esc).join(', ') : 'Nessuna produzione in questo turno'}</div></div>
        <div class="oee-grande ${!tc.vuoto && !tc.futuro ? classeOee(tc.oee) : ''}"><span>OEE</span><b>${!tc.vuoto && !tc.futuro ? pct0(tc.oee) : '—'}</b></div>
      </div>
      <div class="turno-kpi">
        <div class="mini"><div class="lab">Cassette</div><div class="val">${n0(tc.t)}</div></div>
        <div class="mini"><div class="lab">Scarti</div><div class="val r">${n0(tc.r)} <span style="font-size:13px;color:var(--text-2)">${pc(tc.r, tc.t)}</span></div></div>
        <div class="mini"><div class="lab">Pedane</div><div class="val">${n0(SMI.pedane(tc.t))}</div></div>
      </div>
      ${!tc.vuoto && !tc.futuro ? `<div class="apq-riga">
        ${barraApq('Disponibilità', tc.A, `In produzione ${durata(tc.inProd)} su ${durata(tc.pianificato)} programmati · fermi ${durata(tc.fermoMin)} · cambi ${durata(tc.cambioMin)}`)}
        ${barraApq('Prestazione', tc.P, `${n0(tc.t)} cassette su ${n0(tc.inProd * 24)} possibili a 24/min`)}
        ${barraApq('Qualità', tc.Q, `${n0(tc.t - tc.r)} buone su ${n0(tc.t)}`)}
      </div>` : ''}
      <div class="nota">Obiettivo del turno: <b>${n0(SMI.VELOCITA_STD * 480)}</b> cassette (24/min × 8 h) = <b>${SMI.VELOCITA_STD * 480 / 80}</b> pedane · fatto <b>${pct0(tc.t / (SMI.VELOCITA_STD * 480))}</b>.</div>
      <div class="trio-turni">${turni3.map(t => `<div class="t ${t.n === T.n ? 'att' : ''} ${t.futuro ? 'futuro' : ''}">
          <div class="t-testa"><b class="t-nome">${t.nome}</b><span>${t.orario}</span></div>
          <div class="t-val">${t.futuro ? '—' : n0(t.t)}</div><div class="t-lab">cassette${t.futuro ? '' : ' · ' + n0(SMI.pedane(t.t)) + ' pedane'}</div>
          <div class="t-riga"><span>Scarti</span><b>${t.t ? pc(t.r, t.t) : '—'}</b></div>
          <div class="t-riga"><span>Fermo</span><b>${t.futuro || t.vuoto ? '—' : durata(t.fermoMin)}</b></div>
          <div class="t-riga"><span>Cambi</span><b>${t.futuro || t.vuoto ? '—' : durata(t.cambioMin)}</b></div>
          <div class="t-oee ${!t.vuoto && !t.futuro ? classeOee(t.oee) : ''}"><span>OEE</span><b>${t.vuoto ? '<small>nessuna produzione</small>' : t.futuro ? '—' : pct0(t.oee)}</b></div>
          ${!t.vuoto && !t.futuro ? `<div class="barra oee ${classeOee(t.oee)}"><i style="width:${Math.min(100, t.oee * 100)}%"></i></div>` : ''}
        </div>`).join('')}</div>
    </section>`;

  // --- grafici ultime 24 h
  const graf = `
  <div class="grafici">
    <section class="vetro card"><h2>Cassette per ora · ultime 24 h</h2>
      <div class="legenda"><span><i style="background:var(--blue)"></i>Buone</span><span><i style="background:var(--crit)"></i>Scartate</span></div>
      <div class="chart" id="gOre"></div></section>
    <section class="vetro card"><h2>Velocità linea · ultime 12 h</h2>
      <div class="legenda"><span><i class="linea" style="background:var(--aqua)"></i>Cassette al minuto</span><span><i class="linea" style="background:rgba(255,255,255,.5)"></i>Standard 24/min</span></div>
      <div class="chart" id="gVel"></div></section>
  </div>`;

  // --- elenco
  const prodotti = [...new Set(m.produzioni.map(p => p.prodotto))].sort((a, b) => a.localeCompare(b));
  const lista = `
  <section class="vetro card">
    <h2>Produzioni</h2>
    <div class="barra-filtri">
      <div class="seg" id="fVista">${[['produzioni', 'Produzioni'], ['turni', 'Per turno'], ['fermi', 'Fermi'], ['cambi', 'Cambi prodotto'], ['parametri', 'Parametri']].map(([k, l]) => `<button data-v="${k}" class="${S.vista === k ? 'att' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" id="fPeriodo">${[['oggi', 'Oggi'], ['7', '7 giorni'], ['30', '30 giorni'], ['tutto', 'Tutto']].map(([k, l]) => `<button data-p="${k}" class="${S.periodo === k ? 'att' : ''}">${l}</button>`).join('')}</div>
      ${tendinaProdotti(prodotti)}
      <span class="spazio"></span>
      <label class="switch" title="Mostra anche le prove con meno di una pedana (80 cassette)"><input type="checkbox" id="fProve" ${S.prove ? 'checked' : ''}><i></i>Mostra prove</label>
    </div>
    <div id="elenco">${S.vista === 'turni' ? elencoTurni() : S.vista === 'fermi' ? elencoFermi() : S.vista === 'cambi' ? elencoCambi() : S.vista === 'parametri' ? elencoParametri() : elencoProduzioni()}</div>
  </section>`;

  return banner + `<div class="hero">${hero}${turno}</div>` + cardFermiOggi() + graf + lista;
}

function tendinaProdotti(prodotti) {
  const m = S.modello, conta = {};
  for (const p of m.produzioni) if (p.t >= SMI.CASSETTE_PER_PEDANA) { const c = conta[p.prodotto] || (conta[p.prodotto] = { n: 0, t: 0, ult: 0 }); c.n++; c.t += p.t; c.ult = Math.max(c.ult, p.fine); }
  const ord = prodotti.filter(p => conta[p]).sort((a, b) => conta[b].ult - conta[a].ult);
  const voce = (val, nome, det) => `<button type="button" class="td-voce ${val === S.prodotto ? 'att' : ''}" data-val="${esc(val)}"><span class="td-nome" style="text-transform:${val ? 'capitalize' : 'none'}">${esc(nome)}</span><span class="td-det">${det}</span>${val === S.prodotto ? ICONE.ok : ''}</button>`;
  return `<div class="tendina" id="tendina">
    <button type="button" class="td-bottone" id="tdBottone" aria-haspopup="listbox">
      <span class="td-etich">Prodotto</span><span class="td-scelta" style="text-transform:${S.prodotto ? 'capitalize' : 'none'}">${S.prodotto ? esc(S.prodotto) : 'Tutti i prodotti'}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="td-pannello vetro" role="listbox">
      <input type="search" class="td-cerca" placeholder="Cerca prodotto…" autocomplete="off">
      <div class="td-lista">
        ${voce('', 'Tutti i prodotti', `${ord.length} prodotti`)}
        <div class="td-tit">Ordinati per ultima produzione</div>
        ${ord.map(p => voce(p, p, `${conta[p].n} prod. · ultima ${giornoCorto(conta[p].ult)}`)).join('')}
      </div>
    </div>
  </div>`;
}
function collegaTendina() {
  const t = $('#tendina'); if (!t) return;
  const cerca = t.querySelector('.td-cerca');
  $('#tdBottone').onclick = e => { e.stopPropagation(); t.classList.toggle('aperta'); if (t.classList.contains('aperta')) setTimeout(() => cerca.focus(), 30); };
  t.querySelector('.td-pannello').onclick = e => { e.stopPropagation(); const v = e.target.closest('.td-voce'); if (v) { S.prodotto = v.dataset.val; render(); } };
  cerca.oninput = () => { const q = cerca.value.toLowerCase(); t.querySelectorAll('.td-voce').forEach(v => v.style.display = !q || v.dataset.val === '' || v.dataset.val.toLowerCase().includes(q) ? '' : 'none'); };
  document.addEventListener('click', () => t.classList.remove('aperta'), { once: true });
  cerca.onkeydown = e => { if (e.key === 'Escape') t.classList.remove('aperta'); if (e.key === 'Enter') { const v = [...t.querySelectorAll('.td-voce')].find(x => x.style.display !== 'none' && x.dataset.val); if (v) { S.prodotto = v.dataset.val; render(); } } };
}

function elencoProduzioni() {
  const lista = produzioniFiltrate();
  if (!lista.length) return '<div class="vuoto">Nessuna produzione nel periodo scelto.</div>';
  const cIn = cambioInCorso();
  const ultimaId = cIn ? null : S.modello.produzioni.filter(x => x.t >= 1).slice(-1)[0]?.id;
  const perGiorno = new Map(); let primo = true;
  for (const p of lista.slice().reverse()) { const g = SMI.turnoDi(p.inizio).giorno; if (!perGiorno.has(g)) perGiorno.set(g, []); perGiorno.get(g).push(p); }
  let h = '';
  for (const [g, ps] of perGiorno) {
    const tot = ps.reduce((s, p) => s + p.t, 0), rej = ps.reduce((s, p) => s + p.r, 0);
    const gl = giornoLungo(g); h += `<div class="giorno-tit">${gl[0].toUpperCase() + gl.slice(1)} <span>${n0(tot)} cassette · ${n0(SMI.pedane(tot))} pedane · ${pc(rej, tot)} scarti</span></div>`;
    if (cIn && primo && (!S.prodotto || S.prodotto === cIn.al)) h += `<div class="vetro prod nuova-prod"><div class="principale"><div class="nome">${esc(cIn.al)} <span class="live-badge giallo">IN AVVIO</span></div><div class="quando">nuovo prodotto scelto alle ${SMI.fmtOra(cIn.ts)} · cambio da ${esc(cIn.dal)} ${cIn.inCorso ? 'in corso da ' + durataDa(rif() - cIn.da) : 'durato ' + durataDa(cIn.a - cIn.da)}</div></div><div class="c"><div class="lab">Cassette</div><div class="v">${n0(cIn.cassette)}</div></div><div class="c"></div><div class="c"></div><div class="c"></div><div class="turni-chip"></div><div class="freccia"></div></div>`;
    primo = false;
    for (const p0 of ps) {
      const live = p0.id === ultimaId; const p = conLive(p0, live);
      const vivo = live && (S.modello.stato?.inMarcia) && S.modo !== 'demo' && S.modo !== 'file';
      const resa = p.marciaMin ? Math.round(p.t / (p.marciaMin * SMI.VELOCITA_STD) * 100) : 0;
      h += `<div class="vetro prod" data-id="${esc(p.id)}">
        <div class="principale"><div class="nome">${esc(p.prodotto)} ${vivo ? '<span class="live-badge">IN CORSO</span>' : ''}</div><div class="quando">${giornoCorto(p.inizio)} ${SMI.fmtOra(p.inizio)} → ${SMI.isoGiorno(p.inizio) !== SMI.isoGiorno(p.fine) ? giornoCorto(p.fine) + ' ' : ''}${SMI.fmtOra(p.fine)} · ${durata(p.marciaMin)} in marcia${p.escluse ? ` · <span title="Periodi esclusi dal conteggio">✂︎ ${n0(p.escluse.t)} escluse</span>` : ''}</div></div>
        <div class="c"><div class="lab">Cassette</div><div class="v">${n0(p.t)}</div></div>
        <div class="c"><div class="lab">Scarti</div><div class="v r">${n0(p.r)} <span style="font-size:12px;color:var(--text-2);font-weight:500">${pc(p.r, p0.t)}</span></div></div>
        <div class="c"><div class="lab">Pedane</div><div class="v">${n0(SMI.pedane(p.t))}</div></div>
        <div class="c"><div class="lab">Resa vel.</div><div class="v">${resa}%</div></div>
        <div class="turni-chip">${p.turni.map(t => `<span class="tchip">${t.nome.slice(0, 3)} ${giornoCorto(t.giorno)} <b>${n0(t.t)}</b></span>`).join('')}</div>
        <div class="freccia">›</div>
      </div>`;
    }
  }
  return h;
}

function elencoTurni() {
  const lista = produzioniFiltrate();
  const turni = new Map();
  for (const p of lista) for (const t of p.turni) {
    const o = turni.get(t.key) || { key: t.key, giorno: t.giorno, n: t.n, nome: t.nome, t: 0, r: 0, marcia: 0, prodotti: [] };
    o.t += t.t; o.r += t.r; o.marcia += t.marciaMin; o.prodotti.push({ id: p.id, nome: p.prodotto, t: t.t }); turni.set(t.key, o);
  }
  const righe = [...turni.values()].sort((a, b) => b.key.localeCompare(a.key));
  if (!righe.length) return '<div class="vuoto">Nessun turno nel periodo scelto.</div>';
  return `<div class="scroll-x"><table class="tabella"><thead><tr><th>Turno</th><th class="sx">Prodotti</th><th>Cassette</th><th>Scarti</th><th>%</th><th>Pedane</th><th>In marcia</th><th>Resa vel.</th><th title="OEE di tutto il turno">OEE turno</th></tr></thead><tbody>
  ${righe.map(o => `<tr class="clic" data-id="${esc(o.prodotti.sort((a, b) => b.t - a.t)[0].id)}"><td><b>${o.nome}</b> <span style="color:var(--text-3)">${giornoCorto(o.giorno)}</span></td><td style="text-align:left;white-space:normal;text-transform:capitalize">${[...new Set(o.prodotti.map(x => x.nome))].map(esc).join(', ')}</td><td>${n0(o.t)}</td><td class="r">${n0(o.r)}</td><td>${pc(o.r, o.t)}</td><td>${n0(SMI.pedane(o.t))}</td><td>${durata(o.marcia)}</td><td>${o.marcia ? Math.round(o.t / (o.marcia * 24) * 100) : 0}%</td><td>${(() => { const x = oeeTurno(o.key); return !x.vuoto && !x.futuro ? `<span class="oee-chip ${classeOee(x.oee)}">${pct0(x.oee)}</span>` : '—'; })()}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function collegaDashboard() {
  const m = S.modello; if (!m?.produzioni) return;
  const r = rif();
  const gO = $('#gOre'); if (gO) montaGrafico(gO, el => graficoBarre(el, orarie(m.produzioni, r - 24 * 3600e3, r)));
  const gV = $('#gVel'); if (gV) montaGrafico(gV, el => graficoLinea(el, puntiVelocita(m, m.produzioni, r - 12 * 3600e3, r), { da: r - 12 * 3600e3, a: r }));
  $('#fPeriodo')?.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.periodo = b.dataset.p; render(); });
  if (S.vista === 'parametri') disegnaGraficoParametri();
  document.querySelectorAll('[data-prodpar]').forEach(b => b.onclick = () => { S.prodotto = b.dataset.prodpar; render(); });
  $('#fVista')?.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.vista = b.dataset.v; render(); });
  collegaTendina();
  $('#fProve')?.addEventListener('change', e => { S.prove = e.target.checked; render(); });
  $('#vediFermi')?.addEventListener('click', () => { S.vista = 'fermi'; render(); document.querySelector('#elenco')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#elenco')?.addEventListener('click', e => { const el = e.target.closest('[data-id]'); if (el) apriProduzione(el.dataset.id); });
}

/* ==========================================================================
   FINESTRA PRODUZIONE
   ========================================================================== */
const PARAM_PRINCIPALI = [
  ['GREYLEVEL_THRESHOLD', 'Soglia livello di grigio'],
  ['MINIMUM_DEFECT_SIZE', 'Dimensione minima difetto (px)'],
  ['MINIMUM_SUM_OF_DEFECT_SIZES', 'Somma minima difetti (px)'],
  ['AVERAGE_DIFFERENCE_FACTOR', 'Fattore differenza media'],
  ['ERODE_DILATE_HOR_SIZE', 'Erosione/dilatazione orizzontale'],
  ['ERODE_DILATE_VER_SIZE', 'Erosione/dilatazione verticale'],
  ['ANALYSIS_MATCHING_RANGE_X', 'Range allineamento X'],
  ['ANALYSIS_MATCHING_RANGE_Y', 'Range allineamento Y'],
  ['MAX_SHIFT_X', 'Spostamento massimo X'],
  ['MAX_SHIFT_Y', 'Spostamento massimo Y'],
  ['MAX_ROTATION', 'Rotazione massima (°)'],
  ['m_camera_exposure', 'Esposizione telecamera'],
  ['m_camera_gain', 'Guadagno telecamera'],
  ['RADIUS_MM', 'Raggio prodotto (mm)'],
  ['CAMERA_DISTANCE_MM', 'Distanza telecamera (mm)'],
  ['AUTO_UPDATE_GREYLEVEL_THRESHOLD', 'Auto-update: soglia grigio'],
  ['AUTO_UPDATE_MINIMUM_DEFECT_SIZE', 'Auto-update: difetto minimo'],
  ['m_reject_in_learning_mode', 'Scarta durante il learning (1 = sì)'],
  ['AUTO_STOP_AFTER_LEARNING', 'Stop automatico dopo learning'],
];

/* ---------- periodi esclusi ---------- */
const MOTIVI = { neutre: 'Cassette neutre (ispezione rimasta accesa)', prova: 'Prova / avviamento', altro: 'Altro' };
const dtIn = t => new Date(t).toISOString().slice(0, 16);           // ms "pseudo-UTC" → valore di <input type=datetime-local>
const dtDa = v => v ? Date.parse(v + ':00Z') : NaN;
function aggiornaModello() { S.modello = S.grezzo ? SMI.applicaEsclusioni(S.grezzo, S.esclusioni) : null; }
// anteprima: cosa toglierebbe un periodo dalla produzione grezza
function anteprimaEsclusione(pr, da, a) {
  if (!(a > da)) return null;
  const q = SMI.applicaEsclusioni({ produzioni: [pr], minuti: S.grezzo.minuti || [] }, [{ id: '_', da, a }]).produzioni[0].escluse;
  return q ? q.periodi[0] : { t: 0, r: 0, min: 0 };
}
async function salvaEsclusioni(modifica) {
  if (S.modo === 'remoto') {
    const { data, error } = await sb().from('smi_dati').select('dati').eq('id', 'esclusioni');
    if (error) { toast('Non riesco a leggere i periodi esclusi: ' + esc(error.message)); return false; }
    const lista = modifica((data?.[0]?.dati?.lista || []).slice());
    if (!lista) return false;
    const { error: e2 } = await sb().from('smi_dati').upsert({ id: 'esclusioni', dati: { lista }, aggiornato: new Date().toISOString() });
    if (e2) { toast('Non riesco a salvare: ' + esc(e2.message)); return false; }
    S.esclusioni = lista;
  } else {
    const lista = modifica(S.esclusioni.slice()); if (!lista) return false;
    S.esclusioni = lista;
    try { localStorage.setItem('smi_esclusioni_file', JSON.stringify(lista)); } catch { }
  }
  aggiornaModello(); return true;
}
async function escludiPeriodo(id, da, a, motivo) {
  const ok = await salvaEsclusioni(lista => {
    if (lista.some(x => x.da < a && x.a > da)) { toast('Questo periodo si sovrappone a uno già escluso: ripristina prima quello.'); return null; }
    lista.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), da, a, motivo, chi: S.utente?.email || '', quando: SMI.adesso() });
    return lista;
  });
  if (ok) { toast('Periodo escluso dal conteggio'); render(); apriProduzione(id); }
}
async function ripristinaPeriodo(id, idEscl) {
  if (!confirm('Rimettere nel conteggio le cassette di questo periodo?')) return;
  const ok = await salvaEsclusioni(lista => lista.filter(x => x.id !== idEscl));
  if (ok) { toast('Periodo rimesso nel conteggio'); render(); apriProduzione(id); }
}
function pannelloEsclusioni(p, pr) {
  const sosp = pr ? SMI.periodiSospetti(pr, S.grezzo.minuti || [], S.esclusioni) : [];
  const per = p.escluse?.periodi || [];
  const quando = t => `${giornoCorto(t)} ${SMI.fmtOra(t)}`;
  const daDef = sosp[0]?.da ?? Math.max(p.inizio, p.fine - 15 * 60e3), aDef = sosp[0]?.a ?? p.fine;
  return `<div class="sezione pannello" id="pEscl"><h3>Periodi esclusi dal conteggio</h3>
    ${per.length ? `<div class="nota" style="margin-top:0">Tolte da questa produzione <b>${n0(p.escluse.t)}</b> cassette e <b>${n0(p.escluse.r)}</b> scarti. I numeri sopra sono già senza questi periodi.</div>
      ${per.map(x => `<div class="allarme escl"><span class="ora">${quando(x.da)} → ${SMI.fmtOra(x.a)}</span><span style="flex:1">${esc(MOTIVI[x.motivo] || x.motivo || '')}<br><small style="color:var(--text-3)">${n0(x.t)} cassette · ${n0(x.r)} scarti${x.chi ? ' · ' + esc(x.chi.split('@')[0]) : ''}</small></span><button class="btn" data-rip="${esc(x.id)}">Ripristina</button></div>`).join('')}` : ''}
    ${sosp.map((x, i) => `<div class="allarme escl sospetto">${ICONE.warn}<span style="flex:1"><b>Possibili cassette neutre</b> ${quando(x.da)} → ${SMI.fmtOra(x.a)}<br><small style="color:var(--text-3)">${n0(x.t)} cassette, ${Math.round(100 * x.r / x.t)}% espulse</small></span><button class="btn" data-sosp="${i}">Escludi</button></div>`).join('')}
    <details class="escl-form" ${per.length || sosp.length ? '' : 'open'}><summary>Escludi un periodo a mano</summary>
      <div class="escl-campi">
        <label class="campo">Da<input type="datetime-local" step="60" id="eDa" value="${dtIn(daDef)}"></label>
        <label class="campo">A<input type="datetime-local" step="60" id="eA" value="${dtIn(aDef)}"></label>
        <label class="campo">Motivo<select id="eMot">${Object.entries(MOTIVI).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      </div>
      <div class="escl-piede"><span id="eAnt" class="nota" style="margin:0"></span><button class="btn primario" id="eOk">Escludi periodo</button></div>
    </details>
    <div class="nota">Le cassette e gli scarti del periodo escluso spariscono da produzione, turni e OEE per tutti. Si può sempre ripristinare.</div>
  </div>`;
}
function collegaEsclusioni(p, pr) {
  const box = $('#pEscl'); if (!box) return;
  const sosp = pr ? SMI.periodiSospetti(pr, S.grezzo.minuti || [], S.esclusioni) : [];
  const ant = () => {
    const da = dtDa($('#eDa').value), a = dtDa($('#eA').value), q = pr && anteprimaEsclusione(pr, da, a);
    $('#eAnt').innerHTML = !(a > da) ? '<span style="color:#ffb4ae">L\'orario di fine deve essere dopo l\'inizio</span>' : q ? `In questo periodo: <b>${n0(q.t)}</b> cassette, <b>${n0(q.r)}</b> scarti` : '';
    $('#eOk').disabled = !(a > da);
  };
  ['#eDa', '#eA'].forEach(s => $(s).addEventListener('input', ant)); ant();
  $('#eOk').onclick = () => escludiPeriodo(p.id, dtDa($('#eDa').value), dtDa($('#eA').value), $('#eMot').value);
  box.querySelectorAll('[data-sosp]').forEach(b => b.onclick = () => { const x = sosp[+b.dataset.sosp]; escludiPeriodo(p.id, x.da, x.a, 'neutre'); });
  box.querySelectorAll('[data-rip]').forEach(b => b.onclick = () => ripristinaPeriodo(p.id, b.dataset.rip));
}

function perchéNienteParametri(m, prodotto) {
  const n = Object.keys(m.parametri || {}).length;
  if (n) return `Nessun parametro per <b>${esc(prodotto)}</b> in SMI_ANALYSIS.ini: il prodotto potrebbe essere stato rinominato o tolto dalla lista. Prodotti con parametri: ${Object.keys(m.parametri).filter(k => k !== 'default product').map(esc).join(', ')}.`;
  if (S.modo !== 'remoto') return 'Parametri non disponibili: tra i file caricati manca SMI_ANALYSIS.ini.';
  const v = S.vivo || {}, file = (v.file || []).map(f => f[0]), ini = file.find(f => /smi_analysis\.ini$/i.test(f));
  const errNome = Object.keys(v.erroriFile || {}).find(k => /smi_analysis\.ini$/i.test(k));
  const err = (ini && v.erroriFile?.[ini]) || (errNome && v.erroriFile[errNome]);
  if (!v.file) return 'Parametri non ancora arrivati dal PC della linea.';
  if (!v.app) return 'Parametri non ancora arrivati: il PC della linea ha una versione vecchia della pagina. Si aggiorna da solo entro pochi minuti; se no, ricarica la scheda del lettore.';
  if (!ini && /not allowed|NotAllowed|TypeError/i.test(err || '')) return `Edge non lascia leggere i file <b>.ini</b> (blocco di sicurezza del browser). Sul PC della linea apri una volta il file <b>Attiva_parametri_dashboard.bat</b> (lo trovi nel repository, o chiedilo a chi gestisce la dashboard): copia i parametri in C:\\SMI\\copie_dashboard ogni 5 minuti, in un formato che Edge può leggere.`;
  if (!ini && err) return `Il PC della linea <b>non riesce ad aprire SMI_ANALYSIS.ini</b>: ${esc(err)}`;
  if (!ini) return `Il PC della linea <b>non trova SMI_ANALYSIS.ini</b> nella cartella scelta (file trovati: ${file.length}). Controlla che la cartella del lettore sia C:\\SMI.`;
  if (err) return `Il PC della linea trova SMI_ANALYSIS.ini ma <b>non riesce a leggerlo</b>: ${esc(err)}`;
  if (!v.nParametri) return 'Il PC della linea legge SMI_ANALYSIS.ini ma non riconosce i prodotti: manca EI_SYSTEM.ini o la lista prodotti è vuota.';
  return `Il PC della linea ha letto ${n0(v.nParametri)} prodotti, ma i parametri non sono arrivati qui. Premi Aggiorna; se resta così, avvisami.`;
}

/* ---------- storico parametri e scarti ---------- */
const etichettaParam = k => (PARAM_PRINCIPALI.find(([x]) => x === k) || [])[1] || k;
// modifiche raggruppate per prodotto e momento (una "sessione" di modifica)
function gruppiModifiche(prodotto) {
  const g = new Map();
  for (const m of S.storiaPar) {
    if (prodotto && m.prodotto !== prodotto) continue;
    const k = m.prodotto + '|' + m.t;
    if (!g.has(k)) g.set(k, { t: m.t, prodotto: m.prodotto, stimata: m.stimata, voci: [] });
    g.get(k).voci.push(m);
  }
  return [...g.values()].sort((a, b) => a.t - b.t);
}
// scarti nelle ore di produzione prima e dopo un momento (stesso prodotto, senza learning, max 8 ore per parte)
function scartiAttorno(prodotto, t, fino) {
  const ore = [];
  for (const p of S.modello.produzioni) if (p.prodotto === prodotto) for (const h of p.ore) if (h[2] > 0 && !h[7]) ore.push(h);
  ore.sort((a, b) => a[0] - b[0]);
  const somma = l => l.reduce((o, h) => ({ t: o.t + h[2], r: o.r + h[3] }), { t: 0, r: 0 });
  return { prima: somma(ore.filter(h => h[1] <= t).slice(-8)), dopo: somma(ore.filter(h => h[0] >= t && (!fino || h[1] <= fino)).slice(0, 8)) };
}
const vociHtml = voci => voci.map(v => `<div class="mod-voce"><span>${esc(etichettaParam(v.p))}${v.cam !== '-' && v.cam != null ? ` <small>cam. ${esc(v.cam)}</small>` : ''}</span><span class="mod-val">${esc(v.da ?? '—')} → <b>${esc(v.a ?? '—')}</b></span></div>`).join('');
function confrontoHtml(c) {
  const pa = c.prima.t ? c.prima.r / c.prima.t : null, pd = c.dopo.t ? c.dopo.r / c.dopo.t : null;
  const f = (x, n) => x == null ? '<span style="color:var(--text-3)">—</span>' : `<b>${n1(x * 100)}%</b> <small>su ${n0(n)}</small>`;
  const freccia = pa != null && pd != null ? (pd < pa - .005 ? '<span class="giu">▼</span>' : pd > pa + .005 ? '<span class="su">▲</span>' : '') : '';
  return `<td>${f(pa, c.prima.t)}</td><td>${f(pd, c.dopo.t)} ${freccia}</td>`;
}
function graficoScarti(el, punti, linee) {
  const W = Math.max(280, el.clientWidth), H = 240, mL = 40, mR = 12, mT = 14, mB = 26;
  if (!punti.length) { el.innerHTML = '<div class="vuoto">Nessuna produzione di questo prodotto nel periodo scelto</div>'; return; }
  const t0 = Math.min(...punti.map(p => p.t), ...linee.map(l => l.t)) - 3600e3, t1 = Math.max(...punti.map(p => p.t), ...linee.map(l => l.t)) + 3600e3;
  const { max, passo } = scalaNice(Math.max(5, ...punti.map(p => p.v)) * 1.1);
  const iw = W - mL - mR, ih = H - mT - mB;
  const x = t => mL + (t - t0) / (t1 - t0) * iw, y = v => mT + ih - v / max * ih;
  let g = '<g class="griglia-l">';
  for (let v = 0; v <= max + 1e-9; v += passo) g += `<line x1="${mL}" x2="${W - mR}" y1="${y(v)}" y2="${y(v)}"/>`;
  g += '</g><g class="asse">';
  for (let v = 0; v <= max + 1e-9; v += passo) g += `<text x="${mL - 8}" y="${y(v) + 4}" text-anchor="end">${n0(v)}%</text>`;
  const step = [1, 2, 7, 14, 30].map(d => d * 864e5).find(s => (t1 - t0) / s <= Math.max(2, iw / 80)) || 30 * 864e5;
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) g += `<text x="${x(t)}" y="${H - 6}" text-anchor="middle">${giornoCorto(t)}</text>`;
  g += '</g>';
  const lin = linee.map(l => `<g class="mod-linea"><line x1="${x(l.t)}" x2="${x(l.t)}" y1="${mT}" y2="${mT + ih}"/><title>${esc(l.titolo)}</title></g>`).join('');
  const nMax = Math.max(...punti.map(p => p.n));
  const dots = punti.map(p => `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="${4 + 6 * Math.sqrt(p.n / nMax)}" class="mod-punto"><title>${esc(p.titolo)}</title></circle>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">${g}${lin}${dots}</svg>`;
}
function elencoParametri() {
  const prod = S.prodotto;
  const inizio = S.storiaParDa ? `${giornoCorto(S.storiaParDa)} ${SMI.fmtOra(S.storiaParDa)}` : null;
  const nota = `<div class="nota" style="margin-top:0">Ogni modifica a SMI_ANALYSIS.ini viene registrata dal PC della linea${inizio ? ` (registrazione attiva dal ${inizio})` : ''}. Per ogni modifica: scarti nelle 8 ore di produzione prima e dopo, senza le ore di learning e senza i periodi esclusi.</div>`;
  if (S.modo !== 'remoto' && !S.storiaPar.length) return '<div class="vuoto">Lo storico dei parametri è disponibile solo con i dati dal PC della linea.</div>';
  if (!S.storiaParDa && !S.storiaPar.length) return `<div class="vuoto">Lo storico dei parametri non è ancora attivo: il PC della linea deve leggere SMI_ANALYSIS.ini (vedi la scheda Parametri di analisi in una produzione).</div>`;
  const gruppi = gruppiModifiche(prod);
  if (!prod) {
    const per = new Map(); for (const g of gruppiModifiche()) per.set(g.prodotto, (per.get(g.prodotto) || 0) + 1);
    return `<div class="pannello">${nota}<div class="nota">Scegli un prodotto dalla tendina in alto per vedere il grafico degli scarti con le modifiche.</div>
      ${per.size ? `<div class="turni-chip" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${[...per.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `<button class="tchip" data-prodpar="${esc(p)}" style="cursor:pointer;text-transform:capitalize">${esc(p)} <b>${n}</b></button>`).join('')}</div>` : '<div class="nota">Nessuna modifica registrata finora.</div>'}</div>` + tabellaModifiche(gruppi.slice(-30).reverse(), true);
  }
  return `<div class="pannello">${nota}<h3 style="text-transform:capitalize">${esc(prod)}: scarti per produzione e modifiche ai parametri</h3>
      <div class="legenda"><span><i style="background:var(--crit)"></i>Una produzione (più grande = più cassette)</span><span><i class="linea" style="background:var(--warn)"></i>Modifica ai parametri</span></div>
      <div class="chart" id="gScartiPar"></div></div>` + tabellaModifiche(gruppi.slice().reverse(), false);
}
function tabellaModifiche(gruppi, conProdotto) {
  if (!gruppi.length) return '<div class="vuoto">Nessuna modifica registrata per questo prodotto.</div>';
  const tutti = gruppiModifiche();
  return `<div class="sezione pannello"><h3>Modifiche</h3><div class="scroll-x"><table class="tabella mod-tab"><thead><tr><th>Quando</th>${conProdotto ? '<th>Prodotto</th>' : ''}<th>Cosa è cambiato</th><th>Scarti prima</th><th>Scarti dopo</th></tr></thead><tbody>
    ${gruppi.map(g => { const succ = tutti.find(x => x.prodotto === g.prodotto && x.t > g.t); return `<tr><td>${giornoCorto(g.t)} ${SMI.fmtOra(g.t)}${g.stimata ? ' <small title="Ora stimata: nessun evento in event.log">≈</small>' : ''}</td>${conProdotto ? `<td style="text-transform:capitalize">${esc(g.prodotto)}</td>` : ''}<td>${vociHtml(g.voci)}</td>${confrontoHtml(scartiAttorno(g.prodotto, g.t, succ?.t))}</tr>`; }).join('')}
  </tbody></table></div></div>`;
}
function disegnaGraficoParametri() {
  const el = $('#gScartiPar'); if (!el) return;
  const ps = produzioniFiltrate().filter(p => p.t > 0);
  const punti = ps.map(p => ({ t: (p.inizio + p.fine) / 2, v: 100 * p.r / p.t, n: p.t, titolo: `${giornoCorto(p.inizio)} ${SMI.fmtOra(p.inizio)}–${SMI.fmtOra(p.fine)} · ${n1(100 * p.r / p.t)}% scarti su ${n0(p.t)} cassette` }));
  const da = ps.length ? ps[0].inizio - 864e5 : 0;
  const linee = gruppiModifiche(S.prodotto).filter(g => g.t >= da).map(g => ({ t: g.t, titolo: `${giornoCorto(g.t)} ${SMI.fmtOra(g.t)}: ` + g.voci.map(v => `${etichettaParam(v.p)} ${v.da ?? '—'} → ${v.a ?? '—'}`).join(', ') }));
  montaGrafico(el, e => graficoScarti(e, punti, linee));
}

function fotoHtml(lista) {
  if (S.modo !== 'remoto') return '<div class="vuoto">Le foto degli scarti sono disponibili solo con i dati dal PC della linea.</div>';
  if (!lista.length) return `<div class="vuoto">Nessuna foto di scarti per questa produzione.<br><small>Le foto arrivano solo se il PC della linea legge anche la cartella D:\\images, e solo per gli scarti successivi all'attivazione. Si tengono le ultime ${FOTO_MAX} cassette scartate.</small></div>`;
  return `<div class="nota" style="margin-top:0">${n0(lista.length)} cassette scartate fotografate (le due metà della telecamera affiancate). Clicca per ingrandire.</div>
    <div class="foto-griglia">${lista.map(f => `<figure class="foto" data-foto="${esc(f[1])}"><div class="foto-img"></div><figcaption>${giornoCorto(f[0])} ${SMI.fmtOra(f[0])}</figcaption></figure>`).join('')}</div>`;
}
const urlFoto = new Map();
async function caricaMiniature(lista) {
  const cl = sb(); if (!cl || !lista.length) return;
  const mancanti = lista.map(f => f[1]).filter(p => !urlFoto.has(p));
  for (let i = 0; i < mancanti.length; i += 100) {
    const { data } = await cl.storage.from('smi-foto').createSignedUrls(mancanti.slice(i, i + 100), 3600);
    for (const d of data || []) if (d.signedUrl) urlFoto.set(d.path, d.signedUrl);
  }
  document.querySelectorAll('.foto[data-foto]').forEach(el => {
    const u = urlFoto.get(el.dataset.foto); if (!u) { el.querySelector('.foto-img').textContent = 'non disponibile'; return; }
    el.querySelector('.foto-img').innerHTML = `<img loading="lazy" src="${u}" alt="">`;
    el.onclick = () => { const v = document.createElement('div'); v.className = 'foto-grande'; v.innerHTML = `<img src="${u}" alt=""><div class="nota">${esc(el.querySelector('figcaption').textContent)} · clicca per chiudere</div>`; v.onclick = () => v.remove(); document.body.appendChild(v); };
  });
}

function apriProduzione(id) {
  const m = S.modello; const p0 = m.produzioni.find(x => x.id === id); if (!p0) return;
  const ultimaId = m.produzioni.filter(x => x.t >= 1).slice(-1)[0]?.id;
  const p = conLive(p0, p0.id === ultimaId);
  const par = (m.parametri || {})[p.prodotto];
  const def = (m.parametri || {})['default product'];
  const resa = p.marciaMin ? p.t / (p.marciaMin * SMI.VELOCITA_STD) : 0;
  const allarmi = (m.allarmi || []).filter(a => a[0] >= p.inizio && a[0] <= p.fine);
  const allRilev = allarmi.filter(a => !a[2]);
  const durataTot = (p.fine - p.inizio) / 60e3;
  const FP = fermiDi(p0), fermiP = FP.lista;
  const pr = S.grezzo?.produzioni?.find(x => x.id === id);
  const fotoP = S.foto.filter(f => f[0] >= p0.inizio && f[0] <= fineProd(p0) + 5 * 60e3).reverse();

  const riepilogo = `
    <div class="kpi" style="margin-top:0">
      <div class="tile"><div class="lab">Cassette contate</div><div class="val">${n0(p.t)}</div><div class="det">${n0(p.t - p.r)} buone${p.extraLive ? ` · ≈${n0(p.extraLive)} in diretta` : ''}</div></div>
      <div class="tile scarti"><div class="lab">Scartate</div><div class="val">${n0(p.r)}<small>${pc(p.r, p0.t)}</small></div><div class="det">${n0(p.u)} non ispezionate${p.escluse ? ` · ${n0(p.escluse.t)} cassette escluse` : ''}</div></div>
      <div class="tile"><div class="lab">Pedane</div><div class="val">${n0(SMI.pedane(p.t))}<small>+ ${p.t % 80}/80</small></div><div class="barra"><i style="width:${p.t % 80 / 80 * 100}%"></i></div></div>
      <div class="tile"><div class="lab">Resa velocità</div><div class="val">${Math.round(resa * 100)}<small>%</small></div><div class="det">media ${n1(p.marciaMin ? p.t / p.marciaMin : 0)}/min su 24</div></div>
    </div>
    <div class="dueco sezione">
      <div class="pannello"><h3>Tempi</h3>
        <table class="tabella"><tbody>
          <tr><td>Inizio</td><td>${giornoCorto(p.inizio)} ${SMI.fmtOra(p.inizio)}</td></tr>
          <tr><td>Fine</td><td>${giornoCorto(p.fine)} ${SMI.fmtOra(p.fine)}</td></tr>
          <tr><td>Durata totale</td><td>${durata(durataTot)}</td></tr>
          <tr><td>In marcia (ispezione attiva)</td><td>${durata(p.marciaMin)}</td></tr>
          <tr><td>Fermi</td><td>${FP.n} · ${durata(FP.min)}</td></tr>
          ${(() => { const c = tuttiICambi().find(c => c.al === p.prodotto && Math.abs(fineC(c) - p.inizio) < 3600e3); return c ? `<tr><td>Cambio prodotto prima (da ${esc(c.dal)})</td><td>${durataDa(fineC(c) - c.da)}</td></tr>` : ''; })()}
          <tr><td>Modifiche ai parametri</td><td>${p.cambiImpostazioni.length}</td></tr>
        </tbody></table></div>
      <div class="pannello"><h3>Tipo di scarto</h3>
        ${p.r ? `<div class="split"><i style="flex:${p.s};background:var(--serious)"></i><i style="flex:${p.re};background:var(--crit)"></i></div>
        <div class="legenda"><span><i style="background:var(--serious)"></i>Amido (Starch) <b style="color:var(--text-1)">${n0(p.s)}</b></span><span><i style="background:var(--crit)"></i>Residui (Residual) <b style="color:var(--text-1)">${n0(p.re)}</b></span></div>` : '<div class="nota">Nessuno scarto.</div>'}
        ${p.setupT ? `<div class="nota">⚙︎ Durante l'avviamento / learning: <b>${n0(p.setupR)}</b> scarti su <b>${n0(p.setupT)}</b> cassette. Esclusi questi, gli scarti sono <b>${pc(p.r - p.setupR, p.t - p.setupT)}</b>.</div>` : ''}
        ${p.cambiImpostazioni.length ? `<h3 style="margin-top:14px">Modifiche ai parametri di analisi</h3><div class="turni-chip" style="display:flex;gap:6px;flex-wrap:wrap">${p.cambiImpostazioni.map(t => `<span class="tchip">${giornoCorto(t)} ${SMI.fmtOra(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    ${pannelloEsclusioni(p0, pr)}
    <div class="sezione pannello"><h3>Linea del tempo</h3>${lineaTempo(p.inizio, fineProd(p0), [p0], fermiP)}</div>
    <div class="sezione pannello"><h3>Divisione per turno</h3><div class="scroll-x"><table class="tabella"><thead><tr><th>Turno</th><th>Da</th><th>A</th><th>Cassette</th><th>Scarti</th><th>%</th><th>Pedane</th><th>In marcia</th><th>Resa vel.</th></tr></thead><tbody>
      ${p.turni.map(t => `<tr><td><b>${t.nome}</b> ${giornoCorto(t.giorno)}</td><td>${SMI.fmtOra(t.inizio)}</td><td>${SMI.fmtOra(t.fine)}</td><td>${n0(t.t)}</td><td class="r">${n0(t.r)}</td><td>${pc(t.r, t.t)}</td><td>${n0(SMI.pedane(t.t))}</td><td>${durata(t.marciaMin)}</td><td>${t.marciaMin ? Math.round(t.t / (t.marciaMin * 24) * 100) : 0}%</td></tr>`).join('')}
    </tbody></table></div></div>`;

  const andamento = `
    <div class="pannello"><h3>Cassette per ora</h3><div class="legenda"><span><i style="background:var(--blue)"></i>Buone</span><span><i style="background:var(--crit)"></i>Scartate</span></div><div class="chart" id="mOre"></div></div>
    <div class="pannello sezione"><h3>Velocità (cassette al minuto)</h3><div class="legenda"><span><i class="linea" style="background:var(--aqua)"></i>Velocità</span><span><i class="linea" style="background:rgba(255,255,255,.5)"></i>Standard 24/min</span></div><div class="chart" id="mVel"></div>
    <div class="nota">Dove ci sono i file <b>system_event_trace</b> la velocità è minuto per minuto. Altrimenti è la media di ogni intervallo dei contatori orari.</div></div>`;

  let parametri = `<div class="vuoto">${perchéNienteParametri(m, p.prodotto)}</div>`;
  if (par) {
    const cam = par['0'] || {}, com = par['-'] || {};
    const valore = k => cam[k] ?? com[k];
    const valDef = k => (def?.['0'] || {})[k] ?? (def?.['-'] || {})[k];
    const princ = PARAM_PRINCIPALI.filter(([k]) => valore(k) != null).map(([k, l]) => {
      const v = valore(k), d = valDef(k);
      return `<div class="param"><div class="n">${l}${d != null && d !== v ? '<span class="diverso" title="Valore del default: ' + esc(d) + '">≠ default</span>' : ''}</div><div class="v">${esc(v)}</div><div class="k">${k}</div></div>`;
    }).join('');
    const tutti = [...Object.entries(com).map(([k, v]) => [k, v, '-']), ...Object.entries(cam).map(([k, v]) => [k, v, '0'])].sort((a, b) => a[0].localeCompare(b[0]));
    const gp = gruppiModifiche(p.prodotto).slice(-8).reverse();
    const storiaH = gp.length ? `<div class="pannello" style="margin-bottom:14px"><h3>Ultime modifiche a questo prodotto</h3><table class="tabella mod-tab"><tbody>${gp.map(g => `<tr class="${g.t >= p.inizio && g.t <= p.fine ? 'dentro' : ''}"><td>${giornoCorto(g.t)} ${SMI.fmtOra(g.t)}${g.t >= p.inizio && g.t <= p.fine ? ' <span class="chip">in questa produzione</span>' : ''}</td><td>${vociHtml(g.voci)}</td></tr>`).join('')}</tbody></table><div class="nota">Il confronto degli scarti prima e dopo ogni modifica è nella vista <b>Parametri</b> della pagina principale.</div></div>` : '';
    parametri = storiaH + `
      <div class="nota" style="margin-top:0;margin-bottom:12px">Valori <b>attuali</b> letti da SMI_ANALYSIS.ini per <b style="text-transform:capitalize">${esc(p.prodotto)}</b>. Il segno <span class="diverso" style="margin:0">≠ default</span> indica che il valore è diverso da quello del "default product".</div>
      <div class="param-grid">${princ}</div>
      <div class="sezione pannello"><h3 style="display:flex;align-items:center;gap:10px">Tutti i parametri (${tutti.length}) <span class="spazio" style="flex:1"></span><input type="search" id="cercaParam" placeholder="Cerca parametro…" style="max-width:240px"></h3>
      <div class="scroll-x" style="max-height:420px;overflow:auto"><table class="tabella lista-param" id="tabParam"><thead><tr><th>Parametro</th><th>Valore</th><th>Default</th></tr></thead><tbody>
      ${tutti.map(([k, v]) => { const d = valDef(k); return `<tr data-k="${esc(k.toLowerCase())}"><td>${esc(k)}</td><td>${esc(v)}</td><td style="color:${d != null && d !== v ? '#cfe2ff' : 'var(--text-3)'}">${esc(d ?? '—')}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }

  const raggr = new Map(); for (const a of allRilev) raggr.set(a[1], (raggr.get(a[1]) || 0) + 1);
  const allarmiH = allarmi.length || (m.allarmi || []).length ? `
    <div class="dueco">
      <div class="pannello"><h3>Allarmi durante la produzione</h3>${raggr.size ? [...raggr.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => `<div class="allarme">${ICONE.warn}<span>${esc(t)}</span><span class="conta">${c}×</span></div>`).join('') : '<div class="nota">Nessun allarme rilevante.</div>'}
      ${allarmi.length - allRilev.length ? `<div class="nota">Esclusi ${n0(allarmi.length - allRilev.length)} messaggi di servizio (MQTT, DOA, espulsione) che compaiono di continuo.</div>` : ''}</div>
      <div class="pannello"><h3>Ultimi allarmi</h3>${allRilev.slice(-12).reverse().map(a => `<div class="allarme"><span class="ora">${giornoCorto(a[0])} ${SMI.fmtOra(a[0])}</span><span>${esc(a[1])}</span></div>`).join('') || '<div class="nota">—</div>'}</div>
    </div>` : '<div class="vuoto">Il file error.log non è disponibile.</div>';

  const velo = $('#velo');
  velo.innerHTML = `<div class="vetro modale" role="dialog" aria-modal="true">
    <button class="btn icona chiudi" id="chiudiM" aria-label="Chiudi">${ICONE.x}</button>
    <h2 style="font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:var(--text-3);margin:0">Produzione</h2>
    <div class="prodotto-nome">${esc(p.prodotto)}</div>
    <div class="sotto"><span>${giornoLungo(p.inizio)} ${SMI.fmtOra(p.inizio)} → ${SMI.isoGiorno(p.inizio) !== SMI.isoGiorno(p.fine) ? giornoCorto(p.fine) + ' ' : ''}${SMI.fmtOra(p.fine)}</span>${p.turni.map(t => `<span class="chip">${t.nome} ${giornoCorto(t.giorno)}</span>`).join('')}</div>
    <div class="schede" id="schede">${[['r', 'Riepilogo'], ['a', 'Andamento'], ['p', 'Parametri di analisi'], ['f', `Fermi (${fermiP.length})`], ['e', `Allarmi${allRilev.length ? ' (' + allRilev.length + ')' : ''}`], ['s', `Foto scarti${fotoP.length ? ' (' + fotoP.length + ')' : ''}`]].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'att'}">${l}</button>`).join('')}</div>
    <div data-pan="r">${riepilogo}</div><div data-pan="a" class="nascosto">${andamento}</div><div data-pan="p" class="nascosto">${parametri}</div><div data-pan="f" class="nascosto"><div class="pannello"><h3>Linea del tempo</h3>${lineaTempo(p.inizio, fineProd(p0), [p0], fermiP)}</div><div class="sezione">${tabellaFermi(fermiP, { mostraProdotto: false })}</div></div><div data-pan="e" class="nascosto">${allarmiH}</div><div data-pan="s" class="nascosto">${fotoHtml(fotoP)}</div>
  </div>`;
  velo.classList.add('aperto'); document.body.style.overflow = 'hidden';
  const chiudi = () => { velo.classList.remove('aperto'); velo.innerHTML = ''; document.body.style.overflow = ''; };
  $('#chiudiM').onclick = chiudi;
  velo.onclick = e => { if (e.target === velo) chiudi(); };
  document.onkeydown = e => { if (e.key === 'Escape') chiudi(); };
  let disegnati = false;
  $('#schede').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    velo.querySelectorAll('#schede button').forEach(x => x.classList.toggle('att', x === b));
    velo.querySelectorAll('[data-pan]').forEach(x => x.classList.toggle('nascosto', x.dataset.pan !== b.dataset.s));
    if (b.dataset.s === 'a' && !disegnati) {
      disegnati = true;
      const da = Math.floor(p.inizio / 3600e3) * 3600e3, a = p.fine;
      montaGrafico($('#mOre'), el => graficoBarre(el, orarie([p0], da, a)));
      montaGrafico($('#mVel'), el => graficoLinea(el, puntiVelocita(m, [p0], p.inizio, p.fine), { da: p.inizio, a: p.fine }));
    }
  };
  collegaEsclusioni(p0, pr);
  caricaMiniature(fotoP);
  $('#cercaParam')?.addEventListener('input', e => { const q = e.target.value.toLowerCase().trim(); velo.querySelectorAll('#tabParam tbody tr').forEach(tr => tr.style.display = !q || tr.dataset.k.includes(q) ? '' : 'none'); });
}

/* ==========================================================================
   HEADER + RENDER
   ========================================================================== */
function statoLettore() {
  if (S.modo === 'demo') return `<span class="pill"><span class="dot file"></span><span class="testo-pill">Anteprima</span></span>`;
  if (S.modo === 'file') return `<span class="pill"><span class="dot file"></span><span class="testo-pill">File caricati</span></span>`;
  if (S.modo === 'lettore') return `<span class="pill" id="pillLettore"><span class="dot ${L.attivo ? 'on' : 'off'}"></span>${L.attivo ? 'Lettore attivo' : 'Lettore fermo'}</span>`;
  const age = S.aggiornatoVivo ? (Date.now() - S.aggiornatoVivo) / 1000 : Infinity;
  const limite = Math.max(30, (S.vivo?.intervallo || 5) * 3 + 20);
  if (age < limite) return `<span class="pill" title="${esc((S.pcLinea?.nome || 'Il PC della linea') + ' sta inviando i dati')}"><span class="dot on"></span><span class="nascondi-m">Lettore collegato · </span>${age < 60 ? Math.round(age) + ' s fa' : Math.round(age / 60) + ' min fa'}</span>`;
  return `<span class="pill" title="Il PC della linea non invia dati: la scheda del lettore è chiusa o il PC è spento"><span class="dot off"></span>${isFinite(age) ? 'Lettore fermo da ' + tempoFa(age) : 'Lettore mai collegato'}</span>`;
}
const tempoFa = s => s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' giorni';

function sottotitolo() {
  if (S.modo === 'remoto' && S.aggiornatoVivo) return 'Ultimo invio dalla linea alle ' + new Date(S.aggiornatoVivo).toLocaleTimeString('it-IT');
  if (S.modo === 'lettore') return L.ultimoOk ? 'Ultimo invio alle ' + new Date(L.ultimoOk).toLocaleTimeString('it-IT') : 'Lettore';
  return S.modello?.fineDati ? 'Dati fino al ' + SMI.fmtData(S.modello.fineDati) + ' ' + SMI.fmtOra(S.modello.fineDati) : 'Controllo produzione';
}
function header() {
  const puoAggiornare = S.modo === 'remoto';
  return `<header class="vetro top">
    <div class="logo-img" role="img" aria-label="Logo"></div>
    <div class="titolo"><b>${esc(CONFIG.NOME_LINEA)}</b><span id="sottotitolo">${sottotitolo()}</span></div>
    <span class="spazio"></span>
    ${S.modo !== 'lettore' ? `<span id="pillEsp">${pillEspulsione()}</span><span id="pillLinea">${pillStatoLinea()}</span>` : ''}
    <span id="statoPill" class="nascondi-m">${statoLettore()}</span>
    ${S.modo !== 'lettore' ? `<button class="btn primario" id="btnAgg" ${puoAggiornare ? '' : 'disabled title="Disponibile quando il lettore è collegato"'}>${ICONE.agg}<span class="nascondi-m">Aggiorna</span></button>` : ''}
    <div class="menu" id="menu"><button class="btn icona" id="btnMenu" aria-label="Menu">${ICONE.menu}</button>
      <div class="lista vetro">
        ${S.utente ? `<div class="mn-utente"><span class="mn-avatar">${esc(S.utente.email[0].toUpperCase())}</span><div><b>${esc(S.utente.email.split('@')[0])}</b><span>${esc(S.utente.email)}</span></div></div>` : ''}
        <button data-a="dash" class="${!location.hash ? 'att' : ''}"><span class="mn-ico">${ICONE.dash}</span><span class="mn-t"><b>Dashboard</b><span>Produzioni, turni, fermi</span></span></button>
        <button data-a="file" class="${location.hash === '#file' ? 'att' : ''}"><span class="mn-ico">${ICONE.file}</span><span class="mn-t"><b>Carica file a mano</b><span>Log dalla chiavetta</span></span></button>
        <button data-a="lettore" class="${location.hash === '#lettore' ? 'att' : ''}"><span class="mn-ico">${ICONE.pc}</span><span class="mn-t"><b>Lettore</b><span>Solo sul PC della linea</span></span></button>
        ${S.utente ? `<div class="mn-sep"></div><button data-a="esci" class="mn-esci"><span class="mn-ico">${ICONE.esci}</span><span class="mn-t"><b>Esci</b></span></button>` : ''}
        <div class="mn-ver">Versione ${CONFIG.VERSIONE}</div>
      </div></div>
  </header>`;
}

function render() {
  grafici.clear(); ro.disconnect();
  const app = $('#app');
  const vista = location.hash.replace('#', '');
  if (vista === 'lettore') {
    if (!L.preparato) { L.preparato = true; preparaLettore(); }
    S.modo = 'lettore';
    document.title = L.attivo ? 'NON CHIUDERE · DO NOT CLOSE · NID 1' : 'Lettore · ' + CONFIG.NOME_LINEA;
    if (!L.pronto) { app.innerHTML = `<div class="centro"><div class="pill"><span class="dot"></span>Avvio del lettore…</div></div>`; return; }
    if (L.sostituito) { app.innerHTML = vistaSostituito(); $('#btnGestione').onclick = chiediPassword; return; }
    if (L.chiediPw) { app.innerHTML = vistaLogin('', { titolo: 'Gestione lettore', testo: 'Per modificare il lettore inserisci email e password.', email: S.utente?.email, annulla: true }); collegaLogin(() => { L.chiediPw = false; L.autorizzato = true; L.impostazioni = true; render(); }); $('#btnAnnullaLogin').onclick = () => { L.chiediPw = false; render(); }; return; }
    if (L.attivo && !L.impostazioni) { app.innerHTML = vistaNonChiudere(); collegaNonChiudere(); return; }
    if (L.config && L.permessoDaRiattivare && S.utente && !L.impostazioni) { app.innerHTML = vistaRiavvia(); $('#btnRiavvia').onclick = riattivaPermessi; $('#btnGestione').onclick = chiediPassword; return; }
    // PC non ancora configurato (o sessione scaduta): si entra solo con email e password
    if (!L.autorizzato) { app.innerHTML = vistaLogin('', { titolo: 'Lettore ' + CONFIG.NOME_LINEA, testo: L.config ? 'Accedi per gestire il lettore di questo PC.' : 'Accedi per configurare <b>questo PC</b> come PC della linea. Serve solo la prima volta.', email: S.utente?.email }); collegaLogin(() => { L.autorizzato = true; render(); }); return; }
    app.innerHTML = header() + vistaLettore(); collegaHeader(); collegaLettore(); return;
  }
  document.title = 'Produzione · ' + CONFIG.NOME_LINEA;
  if (vista === 'file') { app.innerHTML = header() + vistaFile(); collegaHeader(); collegaFile(); return; }
  if (S.modo === 'lettore') S.modo = null;
  if (!S.modo) { avvio(); return; }
  if (S.modo === 'login') { app.innerHTML = vistaLogin(); collegaLogin(); return; }
  const y = window.scrollY;
  app.innerHTML = header() + vistaDashboard();
  collegaHeader(); collegaDashboard();
  window.scrollTo(0, y);
}
function collegaHeader() {
  $('#btnMenu').onclick = e => { e.stopPropagation(); $('#menu').classList.toggle('aperto'); };
  document.addEventListener('click', () => $('#menu')?.classList.remove('aperto'), { once: true });
  $('#menu .lista').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'dash') { location.hash = ''; S.modo = null; render(); }
    if (a === 'file') location.hash = 'file';
    if (a === 'lettore') location.hash = 'lettore';
    if (a === 'esci') { await S.sb?.auth.signOut(); S.utente = null; S.modo = null; location.hash = ''; render(); }
  };
  $('#btnAgg')?.addEventListener('click', richiediAggiornamento);
}
setInterval(() => {
  const p = $('#statoPill'); if (p && S.modo === 'remoto') p.innerHTML = statoLettore();
  const st = $('#sottotitolo'); if (st) st.textContent = sottotitolo();
  if (S.modello?.stato) { const a = $('#statoLinea'); if (a) a.innerHTML = htmlStatoLinea(); const b = $('#pillLinea'); if (b) b.innerHTML = pillStatoLinea(); const c = $('#pillEsp'); if (c) c.innerHTML = pillEspulsione(); }
}, 5000);
window.addEventListener('hashchange', render);

/* ==========================================================================
   SUPABASE
   ========================================================================== */
function sb() {
  if (S.sb) return S.sb;
  if (!window.supabase?.createClient) return null;
  S.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, lock: async (_n, _t, fn) => await fn() } });
  return S.sb;
}
async function utenteCorrente() { const c = sb(); if (!c) return null; const { data } = await c.auth.getSession(); S.utente = data.session?.user || null; return S.utente; }

async function avvio() {
  if (window.SMI_DEMO) { S.modo = 'demo'; S.grezzo = window.SMI_DEMO; aggiornaModello(); render(); return; }
  $('#app').innerHTML = `<div class="centro"><div class="pill"><span class="dot"></span>Caricamento…</div></div>`;
  const u = await utenteCorrente();
  if (!u) { S.modo = 'login'; render(); return; }
  S.modo = 'remoto';
  await caricaRemoto();
  iscriviRemoto();
  render();
}
async function caricaRemoto() {
  const { data, error } = await sb().from('smi_dati').select('id,dati,aggiornato');
  if (error) { toast('Errore lettura dati: ' + esc(error.message)); return; }
  applicaRighe(data || []);
}
function applicaRighe(righe) {
  const r = Object.fromEntries(righe.map(x => [x.id, x]));
  if (r.esclusioni) S.esclusioni = r.esclusioni.dati?.lista || [];
  if (r.foto) S.foto = r.foto.dati?.lista || [];
  if (r.storia_parametri) { S.storiaPar = r.storia_parametri.dati?.modifiche || []; S.storiaParDa = r.storia_parametri.dati?.inizio || null; }
  const storico = r.storico?.dati || S.grezzo || {};
  S.grezzo = { ...storico, parametri: r.parametri?.dati ?? S.grezzo?.parametri, allarmi: r.allarmi?.dati ?? S.grezzo?.allarmi };
  if (r.pc_linea) S.pcLinea = r.pc_linea.dati;
  if (r.vivo) { S.vivo = r.vivo.dati; S.aggiornatoVivo = new Date(r.vivo.aggiornato).getTime(); if (S.vivo?.stato) S.grezzo.stato = S.vivo.stato; }
  if (!r.storico && !S.grezzo.produzioni) S.grezzo = null;
  aggiornaModello();
}
let canaleRemoto, attesaAgg = false;
function iscriviRemoto() {
  if (canaleRemoto) return;
  canaleRemoto = sb().channel('smi-dash').on('postgres_changes', { event: '*', schema: 'public', table: 'smi_dati' }, async ev => {
    const id = ev.new?.id || ev.old?.id;
    const { data } = await sb().from('smi_dati').select('id,dati,aggiornato').eq('id', id);
    if (data?.length) { applicaRighe(data); if (!$('#velo').classList.contains('aperto')) render(); else { const p = $('#statoPill'); if (p) p.innerHTML = statoLettore(); } }
    if (attesaAgg && id === 'vivo') { attesaAgg = false; toast(`${ICONE.ok.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Dati aggiornati dal PC della linea`); }
  }).subscribe();
  // rete di sicurezza: se il realtime non arriva, rileggo ogni 30 s
  setInterval(() => { if (S.modo === 'remoto' && !$('#velo').classList.contains('aperto')) caricaRemoto().then(render); }, 30000);
}
async function richiediAggiornamento() {
  const b = $('#btnAgg'); if (!b || b.disabled) return;
  b.disabled = true; b.querySelector('svg').classList.add('gira');
  const { error } = await sb().from('smi_comandi').insert({ comando: 'aggiorna' });
  if (error) toast('Non riesco a inviare la richiesta: ' + esc(error.message));
  else { attesaAgg = true; toast('Richiesta inviata al PC della linea…'); setTimeout(() => { if (attesaAgg) { attesaAgg = false; toast('Il lettore non ha risposto: controlla che la scheda sia aperta sul PC della linea'); } }, 20000); }
  setTimeout(() => { const b2 = $('#btnAgg'); if (b2) { b2.disabled = false; b2.querySelector('svg')?.classList.remove('gira'); } }, 2500);
}

function vistaLogin(msg = '', opz = {}) {
  return `<div class="centro"><form class="vetro box-login" id="fLogin">
    <div class="logo-img" role="img" aria-label="Logo"></div>
    <h1>${esc(opz.titolo || CONFIG.NOME_LINEA)}</h1>
    <p>${opz.testo || 'Accedi con lo stesso account del sito Validazione SMI.'}</p>
    <label class="campo">Email<input type="email" name="email" autocomplete="username" required value="${esc(opz.email || '')}"></label>
    <label class="campo">Password<input type="password" name="password" autocomplete="current-password" required></label>
    <div class="errore" id="errLogin">${esc(msg)}</div>
    <button class="btn primario" style="width:100%;justify-content:center;padding:12px">Accedi</button>
    ${opz.annulla ? '<button type="button" class="btn" id="btnAnnullaLogin" style="width:100%;justify-content:center;margin-top:8px">Annulla</button>' : '<div class="nota" style="text-align:center">oppure <a href="#file" style="color:#9ec5f4">carica i file a mano</a> senza accedere</div>'}
  </form></div>`;
}
function collegaLogin(dopo) {
  $('#fLogin').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    if (!sb()) { $('#errLogin').textContent = 'Libreria Supabase non caricata: controlla la connessione.'; return; }
    $('#errLogin').textContent = '';
    const { data, error } = await sb().auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) { $('#errLogin').textContent = error.message === 'Invalid login credentials' ? 'Email o password non corretti' : error.message; return; }
    S.utente = data.user;
    if (dopo) dopo(); else { S.modo = null; render(); }
  };
}

/* ==========================================================================
   CARICAMENTO FILE A MANO
   ========================================================================== */
function vistaFile() {
  return `<div class="lettore"><section class="vetro card">
    <h2>Carica i file dalla chiavetta</h2>
    <div class="drop" id="drop">${ICONE.cartella.replace('<svg', '<svg style="width:34px;height:34px;opacity:.7"')}<p style="margin:10px 0 4px;font-size:15px;color:var(--text-1)">Trascina qui i file</p>
    <p style="margin:0 0 14px;font-size:13px">event.log, error.log, system_event_trace*.log, SMI_ANALYSIS.ini, EI_SYSTEM.ini</p>
    <label class="btn primario">${ICONE.file} Scegli file<input type="file" id="inFile" multiple hidden></label></div>
    <div class="file-trovati" id="fileInfo"></div>
    <div class="nota">I file vengono letti solo nel tuo browser: non vengono inviati a nessuno.</div>
  </section></div>`;
}
function collegaFile() {
  const drop = $('#drop');
  const gestisci = async files => {
    const testi = await leggiFile([...files]);
    if (!testi.eventLog) { $('#fileInfo').innerHTML = '<span style="color:#ffb4ae">Manca event.log: senza quello non posso ricostruire le produzioni.</span>'; return; }
    S.grezzo = SMI.costruisciModello(testi); S.modo = 'file'; S.vivo = null;
    try { S.esclusioni = JSON.parse(localStorage.getItem('smi_esclusioni_file') || '[]'); } catch { S.esclusioni = []; }
    aggiornaModello();
    location.hash = ''; render();
  };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('sopra'); };
  drop.ondragleave = () => drop.classList.remove('sopra');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('sopra'); gestisci(e.dataTransfer.files); };
  $('#inFile').onchange = e => gestisci(e.target.files);
}
const dec = new TextDecoder('windows-1252');
async function testoDi(file) { return dec.decode(await file.arrayBuffer()); }
function tipoFile(nome) {
  const n = nome.toLowerCase();
  if (/^image_last_number.*\.dat$/.test(n)) return 'immagini'; // D:\images: progressivo delle foto degli scarti
  if (/(^|[-_])event\.log$/.test(n) || n === 'event.log') return 'eventLog';
  if (/(^|[-_])error\.log$/.test(n) || n === 'error.log') return 'errorLog';
  if (n.includes('system_event_trace') && n.endsWith('.log')) return 'trace';
  // Edge non lascia leggere i .ini: si leggono le copie .ini.txt fatte da Attiva_parametri_dashboard.bat
  if (/smi_analysis\.ini(\.txt)?$/.test(n)) return 'analysisIni';
  if (/ei_system\.ini(\.txt)?$/.test(n)) return 'systemIni';
  if (/analysis_time\.log$/.test(n)) return 'analysisTime';
  return null;
}
async function leggiFile(files) {
  const out = { traces: [] };
  for (const f of files) {
    const t = tipoFile(f.name); if (!t) continue;
    const testo = await testoDi(f);
    if (t === 'trace') out.traces.push({ nome: f.name, testo }); else if (t !== 'analysisTime' && t !== 'immagini') out[t] = testo;
  }
  return out;
}

/* ==========================================================================
   LETTORE (gira nel browser del PC della linea)
   ========================================================================== */
const L = {
  attivo: false, cartelle: [], file: new Map(), cache: new Map(), ultimoScan: 0,
  immagini: (() => { try { return JSON.parse(localStorage.getItem('smi_immagini')) || { offset: 0, prec: null, campioni: [] }; } catch { return { offset: 0, prec: null, campioni: [] }; } })(),
  intervallo: +(localStorage.getItem('smi_intervallo') || 5), ultimoInvio: {}, registro: [],
  analisi: { offset: 0, righePrec: null, campioni: [] }, ticker: null, ciclo: 0, inCorso: false,
  canale: null, ultimoModello: null,
};
const IDB = {
  db: () => new Promise((ok, ko) => { const r = indexedDB.open('smi-lettore', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }),
  async get(k) { const db = await this.db(); return new Promise(ok => { const r = db.transaction('h').objectStore('h').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); },
  async set(k, v) { const db = await this.db(); return new Promise(ok => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = ok; }); },
};
function log(msg) {
  const r = `${SMI.fmtOra(SMI.adesso())}:${String(new Date().getSeconds()).padStart(2, '0')}  ${msg}`;
  L.registro.unshift(r); L.registro = L.registro.slice(0, 80);
  const el = $('#registro'); if (el) el.innerHTML = L.registro.map(esc).join('<br>');
}

function vistaLettore() {
  const supportato = 'showDirectoryPicker' in window;
  const loggato = !!S.utente;
  const haCartelle = L.cartelle.length > 0;
  return `<div class="lettore">
    <section class="vetro stato-grande">
      <div class="anello ${L.attivo ? 'on' : ''}">${L.attivo ? ICONE.ok.replace('currentColor', '#7ff59a') : ICONE.pc}</div>
      <div style="flex:1"><div style="font-size:22px;font-weight:700">${L.attivo ? 'Lettore attivo' : 'Lettore fermo'}</div>
        <div class="sotto" id="statoLett">${L.attivo ? `Legge i file ogni ${L.intervallo} s e li invia alla dashboard. <b style="color:var(--text-1)">Lascia aperta questa scheda.</b>` : 'Completa i passaggi qui sotto per avviarlo.'}</div></div>
      ${L.attivo ? `<button class="btn primario" id="btnNC">Mostra "Non chiudere"</button><button class="btn" id="btnStop">${ICONE.stop} Ferma</button>` : ''}
    </section>
    ${!supportato ? `<section class="vetro banner" style="margin-top:16px">${ICONE.warn.replace('<svg', '<svg style="width:18px;height:18px;color:var(--warn)"')} Questo browser non può leggere le cartelle. Apri questa pagina con <b>Microsoft Edge</b> o <b>Google Chrome</b>.</section>` : ''}
    <div class="passi">
      <div class="vetro passo fatto"><div class="num">✓</div><div class="testo">Accesso fatto<small>${esc(S.utente?.email || '')}</small></div></div>
      <div class="vetro passo ${L.config ? 'fatto' : ''}"><div class="num">${L.config ? '✓' : '1'}</div><div class="testo">Nome di questo PC<small>Compare sulla dashboard, per sapere quale PC sta inviando i dati</small></div>
        <input type="text" id="nomePc" value="${esc(L.config?.nome || 'PC visione NID 1')}" style="max-width:220px"></div>
      <div class="vetro passo ${haCartelle ? 'fatto' : ''}"><div class="num">${haCartelle ? '✓' : '2'}</div><div class="testo">Scegli la cartella del programma SMI<small>${haCartelle ? L.cartelle.map(c => esc(c.name)).join(', ') + ` · ${L.file.size} file trovati` : 'Di solito C:\\SMI oppure la cartella di Eagle Inspector. Si fa una volta sola.'}</small></div>
        <button class="btn ${haCartelle ? '' : 'primario'}" id="btnCartella" ${supportato ? '' : 'disabled'}>${ICONE.cartella} ${haCartelle ? 'Aggiungi cartella' : 'Scegli cartella'}</button>
        ${haCartelle && !L.attivo ? `<button class="btn" id="btnTogliCartelle">Cambia</button>` : ''}
        ${L.permessoDaRiattivare ? `<button class="btn primario" id="btnRiattiva">Riattiva accesso</button>` : ''}</div>
      <div class="vetro passo ${L.attivo ? 'fatto' : ''}"><div class="num">${L.attivo ? '✓' : '3'}</div><div class="testo">Avvia<small>Da quel momento <b>questo</b> diventa il PC della linea: se si chiude o si riavvia, riparte da solo</small></div>
        <select id="selInt">${[2, 5, 10, 30, 60].map(s => `<option value="${s}" ${s === L.intervallo ? 'selected' : ''}>ogni ${s} s</option>`).join('')}</select>
        <button class="btn primario" id="btnAvvia" ${loggato && haCartelle && !L.attivo ? '' : 'disabled'}>${ICONE.play} Avvia</button></div>
    </div>
    <section class="vetro card" style="margin-top:16px;border-color:rgba(229,83,75,.35)"><h2>Ricomincia da zero</h2>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div class="nota" style="margin:0;flex:1;min-width:240px">Ferma il lettore, dimentica la cartella scelta e esce dall'account <b>su questo PC</b>. Usalo se vuoi spostare il lettore su un altro PC o rifare la configurazione.</div>
      <button class="btn" id="btnReset" style="border-color:rgba(229,83,75,.5);color:#ffc9c4">Reimposta da zero</button></div></section>
    <section class="vetro card" style="margin-top:16px"><h2>File letti</h2><div class="file-trovati" id="elencoFile">${elencoFileHtml()}</div></section>
    <section class="vetro" style="margin-top:16px"><h2 style="padding:16px 16px 0;margin:0;font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:var(--text-3)">Registro</h2><div class="registro" id="registro">${L.registro.map(esc).join('<br>') || 'Nessuna attività.'}</div></section>
    <div class="nota" style="margin-top:14px">💡 Per non far "addormentare" la scheda: in Edge apri <b>Impostazioni → Sistema e prestazioni → Non sospendere mai questi siti</b> e aggiungi l'indirizzo di questa pagina.</div>
  </div>`;
}
function vistaNonChiudere() {
  return `<div class="non-chiudere">
    <div class="nc-card">
      <div class="nc-logo" role="img" aria-label="Logo"></div>
      <div class="nc-it">NON CHIUDERE</div>
      <div class="nc-sub">questa pagina</div>
      <div class="nc-sep"></div>
      <div class="nc-en">DO NOT CLOSE</div>
      <div class="nc-sub">this page</div>
    </div>
    ${BTN_GESTIONE}
    <span class="nc-info" id="ncInfo">${esc(infoInvio())}</span><span class="nc-dot ${statoInvio()}" id="ncDot" title="Stato invio dati"></span>
  </div>`;
}
function vistaRiavvia() {
  return `<div class="non-chiudere"><div class="nc-card">
    <div class="nc-logo" role="img" aria-label="Logo"></div>
    <div class="nc-sub" style="margin:0 0 18px;color:#141826;font-weight:600">Il lettore è in pausa · The reader is paused</div>
    <button class="btn-riavvia" id="btnRiavvia"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>CLICCA QUI PER RIAVVIARE<small>CLICK HERE TO RESTART</small></span></button>
    <div class="nc-sub" style="font-size:14px;margin-top:18px">Se Edge chiede il permesso, scegli <b>"Consenti a ogni visita"</b> · If Edge asks, choose <b>"Allow on every visit"</b></div>
  </div>
  ${BTN_GESTIONE}</div>`;
}
const BTN_GESTIONE = `<button class="nc-gestione" id="btnGestione" title="Riservato: serve la password"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Gestione</button>`;
function chiediPassword() { L.chiediPw = true; render(); }
function vistaSostituito() {
  return `<div class="non-chiudere"><div class="nc-card">
    <div class="nc-logo" role="img" aria-label="Logo"></div>
    <div class="nc-it" style="font-size:clamp(28px,4vw,44px)">Lettore spento su questo PC</div>
    <div class="nc-sub">Il PC della linea adesso è <b>${esc(L.sostituito)}</b>. Questo PC non invia più dati.<br>This PC no longer sends data. You can close this page.</div>
  </div>${BTN_GESTIONE}</div>`;
}
function statoInvio() { return L.ultimoOk && Date.now() - L.ultimoOk < Math.max(30e3, L.intervallo * 3000 + 15e3) ? 'ok' : L.ultimoErrore ? 'ko' : ''; }
function collegaNonChiudere() { $('#btnGestione').onclick = chiediPassword; }
setInterval(() => {
  const d = $('#ncDot'); if (d) d.className = 'nc-dot ' + statoInvio();
  const t = $('#ncInfo'); if (t) t.textContent = infoInvio();
}, 3000);
function infoInvio() {
  const ora = x => new Date(x).toLocaleTimeString('it-IT');
  if (L.testoErrore) return `errore alle ${ora(L.ultimoErrore)}: ${L.testoErrore}`.slice(0, 120);
  return L.ultimoOk ? `ultimo invio ${ora(L.ultimoOk)} · ${CONFIG.VERSIONE.split(' ')[0]}` : `in avvio… · ${CONFIG.VERSIONE.split(' ')[0]}`;
}
setInterval(() => {
  if (!L.attivo) return;
  // un giro bloccato da più di 90 s: lo sblocco
  if (L.inCorso && L.inCorsoDa && Date.now() - L.inCorsoDa > 90e3) { log('Giro di lettura bloccato: lo sblocco'); L.inCorso = false; L.inCorsoDa = null; }
  // niente invii riusciti da 3 minuti: ricarico la pagina (solo se Edge ridà il permesso da solo)
  const rif0 = L.ultimoOk || L.avviatoDa || Date.now();
  if (Date.now() - rif0 > 3 * 60e3 && localStorage.getItem('smi_perm_persistente') === '1' && !L.ricaricoAuto) {
    log('Nessun invio riuscito da 3 minuti: ricarico la pagina'); L.ricaricoAuto = true; setTimeout(() => location.reload(), 1000);
  }
}, 30e3);
window.addEventListener('beforeunload', e => { if (L.attivo && !L.ricaricoAuto) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- aggiornamento automatico del lettore ----------
   Ogni 3 minuti il PC della linea controlla se sul sito c'è una versione nuova della pagina.
   Se c'è, si ricarica da solo e il lettore riparte (serve il permesso "Consenti a ogni visita"). */
async function controllaAggiornamento() {
  if (S.modo !== 'lettore' || !L.attivo) return;
  try {
    const r = await fetch(location.pathname + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const testo = await r.text();
    const v = /VERSIONE: '([^']+)'/.exec(testo)?.[1];
    if (v && v !== CONFIG.VERSIONE) {
      // ricarico solo se so che Edge ridà il permesso sulla cartella da solo ("Consenti a ogni visita")
      if (localStorage.getItem('smi_perm_persistente') !== '1') { if (!L.avvisatoVersione) log(`Nuova versione del sito (${v}): non ricarico da solo per non perdere il permesso sulla cartella`); L.avvisatoVersione = true; return; }
      log(`Nuova versione del sito (${v}): ricarico la pagina`);
      L.ricaricoAuto = true;
      setTimeout(() => location.reload(), 1500);
    }
  } catch { }
}
setInterval(controllaAggiornamento, 3 * 60e3);

function elencoFileHtml() {
  if (!L.file.size) return '<span style="color:var(--text-3)">Nessun file ancora.</span>';
  return [...L.file.entries()].sort().map(([nome, v]) => `<div>${ICONE.file.replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-1px"')} ${esc(v.percorso)} <span style="color:var(--text-3)">· ${(v.size / 1024).toFixed(0)} KB${v.mod ? ' · modificato ' + new Date(v.mod).toLocaleTimeString('it-IT') : ''}</span></div>`).join('');
}
function collegaLettore() {
  $('#btnLoginL')?.addEventListener('click', () => { $('#app').innerHTML = vistaLogin(); collegaLogin(() => { render(); }); });
  $('#btnCartella')?.addEventListener('click', scegliCartella);
  $('#btnRiattiva')?.addEventListener('click', riattivaPermessi);
  $('#btnAvvia')?.addEventListener('click', avviaLettore);
  $('#btnStop')?.addEventListener('click', fermaLettore);
  $('#btnNC')?.addEventListener('click', () => { L.impostazioni = false; render(); });
  $('#btnReset')?.addEventListener('click', reimpostaDaZero);
  $('#btnTogliCartelle')?.addEventListener('click', async () => { L.cartelle = []; L.file = new Map(); await IDB.set('cartelle', []); render(); });
  $('#nomePc')?.addEventListener('change', async e => { if (L.config) { L.config.nome = e.target.value.trim() || 'PC visione NID 1'; try { await IDB.set('config', L.config); } catch { } rivendicaPc(); } });
  $('#selInt')?.addEventListener('change', e => { L.intervallo = +e.target.value; localStorage.setItem('smi_intervallo', L.intervallo); if (L.attivo) { avviaTicker(); render(); } });
}
async function preparaLettore() {
  await utenteCorrente();
  L.config = await IDB.get('config').catch(() => null);
  try { const a = JSON.parse(localStorage.getItem('smi_analisi') || 'null'); if (a?.campioni?.length && SMI.adesso() - a.campioni[a.campioni.length - 1][0] < 3 * 3600e3) L.analisi = a; } catch { }
  const salvate = await IDB.get('cartelle').catch(() => null);
  if (salvate?.length && !L.cartelle.length) {
    let tutteOk = true;
    for (const h of salvate) { const p = await h.queryPermission({ mode: 'read' }); if (p !== 'granted') tutteOk = false; }
    L.cartelle = salvate;
    if (tutteOk) { localStorage.setItem('smi_perm_persistente', '1'); await scansiona(); if (L.config && S.utente && localStorage.getItem('smi_autostart') === '1') { L.pronto = true; await avviaLettore(); } }
    else { L.permessoDaRiattivare = true; localStorage.setItem('smi_perm_persistente', '0'); }
  }
  L.pronto = true;
  if (location.hash === '#lettore') render();
}
async function riattivaPermessi() {
  let ok = true;
  for (const h of L.cartelle) { const p = await h.requestPermission({ mode: 'read' }); if (p !== 'granted') ok = false; }
  if (!ok) { toast('Serve il permesso sulla cartella per leggere i file'); return; }
  localStorage.setItem('smi_perm_persistente', '0'); // dopo una ricarica manuale saprò se il permesso è rimasto
  L.permessoDaRiattivare = false; await scansiona();
  if (S.utente && L.config) avviaLettore(); else render();
}
async function scegliCartella() {
  try {
    const h = await window.showDirectoryPicker({ id: 'smi', mode: 'read' });
    if (!L.cartelle.some(x => x.name === h.name)) L.cartelle.push(h);
    try { await IDB.set('cartelle', L.cartelle); } catch (e) { log('Non riesco a salvare la cartella: ' + e.message); }
    log(`Cartella scelta: ${h.name}`);
    await scansiona(); render();
  } catch (e) { if (e.name !== 'AbortError') log('Errore cartella: ' + e.message); }
}
const SALTA = /image|immag|reference|backup|saved|asc|^\$|recycle|windows|program files/i;
async function scansiona() {
  const trovati = new Map();
  const visita = async (dir, percorso, prof) => {
    if (prof > 4) return;
    for await (const [nome, h] of dir.entries()) {
      // ogni file nel suo try: un file bloccato non deve fermare la scansione degli altri
      try {
        if (h.kind === 'directory') { if (!SALTA.test(nome)) await visita(h, percorso + '\\' + nome, prof + 1); continue; }
        const tipo = tipoFile(nome); if (!tipo) continue;
        const f = await h.getFile();
        const chiave = tipo === 'trace' ? nome : tipo;
        const prec = trovati.get(chiave);
        if (!prec || f.lastModified > prec.mod) trovati.set(chiave, { h, dir, tipo, nome, percorso: percorso + '\\' + nome, size: f.size, mod: f.lastModified });
        if (L.erroriFile) delete L.erroriFile[nome];
      } catch (e) { (L.erroriFile ||= {})[nome] = e.name + ': ' + e.message; log(`Scansione, ${nome}: ${e.message}`); }
    }
  };
  for (const c of L.cartelle) {
    try { await visita(c, c.name, 0); } catch (e) { log('Scansione: ' + e.message); }
    // se gli ini non sono comparsi nell'elenco, li cerco per nome nella cartella principale
    for (const [nome, tipo] of [['SMI_ANALYSIS.ini', 'analysisIni'], ['EI_SYSTEM.ini', 'systemIni']]) {
      if (trovati.has(tipo)) continue;
      try { const h = await c.getFileHandle(nome); const f = await h.getFile(); trovati.set(tipo, { h, tipo, nome, percorso: c.name + '\\' + nome, size: f.size, mod: f.lastModified }); log(`${nome} trovato cercandolo per nome`); }
      catch (e) { (L.erroriFile ||= {})[nome] = e.name + ': ' + e.message; }
    }
  }
  L.file = trovati; L.ultimoScan = Date.now();
  const tipi = [...trovati.values()].map(v => v.tipo);
  log(`Trovati ${trovati.size} file (${tipi.filter(t => t === 'trace').length} trace${tipi.includes('eventLog') ? ', event.log' : ', ⚠ event.log mancante'}${tipi.includes('analysisTime') ? ', analysis_time.log' : ''})`);
  const el = $('#elencoFile'); if (el) el.innerHTML = elencoFileHtml();
}
async function leggiTesto(v) {
  const f = await v.h.getFile(); v.size = f.size; v.mod = f.lastModified;
  const c = L.cache.get(v.percorso);
  if (c && c.size === f.size && c.mod === f.lastModified) return { testo: c.testo, cambiato: false };
  const testo = await testoDi(f);
  L.cache.set(v.percorso, { size: f.size, mod: f.lastModified, testo });
  return { testo, cambiato: true };
}
function avviaTicker() {
  if (L.ticker) L.ticker.terminate();
  // il timer gira in un Worker: i browser rallentano i timer delle schede in background, non quelli dei Worker
  const src = `let t;onmessage=e=>{clearInterval(t);t=setInterval(()=>postMessage(1),e.data)}`;
  L.ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  L.ticker.onmessage = () => cicloLettore();
  L.ticker.postMessage(L.intervallo * 1000);
}
async function rivendicaPc() {
  if (!L.config) return;
  const { error } = await sb().from('smi_dati').upsert({ id: 'pc_linea', dati: { pcId: L.config.id, nome: L.config.nome, da: new Date().toISOString(), email: S.utente?.email }, aggiornato: new Date().toISOString() });
  if (error) log('Errore registrazione PC: ' + error.message);
}
async function avviaLettore() {
  if (!S.utente) return;
  const nome = ($('#nomePc')?.value || L.config?.nome || 'PC visione NID 1').trim();
  const nuovo = !L.config;
  L.config = { id: L.config?.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()), nome };
  try { await IDB.set('config', L.config); } catch { }
  // la prima volta (o dopo "Gestione") questo PC diventa il PC della linea; alla ripartenza automatica controllo solo di esserlo ancora
  if (nuovo || L.autorizzato) await rivendicaPc();
  else if (!(await sonoIlPcDellaLinea())) return;
  L.sostituito = null;
  L.attivo = true; L.impostazioni = false; L.avviatoDa = Date.now(); localStorage.setItem('smi_autostart', '1');
  log('Lettore avviato');
  avviaTicker();
  try { await navigator.wakeLock?.request('screen'); } catch { }
  if (!L.canale) {
    L.canale = sb().channel('smi-lettore').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'smi_comandi' }, ev => {
      log('Richiesta "Aggiorna" ricevuta dalla dashboard'); cicloLettore(ev.new?.id);
    }).subscribe();
  }
  render(); cicloLettore();
}
function fermaLettore() { L.attivo = false; localStorage.setItem('smi_autostart', '0'); L.ticker?.terminate(); L.ticker = null; log('Lettore fermato'); render(); }
async function sonoIlPcDellaLinea() {
  let data, error;
  try { ({ data, error } = await conTimeout(sb().from('smi_dati').select('dati').eq('id', 'pc_linea').maybeSingle(), 15000, 'controllo PC')); } catch { return true; }
  if (error || !data) return true; // nessun PC registrato o errore di rete: continuo
  if (data.dati?.pcId && data.dati.pcId !== L.config?.id) {
    L.attivo = false; L.ticker?.terminate(); L.ticker = null; localStorage.setItem('smi_autostart', '0');
    L.sostituito = data.dati.nome || 'un altro PC'; log('Un altro PC è diventato il PC della linea: mi fermo');
    render(); return false;
  }
  return true;
}
async function reimpostaDaZero() {
  if (!confirm('Fermare il lettore e cancellare la configurazione di questo PC?')) return;
  L.attivo = false; L.ticker?.terminate(); L.ticker = null;
  L.config = null; L.cartelle = []; L.file = new Map(); L.cache = new Map(); L.permessoDaRiattivare = false;
  L.autorizzato = false; L.impostazioni = false; L.ultimoModello = null; L.ultimoInvio = {};
  try { await IDB.set('config', null); await IDB.set('cartelle', []); } catch { }
  localStorage.removeItem('smi_autostart');
  await sb()?.auth.signOut(); S.utente = null;
  log('Configurazione cancellata'); render();
}

const conTimeout = (p, ms = 20000, cosa = 'richiesta') => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error(`${cosa}: nessuna risposta dopo ${ms / 1000} s`)), ms))]);
function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }

/* Storico dei parametri: a ogni cambiamento di SMI_ANALYSIS.ini salvo le differenze (riga 'storia_parametri').
   Accetto una nuova fotografia solo se è uguale per due letture di fila: così una copia del file
   letta a metà non diventa una finta modifica. */
async function aggiornaStoriaParametri(m) {
  const par = m.parametri || {};
  if (!Object.keys(par).some(k => k !== 'default product')) return;
  const h = fnv(JSON.stringify(par));
  if (L.hashPar === h) return;
  if (L.parCandidato !== h) { L.parCandidato = h; return; }
  const { data, error } = await conTimeout(sb().from('smi_dati').select('dati').eq('id', 'storia_parametri'), 20000, 'storico parametri');
  if (error) { log('Storico parametri: ' + error.message); return; }
  const st = data?.[0]?.dati || {};
  if (st.ultimo?.h === h) { L.hashPar = h; return; }
  const ora = SMI.adesso();
  const nuove = st.ultimo?.par ? SMI.dataModifiche(SMI.diffParametri(st.ultimo.par, par), m.eventiParametri, st.ultimo.t, ora) : [];
  const dati = { ...st, inizio: st.inizio || ora, ultimo: { t: ora, h, par }, modifiche: [...(st.modifiche || []), ...nuove].slice(-5000) };
  const { error: e2 } = await conTimeout(sb().from('smi_dati').upsert({ id: 'storia_parametri', dati, aggiornato: new Date().toISOString() }), 45000, 'storico parametri');
  if (e2) { log('Storico parametri: ' + e2.message); return; }
  L.hashPar = h;
  log(!st.ultimo ? 'Storico parametri: prima fotografia salvata' : nuove.length ? `Parametri cambiati: ${nuove.length} valori (${[...new Set(nuove.map(x => x.prodotto))].join(', ')})` : 'Storico parametri aggiornato');
}

const msLocale = t => { const d = new Date(t); return SMI.ms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()); };
async function leggiProgressivoImmagini(v) {
  const f = await v.h.getFile(), b = new Uint8Array(await f.arrayBuffer());
  const txt = new TextDecoder('latin1').decode(b).trim();
  let n = /^\d+$/.test(txt) ? +txt : null;                       // testo, es. "9255"
  if (n == null && b.length >= 4) n = new DataView(b.buffer).getUint32(0, true); // oppure intero binario
  if (n == null || !isFinite(n)) throw new Error('progressivo foto non leggibile');
  return { n, mod: msLocale(f.lastModified) };
}

/* ---------- foto degli scarti ----------
   Per ogni cassetta scartata SMI salva due BMP (le due metà della telecamera, ~3,8 MB l'una).
   Il lettore le unisce in un solo JPEG leggero e lo carica nello spazio "smi-foto" di Supabase;
   l'elenco sta nella riga 'foto'. Tengo le ultime FOTO_MAX cassette e cancello le più vecchie. */
const FOTO_MAX = 400;
function accodaFoto(dir, n) {
  const F = L.foto ||= { prec: null, coda: [], indice: null, pausaFino: 0 };
  if (!dir) return;
  if (F.prec == null || n < F.prec) { F.prec = n; return; } // all'avvio (o se il progressivo riparte) non recupero il pregresso
  for (let k = F.prec + 1; k <= n; k++) { const c = k - (k % 2); if (!F.coda.some(x => x.k === c)) F.coda.push({ k: c, dir }); }
  F.prec = n;
  F.coda = F.coda.slice(-6);
}
async function caricaFotoInCoda() {
  const F = L.foto; if (!F?.coda.length || Date.now() < F.pausaFino) return;
  const cl = sb(); if (!cl) return;
  if (!F.indice) {
    const { data, error } = await cl.from('smi_dati').select('dati').eq('id', 'foto');
    if (error) return;
    F.indice = data?.[0]?.dati?.lista || [];
  }
  for (let i = 0; i < 2 && F.coda.length; i++) {
    const { k, dir } = F.coda[0];
    let h1, h2;
    try { h1 = await dir.getFileHandle(`image${k}.bmp`); h2 = await dir.getFileHandle(`image${k + 1}.bmp`); }
    catch { if (F.coda[0].tentativi = (F.coda[0].tentativi || 0) + 1, F.coda[0].tentativi > 5) F.coda.shift(); return; } // la seconda foto non è ancora scritta
    const f1 = await h1.getFile(), f2 = await h2.getFile();
    const b1 = await createImageBitmap(f1), b2 = await createImageBitmap(f2);
    const sc = Math.min(1, 1600 / (b1.width + b2.width));
    const cv = new OffscreenCanvas(Math.round((b1.width + b2.width) * sc), Math.round(Math.max(b1.height, b2.height) * sc));
    const cx = cv.getContext('2d'); cx.drawImage(b1, 0, 0, b1.width * sc, b1.height * sc); cx.drawImage(b2, b1.width * sc, 0, b2.width * sc, b2.height * sc);
    b1.close(); b2.close();
    const blob = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
    const t = msLocale(Math.max(f1.lastModified, f2.lastModified));
    const percorso = `${new Date(t).toISOString().slice(0, 10)}/${new Date(t).toISOString().slice(11, 19).replace(/:/g, '')}_${k}.jpg`;
    const { error } = await cl.storage.from('smi-foto').upload(percorso, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) {
      log('Foto scarti: ' + error.message + (/bucket|not found/i.test(error.message) ? ' (su Supabase manca lo spazio smi-foto: va eseguito supabase_foto.sql)' : ''));
      F.pausaFino = Date.now() + 10 * 60e3; return;
    }
    F.coda.shift();
    F.indice.push([t, percorso, L.ultimoModello?.stato?.prodotto || '']);
    const via = F.indice.length > FOTO_MAX ? F.indice.splice(0, F.indice.length - FOTO_MAX) : [];
    if (via.length) await cl.storage.from('smi-foto').remove(via.map(x => x[1]));
    await cl.from('smi_dati').upsert({ id: 'foto', dati: { lista: F.indice }, aggiornato: new Date().toISOString() });
  }
}

async function cicloLettore(comandoId) {
  if (!L.attivo || L.inCorso) return; L.inCorso = true; L.inCorsoDa = Date.now();
  try {
    if (Date.now() - L.ultimoScan > 60000) await scansiona();
    const testi = { traces: [] }; let cambiato = false, righeAnalisi = null, modAnalisi = null, immagini = null;
    for (const v of L.file.values()) {
      try {
        if (v.tipo === 'immagini') { immagini = await leggiProgressivoImmagini(v); accodaFoto(v.dir, immagini.n); continue; }
        const { testo, cambiato: c } = await leggiTesto(v);
        if (v.tipo === 'analysisTime') { righeAnalisi = (testo.match(/\n/g) || []).length; modAnalisi = v.mod; continue; }
        if (c) cambiato = true;
        if (v.tipo === 'trace') testi.traces.push({ nome: v.nome, testo }); else testi[v.tipo] = testo;
        if (L.erroriFile) delete L.erroriFile[v.nome];
      } catch (e) { log(`Non riesco a leggere ${v.nome}: ${e.message}`); L.ultimoScan = 0; (L.erroriFile ||= {})[v.nome] = e.message; }
    }
    if (!testi.eventLog) { log('⚠ event.log non trovato nella cartella scelta'); return; }
    if (cambiato || !L.ultimoModello) L.ultimoModello = SMI.costruisciModello(testi);
    const m = L.ultimoModello;
    // conteggio in diretta da analysis_time.log (4 righe per cassetta)
    const ora = SMI.adesso(); const A = L.analisi;
    if (righeAnalisi != null) {
      if (A.righePrec != null && righeAnalisi < A.righePrec) A.offset += A.righePrec; // file ruotato in .bak
      A.righePrec = righeAnalisi;
      // il campione porta l'ora in cui SMI ha scritto le righe (data di modifica del file), non l'ora della lettura:
      // con la lettura ogni 2–5 s, usare l'ora di lettura gonfiava la velocità (fino a 27/min con la linea a 24)
      const n = (A.offset + righeAnalisi) / 4, ultimo = A.campioni[A.campioni.length - 1];
      let tc = ora;
      if (modAnalisi && (!ultimo || n !== ultimo[1])) { const d = new Date(modAnalisi); tc = Math.min(ora, SMI.ms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())); }
      if (ultimo) tc = Math.max(tc, ultimo[0]);
      A.campioni.push(ultimo && n === ultimo[1] ? [tc, n] : [tc, n, 1]); // 1 = qui SMI ha appena scritto
      A.campioni = A.campioni.filter(c => c[0] > ora - 3 * 3600e3);
      try { localStorage.setItem('smi_analisi', JSON.stringify(A)); } catch { } // così il conteggio sopravvive a un riavvio
    }
    // scarti in diretta: SMI salva 2 foto (le due metà della telecamera) per ogni cassetta scartata e tiene il
    // progressivo in D:\images\image_last_number.dat. Il progressivo è circolare: se torna indietro, riparto da lì.
    const I = L.immagini;
    if (immagini) {
      if (I.prec != null && immagini.n < I.prec) I.offset += I.prec;
      I.prec = immagini.n;
      const n = I.offset + immagini.n, u = I.campioni[I.campioni.length - 1];
      if (!u || u[1] !== n) I.campioni.push([u ? Math.max(u[0], Math.min(ora, immagini.mod)) : Math.min(ora, immagini.mod), n]);
      I.campioni = I.campioni.filter(c => c[0] > ora - 3 * 3600e3);
      try { localStorage.setItem('smi_immagini', JSON.stringify(I)); } catch { }
    }
    const valoreA = t => { let best = null; for (const c of A.campioni) if (c[0] <= t) best = c; return best; };
    // valore al momento t, interpolato tra il campione prima e quello dopo
    const valoreInterp = t => { const p = valoreA(t), n = A.campioni.find(c => c[0] > t); if (!p) return n || null; if (!n) return p; return [t, p[1] + (n[1] - p[1]) * (t - p[0]) / (n[0] - p[0])]; };
    let extra = null;
    if (A.campioni.length) {
      const now = A.campioni[A.campioni.length - 1];
      const snap = m.stato.ultimiContatoriTs || 0;
      const base = valoreInterp(snap) || now;
      // velocità misurata tra due scritture di SMI (conteggi esatti agli istanti esatti): SMI scrive a blocchi,
      // e misurare da un'ora qualsiasi gonfiava o sgonfiava il valore di un blocco intero
      const scritture = A.campioni.filter(c => c[2]);
      const velocitaSu = finestra => {
        let fine = scritture[scritture.length - 1]; if (!fine) return null;
        if (ora - fine[0] > 30e3) fine = now; // niente scritture da 30 s: la linea rallenta o è ferma
        let ini = null; for (const c of scritture) { if (c[0] <= fine[0] - finestra) ini = c; else break; }
        if (!ini) ini = scritture[0];
        return fine[0] - ini[0] >= finestra / 2 ? [ini, fine] : null;
      };
      const vel = w => { const r = velocitaSu(w); return r ? (r[1][1] - r[0][1]) / ((r[1][0] - r[0][0]) / 60e3) : null; };
      extra = {
        daTs: base[0], cassette: Math.max(0, Math.round(now[1] - base[1])),
        primaDa: (A.campioni.find(c => c[0] >= base[0] && c[1] > base[1]) || [null])[0],
        velocita1: vel(120e3),
        velocita5: vel(300e3),
      };
      if (immagini && I.campioni.length) {
        // foto scritte dopo l'ultimo contatore orario (prima di quell'ora conta già il contatore di SMI)
        const snapI = m.stato.ultimiContatoriTs || 0;
        let baseI = null; for (const c of I.campioni) if (c[0] <= snapI) baseI = c;
        if (!baseI) baseI = I.campioni[0];
        const ultimoI = I.campioni[I.campioni.length - 1];
        extra.scarti = Math.max(0, Math.round((ultimoI[1] - baseI[1]) / 2));
        extra.ultimoScarto = ultimoI[0];
      }
      if (modAnalisi) { const d = new Date(modAnalisi); extra.ultimaCassetta = SMI.ms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()); }
    }
    const vivo = { battito: ora, intervallo: L.intervallo, stato: m.stato, extra, versione: 1, file: [...L.file.values()].map(v => [v.nome, v.size, v.mod]), erroriFile: L.erroriFile || {}, nParametri: Object.keys(m.parametri || {}).length, app: CONFIG.VERSIONE.split(' ')[0] };
    const righe = [
      ['storico', { versione: m.versione, generato: m.generato, fineDati: m.fineDati, stato: m.stato, produzioni: m.produzioni, minuti: m.minuti, fermi: m.fermi, prodotti: m.prodotti }],
      ['parametri', m.parametri],
      ['allarmi', (m.allarmi || []).map(a => a.slice(0, 3))],
    ];
    const daInviare = [];
    for (const [id, dati] of righe) { const s = JSON.stringify(dati); const h = fnv(s); if (L.ultimoInvio[id] !== h) daInviare.push({ id, dati, h }); }
    daInviare.push({ id: 'vivo', dati: vivo });
    const { error } = await conTimeout(sb().from('smi_dati').upsert(daInviare.map(({ id, dati }) => ({ id, dati, aggiornato: new Date().toISOString() }))), 45000, 'invio dati');
    if (error) { log('Errore invio: ' + error.message); L.ultimoErrore = Date.now(); L.testoErrore = error.message; return; }
    L.ultimoOk = Date.now(); L.ultimoErrore = null; L.testoErrore = null;
    try { await aggiornaStoriaParametri(m); } catch (e) { log('Storico parametri: ' + e.message); }
    try { await caricaFotoInCoda(); } catch (e) { log('Foto scarti: ' + e.message); }
    for (const d of daInviare) if (d.h) L.ultimoInvio[d.id] = d.h;
    L.ciclo++;
    if (L.ciclo % Math.max(1, Math.round(30 / L.intervallo)) === 0 && !(await sonoIlPcDellaLinea())) return;
    if (daInviare.length > 1) log(`Inviato: ${daInviare.filter(d => d.h).map(d => d.id).join(', ')} + stato`);
    else if (L.ciclo % Math.max(1, Math.round(60 / L.intervallo)) === 0) log(`Tutto ok · ${extra ? n0(extra.cassette) + ' cassette dall\'ultimo contatore · ' + (extra.velocita1 != null ? n1(extra.velocita1) + '/min' : '') : 'nessun dato in diretta'}`);
    if (comandoId) await conTimeout(sb().from('smi_comandi').update({ eseguito: new Date().toISOString() }).eq('id', comandoId), 15000, 'comandi');
    else {
      const { data: pend } = await conTimeout(sb().from('smi_comandi').select('id').is('eseguito', null).limit(20), 15000, 'comandi');
      if (pend?.length) await conTimeout(sb().from('smi_comandi').update({ eseguito: new Date().toISOString() }).in('id', pend.map(p => p.id)), 15000, 'comandi');
    }
    const el = $('#elencoFile'); if (el) el.innerHTML = elencoFileHtml();
  } catch (e) { log('Errore: ' + e.message); L.ultimoErrore = Date.now(); L.testoErrore = e.message; }
  finally { L.inCorso = false; L.inCorsoDa = null; }
}

/* ---------- avvio ---------- */
document.addEventListener('DOMContentLoaded', () => {
    render();
});
