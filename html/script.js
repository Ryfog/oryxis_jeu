/* ============================ ORYXIS — logique jeu (v2) ============================ */
/* Partie unique partagee (Jumanji) : 1 pion, 1 de, 1 lancer/jour.
   En jeu (FiveM) le lancer est decide par le SERVEUR (autorite + webhook).
   Dans le navigateur (apercu) tout tourne en local. */

/* "navigateur" = tout sauf la VRAIE resource FiveM (servie sur https://cfx-nui-<resource>/).
   Page web / iframe externe / fichier local => on joue en local et on s'affiche tout seul. */
const BROWSER = !String(location.host).startsWith('cfx-nui-');
const FREE = location.search.includes('free');   // navigateur : autorise les lancers en boucle

/* cooldown 1/jour simule en navigateur (en jeu c'est le serveur qui gere) */
function browserRolledToday() { return localStorage.getItem('oryxis_lastRollDay') === new Date().toDateString(); }
function browserMarkRolled() { localStorage.setItem('oryxis_lastRollDay', new Date().toDateString()); }

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};

/* Chemin officiel des cases (x%, y%) — tracé par l'admin sur le plateau. ?debug affiche les repères. */
const PATH = [
  [68.7,10.6],[71.4,11.3],[72.8,14.8],[72.9,19.8],[71.3,22.1],[68.7,24.6],[66.4,25.4],[65,27.5],[67.9,29.2],[71,31.5],
  [73,34],[74.1,37.5],[73.7,41.7],[72.3,44.4],[67,50.1],[64,53.5],[62,56.5],[61.2,59.4],[63,68.7],[64.4,71.4],
  [67,72.3],[69.8,72.8],[72.7,70.6],[73.6,67.4],[74.9,56.4],[73.8,52.3],[72.2,50.3],[67,45.2],[64,43],[62.2,39.6],
  [61,35.5],[60.6,31.7],[61.8,24.5],[56.5,23.3],[53.8,23],[50.8,22.7],[47.4,23.5],[44.9,23.7],[40.9,25.6],[35.8,26.5],
  [32.9,25.8],[30,25.2],[26.8,24.1],[25.2,22.2],[26.8,9.7],[29.7,9.5],[31.6,11.3],[33.2,14.3],[33.8,17.4],[33.1,22.2],
  [31.4,31.3],[29.9,35.2],[29,38.9],[23.3,38.1],[20.5,40.8],[20,44.6],[20,48.3],[22,52.3],[24.7,54.3],[27,55.2],
  [29.6,56.4],[32.4,58],[34.2,60.2],[36.9,62.9],[38.7,65.7],[40.9,68.9],[45.8,71.2],[48.7,70.7],[51,69.7],[53.5,68.2],
  [56.5,67.2],[59.8,74],[58.2,77],[57.1,79.5],[55.3,81.9],[53.5,83.2],[51,84],[53.5,18.8],[53.5,14.6],[51.2,10.7],
  [47.9,10.1],[45.7,10.8],[42.4,13],[40.8,15.6],[40.8,19.8],[42.2,30.6],[40.8,33.5],[39.8,36.8],[38.2,39.5],[36.4,42.2],
  [34.5,45.3],[32.6,49.3],[31.1,52.1],[28.8,60.8],[28.6,65.1],[28.4,69.6],[30,74.9],[31.6,77.5],[32.9,78.7],[36,79.3],
  [39,78.3],[39.8,75.3],[43.3,66.4],[44.2,63.4]
];

/* Deck d'apercu navigateur (en jeu, les cartes viennent du serveur / editeur admin). */
const CARDS = [
  { type: 'event', title: 'DES BRUITS AU LOIN...', effect: 'RECULE DE 2 CASES.', move: -2 },
  { type: 'event', title: 'VENT FAVORABLE',        effect: 'AVANCE DE 2 CASES.', move: 2 },
  { type: 'defi',  title: 'PIEGE ANCIEN',          effect: 'RESTE IMMOBILE 30 SECONDES.', move: 0 },
  { type: 'defi',  title: "L'APPEL D'ORYXIS",      effect: 'REJOINS LE POINT MARQUE.',     move: 0 },
  { type: 'event', title: 'EBOULEMENT',            effect: 'RECULE DE 1 CASE.',  move: -1 },
];

const state = { pos: 0, rolling: false, canRoll: true, nbCases: PATH.length - 1 };

/* deck editable (version staff) — en jeu il vient du serveur, en navigateur c'est CARDS */
let deck = CARDS.slice();
let forcedNext = -1;   // index de carte forcee pour le prochain lancer (-1 = aleatoire)
let editIndex = -1;

/* apercu navigateur : on partage le deck entre fenetres (localStorage) pour imiter la synchro serveur */
const DECK_KEY = 'oryxis_deck', NEXT_KEY = 'oryxis_next';
function saveDeckLocal() {
  if (!BROWSER) return;
  try { localStorage.setItem(DECK_KEY, JSON.stringify(deck)); localStorage.setItem(NEXT_KEY, String(forcedNext)); } catch (e) {}
}
function loadDeckLocal() {
  if (!BROWSER) return;
  try {
    const r = localStorage.getItem(DECK_KEY);
    if (r) { const d = JSON.parse(r); if (Array.isArray(d) && d.length) deck = d; }
    const n = localStorage.getItem(NEXT_KEY);
    if (n !== null) forcedNext = parseInt(n, 10);
  } catch (e) {}
}

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const screen = $('#screen');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clampPos = (p) => Math.max(0, Math.min(PATH.length - 1, p));

function buildDie(el) { el.innerHTML = ''; for (let i = 0; i < 9; i++) { const p = document.createElement('div'); p.className = 'pip'; el.appendChild(p); } }
function setDie(el, val) { const p = el.children; for (let i = 0; i < 9; i++) p[i].classList.toggle('on', PIPS[val].includes(i)); el.dataset.val = val; }

function placePawn() {
  const p = PATH[clampPos(state.pos)];
  $('#pawn').style.left = p[0] + '%';
  $('#pawn').style.top = p[1] + '%';
}
function hop() { const pw = $('#pawn'); pw.classList.add('hop'); setTimeout(() => pw.classList.remove('hop'), 280); }

function buildDebug() {
  const c = $('#pathDebug'); c.innerHTML = '';
  PATH.forEach((p, i) => { const d = document.createElement('div'); d.className = 'cell'; d.style.left = p[0] + '%'; d.style.top = p[1] + '%'; d.textContent = i; c.appendChild(d); });
}

function setStatus(txt) { const s = $('#status'); s.innerHTML = txt || ''; s.classList.toggle('on', !!txt); }

function showCard(card) {
  $('#cardBanner').textContent = card.type === 'defi' ? 'DÉFI' : 'ÉVÉNEMENT';
  $('#cardTitle').innerHTML = esc(card.title);
  $('#cardEffect').innerHTML = esc(card.effect);
  const c = $('#card');
  c.classList.remove('defi', 'event');
  c.classList.add(card.type === 'defi' ? 'defi' : 'event');
  c.classList.add('flipped');
}
function hideCard() { $('#card').classList.remove('flipped'); }

/* deplacement case par case jusqu'a une cible */
async function moveTo(target) {
  target = clampPos(target);
  while (state.pos !== target) {
    state.pos += state.pos < target ? 1 : -1;
    placePawn(); hop();
    await wait(330);
  }
}

/* obtient le resultat d'un lancer : serveur en jeu, local en navigateur */
async function requestRoll() {
  if (!BROWSER) {
    try {
      const r = await fetch(`https://${res()}/roll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      return await r.json();
    } catch (e) { return { ok: false, reason: 'error' }; }
  }
  // apercu navigateur
  if (!FREE && browserRolledToday()) return { ok: false, reason: 'cooldown' };
  const die = 1 + Math.floor(Math.random() * 6);
  const from = state.pos;
  const landed = clampPos(from + die);
  const atCenter = landed >= PATH.length - 1;
  let card, to;
  if (forcedNext >= 0 && deck[forcedNext]) {        // carte forcee par le staff
    card = deck[forcedNext]; forcedNext = -1;
    to = atCenter ? landed : clampPos(landed + (card.move || 0));
  } else if (atCenter) {                            // au centre : toujours un defi, le pion reste
    const defis = deck.filter((c) => c.type === 'defi');
    card = defis.length ? defis[Math.floor(Math.random() * defis.length)] : deck[Math.floor(Math.random() * deck.length)];
    to = landed;
  } else {
    card = deck[Math.floor(Math.random() * deck.length)];
    to = clampPos(landed + (card.move || 0));
  }
  if (!FREE) browserMarkRolled();
  return { ok: true, die, from, landed, to, card };
}

async function roll() {
  if (state.rolling || !state.canRoll) return;
  state.rolling = true;
  $('#rollBtn').classList.add('busy');
  hideCard();
  setStatus('LE DE ROULE...');

  const d = $('#die1'); d.classList.add('rolling');
  const spin = setInterval(() => setDie(d, 1 + Math.floor(Math.random() * 6)), 70);
  const r = await requestRoll();
  clearInterval(spin); d.classList.remove('rolling');

  if (!r || !r.ok) {
    const m = r && r.reason === 'cooldown' ? "LE DE A DEJA ETE LANCE AUJOURD'HUI."
            : r && r.reason === 'noitem' ? "TU N'AS PAS LE JEU EN MAIN."
            : 'IMPOSSIBLE DE JOUER.';
    setStatus(m);
    state.rolling = false; $('#rollBtn').classList.remove('busy');
    return;
  }

  setDie(d, r.die);
  setStatus(`LE DE TOMBE SUR ${r.die}.`);
  await wait(450);

  await moveTo(r.landed);

  if (r.card) {
    showCard(r.card);
    setStatus(r.card.type === 'defi' ? 'UN DEFI VOUS EST IMPOSE.' : 'LE SORT EN EST JETE.');
    await wait(1500);
  }
  if (r.to !== r.landed) await moveTo(r.to);
  state.pos = r.to;

  await wait(900);
  if (state.pos >= state.nbCases) setStatus("AU CENTRE... ET POURTANT RIEN NE FINIT. RELANCEZ : UN NOUVEAU DEFI VOUS ATTEND.");
  else setStatus('LE JEU SE VOLATILISE... IL REAPPARAITRA AILLEURS.');

  // pas d'auto-verrou : en jeu c'est le SERVEUR qui bloque (1 lancer/jour) ;
  // en navigateur on relance librement pour tester.
  $('#rollBtn').classList.remove('busy');
  state.rolling = false;
}

/* ---------- intro ---------- */
function resume() { $('#intro').classList.add('gone'); }

/* ---------- éditeur de chemin (?edit) ---------- */
let edPoints = [];
function enableEditor() {
  resume();
  $('#pawn').style.display = 'none';
  $('#editor').classList.add('on');
  $('#edLine').classList.add('on');
  $('#pathDebug').classList.add('on');
  $('#game').addEventListener('click', edClick);
  $('#edUndo').addEventListener('click', () => { edPoints.pop(); edRender(); });
  $('#edClear').addEventListener('click', () => { edPoints = []; edRender(); });
  $('#edCopy').addEventListener('click', () => { navigator.clipboard.writeText($('#edOut').value).catch(() => {}); });
  edRender();
}
function edClick(e) {
  if (e.target.closest('button') || e.target.closest('#card') || e.target.closest('#editor')) return;
  const r = $('#game').getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 100;
  const y = ((e.clientY - r.top) / r.height) * 100;
  edPoints.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  edRender();
}
function edRender() {
  const dbg = $('#pathDebug'); dbg.innerHTML = '';
  edPoints.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'cell';
    d.style.left = p[0] + '%'; d.style.top = p[1] + '%'; d.textContent = i;
    dbg.appendChild(d);
  });
  $('#edLine').innerHTML = edPoints.length > 1
    ? `<polyline points="${edPoints.map(p => p[0] + ',' + p[1]).join(' ')}"/>` : '';
  $('#edCount').textContent = edPoints.length;
  $('#edOut').value = JSON.stringify(edPoints);
}

/* ---------- version staff (admin) ---------- */
function esc(s) { return (s || '').replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

async function api(name, data) {
  if (BROWSER) return null;
  try {
    const r = await fetch(`https://${res()}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) });
    return await r.json();
  } catch (e) { return null; }
}

function openAdmin(cards, next) {
  if (Array.isArray(cards)) deck = cards;
  if (typeof next === 'number') forcedNext = next;
  screen.classList.remove('hidden');
  $('#admin').classList.add('on');
  resetForm(); renderAdmin();
}
function closeAdmin() { close(); }   // fermeture complete du NUI (cache l'ecran + relache le focus)
function renderAdmin() {
  const list = $('#admList'); list.innerHTML = '';
  deck.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'adm-card ' + (c.type === 'defi' ? 'defi' : 'event');
    const mv = c.move ? ((c.move > 0 ? '+' : '') + c.move + ' case(s)') : 'pas de déplacement';
    el.innerHTML =
      `<span class="badge">${c.type === 'defi' ? 'DÉFI' : 'ÉVÉN.'}</span>
       <div class="txt"><div class="t">${esc(c.title)}</div><div class="e">${esc(c.effect)}</div><div class="mv">${mv}</div></div>
       <div class="acts"><button data-ed="${i}">Éditer</button><button class="del" data-del="${i}">Suppr.</button></div>`;
    list.appendChild(el);
  });
  $('#admCount').textContent = deck.length;
  $('#admNext').innerHTML = '<option value="-1">— Aléatoire (normal) —</option>' +
    deck.map((c, i) => `<option value="${i}">${c.type === 'defi' ? '[DÉFI] ' : '[ÉVÉN] '}${esc(c.title)}</option>`).join('');
  $('#admNext').value = String(forcedNext);
}
function resetForm() {
  editIndex = -1; $('#fHead').textContent = 'Nouvelle carte';
  $('#fType').value = 'defi'; $('#fTitle').value = ''; $('#fEffect').value = ''; $('#fMove').value = '0';
  $('#fSave').textContent = 'Ajouter';
}
function fillForm(i) {
  const c = deck[i]; if (!c) return;
  editIndex = i; $('#fHead').textContent = 'Éditer la carte #' + (i + 1);
  $('#fType').value = c.type; $('#fTitle').value = c.title; $('#fEffect').value = c.effect; $('#fMove').value = c.move || 0;
  $('#fSave').textContent = 'Enregistrer';
}
async function saveCard() {
  const card = {
    type: $('#fType').value === 'event' ? 'event' : 'defi',
    title: ($('#fTitle').value || '').trim().toUpperCase(),
    effect: ($('#fEffect').value || '').trim().toUpperCase(),
    move: parseInt($('#fMove').value, 10) || 0,
  };
  if (!card.title) { $('#fTitle').focus(); return; }
  if (editIndex >= 0) deck[editIndex] = card; else deck.push(card);
  saveDeckLocal();
  await api('adminSave', { index: editIndex, card });
  resetForm(); renderAdmin();
}
async function deleteCard(i) {
  deck.splice(i, 1);
  if (forcedNext === i) forcedNext = -1; else if (forcedNext > i) forcedNext--;
  saveDeckLocal();
  await api('adminDelete', { index: i });
  if (editIndex === i) resetForm();
  renderAdmin();
}
async function setNext(i) { forcedNext = i; saveDeckLocal(); await api('adminSetNext', { index: i }); }

function initAdmin() {
  $('#admClose').addEventListener('click', closeAdmin);
  $('#fSave').addEventListener('click', saveCard);
  $('#fNew').addEventListener('click', resetForm);
  $('#admNext').addEventListener('change', (e) => setNext(parseInt(e.target.value, 10)));
  $('#admList').addEventListener('click', (e) => {
    const ed = e.target.getAttribute && e.target.getAttribute('data-ed');
    const del = e.target.getAttribute && e.target.getAttribute('data-del');
    if (ed !== null && ed !== undefined && ed !== false) fillForm(+ed);
    else if (del !== null && del !== undefined && del !== false) deleteCard(+del);
  });
}

/* ---------- init ---------- */
function init() {
  loadDeckLocal();
  buildDie($('#die1')); setDie($('#die1'), 3);
  buildDebug(); placePawn();
  $('#rollBtn').addEventListener('click', roll);
  $('#resumeBtn').addEventListener('click', resume);
  initAdmin();
  // apercu : si une autre fenetre modifie les cartes, on se met a jour en direct
  window.addEventListener('storage', (e) => {
    if (e.key === DECK_KEY || e.key === NEXT_KEY) {
      loadDeckLocal();
      if ($('#admin').classList.contains('on')) renderAdmin();
    }
  });
  const q = location.search;
  if (q.includes('debug')) $('#pathDebug').classList.add('on');
  if (q.includes('board')) resume();
  if (q.includes('center')) { state.pos = Math.max(0, PATH.length - 3); placePawn(); }  // test du centre
  if (q.includes('edit')) enableEditor();
  if (q.includes('admin')) openAdmin();
  if (q.includes('hot')) { $('#rollBtn').style.background = 'rgba(255,0,0,.35)'; $('#rollBtn').style.outline = '2px solid red'; }
  if (q.includes('showcard')) showCard({ type: 'defi', title: 'LE GARDIEN', effect: "TUE UN PNJ DANS L'HEURE." });
  if (BROWSER) $('#welcomeName').textContent = 'Spiker';   // apercu
}

/* ---------- affichage / FiveM ---------- */
function open() { screen.classList.remove('hidden'); }
function close() {
  screen.classList.add('hidden');
  $('#admin').classList.remove('on');
  $('#intro').classList.remove('gone');
  if (!BROWSER) { try { fetch(`https://${res()}/close`, { method: 'POST', body: '{}' }); } catch (e) {} }
}
function res() { try { return GetParentResourceName(); } catch (e) { return 'oryxis_jeu'; } }

window.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (d.action === 'open') {
    if (d.state) {
      state.pos = d.state.pos || 0;
      state.nbCases = d.state.nbCases || state.nbCases;
      state.canRoll = d.state.canRoll !== false && d.state.hasItem !== false;
      if (d.state.name) $('#welcomeName').textContent = d.state.name;
      placePawn();
    }
    open();
  } else if (d.action === 'openAdmin') {
    openAdmin(d.cards, typeof d.next === 'number' ? d.next : -1);
  } else if (d.action === 'close') close();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

init();
// hors FiveM (page web / apercu) : on affiche directement le jeu
if (BROWSER && !location.search.includes('admin') && !location.search.includes('edit')) open();
else if (location.search.includes('preview')) open();
