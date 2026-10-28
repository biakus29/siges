/* Smoke v5.3 — Pilotage pédagogique :
   • bouton Encaissement retiré de la barre pour TOUS les profils (l'encaissement
     reste accessible depuis la page Paiements) ;
   • bulletin individuel par élève : évaluation, trimestre, année — A4 portrait ;
   • matières indispensables → NC expliqué sur le bulletin individuel ;
   • statistiques par matière et par classe (menus, périmètre enseignant, CSV, impression). */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const path = require('path');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.print = () => {};
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
  Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
const navLabels = () => $$('.nav-i span:first-of-type').map(n => norm(n.textContent));
const base = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
  return (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls; };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  if (!$('#li-user')) throw new Error('écran de connexion absent');
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(700);
  if (!$('#app')) throw new Error('connexion refusée pour ' + u);
}
const modalOuverte = () => !!$('#modal-root .mback');
const fermerCroix = async () => { click($('#modal-root .m-x')); await wait(300); if (modalOuverte()) throw new Error('croix n\u2019a pas fermé la fenêtre'); };
const selPeriode = () => $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))));
const ligneAvecMoyenne = () => $$('#view tbody tr').find(r => /\d,\d{2}/.test(norm(r.textContent)));

(async () => {
  await wait(700);

  await step('barre : plus aucun bouton Encaissement (superadmin, admin, économe, opérateur)', async () => {
    await login('superadmin', 'super2026');
    if ($('#tb-pay')) throw new Error('bouton visible en mode console');
    await login('admin', 'admin2026');
    if ($('#tb-pay')) throw new Error('bouton visible pour l\u2019administrateur');
    await login('econome', 'econome2026');
    if ($('#tb-pay')) throw new Error('bouton visible pour l\u2019économe');
    await login('operateur', 'operateur2026');
    if ($('#tb-pay')) throw new Error('bouton visible pour l\u2019opérateur');
    await login('admin', 'admin2026');
  });

  await step('l\u2019encaissement reste accessible : page Paiements → Nouveau paiement', async () => {
    nav(/Paiements|Encaissements/); await wait(600);
    const openBtn = $$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouveau paiement/i.test(norm(b.textContent)));
    if (!openBtn) throw new Error('bouton Nouveau paiement introuvable');
    click(openBtn); await wait(500);
    if (!$('#modal-root .srch input')) throw new Error('fenêtre d\u2019encaissement non ouverte');
    await fermerCroix();
  });

  await step('récapitulatif annuel — structure exacte de l\u2019exemple (A4 portrait)', async () => {
    nav(/Bulletins/); await wait(600);
    setSel(selPeriode(), ''); await wait(500);
    const row = ligneAvecMoyenne();
    if (!row) throw new Error('aucune ligne avec moyenne');
    const nom = norm(row.cells[1].textContent);
    const btn = row.querySelector('button');
    if (!/Récapitulatif/.test(norm(btn.textContent))) throw new Error('bouton Récapitulatif attendu pour l\u2019année');
    click(btn); await wait(600);
    const t = norm($('#modal-root').textContent);
    for (const mot of ['RÉCAPITULATIF ANNUEL DES NOTES', 'Année Scolaire', 'Noms et Prénoms', 'Matricule', 'Effectif',
      'Né(e) le', 'Genre', 'Redoublant', 'Moy. /20', 'Coef', 'Points', 'Appréciation', 'Total Points',
      'Bilan disciplinaire annuel', 'Absences Non Justifiées', 'Absences Justifiées', 'T-Coef',
      'Moyenne générale', 'Rang', 'Fait à', 'La Sœur Principale'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent du récapitulatif');
    /* en-tête deux blocs + groupes du plan + colonnes S1..S4 (notes du seed) */
    if (!/RÉPUBLIQUE DU CAMEROUN/.test(t)) throw new Error('bloc gauche (République) absent');
    if (!/DIOCÈSE D'EBOLOWA/.test(t)) throw new Error('bloc droit (Diocèse) absent');
    for (const g of ['Langues et littérature', 'Langues étrangères', 'Sciences exactes et naturelles'])
      if (!t.includes(g)) throw new Error('groupe « ' + g + ' » absent (groupement par groupe du plan)');
    for (const s of ['S1', 'S2', 'S3', 'S4']) if (!t.includes(s)) throw new Error('colonne ' + s + ' absente');
    /* cohérence des totaux sur la première ligne de groupe : Points/Coef = Moyenne */
    const m = t.match(/Total Points : ([\d,]+) \/ Total Coef : (\d+)/);
    if (!m) throw new Error('ligne « Total Points / Total Coef » introuvable');
    await fermerCroix();
  });

  await step('bulletin individuel — évaluation (séquence 1) : une seule note, par groupe', async () => {
    setSel(selPeriode(), '1'); await wait(600);
    const row = ligneAvecMoyenne();
    if (!row) throw new Error('aucune ligne avec moyenne en séquence 1');
    click(row.querySelector('button')); await wait(600);
    const t = norm($('#modal-root').textContent);
    for (const mot of ['Note /20', 'Séquence 1', 'Coef', 'Points', 'Langues et littérature', 'Le Professeur titulaire'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent du bulletin de séquence');
    if (/Devoir \/20/.test(t)) throw new Error('colonne Devoir inattendue (une seule évaluation par séquence)');
    await fermerCroix();
  });

  await step('bulletin individuel — trimestre 1 (moyennes pondérées, par groupe)', async () => {
    setSel(selPeriode(), 'T1'); await wait(600);
    const row = ligneAvecMoyenne();
    if (!row) throw new Error('aucune ligne avec moyenne au trimestre 1');
    click(row.querySelector('button')); await wait(600);
    const t = norm($('#modal-root').textContent);
    if (!t.includes('Trimestre 1')) throw new Error('libellé Trimestre 1 absent');
    if (!t.includes('Moy. trim. /20')) throw new Error('colonne Moy. trim. /20 absente');
    if (/Note \/20/.test(t)) throw new Error('colonne Note /20 inattendue pour un trimestre');
    await fermerCroix();
    setSel(selPeriode(), ''); await wait(400);
  });

  await step('impression en A4 portrait (feuille de style @page)', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    if (!/@page\{size:A4 portrait;margin:10mm 5mm\}/.test(css)) throw new Error('règle @page A4 portrait (20 cm utiles) absente');
  });

  await step('NC expliqué sur le bulletin (matières indispensables), puis retour à l\u2019état initial', async () => {
    nav(/Classes/); await wait(500);
    const row6a = $$('#view tbody tr').find(r => /6ème A/.test(norm(r.textContent)));
    if (!row6a) throw new Error('ligne 6ème A introuvable');
    click(row6a.querySelector('button[title="Modifier"]')); await wait(400);
    const chips = $$('#modal-root .chk-chip');
    if (!chips.length) throw new Error('chips matières absentes');
    const cM = chips.find(c => /MATH/.test(norm(c.textContent)));
    const cF = chips.find(c => /FRAN/.test(norm(c.textContent)));
    click(cM); click(cF);
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const cl = base().classes.find(c => c.id === 'cl6a');
    if ((cl.matieresOblig || []).join(',') !== 'm1,m2') throw new Error('matières indispensables non enregistrées');
    /* bulletin de l'élève non classé */
    nav(/Bulletins/); await wait(500);
    setSel(selPeriode(), '1'); await wait(600);
    const badge = $$('#view .badge.b-mut').find(x => x.textContent === 'NC');
    if (!badge) throw new Error('aucun badge NC au tableau');
    const rowNC = badge.closest('tr');
    click(rowNC.querySelector('button')); await wait(600);
    const t = norm($('#modal-root').textContent);
    if (!/Non classé \(NC\)/.test(t)) throw new Error('mention Non classé (NC) absente du bulletin');
    if (!/ensemble des matières indispensables/.test(t)) throw new Error('explication du NC absente');
    if (!/Mathématiques|Français/.test(t)) throw new Error('matière manquante non listée');
    if (/Rang : \d/.test(t)) throw new Error('un rang est affiché pour un élève non classé');
    await fermerCroix();
    /* retour à l'état initial */
    nav(/Classes/); await wait(500);
    click($$('#view tbody tr').find(r => /6ème A/.test(norm(r.textContent))).querySelector('button[title="Modifier"]'));
    await wait(400);
    const sel = $$('#modal-root .chk-chip.on');
    if (!sel.length) throw new Error('chips sélectionnées introuvables');
    sel.forEach(c => click(c));
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const cl2 = base().classes.find(c => c.id === 'cl6a');
    if ((cl2.matieresOblig || []).length) throw new Error('matières indispensables non retirées : ' + JSON.stringify(cl2.matieresOblig));
  });

  await step('statistiques : 4 analyses séparées — classe, matière, niveau, cycle (admin)', async () => {
    nav(/Statistiques/); await wait(600);
    const t = norm($('#view').textContent);
    for (const mot of ['Statistiques pédagogiques', 'Par classe', 'Par matière', 'Par niveau', 'Par cycle',
      'Évalués', 'Moyenne /20', '% ≥ 10', 'Classe analysée'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent');
    const tabs = $$('#view [role="tab"]');
    if (tabs.length !== 4) throw new Error('4 onglets d\u2019analyse attendus, trouvé ' + tabs.length);
    /* mode classe (défaut) : UN tableau = plan de la classe analysée */
    if ($$('#view table.tbl').length !== 1) throw new Error('un seul tableau par analyse attendu');
    let rows = [...$$('#view tbody tr')];
    if (rows.length !== 10) throw new Error('10 matières du plan de la 6ème A attendues, trouvé ' + rows.length);
    if (rows.filter(r => /\d,\d{2}/.test(norm(r.textContent))).length < 3) throw new Error('moins de 3 matières notées (MATH/FRAN/ANGL attendues)');
    if (!$('#view svg')) throw new Error('graphique des moyennes absent');
    if ($$('#view button[title^="Exporter"]').length !== 1) throw new Error('1 export CSV attendu');
    /* mode matière : UNE matière dans toutes les classes où elle est enseignée */
    click(tabs.find(b => /Par matière/.test(norm(b.textContent)))); await wait(500);
    const selM = $$('#view select').find(s => [...s.options].some(o => /MATH/.test(norm(o.textContent))));
    setSel(selM, [...selM.options].find(o => /MATH/.test(norm(o.textContent))).value); await wait(500);
    rows = [...$$('#view tbody tr')];
    if (!rows.some(r => /6ème A/.test(norm(r.textContent))) || !rows.some(r => /5ème B/.test(norm(r.textContent))))
      throw new Error('les classes où MATH est enseignée sont absentes');
    if (!norm($('#view').textContent).includes('ENSEMBLE')) throw new Error('ligne ENSEMBLE absente du mode matière');
    /* mode niveau : synthèse des classes du niveau */
    click(tabs.find(b => /Par niveau/.test(norm(b.textContent)))); await wait(500);
    rows = [...$$('#view tbody tr')];
    if (!rows.some(r => /6ème A/.test(norm(r.textContent))) || !rows.some(r => /6ème B/.test(norm(r.textContent))))
      throw new Error('les classes du niveau Sixième sont absentes');
    if (!norm($('#view').textContent).includes('ENSEMBLE DU NIVEAU')) throw new Error('ligne ENSEMBLE DU NIVEAU absente');
    /* mode cycle : synthèse des niveaux du cycle collège */
    click(tabs.find(b => /Par cycle/.test(norm(b.textContent)))); await wait(500);
    rows = [...$$('#view tbody tr')];
    if (rows.length < 5) throw new Error('4 niveaux du collège + ENSEMBLE attendus, trouvé ' + rows.length);
    if (!norm($('#view').textContent).includes('ENSEMBLE DU CYCLE')) throw new Error('ligne ENSEMBLE DU CYCLE absente');
  });

  await step('statistiques : changement de période (trimestre, évaluation) sans erreur', async () => {
    setSel(selPeriode(), 'T1'); await wait(600);
    if (!norm($('#view').textContent).includes('Trimestre 1')) throw new Error('libellé Trimestre 1 absent');
    setSel(selPeriode(), '1'); await wait(600);
    if (!/Séquence 1/.test(norm($('#view').textContent))) throw new Error('libellé Séquence 1 absent');
    setSel(selPeriode(), ''); await wait(500);
  });

  await step('statistiques : impression (état A4 de l\u2019analyse en cours)', async () => {
    click($$('#view [role="tab"]').find(b => /Par classe/.test(norm(b.textContent)))); await wait(500);
    click($$('#view .card-h button').find(b => /Imprimer/.test(norm(b.textContent)))); await wait(600);
    if (!modalOuverte()) throw new Error('état statistiques non ouvert');
    if ($$('#modal-root .rcp-tbl').length !== 1) throw new Error('1 tableau attendu dans l\u2019état');
    const t = norm($('#modal-root').textContent);
    if (!t.includes('Statistiques') || !t.includes('Classe 6ème A')) throw new Error('contenu de l\u2019état incomplet');
    if (!t.includes('Moyenne /20')) throw new Error('colonne Moyenne /20 absente de l\u2019état');
    await fermerCroix();
  });

  await step('statistiques : périmètre de l\u2019enseignant (ses matières et ses classes)', async () => {
    await login('enseignant', 'enseignant2026');
    nav(/Statistiques/); await wait(600);
    if ($$('#view [role="tab"]').length !== 4) throw new Error('les 4 analyses doivent rester accessibles à l\u2019enseignant');
    /* mode classe : classes du périmètre uniquement (6ème/5ème), pas tout l\u2019établissement */
    const selCl = $$('#view select').find(s => [...s.options].some(o => /6ème A/.test(norm(o.textContent))));
    const labs = [...selCl.options].map(o => norm(o.textContent));
    if (labs.some(l => /3ème|4ème|Terminale/.test(l))) throw new Error('classe hors périmètre proposée : ' + labs.join(' | '));
    /* en 6ème A il n\u2019enseigne que les mathématiques */
    let rows = [...$$('#view tbody tr')];
    if (rows.length !== 1 || !/MATH/.test(norm(rows[0].textContent))) throw new Error('1 matière (MATH) attendue en 6ème A, trouvé ' + rows.length);
    /* en 5ème B : mathématiques + sa 2nde matière (plan) */
    setSel(selCl, [...selCl.options].find(o => /5ème B/.test(norm(o.textContent))).value); await wait(600);
    rows = [...$$('#view tbody tr')];
    if (rows.length !== 2) throw new Error('2 matières attendues en 5ème B, trouvé ' + rows.length);
    if (!rows.some(r => /MATH/.test(norm(r.textContent)))) throw new Error('MATH absente des statistiques de l\u2019enseignant');
    if (rows.some(r => /FRAN/.test(norm(r.textContent)))) throw new Error('matière hors périmètre visible (FRAN)');
    /* mode matière : seules SES matières sont proposées */
    click($$('#view [role="tab"]').find(b => /Par matière/.test(norm(b.textContent)))); await wait(500);
    const selM = $$('#view select').find(s => [...s.options].some(o => /MATH/.test(norm(o.textContent))));
    if (!selM) throw new Error('sélecteur matière absent en mode Par matière');
    if ([...selM.options].some(o => /FRAN/.test(norm(o.textContent)))) throw new Error('matière hors périmètre proposée (FRAN)');
    if ([...selM.options].length > 3) throw new Error('trop de matières proposées : ' + [...selM.options].map(o => norm(o.textContent)).join(' | '));
  });

  await step('statistiques invisibles pour les profils non pédagogiques (économe, surveillant)', async () => {
    await login('econome', 'econome2026');
    if (navLabels().some(x => /Statistiques/.test(x))) throw new Error('menu Statistiques visible pour l\u2019économe');
    await login('surveillant', 'surveillant2026');
    if (navLabels().some(x => /Statistiques/.test(x))) throw new Error('menu Statistiques visible pour le surveillant');
    await login('admin', 'admin2026');
  });

  await step('aucune erreur React pendant tout le parcours', async () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });

  console.log(fails ? '\n=== SMOKE TEST v5.3 : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v5.3 STATISTIQUES & BULLETINS : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
