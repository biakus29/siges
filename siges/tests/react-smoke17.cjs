/* Smoke v4.0 — pédagogie complète : groupes de matières, catalogue 40+,
   enseignants (CRUD + recherche), plan des enseignements (totaux, ordre,
   clonage), vues croisées enseignant↔matière, bulletins issus du plan. */
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
function setSel(el, v){
  Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }
const LS = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
  return (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls; };
const submitForm = () => { const f = $('#modal-root form'); f.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true })); };

async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(600);
  if (!$('#app')) throw new Error('connexion refusée pour ' + u);
}

(async () => {
  await wait(700);

  await step('catalogue : 43 matières visibles, onglet groupes (7)', async () => {
    await login('admin', 'admin2026');
    nav(/Matières/); await wait(400);
    const rows = $$('#view tbody tr');
    if (rows.length < 40) throw new Error('matières affichées : ' + rows.length);
    const tabs = $$('.tab').map(t => norm(t.textContent));
    if (!tabs.some(t => /Groupes/.test(t) && /7/.test(t))) throw new Error('onglet groupes absent : ' + tabs.join(' / '));
    if (!tabs.some(t => /Matières/.test(t) && /43/.test(t))) throw new Error('compteur matières incohérent : ' + tabs.join(' / '));
  });

  await step('recherche du catalogue (les matières n\u2019ont plus de groupe intrinsèque)', async () => {
    const s = $('#view .srch input');
    if (!s) throw new Error('recherche absente');
    setInput(s, 'compta'); await wait(300);
    const rows = $$('#view tbody tr');
    if (rows.length !== 1 || !/Comptabilité/.test(rows[0].textContent)) throw new Error('recherche "compta" : ' + rows.length + ' ligne(s)');
    setInput(s, ''); await wait(200);
    const b0 = LS();
    if (!(b0.matieres || []).every(m => !('groupeId' in m) && !('coefficient' in m))) throw new Error('des matières portent encore groupe/coefficient');
  });

  await step('groupes : création, code unique, suppression bloquée si matières', async () => {
    click($$('.tab').find(t => /Groupes/.test(t.textContent))); await wait(300);
    const avant = $$('#view tbody tr').length;
    click($$('#view .btn-pri').find(b => /Nouveau groupe/.test(norm(b.textContent)))); await wait(300);
    setInput($('#ff-code'), 'TEST'); setInput($('#ff-libelle'), 'Groupe de test');
    submitForm(); await wait(400);
    if ($$('#view tbody tr').length !== avant + 1) throw new Error('groupe non créé');
    /* code unique */
    click($$('#view .btn-pri').find(b => /Nouveau groupe/.test(norm(b.textContent)))); await wait(300);
    setInput($('#ff-code'), 'LNG'); setInput($('#ff-libelle'), 'Doublon');
    submitForm(); await wait(400);
    if (!d.body.textContent.includes('existe déjà')) throw new Error('doublon de code accepté');
    click($('.m-x')); await wait(300);
    /* suppression d'un groupe vide (celui de test) */
    const ligne = $$('#view tbody tr').find(r => /Groupe de test/.test(r.textContent));
    if (!ligne) throw new Error('groupe de test introuvable');
    click(ligne.querySelector('button[title="Supprimer"]')); await wait(300);
    click($('#modal-root .btn-danger')); await wait(400);
    if ($$('#view tbody tr').length !== avant) throw new Error('groupe non supprimé');
    /* suppression d un groupe PLEIN bloquée */
    const lng = $$('#view tbody tr').find(r => /Langues et littérature/.test(r.textContent));
    click(lng.querySelector('button[title="Supprimer"]')); await wait(300);
    click($('#modal-root .btn-danger')); await wait(400);
    if (!$$('#view tbody tr').some(r => /Langues et littérature/.test(r.textContent))) throw new Error('groupe plein supprimé !');
    if (!d.body.textContent.includes('réaffectez')) throw new Error('message de blocage absent');
  });

  await step('matière : création avec groupe puis suppression', async () => {
    click($$('.tab').find(t => /Matières/.test(t.textContent) && !/Groupes/.test(t.textContent))); await wait(300);
    const avant = $$('#view tbody tr').length;
    click($$('#view .btn-pri').find(b => /Nouvelle matière/.test(norm(b.textContent)))); await wait(300);
    setInput($('#ff-code'), 'ASTR'); setInput($('#ff-libelle'), 'Astronomie');
    submitForm(); await wait(400);
    const b = LS();
    const m = (b.matieres || []).find(x => x.code === 'ASTR');
    if (!m || 'groupeId' in m || 'coefficient' in m) throw new Error('matière ASTR créée avec groupe/coefficient (v4.1 : interdit)');
    /* suppression via l icone corbeille */
    const ligne = $$('#view tbody tr').find(r => /Astronomie/.test(r.textContent));
    if (!ligne) throw new Error('ligne Astronomie absente (après création)');
    click(ligne.querySelector('button[title="Supprimer"]')); await wait(300);
    click($('#modal-root .btn-danger')); await wait(400);
    if ((LS().matieres || []).some(x => x.code === 'ASTR')) throw new Error('matière non supprimée');
    if ($$('#view tbody tr').length !== avant) throw new Error('le tableau n\\u2019a pas repris son effectif');
  });

  await step('enseignants : liste, recherche, création, modification, suppression', async () => {
    nav(/Enseignants/); await wait(400);
    if ($$('#view tbody tr').length < 10) throw new Error('fiches enseignants : ' + $$('#view tbody tr').length);
    /* recherche */
    const s = $('#view .srch input');
    setInput(s, 'atangana'); await wait(300);
    if ($$('#view tbody tr').length !== 1 || !/ATANGANA Robert/.test($$('#view tbody tr')[0].textContent))
      throw new Error('recherche Atangana : ' + $$('#view tbody tr').length + ' ligne(s)');
    setInput(s, ''); await wait(200);
    /* création */
    click($$('#view .card-h .btn-pri').find(x => /Nouvel enseignant/.test(norm(x.textContent)))); await wait(300);
    setInput($('#ff-nom'), 'NGUEMA'); setInput($('#ff-prenom'), 'Léon'); setSel($('#ff-sexe'), 'M');
    setInput($('#ff-telephone'), '699 00 11 22'); setInput($('#ff-specialite'), 'Physique-Chimie');
    setSel($('#ff-grade'), 'A2');
    submitForm(); await wait(400);
    if (!(LS().enseignants || []).some(t => t.nom === 'NGUEMA')) throw new Error('fiche NGUEMA non créée');
    /* suppression */
    setInput(s, 'nguema'); await wait(300);
    const lig = $$('#view tbody tr')[0];
    click(lig.querySelector('button[title="Supprimer"]')); await wait(300);
    click($('#modal-root .btn-danger')); await wait(400);
    if ((LS().enseignants || []).some(t => t.nom === 'NGUEMA')) throw new Error('fiche non supprimée');
    setInput(s, ''); await wait(200);
  });

  await step('vue croisée : enseignements d\\u2019un enseignant (1 clic)', async () => {
    const lig = $$('#view tbody tr').find(r => /ATANGANA/.test(r.textContent));
    if (!lig) throw new Error('ligne Atangana absente');
    click(lig.querySelector('button[title="Enseignements dispensés"]')); await wait(400);
    const t = norm($('#modal-root').textContent);
    if (!/Enseignements de ATANGANA Robert/.test(t)) throw new Error('titre modal : ' + t.slice(0, 80));
    if (!/Mathématiques/.test(t)) throw new Error('Mathématiques absentes de ses enseignements');
    if (!/coef\./.test(t)) throw new Error('coefficients absents');
    click($('.m-x')); await wait(200);
  });

  await step('plan : totaux par groupe et global, nombre de matières, ordre', async () => {
    nav(/Plan des enseignements/); await wait(400);
    const sel = $$('#view select.flt')[0];
    if (!sel) throw new Error('sélecteur de classe absent');
    setSel(sel, 'cl6a'); await wait(400);
    const t = norm($('#view').textContent);
    if (!/10 matière\(s\) au plan|Matières au plan/.test(t)) throw new Error('compteur matières absent');
    if (!/coef\. 20/.test(t)) throw new Error('total des coefficients (20) absent');
    if (!/Synthèse par groupe/.test(t)) throw new Error('synthèse par groupe absente');
    if (!/Langues et littérature/.test(t)) throw new Error('groupe LNG absent de la synthèse');
    /* ordre : la première ligne du plan doit être le n°1 (FRAN coef 4) */
    const rows = $$('#view .tbl')[0] ? $$('#view .tbl')[0].querySelectorAll('tbody tr') : [];
    if (rows.length < 11) throw new Error('lignes du plan : ' + rows.length);
    if (!/FRAN/.test(rows[0].textContent) || !/coef\. 4/.test(rows[0].textContent)) throw new Error('première matière du bulletin : ' + rows[0].textContent);
  });

  await step('plan : ajout, modification, suppression d\\u2019un enseignement', async () => {
    const sel = $$('#view select.flt')[0];
    setSel(sel, 'cl6b'); await wait(300);
    const avant = LS().plan.filter(e => e.classeId === 'cl6b').length;
    click($$('#view .card-h .btn-pri').find(b => /Ajouter un enseignement/.test(norm(b.textContent)))); await wait(300);
    setSel($('#ff-matiereId'), 'm19'); setSel($('#ff-enseignantId'), 'ens-06');
    setSel($('#ff-groupeId'), 'g4'); setInput($('#ff-coefficient'), '3'); submitForm(); await wait(400);
    const b = LS();
    const e = (b.plan || []).find(x => x.classeId === 'cl6b' && x.matiereId === 'm19');
    if (!e || e.coefficient !== 3 || e.enseignantId !== 'ens-06' || e.groupeId !== 'g4') throw new Error('enseignement PHILOSOPHIE non ajouté (avec son groupe)');
    /* modification du coefficient */
    const lig = $$('#view .tbl')[0] ? [...$$('#view .tbl')[0].querySelectorAll('tbody tr')].find(r => /PHIL/.test(r.textContent)) : null;
    if (!lig) throw new Error('ligne PHILOS introuvable');
    click(lig.querySelector('button[title="Modifier"]')); await wait(300);
    setInput($('#ff-coefficient'), '2'); submitForm(); await wait(400);
    if ((LS().plan || []).find(x => x.classeId === 'cl6b' && x.matiereId === 'm19').coefficient !== 2)
      throw new Error('coefficient non modifié');
    /* suppression */
    const lig2 = [...$$('#view .tbl')[0].querySelectorAll('tbody tr')].find(r => /PHIL/.test(r.textContent));
    click(lig2.querySelector('button[title="Retirer"]')); await wait(300);
    click($('#modal-root .btn-danger')); await wait(400);
    if ((LS().plan || []).some(x => x.classeId === 'cl6b' && x.matiereId === 'm19')) throw new Error('enseignement non retiré');
    if ((LS().plan || []).filter(x => x.classeId === 'cl6b').length !== avant) throw new Error('effectif du plan incohérent');
  });

  await step('plan : clonage d\u2019UN enseignement vers d\u2019autres classes', async () => {
    const sel = $$('#view select.flt')[0];
    setSel(sel, 'cl6a'); await wait(300);
    const lig = [...$$('#view .tbl')[0].querySelectorAll('tbody tr')].find(r => /MATH/.test(r.textContent));
    if (!lig) throw new Error('ligne MATH introuvable');
    click(lig.querySelector('button[title^="Cloner cet enseignement"]')); await wait(400);
    const chips = $$('#modal-root .chk-chip input');
    const c3a = chips.find(c => c.parentNode.textContent.includes('3ème A'));
    const c6b = chips.find(c => c.parentNode.textContent.includes('6ème B'));
    if (!c3a || !c6b) throw new Error('classes cibles introuvables');
    if (!c6b.disabled) throw new Error('6ème B devrait être ignorée (matière déjà au plan)');
    click(c3a);
    click($$('#modal-root .m-f .btn-pri').find(x => /Cloner/.test(norm(x.textContent)))); await wait(300);
    click($('#modal-root .btn-pri')); await wait(500);
    const b = LS();
    const e3a = (b.plan || []).find(x => x.classeId === 'cl3a' && x.matiereId === 'm1');
    if (!e3a || e3a.coefficient !== 4 || e3a.groupeId !== 'g3' || e3a.enseignantId !== 'ens-03')
      throw new Error('clonage par enseignement : entrée incorrecte en 3ème A');
    const n6b = (b.plan || []).filter(x => x.classeId === 'cl6b' && x.matiereId === 'm1').length;
    if (n6b !== 1) throw new Error('6ème B : ' + n6b + ' entrée(s) MATH (attendu 1, pas de doublon)');
  });

  await step('plan : clonage vers d\\u2019autres classes en un clic', async () => {
    const sel = $$('#view select.flt')[0];
    setSel(sel, 'cl6a'); await wait(300);
    const n6a = (LS().plan || []).filter(e => e.classeId === 'cl6a').length;
    click($$('#view .card-h button').find(b => /Cloner/.test(norm(b.textContent)))); await wait(400);
    /* cocher 4ème A et 4ème B */
    const chips = $$('#modal-root .chk-chip input');
    const c4a = chips.find(c => c.parentNode.textContent.includes('4ème A'));
    const c4b = chips.find(c => c.parentNode.textContent.includes('4ème B'));
    if (!c4a || !c4b) throw new Error('classes cibles introuvables');
    click(c4a); click(c4b);
    click($$('#modal-root .m-f .btn-pri').find(b => /Cloner/.test(norm(b.textContent)))); await wait(300);
    click($('#modal-root .btn-danger')); await wait(500);   /* confirmation */
    const b = LS();
    const n4a = (b.plan || []).filter(e => e.classeId === 'cl4a').length;
    const n4b = (b.plan || []).filter(e => e.classeId === 'cl4b').length;
    if (n4a !== n6a || n4b !== n6a) throw new Error('clonage : 4ème A=' + n4a + ', 4ème B=' + n4b + ', attendu=' + n6a);
    /* les coefficients sont identiques */
    const src = (b.plan || []).filter(e => e.classeId === 'cl6a').map(e => e.matiereId + ':' + e.coefficient).sort().join('|');
    const dst = (b.plan || []).filter(e => e.classeId === 'cl4a').map(e => e.matiereId + ':' + e.coefficient).sort().join('|');
    if (src !== dst) throw new Error('le clone ne reproduit pas coefficients/matières');
  });

  await step('vue croisée : enseignants d\\u2019une matière (1 clic)', async () => {
    nav(/Matières/); await wait(400);
    const lig = $$('#view tbody tr').find(r => /Mathématiques/.test(r.textContent));
    if (!lig) throw new Error('ligne Mathématiques absente');
    click(lig.querySelector('button[title="Enseignants qui dispensent cette matière"]')); await wait(400);
    const t = norm($('#modal-root').textContent);
    if (!/Enseignants de la matière « Mathématiques »/.test(t)) throw new Error('titre : ' + t.slice(0, 80));
    if (!/ATANGANA/.test(t)) throw new Error('Atangana absent des enseignants de maths');
    if (!/6ème A/.test(t)) throw new Error('classes dispensées absentes');
    click($('.m-x')); await wait(200);
  });

  await step('bulletins : colonnes = plan de la classe (ordre + coefficients)', async () => {
    nav(/Bulletins/); await wait(400);
    const sel = $$('#view select.flt')[0];
    if (!sel) throw new Error('sélecteur classe absent');
    const opt = [...sel.options].find(o => /6ème A/.test(o.textContent));
    setSel(sel, opt.value); await wait(400);
    const ths = $$('#view .tbl th').map(x => norm(x.textContent));
    if (!ths.some(h => /^FRAN/.test(h) && /coef 4/.test(h))) throw new Error('colonne FRAN coef 4 absente : ' + ths.slice(0, 6).join(','));
    if (!ths.some(h => /^MATH/.test(h) && /coef 4/.test(h))) throw new Error('colonne MATH coef 4 absente');
    const codes = ths.filter(h => /^(FRAN|MATH|ANGL|HGEO|SVT|ECM|INFO|MUSI|ARTP|EPS)/.test(h));
    if (codes.length < 10) throw new Error('matières du plan affichées : ' + codes.length);
    /* l ordre du plan : FRAN avant MATH, MATH avant ANGL */
    const iF = ths.findIndex(h => /^FRAN/.test(h)), iM = ths.findIndex(h => /^MATH/.test(h)), iA = ths.findIndex(h => /^ANGL/.test(h));
    if (!(iF < iM && iM < iA)) throw new Error('ordre du plan non respecté : ' + iF + ',' + iM + ',' + iA);
  });

  await step('censeur : périmètre pédagogie complet (enseignants + plan en écriture)', async () => {
    await login('censeur', 'censeur2026');
    const labs = $$('.nav-i').map(n => norm(n.textContent));
    if (!labs.some(t => /Enseignants/.test(t))) throw new Error('menu Enseignants absent pour le censeur');
    if (!labs.some(t => /Plan des enseignements/.test(t))) throw new Error('menu Plan absent pour le censeur');
    nav(/Plan des enseignements/); await wait(400);
    if (!$$('#view .card-h .btn-pri').some(b => /Ajouter/.test(norm(b.textContent)))) throw new Error('le censeur ne peut pas modifier le plan');
  });

  await step('aucune erreur React', () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });

  console.log('');
  console.log(fails ? '=== ' + fails + ' ÉCHEC(S) ===' : '=== SMOKE TEST v4.0 PÉDAGOGIE : OK ===');
  process.exit(fails ? 1 : 0);
})();
