/* Smoke v4.1 — comptes nouvellement créés (formulaire réactif, connexion,
   périmètres) + balayage de tous les boutons des pages sans erreur React. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.print = () => {};   /* impression neutralisée pendant le balayage */
    w.addEventListener('error', e => errors.push(e.message));
    w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(|defaultProps|navigation/i.test(s)) errors.push('console.error: ' + s); };
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
function setInput(el, v){
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function setSel(el, v){
  Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ if (!el) throw new Error('élément introuvable au clic'); el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => { const n = $$('.nav-i').find(i => x.test(i.textContent)); if (!n) throw new Error('menu introuvable : ' + x); click(n); };
const submitForm = () => { const f = $('#modal-root form'); if (!f) throw new Error('formulaire absent'); f.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true })); };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }
const LS = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
  return (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls; };

async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  if (!$('#li-user')) throw new Error('écran de connexion absent');
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(700);
  if (!$('#app')) throw new Error('connexion refusée pour ' + u);
}
const navLabels = () => $$('.nav-i').map(n => norm(n.textContent));

(async () => {
  await wait(700);

  await step('création d\\u2019un compte censeur AVEC attributions (formulaire réactif)', async () => {
    await login('admin', 'admin2026');
    nav(/Utilisateurs/); await wait(400);
    click($$('#view .btn-pri').find(b => /Nouvel utilisateur/.test(norm(b.textContent)))); await wait(400);
    setInput($('#ff-nom'), 'Nouveau Censeur Test');
    setInput($('#ff-username'), 'censeur2');
    setInput($('#ff-pwd'), 'Test2026');
    setSel($('#ff-role'), 'censeur'); await wait(400);
    /* le choix du profil fait apparaître les attributions (correctif v4.1) */
    if (!$('#modal-root .chk-list')) throw new Error('les attributions du censeur n\\u2019apparaissent pas après le choix du profil');
    const nv6 = $$('#modal-root .chk-chip input').find(c => /Sixi/.test(c.parentNode.textContent));
    if (!nv6) throw new Error('niveau 6ème introuvable dans les attributions');
    click(nv6);
    submitForm(); await wait(500);
    const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
    const u = ls.users.find(x => x.username === 'censeur2');
    if (!u || u.role !== 'censeur') throw new Error('compte censeur2 non créé');
    if (!Array.isArray(u.niveauxIds) || !u.niveauxIds.length) throw new Error('cycle non enregistré sur le compte');
  });

  await step('création d\\u2019un compte enseignant LIÉ à une fiche (périmètre = plan)', async () => {
    click($$('#view .btn-pri').find(b => /Nouvel utilisateur/.test(norm(b.textContent)))); await wait(400);
    setInput($('#ff-nom'), 'Professeur Blaise Kamga');
    setInput($('#ff-username'), 'prof2');
    setInput($('#ff-pwd'), 'Test2026');
    setSel($('#ff-role'), 'enseignant'); await wait(400);
    if (!$('#ff-enseignantId')) throw new Error('sélecteur de fiche enseignant absent');
    const opt = [...$('#ff-enseignantId').options].find(o => /KAMGA/.test(o.textContent));
    if (!opt) throw new Error('fiche KAMGA introuvable');
    setSel($('#ff-enseignantId'), opt.value);
    submitForm(); await wait(500);
    const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
    const u = ls.users.find(x => x.username === 'prof2');
    if (!u || u.role !== 'enseignant' || u.enseignantId !== 'ens-07') throw new Error('compte prof2 non lié à la fiche ens-07');
  });

  await step('le compte nouvellement créé se connecte (censeur) et son périmètre s\\u2019applique', async () => {
    await login('censeur2', 'Test2026');
    const labs = navLabels();
    if (!labs.some(t => /Matières/.test(t)) || !labs.some(t => /Plan des enseignements/.test(t))) throw new Error('menus pédagogie absents : ' + labs.join('|'));
    if (labs.some(t => /Encaissements/.test(t))) throw new Error('menu paiements visible pour un censeur');
    nav(/Plan des enseignements/); await wait(400);
    const opts = $$('#view select.flt')[0];
    if (!opts) throw new Error('sélecteur de classes absent');
    const labsClasses = [...opts.options].map(o => norm(o.textContent));
    if (!labsClasses.every(c => /6ème/.test(c))) throw new Error('le censeur2 voit des classes hors de son cycle : ' + labsClasses.join(', '));
    if (!labsClasses.length) throw new Error('aucune classe visible pour le cycle');
  });

  await step('le compte enseignant lié se connecte : périmètre = enseignements de sa fiche', async () => {
    await login('prof2', 'Test2026');
    const labs = navLabels();
    const attendu = ['Tableau de bord', 'Matières', 'Plan des enseignements', 'Saisie des notes', 'Bulletins & rapports', 'Statistiques'];
    if (labs.join('|') !== attendu.join('|')) throw new Error('menus prof2 : ' + labs.join('|'));
    nav(/Matières/); await wait(400);
    const rows = $$('#view tbody tr').map(r => norm(r.textContent));
    if (!rows.some(r => /Informatique/.test(r))) throw new Error('la matière de la fiche (Informatique) est absente');
    if (rows.some(r => /Français/.test(r))) throw new Error('une matière non enseignée est visible');
  });

  await step('balayage complet : chaque page répond, onglets, recherches, filtres et boutons d\\u2019action', async () => {
    await login('admin', 'admin2026');
    const PAGES = [/Tableau de bord/, /Élèves/, /Encaissements/, /Bourses/, /Rapports financiers/, /Années scolaires/,
      /Niveaux/, /Classes/, /Types de frais/, /Grille tarifaire/, /Matières/, /Enseignants/, /Plan des enseignements/,
      /Séquences & appréciations/, /Saisie des notes/, /Bulletins/, /Discipline & absences/, /Utilisateurs/, /Personnalisation/, /Journal/];
    let pagesOK = 0, boutons = 0, modals = 0;
    for (const rx of PAGES){
      nav(rx); await wait(350);
      if (!$('#view') || !$('#view').textContent.trim()) throw new Error('page vide : ' + rx);
      /* onglets */
      for (const t of $$('#view .tab')){ click(t); await wait(120); boutons++; }
      /* recherche */
      const srch = $('#view .srch input');
      if (srch){ setInput(srch, 'a'); await wait(120); setInput(srch, ''); await wait(120); }
      /* filtres */
      for (const sel of $$('#view select.flt')){
        if (sel.options.length > 1){ setSel(sel, sel.options[1].value); await wait(150); }
      }
      /* boutons d'action sûrs (ouvrent des fenêtres) */
      const safe = $$('#view .btn, #view .card-h button, #view .ycard button')
        .filter(b => /Nouveau|Nouvelle|Ajouter|Cloner|Importer|Imprimer|Générer/i.test(norm(b.textContent)))
        .filter(b => !/Supprimer|Vider|Activer|Clôturer|Réouvrir|Annuler/i.test(norm(b.textContent)));
      for (const b of safe.slice(0, 6)){
        click(b); await wait(280); boutons++;
        const x = $('.m-x'); if (x){ click(x); await wait(200); modals++; }
      }
      pagesOK++;
    }
    if (pagesOK !== PAGES.length) throw new Error('pages balayées : ' + pagesOK);
    console.log('   ' + pagesOK + ' pages, ' + boutons + ' interactions, ' + modals + ' fenêtres ouvertes/fermées');
  });

  await step('aucune erreur React pendant tout le balayage', () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });

  console.log('');
  console.log(fails ? '=== ' + fails + ' ÉCHEC(S) ===' : '=== SMOKE TEST v4.1 COMPTES & BOUTONS : OK ===');
  process.exit(fails ? 1 : 0);
})();
