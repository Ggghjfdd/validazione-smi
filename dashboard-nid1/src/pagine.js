/* ==========================================================================
   FOTO DEGLI SCARTI · ARCHIVIO PROVE · ANALISI EFFICIENZE E FERMI
   (usa le funzioni e lo stato globali di app.js)
   ========================================================================== */

const TIPI_PROVA = ['Prova parametri', 'Campione difettoso', 'Cassette neutre', 'Avviamento / learning', 'Verifica qualità', 'Altro'];
const ESITI = { valutare: 'Da valutare', corretto: 'Scarto corretto', falso: 'Falso scarto' };
const COL_ESITO = { valutare: 'var(--text-3)', corretto: 'var(--good)', falso: 'var(--crit)' };
const urlFoto = new Map();
const oraSec = t => new Date(t).toISOString().slice(11, 19);
const isoG = t => new Date(t).toISOString().slice(0, 10);
const nomeSicuro = s => String(s || 'prodotto').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const tutteLeProve = () => [...(S.archivioProve?.values() || [])].filter(p => !p.eliminata);

/* ---------- scaricare ---------- */
function scaricaBlob(blob, nome) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
async function scaricaFoto(percorso, nome) {
  const { data, error } = await sb().storage.from('smi-foto').download(percorso);
  if (error) { toast('Non riesco a scaricare la foto: ' + esc(error.message)); return; }
  scaricaBlob(data, nome);
}
let jszipP = null;
function caricaJSZip() {
  return jszipP ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => ok(window.JSZip); s.onerror = () => { jszipP = null; ko(new Error('libreria zip non caricata')); };
    document.head.appendChild(s);
  });
}
// voci: [{percorso, nome}] → una foto si scarica così com'è, più foto in uno zip
async function scaricaFotoMolte(voci, nomeZip, extra = {}) {
  if (!voci.length) return;
  if (voci.length === 1 && !Object.keys(extra).length) return scaricaFoto(voci[0].percorso, voci[0].nome);
  toast(`Preparo ${voci.length} foto…`);
  try {
    const JSZip = await caricaJSZip(), zip = new JSZip();
    let ok = 0;
    for (let i = 0; i < voci.length; i += 6) await Promise.all(voci.slice(i, i + 6).map(async v => {
      const { data } = await sb().storage.from('smi-foto').download(v.percorso);
      if (data) { zip.file(v.nome, data); ok++; }
    }));
    for (const [n, testo] of Object.entries(extra)) zip.file(n, testo);
    scaricaBlob(await zip.generateAsync({ type: 'blob' }), nomeZip);
    if (ok < voci.length) toast(`Scaricate ${ok} foto su ${voci.length}: le altre non sono più disponibili`);
  } catch (e) { toast('Download non riuscito: ' + esc(e.message)); }
}
const nomeFotoScarto = f => `scarto_${nomeSicuro(f[2])}_${f[1].split('/')[0]}_${f[1].split('/').pop()}`;
async function urlFirmati(percorsi) {
  const cl = sb(); if (!cl) return;
  const mancanti = [...new Set(percorsi)].filter(p => p && !urlFoto.has(p));
  for (let i = 0; i < mancanti.length; i += 100) {
    const { data } = await cl.storage.from('smi-foto').createSignedUrls(mancanti.slice(i, i + 100), 3600);
    for (const d of data || []) if (d.signedUrl) urlFoto.set(d.path, d.signedUrl);
  }
}

/* ---------- archivio prove (righe 'prova_<id>' di smi_dati) ---------- */
async function caricaProve() {
  const { data, error } = await sb().from('smi_dati').select('id,dati').like('id', 'prova_%');
  if (error) { toast('Non riesco a leggere le prove: ' + esc(error.message)); S.archivioProve ||= new Map(); return; }
  S.archivioProve = new Map((data || []).map(r => [r.dati.id, r.dati]));
}
async function aggiornaProvaRemota(id) {
  if (!S.archivioProve) return;
  const { data } = await sb().from('smi_dati').select('id,dati').eq('id', id);
  if (data?.[0]) S.archivioProve.set(data[0].dati.id, data[0].dati);
  if (location.hash === '#prove' && !document.querySelector('.sovra')) aggiornaRisultatiProve();
}
// parametri di un prodotto all'istante t: valori attuali, tornando indietro con lo storico delle modifiche
function parametriAl(prodotto, t) {
  const att = S.modello?.parametri?.[prodotto]; if (!att) return null;
  const par = JSON.parse(JSON.stringify(att));
  for (const m of S.storiaPar.filter(x => x.prodotto === prodotto && x.t > t).sort((a, b) => b.t - a.t)) {
    const c = par[m.cam] ||= {};
    if (m.da == null) delete c[m.p]; else c[m.p] = m.da;
  }
  return par;
}
function produzioneAl(t) {
  return (S.modello?.produzioni || []).find(p => t >= p.inizio - 5 * 60e3 && t <= fineProd(p) + 5 * 60e3);
}
async function salvaProva(f, campi, gruppo) {
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const foto = `prove/${id}.jpg`;
  const { error: e1 } = await sb().storage.from('smi-foto').copy(f[1], foto);
  if (e1) throw new Error('la foto non è più disponibile (' + e1.message + ')');
  const pr = produzioneAl(f[0]), prodotto = f[2] || pr?.prodotto || '';
  const rec = {
    id, t: f[0], foto, fotoOrig: f[1], prodotto, gruppo,
    operatore: campi.operatore.trim(), tipo: campi.tipo.trim(), esito: campi.esito, note: campi.note.trim(),
    parametri: parametriAl(prodotto, f[0]),
    parametriCerti: !!(S.storiaParDa && f[0] >= S.storiaParDa),
    produzione: pr ? { id: pr.id, inizio: pr.inizio, t: pr.t, r: pr.r } : null,
    chi: S.utente?.email || '', creato: SMI.adesso(),
  };
  const { error } = await sb().from('smi_dati').upsert({ id: 'prova_' + id, dati: rec, aggiornato: new Date().toISOString() });
  if (error) { await sb().storage.from('smi-foto').remove([foto]); throw new Error(error.message); }
  (S.archivioProve ||= new Map()).set(id, rec);
  return rec;
}
async function modificaProva(id, cambi) {
  const p = S.archivioProve.get(id); if (!p) return false;
  const rec = { ...p, ...cambi, modificato: SMI.adesso(), modificatoDa: S.utente?.email || '' };
  const { error } = await sb().from('smi_dati').upsert({ id: 'prova_' + id, dati: rec, aggiornato: new Date().toISOString() });
  if (error) { toast('Non riesco a salvare: ' + esc(error.message)); return false; }
  S.archivioProve.set(id, rec); return true;
}

/* ---------- finestre sovrapposte ---------- */
function sovra(html, classe = '') {
  const v = document.createElement('div'); v.className = 'sovra';
  v.innerHTML = `<div class="vetro modale sovra-box ${classe}">${html}</div>`;
  v.onclick = e => { if (e.target === v) v.remove(); };
  document.body.appendChild(v);
  return v;
}
function apriFormProva(fs, dopo) {
  const prove = tutteLeProve();
  const ops = [...new Set(prove.map(p => p.operatore).filter(Boolean))].sort();
  const tipi = [...new Set([...TIPI_PROVA, ...prove.map(p => p.tipo)].filter(Boolean))];
  let ultimoOp = ''; try { ultimoOp = localStorage.getItem('smi_operatore') || ''; } catch { }
  const prod = [...new Set(fs.map(f => f[2] || produzioneAl(f[0])?.prodotto || '—'))].join(', ');
  const v = sovra(`<h2>Segna come prova</h2>
    <div class="nota" style="margin-top:4px">${fs.length === 1 ? `Foto del ${giornoCorto(fs[0][0])} alle ${oraSec(fs[0][0])}` : `${fs.length} foto (dal ${giornoCorto(fs[fs.length - 1][0])} ${oraSec(fs[fs.length - 1][0])} al ${giornoCorto(fs[0][0])} ${oraSec(fs[0][0])})`} · <span style="text-transform:capitalize">${esc(prod)}</span>.<br>Vengono salvati per sempre la foto, l'ora, il prodotto e <b>tutti i parametri di analisi di quel momento</b>.</div>
    <form id="fProva" class="form-prova">
      <label class="campo">Operatore che ha fatto la prova<input type="text" name="operatore" list="dlOp" required value="${esc(ultimoOp)}" autocomplete="off"></label>
      <datalist id="dlOp">${ops.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
      <label class="campo">Tipo di prova<input type="text" name="tipo" list="dlTipo" required autocomplete="off" placeholder="Scegli o scrivi"></label>
      <datalist id="dlTipo">${tipi.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
      <label class="campo">Esito<select name="esito">${Object.entries(ESITI).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="campo">Note<textarea name="note" rows="3" placeholder="Cosa si stava provando, cosa si è visto…"></textarea></label>
      <div class="escl-piede"><span id="fpErr" class="nota" style="margin:0;color:#ffb4ae"></span><span class="spazio"></span><button type="button" class="btn" id="fpAnn">Annulla</button><button class="btn primario" id="fpOk">Salva ${fs.length > 1 ? fs.length + ' prove' : 'prova'}</button></div>
    </form>`, 'stretta');
  v.querySelector('#fpAnn').onclick = () => v.remove();
  v.querySelector('#fProva').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try { localStorage.setItem('smi_operatore', d.operatore.trim()); } catch { }
    const b = v.querySelector('#fpOk'); b.disabled = true;
    const gruppo = fs.length > 1 ? 'g' + Date.now().toString(36) : null;
    let ok = 0, err = '';
    for (const f of fs) { b.textContent = `Salvo ${ok + 1} di ${fs.length}…`; try { await salvaProva(f, d, gruppo); ok++; } catch (x) { err = x.message; } }
    if (ok) toast(`${ok} ${ok === 1 ? 'prova salvata' : 'prove salvate'} nell'archivio Prove`);
    if (ok < fs.length) { v.querySelector('#fpErr').textContent = `${fs.length - ok} non salvate: ${err}`; b.disabled = false; b.textContent = 'Riprova'; fs = fs.slice(ok); }
    else v.remove();
    dopo?.();
  };
  v.querySelector('input[name=tipo]').focus();
}
function apriFotoGrande(f, url, dopo) {
  const pv = tutteLeProve().filter(p => p.fotoOrig === f[1]);
  const v = sovra(`<img class="foto-big" src="${url}" alt="">
    <div class="barra-filtri" style="margin:12px 0 0">
      <span style="text-transform:capitalize"><b>${esc(f[2] || '')}</b></span><span class="nota" style="margin:0">${giornoLungo(f[0])} · ${oraSec(f[0])}</span>
      ${pv.map(p => `<span class="chip info">Prova: ${esc(p.tipo)} · ${esc(p.operatore)}</span>`).join('')}
      <span class="spazio"></span>
      <button class="btn" id="fgScarica">⬇ Scarica</button>
      <button class="btn primario" id="fgProva">${pv.length ? 'Segna un\'altra prova' : 'Segna come prova'}</button>
      <button class="btn" id="fgChiudi">Chiudi</button>
    </div>`, 'larga');
  v.querySelector('#fgChiudi').onclick = () => v.remove();
  v.querySelector('#fgScarica').onclick = () => scaricaFoto(f[1], nomeFotoScarto(f));
  v.querySelector('#fgProva').onclick = () => { v.remove(); apriFormProva([f], dopo); };
}

/* ---------- scheda "Foto scarti" della produzione ---------- */
function fotoHtml(lista) {
  if (S.modo !== 'remoto') return '<div class="vuoto">Le foto degli scarti sono disponibili solo con i dati dal PC della linea.</div>';
  if (!lista.length) return `<div class="vuoto">Nessuna foto di scarti per questa produzione.<br><small>Le foto arrivano solo se il PC della linea legge anche la cartella D:\\images, e solo per gli scarti successivi all'attivazione. Si tengono le ultime ${FOTO_MAX} cassette scartate; le foto segnate come prova restano per sempre.</small></div>`;
  return `<div class="barra-filtri foto-barra">
      <span class="nota" style="margin:0">${n0(lista.length)} cassette scartate fotografate. Clicca per ingrandire, spunta per scaricare o segnare più foto insieme.</span>
      <span class="spazio"></span>
      <button class="btn" id="fotoTutte">Seleziona tutte</button>
      <button class="btn" id="fotoScarica">⬇ Scarica tutte</button>
      <button class="btn primario" id="fotoProva" disabled>Segna come prova</button>
    </div>
    <div class="foto-griglia">${lista.map(f => `<figure class="foto" data-foto="${esc(f[1])}"><div class="foto-img"></div><label class="foto-sel" title="Seleziona"><input type="checkbox" data-sel="${esc(f[1])}"></label><figcaption><span>${giornoCorto(f[0])} ${oraSec(f[0])}</span><span class="foto-tag"></span></figcaption></figure>`).join('')}</div>`;
}
async function caricaMiniature(lista) {
  const box = document.querySelector('[data-pan="s"]'); if (!box || !lista.length || !sb()) return;
  if (!S.archivioProve) await caricaProve();
  await urlFirmati(lista.map(f => f[1]));
  const perPercorso = new Map(lista.map(f => [f[1], f]));
  const sel = new Set();
  const tag = () => {
    const prove = tutteLeProve();
    box.querySelectorAll('.foto[data-foto]').forEach(el => {
      const p = prove.filter(x => x.fotoOrig === el.dataset.foto);
      el.classList.toggle('e-prova', !!p.length);
      el.querySelector('.foto-tag').innerHTML = p.length ? `<span class="chip info">PROVA · ${esc(p[0].tipo)}</span>` : '';
    });
  };
  const aggiornaBarra = () => {
    const n = sel.size;
    box.querySelector('#fotoScarica').textContent = n ? `⬇ Scarica ${n} selezionate` : '⬇ Scarica tutte';
    const bp = box.querySelector('#fotoProva'); bp.disabled = !n; bp.textContent = n > 1 ? `Segna ${n} come prova` : 'Segna come prova';
    box.querySelector('#fotoTutte').textContent = n === lista.length ? 'Deseleziona' : 'Seleziona tutte';
  };
  box.querySelectorAll('.foto[data-foto]').forEach(el => {
    const f = perPercorso.get(el.dataset.foto), u = urlFoto.get(el.dataset.foto);
    if (!u) { el.querySelector('.foto-img').textContent = 'non più disponibile'; return; }
    el.querySelector('.foto-img').innerHTML = `<img loading="lazy" src="${u}" alt="">`;
    el.querySelector('.foto-img').onclick = () => apriFotoGrande(f, u, tag);
  });
  box.querySelectorAll('[data-sel]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); c.closest('.foto').classList.toggle('sel', c.checked); aggiornaBarra(); });
  box.querySelector('#fotoTutte').onclick = () => {
    const tutte = sel.size !== lista.length;
    box.querySelectorAll('[data-sel]').forEach(c => { c.checked = tutte; c.closest('.foto').classList.toggle('sel', tutte); tutte ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); });
    aggiornaBarra();
  };
  box.querySelector('#fotoScarica').onclick = () => {
    const fs = (sel.size ? lista.filter(f => sel.has(f[1])) : lista);
    scaricaFotoMolte(fs.map(f => ({ percorso: f[1], nome: nomeFotoScarto(f) })), `scarti_${nomeSicuro(fs[0][2])}_${isoG(fs[0][0])}.zip`);
  };
  box.querySelector('#fotoProva').onclick = () => apriFormProva(lista.filter(f => sel.has(f[1])), tag);
  tag();
}

/* ==========================================================================
   PAGINA PROVE  (#prove)
   ========================================================================== */
S.pv ||= { gruppo: 'tempo', vista: 'schede', q: '', da: '', a: '', prodotto: '', tipo: '', operatore: '', esito: '', sel: new Set() };
function filtraProve() {
  const f = S.pv, q = f.q.trim().toLowerCase();
  const da = f.da ? Date.parse(f.da + 'T00:00:00Z') : -Infinity, a = f.a ? Date.parse(f.a + 'T00:00:00Z') + 864e5 : Infinity;
  return tutteLeProve().filter(p => p.t >= da && p.t < a
    && (!f.prodotto || p.prodotto === f.prodotto) && (!f.tipo || p.tipo === f.tipo)
    && (!f.operatore || p.operatore === f.operatore) && (!f.esito || p.esito === f.esito)
    && (!q || [p.prodotto, p.tipo, p.operatore, p.note, ESITI[p.esito], p.chi].join(' ').toLowerCase().includes(q))
  ).sort((x, y) => y.t - x.t);
}
const opzioni = (valori, sel, tutti) => `<option value="">${tutti}</option>` + valori.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
function vistaProve() {
  if (S.modo !== 'remoto') return `<div class="vetro card"><div class="vuoto">L'archivio delle prove è disponibile solo con l'accesso ai dati del PC della linea.</div></div>`;
  if (!S.archivioProve) { caricaProve().then(() => { if (location.hash === '#prove') render(); }); return `<div class="centro"><div class="pill"><span class="dot"></span>Carico le prove…</div></div>`; }
  const tutte = tutteLeProve(), f = S.pv, uniq = k => [...new Set(tutte.map(p => p[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return `<section class="vetro card">
    <h2>Archivio prove</h2>
    <div class="nota" style="margin-top:0">Ogni prova contiene la foto della cassetta, l'ora, il prodotto, l'operatore, il tipo di prova, l'esito e tutti i parametri di analisi di quel momento. Le prove si segnano dalla scheda <b>Foto scarti</b> di una produzione.</div>
    <div class="barra-filtri" style="margin-top:14px">
      <input type="search" id="pvQ" placeholder="Cerca (note, operatore…)" value="${esc(f.q)}" style="min-width:200px">
      <label class="campo-in">Dal <input type="date" id="pvDa" value="${f.da}"></label>
      <label class="campo-in">al <input type="date" id="pvA" value="${f.a}"></label>
      <select id="pvProd">${opzioni(uniq('prodotto'), f.prodotto, 'Tutti i prodotti')}</select>
      <select id="pvTipo">${opzioni(uniq('tipo'), f.tipo, 'Tutti i tipi')}</select>
      <select id="pvOp">${opzioni(uniq('operatore'), f.operatore, 'Tutti gli operatori')}</select>
      <select id="pvEsito"><option value="">Tutti gli esiti</option>${Object.entries(ESITI).map(([k, l]) => `<option value="${k}" ${f.esito === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="barra-filtri">
      <span class="nota" style="margin:0">Raggruppa per</span>
      <div class="seg" id="pvGruppo">${[['tempo', 'Giorno'], ['prodotto', 'Prodotto'], ['tipo', 'Tipo di prova'], ['operatore', 'Operatore'], ['esito', 'Esito']].map(([k, l]) => `<button data-g="${k}" class="${f.gruppo === k ? 'att' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" id="pvVista">${[['schede', 'Foto'], ['tabella', 'Tabella']].map(([k, l]) => `<button data-v="${k}" class="${f.vista === k ? 'att' : ''}">${l}</button>`).join('')}</div>
      <span class="spazio"></span>
      <button class="btn" id="pvConfronta" disabled>Confronta parametri</button>
      <button class="btn" id="pvCsv">Esporta Excel (CSV)</button>
      <button class="btn" id="pvZip">⬇ Scarica foto</button>
    </div>
    <div id="pvRisultati"></div>
  </section>`;
}
function riassuntoProve(lista) {
  const conta = k => { const m = new Map(); for (const p of lista) { const v = k === 'esito' ? ESITI[p.esito] || '—' : p[k] || '—'; m.set(v, (m.get(v) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const blocco = (tit, voci) => `<div class="tile"><div class="lab">${tit}</div>${voci.slice(0, 5).map(([v, n]) => `<div class="mod-voce"><span style="text-transform:capitalize">${esc(v)}</span><b>${n}</b></div>`).join('') || '<div class="nota">—</div>'}</div>`;
  return `<div class="kpi" style="margin-top:4px">
    <div class="tile"><div class="lab">Prove</div><div class="val">${n0(lista.length)}</div><div class="det">${n0(new Set(lista.map(p => p.prodotto)).size)} prodotti · ${n0(new Set(lista.map(p => p.operatore)).size)} operatori</div></div>
    ${blocco('Per tipo', conta('tipo'))}${blocco('Per esito', conta('esito'))}${blocco('Per operatore', conta('operatore'))}</div>`;
}
const chiaveGruppo = (p, g) => g === 'tempo' ? isoG(p.t) : g === 'esito' ? (ESITI[p.esito] || '—') : (p[g] || '—');
const etichettaGruppo = (k, g) => g === 'tempo' ? giornoLungo(Date.parse(k + 'T00:00:00Z')) : k;
function principali(par, n = 4) {
  if (!par) return '<span class="nota" style="margin:0">parametri non disponibili</span>';
  const cams = Object.keys(par).sort();
  return PARAM_PRINCIPALI.slice(0, n).map(([k, l]) => `<div class="mod-voce"><span>${esc(l)}</span><span class="mod-val">${cams.map(c => esc(par[c]?.[k] ?? '—')).join(' / ')}</span></div>`).join('');
}
function aggiornaRisultatiProve() {
  const box = $('#pvRisultati'); if (!box) return;
  const lista = filtraProve(), f = S.pv;
  for (const id of [...f.sel]) if (!lista.some(p => p.id === id)) f.sel.delete(id);
  if (!tutteLeProve().length) { box.innerHTML = '<div class="vuoto">Nessuna prova salvata finora.<br><small>Apri una produzione → scheda <b>Foto scarti</b> → clicca una foto → <b>Segna come prova</b>.</small></div>'; collegaRisultatiProve(lista); return; }
  if (!lista.length) { box.innerHTML = riassuntoProve(lista) + '<div class="vuoto">Nessuna prova con questi filtri.</div>'; collegaRisultatiProve(lista); return; }
  const gruppi = new Map();
  for (const p of lista) { const k = chiaveGruppo(p, f.gruppo); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k).push(p); }
  const ordine = [...gruppi.keys()].sort((a, b) => f.gruppo === 'tempo' ? b.localeCompare(a) : gruppi.get(b).length - gruppi.get(a).length);
  const scheda = p => `<figure class="foto prova-card ${f.sel.has(p.id) ? 'sel' : ''}" data-prova="${p.id}"><div class="foto-img" data-img="${esc(p.foto)}"></div>
      <label class="foto-sel" title="Seleziona per confrontare o scaricare"><input type="checkbox" data-psel="${p.id}" ${f.sel.has(p.id) ? 'checked' : ''}></label>
      <figcaption class="prova-cap"><div class="prova-tit"><b>${esc(p.tipo)}</b><span class="esito" style="color:${COL_ESITO[p.esito]}">● ${ESITI[p.esito] || ''}</span></div>
        <div><span style="text-transform:capitalize">${esc(p.prodotto)}</span> · ${esc(p.operatore)}</div>
        <div class="nota" style="margin:2px 0 0">${giornoCorto(p.t)} ${oraSec(p.t)}${p.note ? ' · ' + esc(p.note.slice(0, 60)) + (p.note.length > 60 ? '…' : '') : ''}</div></figcaption></figure>`;
  const riga = p => `<tr data-prova="${p.id}" class="cliccabile"><td><input type="checkbox" data-psel="${p.id}" ${f.sel.has(p.id) ? 'checked' : ''}></td><td>${giornoCorto(p.t)} ${oraSec(p.t)}</td><td class="sx" style="text-transform:capitalize">${esc(p.prodotto)}</td><td class="sx">${esc(p.tipo)}</td><td class="sx">${esc(p.operatore)}</td><td class="sx" style="color:${COL_ESITO[p.esito]}">${ESITI[p.esito] || ''}</td><td class="sx note-cella">${esc(p.note)}</td><td class="sx">${principali(p.parametri, 3)}</td></tr>`;
  box.innerHTML = riassuntoProve(lista) + ordine.map(k => {
    const ps = gruppi.get(k);
    return `<div class="sezione"><h3 class="gruppo-tit"><span style="text-transform:${f.gruppo === 'tempo' ? 'none' : 'capitalize'}">${esc(etichettaGruppo(k, f.gruppo))}</span><span class="chip">${ps.length}</span></h3>
      ${f.vista === 'schede' ? `<div class="foto-griglia">${ps.map(scheda).join('')}</div>`
        : `<div class="scroll-x"><table class="tabella tab-prove"><thead><tr><th></th><th>Quando</th><th class="sx">Prodotto</th><th class="sx">Tipo</th><th class="sx">Operatore</th><th class="sx">Esito</th><th class="sx">Note</th><th class="sx">Parametri principali (cam. 0 / 1)</th></tr></thead><tbody>${ps.map(riga).join('')}</tbody></table></div>`}</div>`;
  }).join('');
  collegaRisultatiProve(lista);
}
function collegaRisultatiProve(lista) {
  const f = S.pv, box = $('#pvRisultati');
  const barra = () => { const n = f.sel.size; $('#pvConfronta').disabled = n < 2; $('#pvConfronta').textContent = n >= 2 ? `Confronta ${n} prove` : 'Confronta parametri'; $('#pvZip').textContent = n ? `⬇ Scarica ${n} foto` : '⬇ Scarica foto'; };
  box.querySelectorAll('[data-psel]').forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = () => { c.checked ? f.sel.add(c.dataset.psel) : f.sel.delete(c.dataset.psel); c.closest('[data-prova]').classList.toggle('sel', c.checked); barra(); }; });
  box.querySelectorAll('.foto-sel').forEach(l => l.onclick = e => e.stopPropagation());
  box.querySelectorAll('[data-prova]').forEach(el => el.onclick = () => apriDettaglioProva(el.dataset.prova));
  barra();
  const imgs = [...box.querySelectorAll('[data-img]')];
  urlFirmati(imgs.map(i => i.dataset.img)).then(() => imgs.forEach(i => { const u = urlFoto.get(i.dataset.img); i.innerHTML = u ? `<img loading="lazy" src="${u}" alt="">` : 'foto non disponibile'; }));
  $('#pvCsv').onclick = () => esportaProveCsv(lista);
  $('#pvZip').onclick = () => {
    const ps = f.sel.size ? lista.filter(p => f.sel.has(p.id)) : lista;
    if (!ps.length) return;
    scaricaFotoMolte(ps.map(p => ({ percorso: p.foto, nome: `${isoG(p.t)}_${oraSec(p.t).replace(/:/g, '')}_${nomeSicuro(p.prodotto)}_${nomeSicuro(p.tipo)}_${p.id}.jpg` })), `prove_${isoG(SMI.adesso())}.zip`, { 'prove.csv': csvProve(ps) });
  };
  $('#pvConfronta').onclick = () => confrontaProve(lista.filter(p => f.sel.has(p.id)));
}
function collegaProve() {
  if (!$('#pvRisultati')) return;
  const f = S.pv, su = () => aggiornaRisultatiProve();
  $('#pvQ').oninput = e => { f.q = e.target.value; su(); };
  [['#pvDa', 'da'], ['#pvA', 'a'], ['#pvProd', 'prodotto'], ['#pvTipo', 'tipo'], ['#pvOp', 'operatore'], ['#pvEsito', 'esito']].forEach(([s, k]) => $(s).onchange = e => { f[k] = e.target.value; su(); });
  $('#pvGruppo').onclick = e => { const b = e.target.closest('button'); if (!b) return; f.gruppo = b.dataset.g; $('#pvGruppo').querySelectorAll('button').forEach(x => x.classList.toggle('att', x === b)); su(); };
  $('#pvVista').onclick = e => { const b = e.target.closest('button'); if (!b) return; f.vista = b.dataset.v; $('#pvVista').querySelectorAll('button').forEach(x => x.classList.toggle('att', x === b)); su(); };
  su();
}
function tabellaParametri(par, confronto) {
  if (!par) return '<div class="vuoto">Parametri non disponibili per questa prova (il PC della linea non leggeva ancora SMI_ANALYSIS.ini).</div>';
  const cams = [...new Set([...Object.keys(par), ...Object.keys(confronto || {})])].sort();
  const chiavi = [...new Set(cams.flatMap(c => [...Object.keys(par[c] || {}), ...Object.keys(confronto?.[c] || {})]))];
  const ord = PARAM_PRINCIPALI.map(([k]) => k).filter(k => chiavi.includes(k)).concat(chiavi.filter(k => !PARAM_PRINCIPALI.some(([x]) => x === k)).sort());
  return `<div class="scroll-x"><table class="tabella mod-tab"><thead><tr><th>Parametro</th>${cams.map(c => `<th>Camera ${esc(c)}</th>`).join('')}</tr></thead><tbody>
    ${ord.map(k => `<tr><td>${esc(etichettaParam(k))}${etichettaParam(k) !== k ? ` <small>${esc(k)}</small>` : ''}</td>${cams.map(c => { const v = par[c]?.[k], o = confronto?.[c]?.[k]; const diff = confronto && String(o ?? '') !== String(v ?? ''); return `<td class="${diff ? 'diverso' : ''}">${esc(v ?? '—')}${diff ? ` <small title="Valore attuale">ora ${esc(o ?? '—')}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}
async function apriDettaglioProva(id) {
  const p = S.archivioProve.get(id); if (!p) return;
  await urlFirmati([p.foto]);
  const u = urlFoto.get(p.foto), att = S.modello?.parametri?.[p.prodotto];
  const nDiff = att && p.parametri ? Object.keys({ ...att, ...p.parametri }).reduce((s, c) => s + new Set([...Object.keys(att[c] || {}), ...Object.keys(p.parametri[c] || {})]).size - [...new Set([...Object.keys(att[c] || {}), ...Object.keys(p.parametri[c] || {})])].filter(k => String(att[c]?.[k] ?? '') === String(p.parametri[c]?.[k] ?? '')).length, 0) : 0;
  const tutte = tutteLeProve(), ops = [...new Set(tutte.map(x => x.operatore))], tipi = [...new Set([...TIPI_PROVA, ...tutte.map(x => x.tipo)])];
  const v = sovra(`<div class="dett-prova">
      <div>${u ? `<img class="foto-big" src="${u}" alt="">` : '<div class="vuoto">Foto non disponibile</div>'}
        <div class="nota">${giornoLungo(p.t)} alle <b>${oraSec(p.t)}</b> · <span style="text-transform:capitalize">${esc(p.prodotto)}</span>${p.produzione ? ` · produzione dalle ${SMI.fmtOra(p.produzione.inizio)} (${n0(p.produzione.t)} cassette, ${pc(p.produzione.r, p.produzione.t)} scarti)` : ''}</div>
        <div class="nota">Salvata da ${esc(p.chi || '—')} il ${giornoCorto(p.creato)} ${SMI.fmtOra(p.creato)}${p.modificato ? ` · modificata da ${esc(p.modificatoDa || '—')} il ${giornoCorto(p.modificato)} ${SMI.fmtOra(p.modificato)}` : ''}${p.gruppo ? ' · fa parte di un gruppo di prove salvate insieme' : ''}</div></div>
      <form id="fDett" class="form-prova">
        <label class="campo">Operatore<input type="text" name="operatore" list="dlOp2" required value="${esc(p.operatore)}"></label><datalist id="dlOp2">${ops.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        <label class="campo">Tipo di prova<input type="text" name="tipo" list="dlTipo2" required value="${esc(p.tipo)}"></label><datalist id="dlTipo2">${tipi.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        <label class="campo">Esito<select name="esito">${Object.entries(ESITI).map(([k, l]) => `<option value="${k}" ${p.esito === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="campo">Note<textarea name="note" rows="4">${esc(p.note)}</textarea></label>
        <div class="escl-piede"><button type="button" class="btn" id="dElimina" style="color:#ffb4ae">Elimina</button><span class="spazio"></span><button type="button" class="btn" id="dScarica">⬇ Foto</button><button class="btn primario">Salva modifiche</button></div>
      </form></div>
    <h3 style="margin-top:18px">Parametri di analisi al momento della prova</h3>
    <div class="nota" style="margin-top:0">${p.parametriCerti ? 'Valori esatti di quel momento.' : 'Ricostruiti dai valori attuali e dallo storico delle modifiche: la registrazione delle modifiche non copriva ancora quel momento, quindi potrebbero non essere esatti.'}${att ? ` ${nDiff ? `<b>${nDiff}</b> valori diversi da quelli attuali (evidenziati).` : 'Tutti uguali ai valori attuali.'}` : ''}</div>
    ${tabellaParametri(p.parametri, att)}
    <div class="escl-piede" style="margin-top:12px"><span class="spazio"></span><button class="btn" id="dChiudi">Chiudi</button></div>`, 'larga');
  v.querySelector('#dChiudi').onclick = () => v.remove();
  v.querySelector('#dScarica').onclick = () => scaricaFoto(p.foto, `${isoG(p.t)}_${oraSec(p.t).replace(/:/g, '')}_${nomeSicuro(p.prodotto)}_${nomeSicuro(p.tipo)}.jpg`);
  v.querySelector('#fDett').onsubmit = async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
    if (await modificaProva(id, { operatore: d.operatore.trim(), tipo: d.tipo.trim(), esito: d.esito, note: d.note.trim() })) { toast('Prova aggiornata'); v.remove(); render(); }
  };
  v.querySelector('#dElimina').onclick = async () => {
    if (!confirm('Eliminare questa prova dall\'archivio? La foto verrà cancellata.')) return;
    if (await modificaProva(id, { eliminata: true })) { await sb().storage.from('smi-foto').remove([p.foto]); S.pv.sel.delete(id); toast('Prova eliminata'); v.remove(); render(); }
  };
}
async function confrontaProve(ps) {
  ps = ps.slice().sort((a, b) => a.t - b.t);
  await urlFirmati(ps.map(p => p.foto));
  const cams = [...new Set(ps.flatMap(p => Object.keys(p.parametri || {})))].sort();
  const chiavi = [...new Set(ps.flatMap(p => cams.flatMap(c => Object.keys(p.parametri?.[c] || {}))))];
  const righe = [];
  for (const c of cams) for (const k of chiavi) {
    const vals = ps.map(p => p.parametri?.[c]?.[k]);
    righe.push({ c, k, vals, diverso: new Set(vals.map(x => String(x ?? ''))).size > 1 });
  }
  const ord = (a, b) => { const ia = PARAM_PRINCIPALI.findIndex(([x]) => x === a.k), ib = PARAM_PRINCIPALI.findIndex(([x]) => x === b.k); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.k.localeCompare(b.k) || a.c.localeCompare(b.c); };
  const corpo = soloDiv => righe.filter(r => !soloDiv || r.diverso).sort(ord).map(r => `<tr class="${r.diverso ? 'diverso-r' : ''}"><td>${esc(etichettaParam(r.k))} <small>cam. ${esc(r.c)}</small></td>${r.vals.map(x => `<td>${esc(x ?? '—')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${ps.length + 1}" class="vuoto">Nessuna differenza: tutte le prove avevano gli stessi parametri.</td></tr>`;
  const v = sovra(`<h2>Confronto di ${ps.length} prove</h2>
    <div class="barra-filtri" style="margin-top:8px"><label class="switch"><input type="checkbox" id="cTutti"><i></i>Mostra anche i parametri uguali</label><span class="spazio"></span><button class="btn" id="cChiudi">Chiudi</button></div>
    <div class="scroll-x"><table class="tabella mod-tab confronto"><thead><tr><th></th>${ps.map(p => `<th><div class="conf-th">${urlFoto.get(p.foto) ? `<img src="${urlFoto.get(p.foto)}" alt="">` : ''}<b>${esc(p.tipo)}</b><span>${giornoCorto(p.t)} ${oraSec(p.t)}</span><span style="text-transform:capitalize">${esc(p.prodotto)} · ${esc(p.operatore)}</span><span style="color:${COL_ESITO[p.esito]}">${ESITI[p.esito] || ''}</span></div></th>`).join('')}</tr></thead><tbody id="cCorpo">${corpo(true)}</tbody></table></div>`, 'larga');
  v.querySelector('#cChiudi').onclick = () => v.remove();
  v.querySelector('#cTutti').onchange = e => { v.querySelector('#cCorpo').innerHTML = corpo(!e.target.checked); };
}
function csvCella(x) { const s = String(x ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function csvProve(ps) {
  const cams = [...new Set(ps.flatMap(p => Object.keys(p.parametri || {})))].sort();
  const chiavi = [...new Set(ps.flatMap(p => cams.flatMap(c => Object.keys(p.parametri?.[c] || {}))))].sort();
  const colPar = cams.flatMap(c => chiavi.map(k => [c, k]));
  const testa = ['Data', 'Ora', 'Prodotto', 'Tipo di prova', 'Operatore', 'Esito', 'Note', 'Cassette produzione', '% scarti produzione', 'Parametri esatti', 'Salvata da', 'Foto', ...colPar.map(([c, k]) => `cam${c} ${k}`)];
  const righe = ps.map(p => [isoG(p.t), oraSec(p.t), p.prodotto, p.tipo, p.operatore, ESITI[p.esito] || '', p.note, p.produzione?.t ?? '', p.produzione?.t ? n1(100 * p.produzione.r / p.produzione.t) : '', p.parametriCerti ? 'sì' : 'ricostruiti', p.chi, p.foto, ...colPar.map(([c, k]) => p.parametri?.[c]?.[k] ?? '')]);
  return '\ufeff' + [testa, ...righe].map(r => r.map(csvCella).join(';')).join('\r\n');
}
function esportaProveCsv(ps) { if (!ps.length) return toast('Nessuna prova da esportare'); scaricaBlob(new Blob([csvProve(ps)], { type: 'text/csv;charset=utf-8' }), `prove_${isoG(SMI.adesso())}.csv`); }

/* ==========================================================================
   PAGINA ANALISI EFFICIENZE E FERMI  (#analisi)
   ========================================================================== */
S.an ||= { da: '', a: '', turno: '', prodotto: '' };
const NOMI_TURNI = ['Mattino', 'Pomeriggio', 'Notte'];
function intervalloAnalisi() {
  const r = rif(), oggi = isoG(SMI.turnoDi(r).giorno);
  if (!S.an.a) S.an.a = oggi;
  if (!S.an.da) S.an.da = isoG(Date.parse(oggi + 'T00:00:00Z') - 6 * 864e5);
  return { da: Date.parse(S.an.da + 'T00:00:00Z'), a: Date.parse(S.an.a + 'T00:00:00Z') + 864e5, r };
}
// righe per turno: {key, giorno, nome, inizio, pian, inProd, fermo, cambio, t, r, prodotti}
function righeTurni() {
  const { da, a, r } = intervalloAnalisi(), out = [];
  if (!S.an.prodotto) {
    for (let t = da + 7 * 3600e3; t < Math.min(a, r + 8 * 3600e3); t += 8 * 3600e3) {
      const T = SMI.turnoDi(t); if (S.an.turno && T.nome !== S.an.turno) continue;
      const o = oeeTurno(T.key); if (o.futuro || (!o.pianificato && !o.t)) continue;
      out.push({ key: T.key, giorno: T.giorno, nome: T.nome, inizio: T.inizio, pian: o.pianificato, inProd: o.inProd, fermo: o.fermoMin, cambio: o.cambioMin, t: o.t, r: o.r, prodotti: [...o.prod], inCorso: o.inCorso });
    }
    return out;
  }
  // un solo prodotto: dalle produzioni di quel prodotto, divise per turno
  const fermi = tuttiIFermi(), byKey = new Map();
  for (const p of S.modello.produzioni) {
    if (p.prodotto !== S.an.prodotto) continue;
    const pf = fineProd(p);
    for (const tt of p.turni) {
      const T = SMI.turnoDi(tt.inizio + 1000); if (T.inizio < da || T.inizio >= a || (S.an.turno && T.nome !== S.an.turno)) continue;
      const x = Math.max(p.inizio, T.inizio), y = Math.min(pf, T.fine, r); if (y <= x) continue;
      const fm = fermi.filter(f => f.da < y && fineF(f) > x).reduce((s, f) => s + Math.min(y, fineF(f)) - Math.max(x, f.da), 0) / 60e3;
      const dur = (y - x) / 60e3;
      const o = byKey.get(T.key) || { key: T.key, giorno: T.giorno, nome: T.nome, inizio: T.inizio, pian: 0, inProd: 0, fermo: 0, cambio: 0, t: 0, r: 0, prodotti: [S.an.prodotto] };
      o.pian += dur; o.fermo += fm; o.inProd += Math.max(0, dur - fm); o.t += tt.t; o.r += tt.r;
      byKey.set(T.key, o);
    }
  }
  return [...byKey.values()].sort((x, y) => x.inizio - y.inizio);
}
function somma(righe) {
  const s = righe.reduce((o, x) => ({ pian: o.pian + x.pian, inProd: o.inProd + x.inProd, fermo: o.fermo + x.fermo, cambio: o.cambio + x.cambio, t: o.t + x.t, r: o.r + x.r }), { pian: 0, inProd: 0, fermo: 0, cambio: 0, t: 0, r: 0 });
  s.A = s.pian ? s.inProd / s.pian : 0; s.P = s.inProd ? s.t / (s.inProd * SMI.VELOCITA_STD) : 0; s.Q = s.t ? (s.t - s.r) / s.t : 0; s.oee = s.A * s.P * s.Q;
  return s;
}
function fermiAnalisi() {
  const { da, a } = intervalloAnalisi();
  return tuttiIFermi().filter(f => f.da >= da && f.da < a && (!S.an.turno || SMI.turnoDi(f.da).nome === S.an.turno) && (!S.an.prodotto || f.prodotto === S.an.prodotto));
}
function cambiAnalisi() {
  const { da, a } = intervalloAnalisi();
  return tuttiICambi().filter(c => c.da >= da && c.da < a && (!S.an.turno || SMI.turnoDi(c.da).nome === S.an.turno) && (!S.an.prodotto || c.dal === S.an.prodotto || c.al === S.an.prodotto));
}
const coloreOee = v => v >= .85 ? 'var(--good)' : v >= .65 ? 'var(--warn)' : 'var(--crit)';
function barreLista(voci, fmt) {
  const max = Math.max(1e-9, ...voci.map(v => v.v));
  return voci.map(v => `<div class="bl"><span class="bl-l" title="${esc(v.l)}">${esc(v.l)}</span><span class="bl-b"><i style="width:${Math.max(.5, 100 * v.v / max)}%;background:${v.c || 'var(--blue)'}"></i></span><span class="bl-v">${fmt(v)}</span></div>`).join('') || '<div class="nota">Nessun fermo.</div>';
}
function vistaAnalisi() {
  const m = S.modello;
  if (!m?.produzioni) return `<div class="vetro card"><div class="vuoto">Nessun dato disponibile.</div></div>`;
  intervalloAnalisi();
  const prodotti = [...new Set(m.produzioni.map(p => p.prodotto))].sort((a, b) => a.localeCompare(b));
  const righe = righeTurni(), s = somma(righe), fermi = fermiAnalisi(), cambi = cambiAnalisi();
  const minF = l => l.reduce((x, f) => x + (fineF(f) - f.da), 0) / 60e3;
  const fIsp = fermi.filter(f => f.tipo === 'ispezione'), fLin = fermi.filter(f => f.tipo === 'linea');
  const persePrest = Math.max(0, Math.round(s.inProd * SMI.VELOCITA_STD - s.t));
  const giorni = new Map(); for (const x of righe) { const k = isoG(x.giorno); giorni.set(k, [...(giorni.get(k) || []), x]); }
  const perTurno = NOMI_TURNI.map(n => ({ n, s: somma(righe.filter(x => x.nome === n)) }));
  const perProd = new Map();
  for (const p of m.produzioni) {
    const { da, a } = intervalloAnalisi(); if (p.inizio < da || p.inizio >= a || (S.an.prodotto && p.prodotto !== S.an.prodotto)) continue;
    const dur = (Math.min(fineProd(p), rif()) - p.inizio) / 60e3, fm = fermiDi(p).min;
    const o = perProd.get(p.prodotto) || { n: 0, pian: 0, inProd: 0, fermo: 0, cambio: 0, t: 0, r: 0 };
    o.n++; o.pian += dur; o.fermo += fm; o.inProd += Math.max(0, dur - fm); o.t += p.t; o.r += p.r; perProd.set(p.prodotto, o);
  }
  const ore = Array(24).fill(0); for (const f of fermi) for (let t = f.da; t < fineF(f); t += 60e3) ore[new Date(t).getUTCHours()]++;
  const maxOra = Math.max(1, ...ore);
  const fasce = [['meno di 5 min', 0, 5], ['5–15 min', 5, 15], ['15–60 min', 15, 60], ['oltre 1 ora', 60, 1e9]].map(([l, x, y]) => { const ls = fermi.filter(f => { const d = (fineF(f) - f.da) / 60e3; return d >= x && d < y; }); return { l, v: minF(ls), n: ls.length }; });
  const fermiProd = new Map(); for (const f of fermi) { const k = f.prodotto || '—'; const o = fermiProd.get(k) || { v: 0, n: 0 }; o.v += (fineF(f) - f.da) / 60e3; o.n++; fermiProd.set(k, o); }
  const pd = s.pian || 1;
  const seg = (v, c, l) => v > 0 ? `<i style="width:${100 * v / pd}%;background:${c}" title="${l}: ${durata(v)}"></i>` : '';
  const tile = (lab, val, det, col) => `<div class="tile"><div class="lab">${lab}</div><div class="val" ${col ? `style="color:${col}"` : ''}>${val}</div><div class="det">${det}</div></div>`;
  return `<section class="vetro card">
    <h2>Analisi efficienze e fermi</h2>
    <div class="barra-filtri" style="margin-top:6px">
      <div class="seg" id="anRapido">${[['oggi', 'Oggi'], ['7', '7 giorni'], ['30', '30 giorni'], ['tutto', 'Tutto']].map(([k, l]) => `<button data-r="${k}">${l}</button>`).join('')}</div>
      <label class="campo-in">Dal <input type="date" id="anDa" value="${S.an.da}"></label>
      <label class="campo-in">al <input type="date" id="anA" value="${S.an.a}"></label>
      <select id="anTurno"><option value="">Tutti i turni</option>${NOMI_TURNI.map(n => `<option ${S.an.turno === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="anProd">${opzioni(prodotti, S.an.prodotto, 'Tutti i prodotti')}</select>
      <span class="spazio"></span>
      <button class="btn" id="anCsvT">Esporta turni (CSV)</button><button class="btn" id="anCsvF">Esporta fermi (CSV)</button>
    </div>
    ${!righe.length ? '<div class="vuoto">Nessuna produzione nel periodo scelto.</div>' : `
    <div class="kpi an-kpi">
      ${tile('OEE', pct0(s.oee), `${righe.length} turni`, coloreOee(s.oee))}
      ${tile('Disponibilità', pct0(s.A), `${durata(s.inProd)} in produzione su ${durata(s.pian)}`, coloreOee(s.A))}
      ${tile('Prestazione', pct0(s.P), `${s.inProd ? n1(s.t / s.inProd) : '—'} cass/min (standard ${SMI.VELOCITA_STD})`, coloreOee(s.P))}
      ${tile('Qualità', pct0(s.Q), `${n0(s.r)} scarti su ${n0(s.t)}`, coloreOee(s.Q))}
      ${tile('Cassette', n0(s.t), `${n1(s.t / SMI.CASSETTE_PER_PEDANA)} pedane`)}
      ${tile('Fermi', durata(s.fermo), `${fermi.length} fermi · media ${fermi.length ? durata(minF(fermi) / fermi.length) : '—'}`, s.fermo ? '#ffb4ae' : '')}
      ${tile('Cambi prodotto', durata(s.cambio), `${cambi.length} cambi · media ${cambi.length ? durataDa(cambi.reduce((x, c) => x + fineC(c) - c.da, 0) / cambi.length) : '—'}`)}
      ${tile('Cassette perse', n0(persePrest + s.r), `${n0(persePrest)} per velocità · ${n0(s.r)} scarti`)}
    </div>
    <div class="pannello sezione"><h3>Dove va il tempo programmato (${durata(s.pian)})</h3>
      <div class="barra-tempo">${seg(s.inProd, 'var(--aqua)', 'In produzione')}${seg(minF(fIsp), 'var(--crit)', 'Ispezione fermata')}${seg(minF(fLin), 'var(--serious)', 'Nessuna cassetta')}${seg(s.cambio, 'var(--violet)', 'Cambi prodotto')}</div>
      <div class="legenda" style="margin-top:10px"><span><i style="background:var(--aqua)"></i>In produzione ${durata(s.inProd)} (${pc(s.inProd, pd)})</span><span><i style="background:var(--crit)"></i>Ispezione fermata ${durata(minF(fIsp))}</span><span><i style="background:var(--serious)"></i>Nessuna cassetta ${durata(minF(fLin))}</span><span><i style="background:var(--violet)"></i>Cambi prodotto ${durata(s.cambio)}</span></div>
    </div>
    <div class="pannello sezione"><h3>OEE per giorno</h3><div class="chart" id="anGiorni"></div>
      <div class="legenda"><span><i style="background:var(--good)"></i>≥ 85%</span><span><i style="background:var(--warn)"></i>≥ 65%</span><span><i style="background:var(--crit)"></i>sotto 65%</span></div></div>
    <div class="dueco sezione">
      <div class="pannello"><h3>Per turno</h3><table class="tabella"><thead><tr><th>Turno</th><th>OEE</th><th>Disp.</th><th>Prest.</th><th>Qual.</th><th>Fermi</th></tr></thead><tbody>
        ${perTurno.filter(x => x.s.pian).map(({ n, s: q }) => `<tr><td>${n}</td><td style="color:${coloreOee(q.oee)}"><b>${pct0(q.oee)}</b></td><td>${pct0(q.A)}</td><td>${pct0(q.P)}</td><td>${pct0(q.Q)}</td><td>${durata(q.fermo)}</td></tr>`).join('')}</tbody></table></div>
      <div class="pannello"><h3>Per prodotto</h3><div class="scroll-x"><table class="tabella"><thead><tr><th>Prodotto</th><th>Prod.</th><th>Cassette</th><th>Scarti</th><th>OEE</th><th>Fermi</th></tr></thead><tbody>
        ${[...perProd.entries()].sort((x, y) => y[1].t - x[1].t).map(([k, o]) => { const q = somma([o]); return `<tr><td style="text-transform:capitalize">${esc(k)}</td><td>${o.n}</td><td>${n0(o.t)}</td><td>${pc(o.r, o.t)}</td><td style="color:${coloreOee(q.oee)}"><b>${pct0(q.oee)}</b></td><td>${durata(o.fermo)}</td></tr>`; }).join('')}</tbody></table></div></div>
    </div>
    <div class="dueco sezione">
      <div class="pannello"><h3>Fermi per motivo</h3>${barreLista([{ l: 'Ispezione fermata', v: minF(fIsp), n: fIsp.length, c: 'var(--crit)' }, { l: 'Nessuna cassetta', v: minF(fLin), n: fLin.length, c: 'var(--serious)' }, { l: 'Cambi prodotto', v: cambi.reduce((x, c) => x + fineC(c) - c.da, 0) / 60e3, n: cambi.length, c: 'var(--violet)' }], v => `${durata(v.v)} · ${v.n}×`)}
        <h3 style="margin-top:16px">Fermi per durata</h3>${barreLista(fasce.map(x => ({ ...x, c: 'var(--warn)' })), v => `${v.n} fermi · ${durata(v.v)}`)}</div>
      <div class="pannello"><h3>Fermi per prodotto</h3>${barreLista([...fermiProd.entries()].sort((x, y) => y[1].v - x[1].v).slice(0, 8).map(([l, o]) => ({ l, ...o, c: 'var(--serious)' })), v => `${durata(v.v)} · ${v.n}×`)}
        <h3 style="margin-top:16px">Fermi per turno</h3>${barreLista(NOMI_TURNI.map(n => { const ls = fermi.filter(f => SMI.turnoDi(f.da).nome === n); return { l: n, v: minF(ls), n: ls.length, c: 'var(--crit)' }; }), v => `${durata(v.v)} · ${v.n}×`)}</div>
    </div>
    <div class="pannello sezione"><h3>Fermi per ora del giorno</h3>
      <div class="ore-col">${ore.map((v, h) => `<div title="${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00 · ${durata(v)} di fermo"><i style="height:${100 * v / maxOra}%"></i><span>${h % 3 ? '' : String(h).padStart(2, '0')}</span></div>`).join('')}</div>
      <div class="nota">Minuti di fermo totali in ogni ora del giorno nel periodo scelto: mostra le ore in cui la linea si ferma più spesso (cambi turno, pause…).</div></div>
    <div class="pannello sezione"><h3>I fermi più lunghi</h3>${tabellaFermi(fermi.slice().sort((x, y) => (fineF(x) - x.da) - (fineF(y) - y.da)).slice(-15))}</div>
    <div class="pannello sezione"><h3>Tutti i turni</h3><div class="scroll-x"><table class="tabella"><thead><tr><th>Giorno</th><th class="sx">Turno</th><th class="sx">Prodotti</th><th>Cassette</th><th>Scarti</th><th>Disp.</th><th>Prest.</th><th>Qual.</th><th>OEE</th><th>Fermi</th><th>Cambi</th></tr></thead><tbody>
      ${righe.slice().reverse().map(x => { const q = somma([x]); return `<tr><td>${giornoCorto(x.giorno)}</td><td class="sx">${x.nome}${x.inCorso ? ' <span class="live-badge">IN CORSO</span>' : ''}</td><td class="sx" style="text-transform:capitalize">${esc(x.prodotti.join(', '))}</td><td>${n0(x.t)}</td><td>${pc(x.r, x.t)}</td><td>${pct0(q.A)}</td><td>${pct0(q.P)}</td><td>${pct0(q.Q)}</td><td style="color:${coloreOee(q.oee)}"><b>${pct0(q.oee)}</b></td><td>${durata(x.fermo)}</td><td>${durata(x.cambio)}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="nota">${S.an.prodotto ? `Con un prodotto scelto, i valori si riferiscono solo al tempo in cui si è prodotto <b>${esc(S.an.prodotto)}</b> (i cambi prodotto non sono contati). ` : ''}Disponibilità = tempo in produzione / tempo programmato; Prestazione = cassette / (minuti in produzione × ${SMI.VELOCITA_STD}); Qualità = buone / contate. Le ore a linea spenta (notti, weekend) non sono contate. Escluse le cassette dei periodi esclusi.</div></div>`}
  </section>`;
}
function disegnaOeeGiorni(el, voci) {
  const W = Math.max(280, el.clientWidth), H = 220, mL = 40, mR = 8, mT = 16, mB = 26, iw = W - mL - mR, ih = H - mT - mB;
  if (!voci.length) { el.innerHTML = '<div class="vuoto">—</div>'; return; }
  const y = v => mT + ih - Math.min(1.1, v) / 1.1 * ih, bw = iw / voci.length, larg = Math.max(4, Math.min(40, bw * .6));
  let g = '<g class="griglia-l">' + [0, .25, .5, .75, 1].map(v => `<line x1="${mL}" x2="${W - mR}" y1="${y(v)}" y2="${y(v)}"/>`).join('') + '</g><g class="asse">' + [0, .25, .5, .75, 1].map(v => `<text x="${mL - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`).join('');
  const ogni = Math.ceil(voci.length / Math.max(2, Math.floor(iw / 50)));
  voci.forEach((d, i) => { if (i % ogni === 0) g += `<text x="${mL + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle">${giornoCorto(Date.parse(d.k + 'T00:00:00Z'))}</text>`; });
  g += `</g><line x1="${mL}" x2="${W - mR}" y1="${y(.85)}" y2="${y(.85)}" stroke="var(--good)" stroke-dasharray="4 4" opacity=".6"/>`;
  const b = voci.map((d, i) => { const x = mL + bw * i + (bw - larg) / 2; return `<g><rect x="${x}" y="${y(d.s.oee)}" width="${larg}" height="${Math.max(1, y(0) - y(d.s.oee))}" rx="4" fill="${coloreOee(d.s.oee)}" opacity=".85"/><title>${giornoLungo(Date.parse(d.k + 'T00:00:00Z'))}\nOEE ${pct0(d.s.oee)} · Disponibilità ${pct0(d.s.A)} · Prestazione ${pct0(d.s.P)} · Qualità ${pct0(d.s.Q)}\n${n0(d.s.t)} cassette · ${durata(d.s.fermo)} di fermo</title>${bw > 34 ? `<text x="${x + larg / 2}" y="${y(d.s.oee) - 4}" text-anchor="middle" class="val-barra">${pct0(d.s.oee)}</text>` : ''}</g>`; }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">${g}${b}</svg>`;
}
function collegaAnalisi() {
  const box = $('#anDa'); if (!box) return;
  const su = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
  $('#anDa').onchange = e => { S.an.da = e.target.value; su(); };
  $('#anA').onchange = e => { S.an.a = e.target.value; su(); };
  $('#anTurno').onchange = e => { S.an.turno = e.target.value; su(); };
  $('#anProd').onchange = e => { S.an.prodotto = e.target.value; su(); };
  $('#anRapido').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const oggi = isoG(SMI.turnoDi(rif()).giorno), g0 = Date.parse(oggi + 'T00:00:00Z');
    S.an.a = oggi;
    S.an.da = b.dataset.r === 'oggi' ? oggi : b.dataset.r === 'tutto' ? isoG(Math.min(...S.modello.produzioni.map(p => p.inizio))) : isoG(g0 - (+b.dataset.r - 1) * 864e5);
    su();
  };
  const righe = righeTurni();
  const el = $('#anGiorni');
  if (el) {
    const g = new Map(); for (const x of righe) { const k = isoG(x.giorno); g.set(k, [...(g.get(k) || []), x]); }
    const voci = [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, l]) => ({ k, s: somma(l) }));
    montaGrafico(el, e => disegnaOeeGiorni(e, voci));
  }
  $('#anCsvT').onclick = () => {
    const testa = ['Giorno', 'Turno', 'Prodotti', 'Minuti programmati', 'Minuti in produzione', 'Minuti fermo', 'Minuti cambio prodotto', 'Cassette', 'Scarti', 'Disponibilità %', 'Prestazione %', 'Qualità %', 'OEE %'];
    const rr = righe.map(x => { const q = somma([x]); return [isoG(x.giorno), x.nome, x.prodotti.join(', '), Math.round(x.pian), Math.round(x.inProd), Math.round(x.fermo), Math.round(x.cambio), x.t, x.r, n1(100 * q.A), n1(100 * q.P), n1(100 * q.Q), n1(100 * q.oee)]; });
    scaricaBlob(new Blob(['\ufeff' + [testa, ...rr].map(r => r.map(csvCella).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `turni_${S.an.da}_${S.an.a}.csv`);
  };
  $('#anCsvF').onclick = () => {
    const testa = ['Giorno', 'Dalle', 'Alle', 'Durata (min)', 'Motivo', 'Prodotto', 'Turno'];
    const rr = [...fermiAnalisi().map(f => [isoG(f.da), SMI.fmtOra(f.da), f.a ? SMI.fmtOra(f.a) : 'in corso', Math.round((fineF(f) - f.da) / 60e3), TIPO_FERMO[f.tipo], f.prodotto || '', SMI.turnoDi(f.da).nome]),
      ...cambiAnalisi().map(c => [isoG(c.da), SMI.fmtOra(c.da), c.a ? SMI.fmtOra(c.a) : 'in corso', Math.round((fineC(c) - c.da) / 60e3), 'Cambio prodotto', `${c.dal} → ${c.al}`, SMI.turnoDi(c.da).nome])].sort((x, y) => (x[0] + x[1]).localeCompare(y[0] + y[1]));
    scaricaBlob(new Blob(['\ufeff' + [testa, ...rr].map(r => r.map(csvCella).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `fermi_${S.an.da}_${S.an.a}.csv`);
  };
}
