/* ==========================================================================
   FOTO DEGLI SCARTI · ARCHIVIO PROVE · ANALISI EFFICIENZE E FERMI
   (usa le funzioni e lo stato globali di app.js)
   ========================================================================== */

const TIPI_PROVA = ['Prova parametri', 'Campione difettoso', 'Cassette neutre', 'Avviamento / learning', 'Verifica qualità', 'Altro'];
const ESITI = { valutare: 'Da valutare', corretto: 'Scarto corretto', falso: 'Falso scarto' };
const COL_ESITO = { valutare: 'var(--text-3)', corretto: 'var(--good)', falso: 'var(--crit)' };
const urlFoto = new Map();
const POSIZIONI = [['sx', 'SX'], ['centro', 'CENTRO'], ['dx', 'DX']];
const campoPosizioni = (sel = []) => `<div class="campo">Dove si trova il difetto<span class="pos-difetto">${POSIZIONI.map(([k, l]) => `<label><input type="checkbox" name="pos_${k}" ${sel.includes(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</span></div>`;
const posizioniDa = d => POSIZIONI.map(([k]) => k).filter(k => d['pos_' + k]);
const testoPosizioni = p => (p.posizioneDifetto || []).map(k => (POSIZIONI.find(x => x[0] === k) || [, k])[1]).join(' · ');
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
async function urlFirmati(chiavi) {
  const cl = sb(); if (!cl) return;
  const mancanti = [...new Set(chiavi)].filter(k => k && !urlFoto.has(k));
  for (const [bucket, pref] of [['smi-foto', ''], ['smi-allegati', 'A:']]) {
    const ps = mancanti.filter(k => pref ? k.startsWith(pref) : !k.startsWith('A:')).map(k => k.slice(pref.length));
    for (let i = 0; i < ps.length; i += 100) {
      const { data } = await cl.storage.from(bucket).createSignedUrls(ps.slice(i, i + 100), 3600);
      for (const d of data || []) if (d.signedUrl) urlFoto.set(pref + d.path, d.signedUrl);
    }
  }
}
const eImmagine = a => /^image\//.test(a.tipo || '') || /\.(jpe?g|png|gif|bmp|webp|heic)$/i.test(a.nome || '');
// immagine da mostrare per una prova: la foto dello scarto, oppure la prima foto allegata
const miniatura = p => p.foto || ((p.allegati || []).find(eImmagine) ? 'A:' + p.allegati.find(eImmagine).percorso : null);
const dimensione = b => b > 1048576 ? n1(b / 1048576) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const iconaFile = n => /\.pdf$/i.test(n) ? 'PDF' : /\.docx?$/i.test(n) ? 'DOC' : /\.(xlsx?|csv)$/i.test(n) ? 'XLS' : /\.(pptx?)$/i.test(n) ? 'PPT' : /\.(zip|7z|rar)$/i.test(n) ? 'ZIP' : 'FILE';
const LIMITE_FILE = 50 * 1048576;
async function caricaAllegati(cartella, files) {
  const out = [], errori = [];
  for (const f of files) {
    if (f.size > LIMITE_FILE) { errori.push(`${f.name}: più di 50 MB`); continue; }
    const est = (/\.[^.]+$/.exec(f.name) || [''])[0].toLowerCase();
    const percorso = `${cartella}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}_${nomeSicuro(f.name.replace(/\.[^.]+$/, ''))}${est}`;
    const { error } = await sb().storage.from('smi-allegati').upload(percorso, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (error) { errori.push(`${f.name}: ${/bucket|not found/i.test(error.message) ? 'su Supabase manca lo spazio smi-allegati (va eseguito supabase_allegati.sql)' : error.message}`); continue; }
    out.push({ percorso, nome: f.name, tipo: f.type || '', dimensione: f.size, caricato: SMI.adesso(), chi: S.utente?.email || '' });
  }
  return { allegati: out, errori };
}
async function scaricaAllegato(a) {
  const { data, error } = await sb().storage.from('smi-allegati').download(a.percorso);
  if (error) { toast('Non riesco a scaricare il file: ' + esc(error.message)); return; }
  scaricaBlob(data, a.nome);
}
function allegatiHtml(allegati, modificabile) {
  if (!allegati?.length) return '<div class="nota" style="margin-top:0">Nessun allegato.</div>';
  return `<div class="allegati">${allegati.map((a, i) => eImmagine(a)
    ? `<figure class="allegato img" data-all="${i}"><div class="foto-img" data-img="${esc('A:' + a.percorso)}"></div><figcaption><span title="${esc(a.nome)}">${esc(a.nome)}</span>${modificabile ? `<button type="button" class="x" data-rimuovi="${i}" title="Rimuovi">×</button>` : ''}</figcaption></figure>`
    : `<div class="allegato doc" data-all="${i}"><span class="ico-doc">${iconaFile(a.nome)}</span><span class="doc-nome"><b title="${esc(a.nome)}">${esc(a.nome)}</b><small>${dimensione(a.dimensione || 0)} · ${giornoCorto(a.caricato)}</small></span>${modificabile ? `<button type="button" class="x" data-rimuovi="${i}" title="Rimuovi">×</button>` : ''}</div>`).join('')}</div>`;
}
async function collegaAllegati(box, allegati, onRimuovi) {
  if (!box) return;
  box.querySelectorAll('[data-rimuovi]').forEach(b => b.onclick = e => { e.stopPropagation(); onRimuovi?.(+b.dataset.rimuovi); });
  box.querySelectorAll('[data-all]').forEach(el => el.onclick = e => {
    if (e.target.closest('[data-rimuovi]')) return;
    const a = allegati[+el.dataset.all], u = urlFoto.get('A:' + a.percorso);
    if (eImmagine(a) && u) {
      const v = sovra(`<img class="foto-big" src="${u}" alt=""><div class="barra-filtri" style="margin:12px 0 0"><b>${esc(a.nome)}</b><span class="spazio"></span><button class="btn" id="aScarica">⬇ Scarica</button><button class="btn" id="aChiudi">Chiudi</button></div>`, 'larga');
      v.querySelector('#aChiudi').onclick = () => v.remove(); v.querySelector('#aScarica').onclick = () => scaricaAllegato(a);
    } else scaricaAllegato(a);
  });
  const imgs = [...box.querySelectorAll('[data-img]')];
  await urlFirmati(imgs.map(i => i.dataset.img));
  imgs.forEach(i => { const u = urlFoto.get(i.dataset.img); i.innerHTML = u ? `<img loading="lazy" src="${u}" alt="">` : 'non disponibile'; });
}
function campoFile(id) {
  return `<label class="campo">Foto e documenti<span class="file-zona"><input type="file" id="${id}" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip"><span class="nota" style="margin:0">Clicca per scegliere i file (dal telefono anche la fotocamera). Max 50 MB l'uno.</span></span><span class="file-lista" id="${id}L"></span></label>`;
}
function collegaCampoFile(v, id) {
  const inp = v.querySelector('#' + id), lista = v.querySelector('#' + id + 'L');
  inp.onchange = () => { lista.innerHTML = [...inp.files].map(f => `<span class="chip">${esc(f.name)} · ${dimensione(f.size)}</span>`).join(''); };
}
// colaggi (= produzioni) da scegliere, dal più recente
const maiusc = x => String(x || '').replace(/^./, c => c.toUpperCase());
function opzioniColaggio(sel) {
  const ps = (S.modello?.produzioni || []).slice().sort((a, b) => b.inizio - a.inizio).slice(0, 300);
  return `<option value="">Nessun colaggio</option>` + ps.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(maiusc(p.prodotto))} · ${giornoCorto(p.inizio)} ${SMI.fmtOra(p.inizio)}–${SMI.isoGiorno(p.inizio) !== SMI.isoGiorno(p.fine) ? giornoCorto(p.fine) + ' ' : ''}${SMI.fmtOra(p.fine)} · ${n0(p.t)} cass.</option>`).join('');
}
const datiColaggio = id => { const p = (S.modello?.produzioni || []).find(x => x.id === id); return p ? { id: p.id, inizio: p.inizio, fine: p.fine, prodotto: p.prodotto, t: p.t, r: p.r } : null; };
const testoColaggio = c => c ? `${c.prodotto ? maiusc(c.prodotto) + ' · ' : ''}${giornoCorto(c.inizio)} ${SMI.fmtOra(c.inizio)}${c.fine ? '–' + SMI.fmtOra(c.fine) : ''}` : '';

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
// base: { t, fotoSrc (foto dello scarto da copiare, facoltativa), prodotto }
async function salvaProva(base, campi, gruppo, allegati = []) {
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let foto = null;
  if (base.fotoSrc) {
    foto = `prove/${id}.jpg`;
    const { error: e1 } = await sb().storage.from('smi-foto').copy(base.fotoSrc, foto);
    if (e1) throw new Error('la foto non è più disponibile (' + e1.message + ')');
  }
  const prodotto = base.prodotto || datiColaggio(campi.colaggio)?.prodotto || produzioneAl(base.t)?.prodotto || '';
  const rec = {
    id, t: base.t, foto, fotoOrig: base.fotoSrc || null, prodotto, gruppo,
    operatore: campi.operatore.trim(), tipo: campi.tipo.trim(), esito: campi.esito, note: (campi.note || '').trim(),
    produzione: datiColaggio(campi.colaggio), codiceColaggio: (campi.codice || '').trim(), allegati, posizioneDifetto: posizioniDa(campi),
    parametri: parametriAl(prodotto, base.t),
    parametriCerti: !!(S.storiaParDa && base.t >= S.storiaParDa),
    chi: S.utente?.email || '', creato: SMI.adesso(),
  };
  const { error } = await sb().from('smi_dati').upsert({ id: 'prova_' + id, dati: rec, aggiornato: new Date().toISOString() });
  if (error) { if (foto) await sb().storage.from('smi-foto').remove([foto]); throw new Error(error.message); }
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
function apriFormProva(fs, dopo, opz = {}) {
  const prove = tutteLeProve(), nuova = !fs.length;
  const ops = [...new Set(prove.map(p => p.operatore).filter(Boolean))].sort();
  const tipi = [...new Set([...TIPI_PROVA, ...prove.map(p => p.tipo)].filter(Boolean))];
  const prodotti = [...new Set([...(S.modello?.produzioni || []).map(p => p.prodotto), ...Object.keys(S.modello?.parametri || {})].filter(x => x && x !== 'default product'))].sort();
  let ultimoOp = ''; try { ultimoOp = localStorage.getItem('smi_operatore') || ''; } catch { }
  const t0 = nuova ? (opz.t ?? Math.floor(SMI.adesso() / 60e3) * 60e3) : fs[0][0];
  const col0 = opz.colaggio || produzioneAl(t0)?.id || '';
  const prod0 = nuova ? (datiColaggio(col0)?.prodotto || S.modello?.stato?.prodotto || '') : '';
  const prodFoto = nuova ? '' : [...new Set(fs.map(f => f[2] || produzioneAl(f[0])?.prodotto || '—'))].join(', ');
  const v = sovra(`<h2>${nuova ? 'Nuova prova' : 'Segna come prova'}</h2>
    <div class="nota" style="margin-top:4px">${nuova ? 'Prova registrata a mano: associala a un colaggio e allega foto e documenti.' : `${fs.length === 1 ? `Foto del ${giornoCorto(fs[0][0])} alle ${oraSec(fs[0][0])}` : `${fs.length} foto (dal ${giornoCorto(fs[fs.length - 1][0])} ${oraSec(fs[fs.length - 1][0])} al ${giornoCorto(fs[0][0])} ${oraSec(fs[0][0])})`} · <span style="text-transform:capitalize">${esc(prodFoto)}</span>.`}<br>Vengono salvati per sempre ${nuova ? '' : 'la foto, '}l'ora, il prodotto e <b>tutti i parametri di analisi di quel momento</b>.</div>
    <form id="fProva" class="form-prova">
      ${nuova ? `<div class="due-campi"><label class="campo">Data e ora della prova<input type="datetime-local" name="quando" step="60" required value="${dtIn(t0)}"></label>
        <label class="campo">Prodotto<input type="text" name="prodotto" list="dlProd" required value="${esc(prod0)}" autocomplete="off"></label></div>
        <datalist id="dlProd">${prodotti.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}
      <div class="due-campi"><label class="campo">Colaggio<select name="colaggio">${opzioniColaggio(col0)}</select></label>
        <label class="campo">Codice colaggio / lotto (facoltativo)<input type="text" name="codice" autocomplete="off" placeholder="es. numero di lotto"></label></div>
      <div class="due-campi"><label class="campo">Operatore che ha fatto la prova<input type="text" name="operatore" list="dlOp" required value="${esc(ultimoOp)}" autocomplete="off"></label>
        <label class="campo">Tipo di prova<input type="text" name="tipo" list="dlTipo" required autocomplete="off" placeholder="Scegli o scrivi"></label></div>
      <datalist id="dlOp">${ops.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
      <datalist id="dlTipo">${tipi.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
      <div class="due-campi">${campoPosizioni()}<label class="campo">Esito<select name="esito">${Object.entries(ESITI).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
      <label class="campo">Note<textarea name="note" rows="3" placeholder="Cosa si stava provando, cosa si è visto…"></textarea></label>
      ${campoFile('fpFile')}
      <div class="escl-piede"><span id="fpErr" class="nota" style="margin:0;color:#ffb4ae"></span><span class="spazio"></span><button type="button" class="btn" id="fpAnn">Annulla</button><button class="btn primario" id="fpOk">Salva ${fs.length > 1 ? fs.length + ' prove' : 'prova'}</button></div>
    </form>`, 'media');
  collegaCampoFile(v, 'fpFile');
  v.querySelector('#fpAnn').onclick = () => v.remove();
  if (nuova) {
    // cambiando l'ora propongo il colaggio di quel momento, finché non lo si sceglie a mano
    let toccato = !!opz.colaggio;
    v.querySelector('select[name=colaggio]').onchange = e => { toccato = true; const c = datiColaggio(e.target.value); if (c) v.querySelector('input[name=prodotto]').value = c.prodotto; };
    v.querySelector('input[name=quando]').onchange = e => { if (toccato) return; const p = produzioneAl(dtDa(e.target.value)); v.querySelector('select[name=colaggio]').value = p?.id || ''; if (p) v.querySelector('input[name=prodotto]').value = p.prodotto; };
  }
  v.querySelector('#fProva').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try { localStorage.setItem('smi_operatore', d.operatore.trim()); } catch { }
    const b = v.querySelector('#fpOk'); b.disabled = true;
    const gruppo = fs.length > 1 ? 'g' + Date.now().toString(36) : null;
    let allegati = [], errFile = [];
    const files = [...v.querySelector('#fpFile').files];
    if (files.length) {
      b.textContent = `Carico ${files.length} file…`;
      ({ allegati, errori: errFile } = await caricaAllegati(gruppo ? `gruppi/${gruppo}` : `prove/${Date.now().toString(36)}`, files));
      if (errFile.length && !confirm(`Alcuni file non sono stati caricati:\n${errFile.join('\n')}\n\nSalvare comunque la prova senza questi file?`)) { b.disabled = false; b.textContent = 'Salva'; return; }
    }
    const basi = nuova ? [{ t: dtDa(d.quando), prodotto: d.prodotto.trim() }] : fs.map(f => ({ t: f[0], fotoSrc: f[1], prodotto: f[2] }));
    let ok = 0, err = '';
    for (const base of basi) { b.textContent = `Salvo ${ok + 1} di ${basi.length}…`; try { await salvaProva(base, d, gruppo, allegati); ok++; } catch (x) { err = x.message; } }
    if (ok) toast(`${ok} ${ok === 1 ? 'prova salvata' : 'prove salvate'} nell'archivio Prove`);
    if (ok < basi.length) { v.querySelector('#fpErr').textContent = `${basi.length - ok} non salvate: ${err}`; b.disabled = false; b.textContent = 'Riprova'; if (!nuova) fs = fs.slice(ok); }
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
    && (!q || [p.prodotto, p.tipo, p.operatore, p.note, ESITI[p.esito], p.chi, p.codiceColaggio, testoPosizioni(p), ...(p.allegati || []).map(a => a.nome)].join(' ').toLowerCase().includes(q))
  ).sort((x, y) => y.t - x.t);
}
const opzioni = (valori, sel, tutti) => `<option value="">${tutti}</option>` + valori.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
function vistaProve() {
  if (S.modo !== 'remoto') return `<div class="vetro card"><div class="vuoto">L'archivio delle prove è disponibile solo con l'accesso ai dati del PC della linea.</div></div>`;
  if (!S.archivioProve) { caricaProve().then(() => { if (location.hash === '#prove') render(); }); return `<div class="centro"><div class="pill"><span class="dot"></span>Carico le prove…</div></div>`; }
  const tutte = tutteLeProve(), f = S.pv, uniq = k => [...new Set(tutte.map(p => p[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return `<section class="vetro card">
    <h2>Archivio prove</h2>
    <div class="nota" style="margin-top:0">Ogni prova contiene la foto della cassetta, l'ora, il prodotto, l'operatore, il tipo di prova, l'esito e tutti i parametri di analisi di quel momento. Si creano con <b>+ Nuova prova</b> (anche con foto e documenti caricati a mano) oppure dalla scheda <b>Foto scarti</b> di una produzione.</div>
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
      <div class="seg" id="pvGruppo">${[['tempo', 'Giorno'], ['prodotto', 'Prodotto'], ['tipo', 'Tipo di prova'], ['operatore', 'Operatore'], ['colaggio', 'Colaggio'], ['esito', 'Esito']].map(([k, l]) => `<button data-g="${k}" class="${f.gruppo === k ? 'att' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" id="pvVista">${[['schede', 'Foto'], ['tabella', 'Tabella']].map(([k, l]) => `<button data-v="${k}" class="${f.vista === k ? 'att' : ''}">${l}</button>`).join('')}</div>
      <span class="spazio"></span>
      <button class="btn primario" id="pvNuova">+ Nuova prova</button>
      <button class="btn" id="pvConfronta" disabled>Confronta parametri</button>
      <button class="btn primario" id="pvXlsx">⬇ Excel prove</button>
      <button class="btn" id="pvCsv" title="Tutti i campi e tutti i parametri">CSV completo</button>
      <button class="btn" id="pvZip">⬇ Scarica foto e documenti</button>
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
const chiaveGruppo = (p, g) => g === 'tempo' ? isoG(p.t) : g === 'esito' ? (ESITI[p.esito] || '—') : g === 'colaggio' ? (p.produzione ? `c:${String(p.produzione.inizio).padStart(15, '0')}#${p.produzione.id}` : p.codiceColaggio ? 'codice#' + p.codiceColaggio : '—') : (p[g] || '—');
const etichettaGruppo = (k, g) => g === 'tempo' ? giornoLungo(Date.parse(k + 'T00:00:00Z')) : g === 'colaggio' ? (k === '—' ? 'Senza colaggio' : k.startsWith('codice#') ? 'Codice ' + k.slice(7) : 'Colaggio ' + testoColaggio(tutteLeProve().find(p => p.produzione?.id === k.slice(k.indexOf('#') + 1))?.produzione)) : k;
function principali(par, n = 4) {
  if (!par) return '<span class="nota" style="margin:0">parametri non disponibili</span>';
  const cams = Object.keys(par).sort();
  const va = vistaAttiva();
  return (va ? va.parametri.slice(0, n).map(k => [k, etichettaParam(k)]) : PARAM_PRINCIPALI.slice(0, n)).map(([k, l]) => `<div class="mod-voce"><span>${esc(l)}</span><span class="mod-val">${cams.map(c => esc(par[c]?.[k] ?? '—')).join(' / ')}</span></div>`).join('');
}
function aggiornaRisultatiProve() {
  const box = $('#pvRisultati'); if (!box) return;
  const lista = filtraProve(), f = S.pv;
  for (const id of [...f.sel]) if (!lista.some(p => p.id === id)) f.sel.delete(id);
  if (!tutteLeProve().length) { box.innerHTML = '<div class="vuoto">Nessuna prova salvata finora.<br><small>Premi <b>+ Nuova prova</b>, oppure apri una produzione → scheda <b>Foto scarti</b> → clicca una foto → <b>Segna come prova</b>.</small></div>'; collegaRisultatiProve(lista); return; }
  if (!lista.length) { box.innerHTML = riassuntoProve(lista) + '<div class="vuoto">Nessuna prova con questi filtri.</div>'; collegaRisultatiProve(lista); return; }
  const gruppi = new Map();
  for (const p of lista) { const k = chiaveGruppo(p, f.gruppo); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k).push(p); }
  const ordine = [...gruppi.keys()].sort((a, b) => f.gruppo === 'tempo' || f.gruppo === 'colaggio' ? b.localeCompare(a) : gruppi.get(b).length - gruppi.get(a).length);
  const scheda = p => `<figure class="foto prova-card ${f.sel.has(p.id) ? 'sel' : ''}" data-prova="${p.id}"><div class="foto-img" data-img="${esc(miniatura(p) || '')}"></div>
      <label class="foto-sel" title="Seleziona per confrontare o scaricare"><input type="checkbox" data-psel="${p.id}" ${f.sel.has(p.id) ? 'checked' : ''}></label>
      <figcaption class="prova-cap"><div class="prova-tit"><b>${esc(p.tipo)}</b><span class="esito" style="color:${COL_ESITO[p.esito]}">● ${ESITI[p.esito] || ''}</span></div>
        <div><span style="text-transform:capitalize">${esc(p.prodotto)}</span> · ${esc(p.operatore)}${p.allegati?.length ? ` · <span title="Allegati">📎 ${p.allegati.length}</span>` : ''}</div>
        ${p.posizioneDifetto?.length ? `<div class="nota" style="margin:2px 0 0">Difetto: <b>${testoPosizioni(p)}</b></div>` : ''}
        ${p.produzione || p.codiceColaggio ? `<div class="nota" style="margin:2px 0 0">Colaggio ${esc(testoColaggio(p.produzione))}${p.codiceColaggio ? ' · ' + esc(p.codiceColaggio) : ''}</div>` : ''}
        <div class="nota" style="margin:2px 0 0">${giornoCorto(p.t)} ${oraSec(p.t)}${p.note ? ' · ' + esc(p.note.slice(0, 60)) + (p.note.length > 60 ? '…' : '') : ''}</div></figcaption></figure>`;
  const riga = p => `<tr data-prova="${p.id}" class="cliccabile"><td><input type="checkbox" data-psel="${p.id}" ${f.sel.has(p.id) ? 'checked' : ''}></td><td>${giornoCorto(p.t)} ${oraSec(p.t)}</td><td class="sx" style="text-transform:capitalize">${esc(p.prodotto)}</td><td class="sx">${esc(p.tipo)}</td><td class="sx">${esc(p.operatore)}</td><td class="sx" style="color:${COL_ESITO[p.esito]}">${ESITI[p.esito] || ''}</td><td class="sx">${testoPosizioni(p) || '—'}</td><td class="sx">${esc(testoColaggio(p.produzione))}${p.codiceColaggio ? '<br><small>' + esc(p.codiceColaggio) + '</small>' : ''}</td><td class="sx note-cella">${p.allegati?.length ? `📎${p.allegati.length} ` : ''}${esc(p.note)}</td><td class="sx">${principali(p.parametri, 3)}</td></tr>`;
  box.innerHTML = riassuntoProve(lista) + ordine.map(k => {
    const ps = gruppi.get(k);
    return `<div class="sezione"><h3 class="gruppo-tit"><span style="text-transform:${f.gruppo === 'tempo' ? 'none' : 'capitalize'}">${esc(etichettaGruppo(k, f.gruppo))}</span><span class="chip">${ps.length}</span></h3>
      ${f.vista === 'schede' ? `<div class="foto-griglia">${ps.map(scheda).join('')}</div>`
        : `<div class="scroll-x"><table class="tabella tab-prove"><thead><tr><th></th><th>Quando</th><th class="sx">Prodotto</th><th class="sx">Tipo</th><th class="sx">Operatore</th><th class="sx">Esito</th><th class="sx">Difetto</th><th class="sx">Colaggio</th><th class="sx">Note</th><th class="sx">Parametri principali (cam. 0 / 1)</th></tr></thead><tbody>${ps.map(riga).join('')}</tbody></table></div>`}</div>`;
  }).join('');
  collegaRisultatiProve(lista);
}
function collegaRisultatiProve(lista) {
  const f = S.pv, box = $('#pvRisultati');
  const barra = () => { const n = f.sel.size; $('#pvConfronta').disabled = n < 2; $('#pvConfronta').textContent = n >= 2 ? `Confronta ${n} prove` : 'Confronta parametri'; $('#pvZip').textContent = n ? `⬇ Scarica ${n} prove` : '⬇ Scarica foto e documenti'; };
  box.querySelectorAll('[data-psel]').forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = () => { c.checked ? f.sel.add(c.dataset.psel) : f.sel.delete(c.dataset.psel); c.closest('[data-prova]').classList.toggle('sel', c.checked); barra(); }; });
  box.querySelectorAll('.foto-sel').forEach(l => l.onclick = e => e.stopPropagation());
  box.querySelectorAll('[data-prova]').forEach(el => el.onclick = () => apriDettaglioProva(el.dataset.prova));
  barra();
  const imgs = [...box.querySelectorAll('[data-img]')];
  urlFirmati(imgs.map(i => i.dataset.img)).then(() => imgs.forEach(i => { const u = urlFoto.get(i.dataset.img); i.innerHTML = u ? `<img loading="lazy" src="${u}" alt="">` : `<span class="ico-doc grande">${i.dataset.img ? '—' : '📎'}</span>`; }));
  $('#pvCsv').onclick = () => esportaProveCsv(lista);
  $('#pvXlsx').onclick = () => esportaProveXlsx(f.sel.size ? lista.filter(p => f.sel.has(p.id)) : lista);
  $('#pvZip').onclick = () => {
    const ps = f.sel.size ? lista.filter(p => f.sel.has(p.id)) : lista;
    if (!ps.length) return;
    scaricaZipProve(ps);
  };
  $('#pvNuova').onclick = () => apriFormProva([], () => render());
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
    ${ord.map(k => `<tr data-pk="${esc(k)}"><td>${esc(etichettaParam(k))}${etichettaParam(k) !== k ? ` <small>${esc(k)}</small>` : ''}</td>${cams.map(c => { const v = par[c]?.[k], o = confronto?.[c]?.[k]; const diff = confronto && String(o ?? '') !== String(v ?? ''); return `<td class="${diff ? 'diverso' : ''}">${esc(v ?? '—')}${diff ? ` <small title="Valore attuale">ora ${esc(o ?? '—')}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}
async function apriDettaglioProva(id) {
  const p = S.archivioProve.get(id); if (!p) return;
  if (p.foto) await urlFirmati([p.foto]);
  const u = p.foto && urlFoto.get(p.foto), att = S.modello?.parametri?.[p.prodotto];
  let nDiff = 0;
  if (att && p.parametri) for (const c of new Set([...Object.keys(att), ...Object.keys(p.parametri)])) for (const k of new Set([...Object.keys(att[c] || {}), ...Object.keys(p.parametri[c] || {})])) if (String(att[c]?.[k] ?? '') !== String(p.parametri[c]?.[k] ?? '')) nDiff++;
  const tutte = tutteLeProve(), ops = [...new Set(tutte.map(x => x.operatore))], tipi = [...new Set([...TIPI_PROVA, ...tutte.map(x => x.tipo)])];
  const col = p.produzione, colEsiste = col && (S.modello?.produzioni || []).some(x => x.id === col.id);
  const v = sovra(`<div class="dett-prova">
      <div>${u ? `<img class="foto-big" src="${u}" alt="">` : ''}
        <div class="nota" ${u ? '' : 'style="margin-top:0"'}>${giornoLungo(p.t)} alle <b>${oraSec(p.t)}</b> · <span style="text-transform:capitalize">${esc(p.prodotto)}</span>${p.foto ? ' · foto dello scarto' : ' · prova registrata a mano'}</div>
        ${col ? `<div class="nota">Colaggio <b>${esc(testoColaggio(col))}</b> · ${n0(col.t)} cassette, ${pc(col.r, col.t)} scarti ${colEsiste ? '<button type="button" class="btn piccolo" id="dApriCol">Apri colaggio</button>' : ''}</div>` : ''}
        <h3 style="margin-top:16px">Foto e documenti allegati</h3>
        <div id="dAll">${allegatiHtml(p.allegati, true)}</div>
        <div class="barra-filtri" style="margin-top:8px"><input type="file" id="dFile" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip" class="nascosto"><button type="button" class="btn" id="dAggiungi">+ Aggiungi foto o documenti</button></div>
        <div class="nota">Salvata da ${esc(p.chi || '—')} il ${giornoCorto(p.creato)} ${SMI.fmtOra(p.creato)}${p.modificato ? ` · modificata da ${esc(p.modificatoDa || '—')} il ${giornoCorto(p.modificato)} ${SMI.fmtOra(p.modificato)}` : ''}${p.gruppo ? ' · fa parte di un gruppo di prove salvate insieme' : ''}</div></div>
      <form id="fDett" class="form-prova">
        <label class="campo">Colaggio<select name="colaggio">${opzioniColaggio(col?.id || '')}${col && !colEsiste ? `<option value="${esc(col.id)}" selected>${esc(testoColaggio(col))} (non più nei dati)</option>` : ''}</select></label>
        <label class="campo">Codice colaggio / lotto<input type="text" name="codice" value="${esc(p.codiceColaggio || '')}"></label>
        <label class="campo">Operatore<input type="text" name="operatore" list="dlOp2" required value="${esc(p.operatore)}"></label><datalist id="dlOp2">${ops.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        <label class="campo">Tipo di prova<input type="text" name="tipo" list="dlTipo2" required value="${esc(p.tipo)}"></label><datalist id="dlTipo2">${tipi.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        ${campoPosizioni(p.posizioneDifetto || [])}
        <label class="campo">Esito<select name="esito">${Object.entries(ESITI).map(([k, l]) => `<option value="${k}" ${p.esito === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="campo">Note<textarea name="note" rows="4">${esc(p.note)}</textarea></label>
        <div class="escl-piede"><button type="button" class="btn" id="dElimina" style="color:#ffb4ae">Elimina</button><span class="spazio"></span>${p.foto ? '<button type="button" class="btn" id="dScarica">⬇ Foto</button>' : ''}<button class="btn primario">Salva modifiche</button></div>
      </form></div>
    <h3 style="margin-top:18px">Parametri di analisi al momento della prova</h3>
    <div class="nota" style="margin-top:0">${!p.parametri ? '' : p.parametriCerti ? 'Valori esatti di quel momento.' : 'Ricostruiti dai valori attuali e dallo storico delle modifiche: la registrazione delle modifiche non copriva ancora quel momento, quindi potrebbero non essere esatti.'}${att && p.parametri ? ` ${nDiff ? `<b>${nDiff}</b> valori diversi da quelli attuali (evidenziati).` : 'Tutti uguali ai valori attuali.'}` : ''}</div>
    <div class="sezione" style="margin-top:8px">${barraViste()}${tabellaParametri(p.parametri, att)}</div>
    <div class="escl-piede" style="margin-top:12px"><span class="spazio"></span><button class="btn" id="dChiudi">Chiudi</button></div>`, 'larga');
  const riapri = () => { v.remove(); apriDettaglioProva(id); if (location.hash === '#prove') render(); };
  const rimuovi = async i => {
    const a = p.allegati[i]; if (!confirm(`Togliere "${a.nome}" da questa prova?`)) return;
    if (await modificaProva(id, { allegati: p.allegati.filter((_, j) => j !== i) })) {
      if (!tutteLeProve().some(x => x.id !== id && (x.allegati || []).some(y => y.percorso === a.percorso))) await sb().storage.from('smi-allegati').remove([a.percorso]);
      toast('Allegato tolto'); riapri();
    }
  };
  applicaVista();
  collegaAllegati(v.querySelector('#dAll'), p.allegati || [], rimuovi);
  v.querySelector('#dAggiungi').onclick = () => v.querySelector('#dFile').click();
  v.querySelector('#dFile').onchange = async e => {
    const files = [...e.target.files]; if (!files.length) return;
    const b = v.querySelector('#dAggiungi'); b.disabled = true; b.textContent = `Carico ${files.length} file…`;
    const { allegati, errori } = await caricaAllegati(`prove/${id}`, files);
    if (errori.length) toast('Non caricati: ' + esc(errori.join(' · ')));
    if (allegati.length && await modificaProva(id, { allegati: [...(S.archivioProve.get(id).allegati || []), ...allegati] })) { toast(`${allegati.length} file aggiunti`); riapri(); }
    else { b.disabled = false; b.textContent = '+ Aggiungi foto o documenti'; }
  };
  v.querySelector('#dApriCol')?.addEventListener('click', () => { v.remove(); if (location.hash) { location.hash = ''; setTimeout(() => apriProduzione(col.id), 600); } else apriProduzione(col.id); });
  v.querySelector('#dChiudi').onclick = () => v.remove();
  v.querySelector('#dScarica')?.addEventListener('click', () => scaricaFoto(p.foto, `${isoG(p.t)}_${oraSec(p.t).replace(/:/g, '')}_${nomeSicuro(p.prodotto)}_${nomeSicuro(p.tipo)}.jpg`));
  v.querySelector('#fDett').onsubmit = async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
    const nuovoCol = d.colaggio === col?.id ? col : datiColaggio(d.colaggio);
    if (await modificaProva(id, { operatore: d.operatore.trim(), tipo: d.tipo.trim(), esito: d.esito, note: d.note.trim(), produzione: nuovoCol, codiceColaggio: d.codice.trim(), posizioneDifetto: posizioniDa(d) })) { toast('Prova aggiornata'); v.remove(); if (location.hash === '#prove') render(); }
  };
  v.querySelector('#dElimina').onclick = async () => {
    if (!confirm('Eliminare questa prova dall\'archivio? La foto e gli allegati verranno cancellati.')) return;
    if (await modificaProva(id, { eliminata: true })) {
      if (p.foto) await sb().storage.from('smi-foto').remove([p.foto]);
      const soli = (p.allegati || []).filter(a => !tutteLeProve().some(x => (x.allegati || []).some(y => y.percorso === a.percorso))).map(a => a.percorso);
      if (soli.length) await sb().storage.from('smi-allegati').remove(soli);
      S.pv.sel.delete(id); toast('Prova eliminata'); v.remove(); if (location.hash === '#prove') render();
    }
  };
}
// zip: una cartella per prova con foto e allegati, più il CSV con tutti i dati
async function scaricaZipProve(ps) {
  if (!ps.length) return;
  toast(`Preparo ${ps.length} prove…`);
  try {
    const JSZip = await caricaJSZip(), zip = new JSZip();
    zip.file('prove.csv', csvProve(ps));
    let manca = 0;
    const voci = ps.flatMap(p => {
      const cart = `${isoG(p.t)}_${oraSec(p.t).replace(/:/g, '')}_${nomeSicuro(p.prodotto)}_${nomeSicuro(p.tipo)}_${p.id}`;
      return [...(p.foto ? [{ b: 'smi-foto', percorso: p.foto, nome: `${cart}/foto_scarto.jpg` }] : []), ...(p.allegati || []).map((a, i) => ({ b: 'smi-allegati', percorso: a.percorso, nome: `${cart}/${i + 1}_${a.nome}` }))];
    });
    for (let i = 0; i < voci.length; i += 6) await Promise.all(voci.slice(i, i + 6).map(async x => { const { data } = await sb().storage.from(x.b).download(x.percorso); if (data) zip.file(x.nome, data); else manca++; }));
    scaricaBlob(await zip.generateAsync({ type: 'blob' }), `prove_${isoG(SMI.adesso())}.zip`);
    if (manca) toast(`${manca} file non più disponibili`);
  } catch (e) { toast('Download non riuscito: ' + esc(e.message)); }
}
async function confrontaProve(ps) {
  ps = ps.slice().sort((a, b) => a.t - b.t);
  await urlFirmati(ps.map(miniatura).filter(Boolean));
  const cams = [...new Set(ps.flatMap(p => Object.keys(p.parametri || {})))].sort();
  const chiavi = [...new Set(ps.flatMap(p => cams.flatMap(c => Object.keys(p.parametri?.[c] || {}))))];
  const righe = [];
  for (const c of cams) for (const k of chiavi) {
    const vals = ps.map(p => p.parametri?.[c]?.[k]);
    righe.push({ c, k, vals, diverso: new Set(vals.map(x => String(x ?? ''))).size > 1 });
  }
  const ord = (a, b) => { const ia = PARAM_PRINCIPALI.findIndex(([x]) => x === a.k), ib = PARAM_PRINCIPALI.findIndex(([x]) => x === b.k); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.k.localeCompare(b.k) || a.c.localeCompare(b.c); };
  const corpo = soloDiv => righe.filter(r => !soloDiv || r.diverso).sort(ord).map(r => `<tr class="${r.diverso ? 'diverso-r' : ''}" data-pk="${esc(r.k)}"><td>${esc(etichettaParam(r.k))} <small>cam. ${esc(r.c)}</small></td>${r.vals.map(x => `<td>${esc(x ?? '—')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${ps.length + 1}" class="vuoto">Nessuna differenza: tutte le prove avevano gli stessi parametri.</td></tr>`;
  const v = sovra(`<h2>Confronto di ${ps.length} prove</h2>
    <div class="barra-filtri" style="margin-top:8px"><label class="switch"><input type="checkbox" id="cTutti"><i></i>Mostra anche i parametri uguali</label><span class="spazio"></span><button class="btn" id="cChiudi">Chiudi</button></div>
    <div class="sezione" style="margin-top:0">${barraViste()}
    <div class="scroll-x"><table class="tabella mod-tab confronto"><thead><tr><th></th>${ps.map(p => `<th><div class="conf-th">${urlFoto.get(miniatura(p)) ? `<img src="${urlFoto.get(miniatura(p))}" alt="">` : ''}<b>${esc(p.tipo)}</b><span>${giornoCorto(p.t)} ${oraSec(p.t)}</span><span style="text-transform:capitalize">${esc(p.prodotto)} · ${esc(p.operatore)}</span><span style="color:${COL_ESITO[p.esito]}">${ESITI[p.esito] || ''}</span></div></th>`).join('')}</tr></thead><tbody id="cCorpo">${corpo(true)}</tbody></table></div></div>`, 'larga');
  v.querySelector('#cChiudi').onclick = () => v.remove();
  v.querySelector('#cTutti').onchange = e => { v.querySelector('#cCorpo').innerHTML = corpo(!e.target.checked); applicaVista(); };
  applicaVista();
}
function csvCella(x) { const s = String(x ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function csvProve(ps) {
  const cams = [...new Set(ps.flatMap(p => Object.keys(p.parametri || {})))].sort();
  const chiavi = [...new Set(ps.flatMap(p => cams.flatMap(c => Object.keys(p.parametri?.[c] || {}))))].sort();
  const colPar = cams.flatMap(c => chiavi.map(k => [c, k]));
  const testa = ['Data', 'Ora', 'Prodotto', 'Tipo di prova', 'Operatore', 'Esito', 'Note', 'Colaggio (inizio)', 'Codice colaggio / lotto', 'Posizione difetto', 'Cassette colaggio', '% scarti colaggio', 'Allegati', 'Parametri esatti', 'Salvata da', 'Foto', ...colPar.map(([c, k]) => `cam${c} ${k}`)];
  const righe = ps.map(p => [isoG(p.t), oraSec(p.t), p.prodotto, p.tipo, p.operatore, ESITI[p.esito] || '', p.note, p.produzione ? `${isoG(p.produzione.inizio)} ${SMI.fmtOra(p.produzione.inizio)}` : '', p.codiceColaggio || '', testoPosizioni(p), p.produzione?.t ?? '', p.produzione?.t ? n1(100 * p.produzione.r / p.produzione.t) : '', (p.allegati || []).map(a => a.nome).join(', '), p.parametriCerti ? 'sì' : 'ricostruiti', p.chi, p.foto || '', ...colPar.map(([c, k]) => p.parametri?.[c]?.[k] ?? '')]);
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

/* prove di un colaggio, nel riepilogo della produzione */
function pannelloProveColaggio(p) {
  if (S.modo !== 'remoto') return '';
  return `<div class="sezione pannello" id="pProveCol"><h3>Prove su questo colaggio</h3><div id="pProveColL" class="nota" style="margin-top:0">Carico…</div>
    <div class="barra-filtri" style="margin:10px 0 0"><button class="btn primario" id="pNuovaProva">+ Nuova prova su questo colaggio</button></div></div>`;
}
async function collegaProveColaggio(p) {
  const box = $('#pProveCol'); if (!box) return;
  const disegna = async () => {
    if (!S.archivioProve) await caricaProve();
    const ps = tutteLeProve().filter(x => x.produzione?.id === p.id).sort((a, b) => a.t - b.t);
    const l = $('#pProveColL'); if (!l) return;
    l.innerHTML = ps.length ? `<div class="foto-griglia piccola">${ps.map(x => `<figure class="foto prova-card" data-prova="${x.id}"><div class="foto-img" data-img="${esc(miniatura(x) || '')}"></div><figcaption class="prova-cap"><div class="prova-tit"><b>${esc(x.tipo)}</b><span class="esito" style="color:${COL_ESITO[x.esito]}">● ${ESITI[x.esito] || ''}</span></div><div>${oraSec(x.t)} · ${esc(x.operatore)}${x.allegati?.length ? ` · 📎 ${x.allegati.length}` : ''}</div></figcaption></figure>`).join('')}</div>` : 'Nessuna prova associata a questo colaggio.';
    l.querySelectorAll('[data-prova]').forEach(el => el.onclick = () => apriDettaglioProva(el.dataset.prova));
    const imgs = [...l.querySelectorAll('[data-img]')];
    await urlFirmati(imgs.map(i => i.dataset.img).filter(Boolean));
    imgs.forEach(i => { const u = urlFoto.get(i.dataset.img); i.innerHTML = u ? `<img loading="lazy" src="${u}" alt="">` : '<span class="ico-doc grande">📎</span>'; });
  };
  $('#pNuovaProva').onclick = () => apriFormProva([], disegna, { colaggio: p.id, t: Math.min(SMI.adesso(), fineProd(p)) - (SMI.adesso() > fineProd(p) ? 60e3 : 0) });
  disegna();
}

/* ==========================================================================
   SEGNALIBRI DEI PARAMETRI
   Un segnalibro è un elenco di parametri da mostrare (gli altri si nascondono) nella scheda
   Parametri di una produzione, nel dettaglio e nel confronto delle prove.
   Sono condivisi (riga 'viste_parametri' di smi_dati); quello scelto si ricorda nel browser e si può
   aprire da un link (?parametri=<nome>) da salvare tra i preferiti del browser.
   ========================================================================== */
S.viste ||= [];
const PRINCIPALI_ID = '__principali';
function vistaAttiva() {
  let id = ''; try { id = localStorage.getItem('smi_vista_par') || ''; } catch { }
  if (id === PRINCIPALI_ID) return { id, nome: 'Parametri principali', parametri: PARAM_PRINCIPALI.map(([k]) => k) };
  return S.viste.find(v => v.id === id) || null;
}
function scegliVista(id) { try { localStorage.setItem('smi_vista_par', id || ''); } catch { } applicaVista(); }
// link ?parametri=nome → segnalibro scelto (una volta caricati i segnalibri)
function vistaDaLink() {
  const q = new URLSearchParams(location.search).get('parametri'); if (!q) return;
  const v = q === 'principali' ? { id: PRINCIPALI_ID } : S.viste.find(x => x.id === q || x.nome.toLowerCase() === q.toLowerCase());
  if (v) { try { localStorage.setItem('smi_vista_par', v.id); } catch { } }
}
function tuttiIParametri() {
  const k = new Set(PARAM_PRINCIPALI.map(([x]) => x));
  for (const prod of Object.values(S.modello?.parametri || {})) for (const cam of Object.values(prod || {})) for (const x of Object.keys(cam || {})) k.add(x);
  return [...k];
}
function barraViste() {
  const a = vistaAttiva();
  return `<div class="barra-viste"><span class="nota" style="margin:0">Segnalibro</span>
    <select class="sel-vista"><option value="">Tutti i parametri</option><option value="${PRINCIPALI_ID}" ${a?.id === PRINCIPALI_ID ? 'selected' : ''}>Parametri principali</option>
      ${S.viste.map(v => `<option value="${esc(v.id)}" ${a?.id === v.id ? 'selected' : ''}>🔖 ${esc(v.nome)} (${v.parametri.length})</option>`).join('')}</select>
    <button type="button" class="btn piccolo" data-vista="nuovo">+ Nuovo</button>
    <button type="button" class="btn piccolo" data-vista="modifica" ${a && a.id !== PRINCIPALI_ID ? '' : 'hidden'}>Modifica</button>
    <button type="button" class="btn piccolo" data-vista="link" ${a ? '' : 'hidden'} title="Link da salvare nei preferiti del browser">🔗 Link</button>
    <span class="nota vista-info" style="margin:0"></span></div>`;
}
// nasconde gli elementi [data-pk] che non sono nel segnalibro scelto e aggiorna tutte le barre
function applicaVista() {
  const a = vistaAttiva(), set = a ? new Set(a.parametri) : null;
  document.querySelectorAll('[data-pk]').forEach(el => el.classList.toggle('fuori-vista', !!set && !set.has(el.dataset.pk)));
  document.querySelectorAll('.barra-viste').forEach(b => { if (b.querySelector('.sel-vista').options.length !== S.viste.length + 2) b.outerHTML = barraViste(); });
  document.querySelectorAll('.barra-viste').forEach(b => {
    b.querySelector('.sel-vista').value = a?.id || '';
    b.querySelector('[data-vista=modifica]').hidden = !(a && a.id !== PRINCIPALI_ID);
    b.querySelector('[data-vista=link]').hidden = !a;
    b.querySelector('.vista-info').textContent = a ? `${a.parametri.length} parametri nel segnalibro` : '';
  });
  collegaBarreViste();
}
function collegaBarreViste() {
  document.querySelectorAll('.barra-viste').forEach(b => {
    b.querySelector('.sel-vista').onchange = e => scegliVista(e.target.value);
    b.querySelector('[data-vista=nuovo]').onclick = () => editorVista(null);
    b.querySelector('[data-vista=modifica]').onclick = () => editorVista(vistaAttiva());
    b.querySelector('[data-vista=link]').onclick = async () => {
      const a = vistaAttiva(); const url = `${location.origin}${location.pathname}?parametri=${encodeURIComponent(a.id === PRINCIPALI_ID ? 'principali' : a.nome)}`;
      try { await navigator.clipboard.writeText(url); toast('Link copiato: salvalo nei preferiti del browser (Ctrl+D dopo averlo aperto)'); }
      catch { prompt('Copia questo link e salvalo nei preferiti:', url); }
    };
  });
}
async function salvaViste(modifica) {
  const { data, error } = await sb().from('smi_dati').select('dati').eq('id', 'viste_parametri');
  if (error) { toast('Non riesco a leggere i segnalibri: ' + esc(error.message)); return false; }
  const lista = modifica((data?.[0]?.dati?.lista || []).slice()); if (!lista) return false;
  const { error: e2 } = await sb().from('smi_dati').upsert({ id: 'viste_parametri', dati: { lista }, aggiornato: new Date().toISOString() });
  if (e2) { toast('Non riesco a salvare: ' + esc(e2.message)); return false; }
  S.viste = lista; return true;
}
function editorVista(vista) {
  if (S.modo !== 'remoto') { toast('I segnalibri si salvano solo con l\'accesso ai dati del PC della linea'); return; }
  const tutti = tuttiIParametri(), scelti = new Set(vista?.parametri || []);
  const ord = PARAM_PRINCIPALI.map(([k]) => k).filter(k => tutti.includes(k)).concat(tutti.filter(k => !PARAM_PRINCIPALI.some(([x]) => x === k)).sort());
  const v = sovra(`<h2>${vista ? 'Modifica segnalibro' : 'Nuovo segnalibro'}</h2>
    <div class="nota" style="margin-top:4px">Scegli i parametri da vedere: con questo segnalibro attivo, nelle schede dei parametri compaiono solo questi. Il segnalibro è condiviso con tutti gli utenti.</div>
    <form id="fVista" class="form-prova">
      <label class="campo">Nome<input type="text" name="nome" required value="${esc(vista?.nome || '')}" placeholder="es. Controllo Goleador" autocomplete="off"></label>
      <div class="barra-filtri" style="margin:0"><input type="search" id="vCerca" placeholder="Cerca parametro…" style="flex:1"><button type="button" class="btn piccolo" id="vPrinc">Solo principali</button><button type="button" class="btn piccolo" id="vNessuno">Nessuno</button><span class="nota" id="vConta" style="margin:0"></span></div>
      <div class="lista-check">${ord.map(k => `<label data-k="${esc((k + ' ' + etichettaParam(k)).toLowerCase())}"><input type="checkbox" value="${esc(k)}" ${scelti.has(k) ? 'checked' : ''}><span>${esc(etichettaParam(k))}${etichettaParam(k) !== k ? ` <small>${esc(k)}</small>` : ''}</span></label>`).join('')}</div>
      <div class="escl-piede">${vista ? '<button type="button" class="btn" id="vElimina" style="color:#ffb4ae">Elimina</button>' : ''}<span class="spazio"></span><button type="button" class="btn" id="vAnn">Annulla</button><button class="btn primario">Salva segnalibro</button></div>
    </form>`, 'media');
  const conta = () => { v.querySelector('#vConta').textContent = `${v.querySelectorAll('.lista-check input:checked').length} scelti`; };
  v.querySelectorAll('.lista-check input').forEach(c => c.onchange = conta); conta();
  v.querySelector('#vCerca').oninput = e => { const q = e.target.value.toLowerCase().trim(); v.querySelectorAll('.lista-check label').forEach(l => l.style.display = !q || l.dataset.k.includes(q) ? '' : 'none'); };
  v.querySelector('#vPrinc').onclick = () => { const p = new Set(PARAM_PRINCIPALI.map(([k]) => k)); v.querySelectorAll('.lista-check input').forEach(c => c.checked = p.has(c.value)); conta(); };
  v.querySelector('#vNessuno').onclick = () => { v.querySelectorAll('.lista-check input').forEach(c => c.checked = false); conta(); };
  v.querySelector('#vAnn').onclick = () => v.remove();
  v.querySelector('#vElimina')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare il segnalibro "${vista.nome}" per tutti?`)) return;
    if (await salvaViste(l => l.filter(x => x.id !== vista.id))) { toast('Segnalibro eliminato'); v.remove(); scegliVista(''); }
  });
  v.querySelector('#fVista').onsubmit = async e => {
    e.preventDefault();
    const nome = new FormData(e.target).get('nome').trim(), parametri = [...v.querySelectorAll('.lista-check input:checked')].map(c => c.value);
    if (!parametri.length) { toast('Scegli almeno un parametro'); return; }
    const id = vista?.id || 'v' + Date.now().toString(36);
    const ok = await salvaViste(l => {
      if (l.some(x => x.id !== id && x.nome.toLowerCase() === nome.toLowerCase())) { toast('Esiste già un segnalibro con questo nome'); return null; }
      const rec = { id, nome, parametri, chi: S.utente?.email || '', aggiornato: SMI.adesso() };
      const i = l.findIndex(x => x.id === id); if (i >= 0) l[i] = rec; else l.push(rec);
      return l;
    });
    if (ok) { toast('Segnalibro salvato'); v.remove(); scegliVista(id); }
  };
}

/* ---------- Excel delle prove (struttura concordata) ----------
   Una riga per produzione (colaggio) dello stesso prodotto con gli stessi parametri; nelle colonne
   Difetto stampa SX / CENTRO / DX va la foto della prova con il difetto in quella posizione (la prima,
   se ce ne sono più di una). Conteggi = quelli della produzione. ExcelJS (immagini e formattazione). */
let exceljsP = null;
function caricaExcelJS() {
  return exceljsP ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    s.onload = () => ok(window.ExcelJS); s.onerror = () => { exceljsP = null; ko(new Error('libreria Excel non caricata')); };
    document.head.appendChild(s);
  });
}
const COLONNE_XLSX = [['', 5], ['Prodotto', 16], ['Data', 11], ['Turno', 12], ['Total', 9], ['Accepted products', 11], ['Rejected products', 11], ['SMI', 8], ['Starch', 9], ['Residual', 9],
  ['Largest defect threshold pixels', 12], ['Largest defect threshold pixels', 12], ['Greylevel threshold', 11],
  ['Erodi / dilata dimensione orrizontale pixel', 13], ['Erodi / dilata dimensione orrizontale pixel', 13],
  ['Difetto stampa \nSX', 36], ['Difetto stampa \nCENTRO', 36], ['Difetto stampa \nDX', 36], ['Umidità amido colaggio', 12]];
const PARAM_XLSX = ['MINIMUM_DEFECT_SIZE', 'MINIMUM_SUM_OF_DEFECT_SIZES', 'GREYLEVEL_THRESHOLD', 'ERODE_DILATE_HOR_SIZE', 'ERODE_DILATE_VER_SIZE'];
function gruppiXlsx(ps) {
  const val = (p, k) => p.parametri?.['0']?.[k] ?? p.parametri?.['-']?.[k] ?? Object.values(p.parametri || {}).find(c => c?.[k] != null)?.[k] ?? '';
  const g = new Map();
  for (const p of ps.slice().sort((a, b) => a.t - b.t)) {
    const pr = (S.modello?.produzioni || []).find(x => x.id === p.produzione?.id) || (p.produzione ? null : produzioneAl(p.t));
    const par = PARAM_XLSX.map(k => val(p, k));
    const k = [pr?.id || p.produzione?.id || `${p.prodotto}|${isoG(p.t)}`, ...par].join('§');
    if (!g.has(k)) g.set(k, { prove: [], pr, prodSalvata: p.produzione, prodotto: p.prodotto, par, foto: {} });
    const o = g.get(k); o.prove.push(p);
    for (const pos of p.posizioneDifetto || []) if (!o.foto[pos] && miniatura(p)) o.foto[pos] = miniatura(p);
  }
  return [...g.values()];
}
async function immagineJpeg(chiave, maxL = 640) {
  const [bucket, percorso] = chiave.startsWith('A:') ? ['smi-allegati', chiave.slice(2)] : ['smi-foto', chiave];
  const { data } = await sb().storage.from(bucket).download(percorso); if (!data) return null;
  try {
    const bmp = await createImageBitmap(data), sc = Math.min(1, maxL / bmp.width);
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close();
    return { base64: cv.toDataURL('image/jpeg', 0.8), w: cv.width, h: cv.height };
  } catch { return null; }
}
async function esportaProveXlsx(ps) {
  if (!ps.length) return toast('Nessuna prova da esportare');
  toast(`Preparo l'Excel con ${ps.length} prove…`);
  try {
    const ExcelJS = await caricaExcelJS(), gruppi = gruppiXlsx(ps);
    const wb = new ExcelJS.Workbook(); wb.creator = 'Dashboard NID 1';
    const ws = wb.addWorksheet('Prove', {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .3, right: .3, top: .4, bottom: .4, header: .2, footer: .2 }, printTitlesRow: '1:1' },
    });
    ws.columns = COLONNE_XLSX.map(([, w]) => ({ width: w }));
    const bordo = { style: 'thin', color: { argb: 'FFB7C3D0' } }, bordi = { top: bordo, left: bordo, bottom: bordo, right: bordo };
    const testa = ws.addRow(COLONNE_XLSX.map(([h]) => h));
    testa.height = 48;
    testa.eachCell((c, n) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: n >= 16 && n <= 18 ? 'FF8E3B3B' : n >= 11 && n <= 15 ? 'FF2F5D8A' : 'FF1F3A5F' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = bordi;
    });
    const ALT_FOTO = 112; // pt
    let r = 1;
    for (const [i, gr] of gruppi.entries()) {
      const p0 = gr.prove[0], pr = gr.pr, tot = pr ? pr.t : gr.prodSalvata?.t, rej = pr ? pr.r : gr.prodSalvata?.r;
      const [y, m, d] = isoG(p0.t).split('-').map(Number);
      const turni = [...new Set(gr.prove.map(p => SMI.turnoDi(p.t).nome))].join(', ');
      const num = v => v === '' || v == null ? null : isNaN(+v) ? v : +v;
      const row = ws.addRow([i + 1, maiusc(gr.prodotto), new Date(Date.UTC(y, m - 1, d)), turni, tot ?? null, tot != null && rej != null ? tot - rej : null, rej ?? null, null, pr?.s ?? null, pr?.re ?? null, ...gr.par.map(num), null, null, null, null]);
      r++;
      const conFoto = POSIZIONI.some(([k]) => gr.foto[k]);
      row.height = conFoto ? ALT_FOTO : 22;
      for (let n = 1; n <= COLONNE_XLSX.length; n++) { const c = row.getCell(n);
        c.border = bordi; c.alignment = { horizontal: n === 2 || n === 4 ? 'left' : 'center', vertical: 'middle', wrapText: true }; c.font = { size: 11 };
        if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FA' } };
      }
      row.getCell(2).font = { bold: true, size: 11 };
      row.getCell(3).numFmt = 'dd/mm/yyyy';
      [5, 6, 7, 9, 10].forEach(n => row.getCell(n).numFmt = '#,##0');
      if (rej && tot) row.getCell(7).note = `${n1(100 * rej / tot)}% scarti`;
      for (const [j, [k]] of POSIZIONI.entries()) {
        const chiave = gr.foto[k]; if (!chiave) continue;
        const im = await immagineJpeg(chiave); if (!im) { row.getCell(16 + j).value = '(foto non disponibile)'; continue; }
        const id = wb.addImage({ base64: im.base64, extension: 'jpeg' });
        const boxW = COLONNE_XLSX[15 + j][1] * 7 - 10, boxH = ALT_FOTO * 4 / 3 - 10, s = Math.min(boxW / im.w, boxH / im.h);
        const w = im.w * s, h = im.h * s;
        ws.addImage(id, { tl: { col: 15 + j + (boxW + 10 - w) / 2 / (boxW + 10), row: r - 1 + (boxH + 10 - h) / 2 / (boxH + 10) }, ext: { width: w, height: h }, editAs: 'oneCell' });
      }
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLONNE_XLSX.length } };
    const buf = await wb.xlsx.writeBuffer();
    scaricaBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `prove_NID1_${isoG(SMI.adesso())}.xlsx`);
    toast(`Excel pronto: ${gruppi.length} righe da ${ps.length} prove`);
  } catch (e) { toast('Excel non creato: ' + esc(e.message)); }
}
