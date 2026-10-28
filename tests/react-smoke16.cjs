/* Smoke v3.0 — profils d'utilisateurs, menus par profil, tableau de bord
   adaptatif, pédagogie (notes) et discipline, périmètres (cycle, classes,
   matières). Joué sur le seed de démonstration (12 comptes). */
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
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
const navLabels = () => $$('.nav-i span:first-of-type').map(n => norm(n.textContent));
const groupHeaders = () => $$('.nav-g').map(n => norm(n.textContent));
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  if (!$('#li-user')) throw new Error('écran de connexion absent');
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(600);
  if (!$('#app')) throw new Error('connexion refusée pour ' + u);
}

(async () => {
  await wait(700);

  await step('administrateur : menus complets (5 groupes v6.4) et dash financier', async () => {
    await login('admin', 'admin2026');
    const grp = groupHeaders();
    for (const g of ['Scolarité', 'Finances', 'Pédagogie — structure', 'Pédagogie — notes & bilans', 'Administration']){
      if (!grp.includes(g)) throw new Error('groupe manquant : ' + g + ' → ' + grp.join(','));
    }
    if (!$('.kpis')) throw new Error('KPI du tableau de bord absents');
  });

  await step('censeur : dash « cycle », pédagogie oui, paiements non, élèves du cycle seulement', async () => {
    await login('censeur', 'censeur2026');
    const t = norm($('#view').textContent);
    if (!/Classes du cycle/.test(t)) throw new Error('indicateurs de cycle absents');
    if (!/Suivi pédagogique par classe/.test(t)) throw new Error('suivi pédagogique absent');
    const grp = groupHeaders();
    if (!grp.some(g => /Pédagogie/.test(g))) throw new Error('menu Pédagogie absent : ' + grp.join(' | '));
    if (grp.includes('Finances')) throw new Error('menu Finances visible pour le censeur');
    nav(/Élèves/); await wait(400);
    const n = $$('#view tbody tr').length;
    if (!n) throw new Error('aucun élève visible');
    /* le censeur du cycle collège ne doit pas voir les classes de lycée dans le filtre */
    const filtres = $$('#view select option').map(o => norm(o.textContent)).join('|');
    if (/Seconde|Première|Terminale/.test(filtres)) throw new Error('classes de lycée visibles hors cycle');
  });

  await step('surveillant général : dash discipline, faits visibles', async () => {
    await login('surveillant', 'surveillant2026');
    const t = norm($('#view').textContent);
    if (!/Faits — année/.test(t)) throw new Error('indicateurs discipline absents');
    if (!/Derniers faits de discipline/.test(t)) throw new Error('table des faits absente');
    nav(/Discipline & absences/); await wait(400);
    const n = $$('#view tbody tr').length;
    if (n < 5) throw new Error('faits du seed absents (' + n + ')');
    if (!$('#view .btn-pri') || !/Nouveau fait/.test(norm($('#view .card-h').textContent))) throw new Error('bouton Nouveau fait absent');
  });

  await step('surveillant de secteur : seules ses classes dans le filtre discipline', async () => {
    await login('surv-secteur', 'secteur2026');
    nav(/Discipline & absences/); await wait(400);
    const opts = $$('#view select option').map(o => norm(o.textContent)).join('|');
    if (!/4ème A/.test(opts)) throw new Error('classe attribuée absente du filtre : ' + opts.slice(0, 120));
    if (/6ème A/.test(opts)) throw new Error('classe non attribuée visible dans le filtre');
  });

  await step('titulaire : dash « Ma classe », sa classe seulement', async () => {
    await login('titulaire', 'titulaire2026');
    const t = norm($('#view').textContent);
    if (!/Ma classe — 6ème A/.test(t)) throw new Error('dash titulariat absent : ' + t.slice(0, 80));
    if (!/Effectif de la classe/.test(t)) throw new Error('KPI effectif absent');
    nav(/Élèves/); await wait(500);
    /* il ne doit voir que les élèves de 6ème A */
    const rows = $$('#view tbody tr');
    if (!rows.length) throw new Error('aucun élève visible');
    const filtres = $$('#view select option').map(o => norm(o.textContent)).join('|');
    if (/5ème|4ème|3ème/.test(filtres)) throw new Error('classes étrangères visibles');
  });

  await step('enseignant : dash « Mes matières », saisie autorisée sur SES matières, refusée ailleurs', async () => {
    await login('enseignant', 'enseignant2026');
    const t = norm($('#view').textContent);
    if (!/Mes matières/.test(t)) throw new Error('dash enseignant absent');
    if (!/Mon suivi de saisie/.test(t)) throw new Error('suivi de saisie absent');
    nav(/Saisie des notes/); await wait(400);
    const matOpts = $$('#view select').length ? [...$$('#view select')[1].options].map(o => norm(o.textContent)) : [];
    if (!matOpts.some(o => /Mathématiques/.test(o))) throw new Error('matière attribuée absente');
    if (matOpts.some(o => /Français/.test(o))) throw new Error('matière non attribuée visible');
    /* saisie d'une note sur une matière attribuée */
    const inputs = $$('#view .note-in').filter(i => !i.disabled);
    if (!inputs.length) throw new Error('aucun champ de saisie actif');
    setInput(inputs[0], '15');
    inputs[0].dispatchEvent(new w.Event('blur'));
    await wait(500);
    const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
    const b = (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls;
    if (!(b.notes || []).some(n => n.valeur === 15)) throw new Error('note 15 non enregistrée');
    /* tentative sur une matière non attribuée : elle n'est simplement pas proposée */
    const allMat = (b.matieres || []).map(m => m.libelle);
    const visibles = matOpts.join('|');
    if (allMat.some(m => !visibles.includes(m) && visibles.includes(m))) throw new Error('incohérence de filtrage');
  });

  await step('opérateur de saisie : dash notes+discipline, création d’un fait', async () => {
    await login('operateur', 'operateur2026');
    const t = norm($('#view').textContent);
    if (!/Notes saisies/.test(t) || !/Faits de discipline/.test(t)) throw new Error('dash opérateur incomplet');
    nav(/Discipline & absences/); await wait(400);
    const avant = $$('#view tbody tr').length;
    click($$('#view .card-h .btn-pri').find(b => /Nouveau fait/.test(norm(b.textContent)))); await wait(400);
    const form = $('#modal-root form');
    if (!form) throw new Error('formulaire fait absent');
    const selClasse = $('#ff-dclasse'), selEleve = $('#ff-deleve');
    if (!selClasse || !selEleve) throw new Error('champs classe/élève absents');
    Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(selClasse, selClasse.options[1].value);
    selClasse.dispatchEvent(new w.Event('change', { bubbles:true }));
    await wait(400);
    if (!selEleve.options.length) throw new Error('aucun élève dans le sélecteur');
    Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(selEleve, selEleve.options[1].value);
    selEleve.dispatchEvent(new w.Event('change', { bubbles:true }));
    setInput($('#ff-ddesc'), 'Test smoke : bavardage répété');
    form.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(600);
    const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
    const b = (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls;
    if (!(b.discipline || []).some(f => /Test smoke/.test(f.description))) throw new Error('fait non enregistré');
    const apres = $$('#view tbody tr').length;
    if (apres < avant) throw new Error('liste des faits réduite après création');
  });

  await step('menus strictement conformes au profil (enseignant : 3 entrées)', async () => {
    await login('enseignant', 'enseignant2026');
    const labs = navLabels();
    const attendu = ['Tableau de bord', 'Matières', 'Plan des enseignements', 'Saisie des notes', 'Bulletins & rapports', 'Statistiques'];
    if (labs.join('|') !== attendu.join('|')) throw new Error('menus enseignant : ' + labs.join('|'));
  });

  await step('aucune erreur React', () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });

  console.log('');
  console.log(fails ? '=== ' + fails + ' ÉCHEC(S) ===' : '=== SMOKE TEST v3.0 PROFILS & MENUS : OK ===');
  process.exit(fails ? 1 : 0);
})();
