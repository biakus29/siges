/* Smoke v6.2 — SCAN DES NOTES MANQUANTES (aide de l'agent de saisie) :
   • vue « Toutes les évaluations » (défaut) : matrice matières × séquences
     par classe — nombre de notes manquantes par évaluation (S1..S6) et par
     classe, totaux par matière/séquence/classe, TOTAL GÉNÉRAL, KPI ;
   • clic sur une cellule : ouverture directe de la saisie ;
   • vue « Séquence donnée » : KPI, liste triée, élèves sans note, bascule
     « Saisir », feuille de contrôle imprimable (autoPrint), export CSV ;
   • consultation seule pour le lecteur. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
let printed = 0;
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.print = () => { printed++; };
    w.addEventListener('error', e => errors.push(e.message));
    w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(|defaultProps|navigation/i.test(s)) errors.push('console.error: ' + s); }
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
const kvs = () => $$('.scan-kpis .kpi .kv').map(k => norm(k.textContent));
const modalOuverte = () => !!$('#modal-root .mback');
const fermerCroix = async () => { click($('#modal-root .m-x')); await wait(300); if (modalOuverte()) throw new Error('croix n\u2019a pas fermé la fenêtre'); };
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

(async () => {
  await wait(700);

  await step('onglet « Notes manquantes » : 3 modes, badge de matière(s) à compléter', async () => {
    await login('admin', 'admin2026');
    nav(/Saisie des notes/); await wait(500);
    const tabs = $$('.tabs .tab');
    if (tabs.length !== 3) throw new Error('3 onglets attendus (matière/élève/scan), trouvé ' + tabs.length);
    const tScan = tabs.find(b => /Notes manquantes/.test(norm(b.textContent)));
    if (!tScan) throw new Error('onglet Notes manquantes absent');
    if (!/Notes manquantes\s*10/.test(norm(tScan.textContent))) throw new Error('badge 10 attendu, lu : ' + norm(tScan.textContent));
  });

  await step('matrice « Toutes les évaluations » (défaut) : classes × matières × S1..S6, total général', async () => {
    click($$('.tabs .tab').find(b => /Notes manquantes/.test(norm(b.textContent)))); await wait(500);
    const t = norm($('#view').textContent);
    if (!/par évaluation et par classe/.test(t)) throw new Error('titre de la synthèse absent');
    if (!/Scan actualisé à/.test(t)) throw new Error('horodatage absent');
    /* un seul sélecteur (classe de la synthèse), valeur « Toutes les classes » */
    const sels = $$('#view select');
    if (sels.length !== 1) throw new Error('1 sélecteur attendu en vue matrice, trouvé ' + sels.length);
    if (!/Toutes les classes/.test(norm(sels[0].options[sels[0].selectedIndex].textContent))) throw new Error('« Toutes les classes » doit être sélectionnée');
    /* en-têtes de colonnes S1..S6 */
    const ths = $$('.mx-tbl thead th').map(th => norm(th.textContent));
    for (const s of ['S1','S2','S3','S4','S5','S6']) if (!ths.includes(s)) throw new Error('colonne ' + s + ' absente : ' + ths.join('|'));
    /* 4 classes avec plan : 4 en-têtes de groupe */
    const grp = $$('.mx-tbl tr.mx-class').map(tr => norm(tr.textContent));
    if (grp.length !== 4) throw new Error('4 classes attendues dans la matrice, trouvé ' + grp.length + ' : ' + grp.join(' | '));
    if (!grp.some(g => /6ème A — 12 élève\(s\)/.test(g))) throw new Error('groupe « 6ème A — 12 élève(s) » absent');
    /* KPI : 2164 manquantes, 216 à compléter, 0 complètes, 4 classes */
    const k = kvs();
    if (k.join('|') !== '2164|216|0|4') throw new Error('KPI attendus 2164|216|0|4, lus : ' + k.join('|'));
    /* TOTAL GÉNÉRAL : 329×4 puis 424×2, total 2164 */
    const gen = $$('.mx-tbl tr.mx-gen td').map(td => norm(td.textContent));
    if (gen.join('|') !== 'TOTAL GÉNÉRAL|329|329|329|329|424|424|2164') throw new Error('TOTAL GÉNÉRAL attendu 329×4|424×2|2164, lu : ' + gen.join('|'));
    if (!$$('#view button').some(b => /Exporter CSV/.test(norm(b.textContent)))) throw new Error('export CSV de la synthèse absent');
  });

  await step('classe 6ème A : manquantes par évaluation 91/91/91/91/120/120, total 604', async () => {
    const sels = $$('#view select');
    const opt = [...sels[0].options].find(o => /6ème A/.test(norm(o.textContent)));
    setSel(sels[0], opt.value); await wait(500);
    if ($$('.mx-tbl tr.mx-class').length !== 1) throw new Error('1 seul groupe de classe attendu');
    const rows = $$('.mx-tbl tbody tr').filter(tr => !tr.className.includes('mx-class') && !tr.className.includes('mx-tot'));
    if (rows.length !== 10) throw new Error('10 matières attendues, trouvé ' + rows.length);
    const tot = $$('.mx-tbl tr.mx-tot td').map(td => norm(td.textContent));
    if (tot.join('|') !== 'Manquantes — 6ème A|91|91|91|91|120|120|604') throw new Error('totaux attendus 91×4|120×2|604, lus : ' + tot.join('|'));
    /* total par matière : 7×72 (vides), 2×36 (9/12), 1×28 (11/12) */
    const colTot = rows.map(tr => norm(tr.cells[tr.cells.length - 1].textContent));
    if (colTot.filter(v => v === '72').length !== 7 || colTot.filter(v => v === '36').length !== 2 || colTot.filter(v => v === '28').length !== 1)
      throw new Error('totaux par matière attendus 7×72, 2×36, 1×28, lus : ' + colTot.join('|'));
    if ($$('td.mx-okk').length !== 0) throw new Error('aucune cellule complète attendue pour 6ème A');
    const k = kvs();
    if (k.join('|') !== '604|60|0|1') throw new Error('KPI attendus 604|60|0|1, lus : ' + k.join('|'));
    /* cellules cliquables (admin) */
    if ($$('.mx-tbl button.mx-go').length !== 60) throw new Error('60 cellules cliquables attendues, trouvé ' + $$('.mx-tbl button.mx-go').length);
  });

  await step('clic sur une cellule : ouverture directe de la saisie (matière × séquence)', async () => {
    const row28 = $$('.mx-tbl tbody tr').find(tr => !tr.className && norm(tr.cells[tr.cells.length - 1].textContent) === '28');
    if (!row28) throw new Error('ligne Anglais (total 28) introuvable');
    const cells = [...row28.cells].filter(td => td.querySelector('button.mx-go'));
    if (cells.length !== 6) throw new Error('6 cellules à compléter attendues pour cette matière');
    click(cells[0].querySelector('button.mx-go')); await wait(500);
    const on = $('.tabs .tab.on');
    if (!on || !/Par matière/.test(norm(on.textContent))) throw new Error('bascule vers « Par matière » attendue');
    const sels = $$('#view select');
    if (sels.length !== 3) throw new Error('3 sélecteurs attendus en mode matière');
    if (!/ANGL/.test(norm(sels[1].options[sels[1].selectedIndex].textContent))) throw new Error('matière Anglais non sélectionnée');
    if (!/Séquence 1/.test(norm(sels[2].options[sels[2].selectedIndex].textContent))) throw new Error('séquence 1 non sélectionnée');
    if (!/11\/12 note\(s\) saisie\(s\)/.test(norm($('#view').textContent))) throw new Error('11/12 note(s) saisie(s) attendu');
  });

  await step('vue « Séquence donnée » : KPI 0 complète, 3 partielles, 7 vides, 91 manquantes', async () => {
    click($$('.tabs .tab').find(b => /Notes manquantes/.test(norm(b.textContent)))); await wait(500);
    const seg = $$('.seg button').map(b => norm(b.textContent));
    if (seg.length !== 2 || !/Toutes les évaluations/.test(seg[0]) || !/Séquence donnée/.test(seg[1])) throw new Error('segment à 2 vues attendu : ' + seg.join('|'));
    click($$('.seg button')[1]); await wait(500);   /* second bouton du segment = séquence donnée */
    if ($$('.seg button.on').length !== 1 || !/Séquence donnée/.test(norm($('.seg button.on').textContent))) throw new Error('vue détail non active');
    const k = kvs();
    if (k.join('|') !== '0|3|7|91') throw new Error('KPI attendus 0|3|7|91, lus : ' + k.join('|'));
    const sels = $$('#view select');
    if (sels.length !== 2) throw new Error('2 sélecteurs attendus en détail (classe/séquence), trouvé ' + sels.length);
  });

  await step('tableau détail : 10 matières triées (vides d\u2019abord), statuts et élèves manquants', async () => {
    const rows = $$('.tbl tbody tr');
    if (rows.length !== 10) throw new Error('10 matières attendues, trouvé ' + rows.length);
    const badges = $$('.tbl .badge').map(b => norm(b.textContent));
    const vides = badges.filter(b => b === 'Aucune note').length;
    const part = badges.filter(b => b === 'Partielle').length;
    if (vides !== 7 || part !== 3) throw new Error('statuts attendus 7 vides / 3 partielles, lus : ' + vides + '/' + part);
    if (norm(rows[0].textContent).includes('Aucune note') === false) throw new Error('les matières vides doivent venir en premier');
    const sums = $$('.tbl details.manq summary').map(s => norm(s.textContent));
    if (sums.filter(s => /^12 élèves sans note$/.test(s)).length !== 7) throw new Error('7 lignes « 12 élèves sans note » attendues : ' + sums.join('|'));
    if (sums.filter(s => /^3 élèves sans note$/.test(s)).length !== 2) throw new Error('2 lignes « 3 élèves sans note » attendues');
    if (!sums.some(s => /^1 élève sans note$/.test(s))) throw new Error('ligne « 1 élève sans note » attendue');
    const btns = $$('.tbl button').filter(b => /^Saisir$/.test(norm(b.textContent).trim()));
    if (btns.length !== 10) throw new Error('10 boutons « Saisir » attendus (admin), trouvé ' + btns.length);
  });

  await step('séquence 5 (détail) : tout à saisir (10 vides, 120 manquantes)', async () => {
    const sels = $$('#view select');
    const opt5 = [...sels[1].options].find(o => /Séquence 5/.test(norm(o.textContent)));
    setSel(sels[1], opt5.value); await wait(500);
    const k = kvs();
    if (k.join('|') !== '0|0|10|120') throw new Error('KPI attendus 0|0|10|120, lus : ' + k.join('|'));
    const t = norm($('#view').textContent);
    if (!/Élèves sans aucune note/.test(t)) throw new Error('liste des élèves sans aucune note absente');
  });

  await step('horodatage rafraîchi et toast de confirmation', async () => {
    click($$('#view button').find(b => /Actualiser/.test(norm(b.textContent)))); await wait(400);
    const toasts = $$('#toast-root .toast').map(t => norm(t.textContent));
    if (!toasts.some(t => /Scan actualisé à \d\d:\d\d:\d\d/.test(t))) throw new Error('toast « Scan actualisé à HH:MM:SS » attendu, toasts : ' + toasts.join(' | ').slice(0, 120));
    if (!/Scan actualisé à \d\d:\d\d:\d\d/.test(norm($('#view').textContent))) throw new Error('horodatage mis à jour absent');
  });

  await step('feuille de contrôle imprimable (autoPrint)', async () => {
    const btnP = $$('#view button').find(b => /Feuille de contrôle/.test(norm(b.textContent)));
    if (!btnP) throw new Error('bouton Feuille de contrôle absent');
    click(btnP); await wait(600);
    if (!modalOuverte()) throw new Error('fenêtre de la feuille de contrôle absente');
    const t = norm($('#modal-root').textContent);
    for (const mot of ['Feuille de contrôle', 'Saisie faite', 'Élèves sans note', 'Scan du', 'agent de saisie'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent de la feuille de contrôle');
    if (printed < 1) throw new Error('impression automatique non déclenchée');
    await fermerCroix();
  });

  await step('consultation seule (lecteur) : matrice visible, aucune saisie possible', async () => {
    await login('lecteur', 'lecteur2026');
    nav(/Saisie des notes/); await wait(500);
    click($$('.tabs .tab').find(b => /Notes manquantes/.test(norm(b.textContent)))); await wait(500);
    if ($$('.mx-tbl tr.mx-class').length !== 4) throw new Error('4 classes attendues dans la matice (lecteur)');
    if ($$('.mx-tbl button.mx-go').length !== 0) throw new Error('aucune cellule cliquable attendue (lecteur)');
    click($$('.seg button')[1]); await wait(500);   /* vue détail */
    if ($$('.tbl tbody tr').length !== 10) throw new Error('10 matières attendues pour le lecteur');
    if ($$('.tbl button').some(b => /^Saisir$/.test(norm(b.textContent).trim()))) throw new Error('aucun bouton Saisir attendu en consultation');
    const t = norm($('#view').textContent);
    if (!/Consultation seule/.test(t)) throw new Error('mention « Consultation seule » absente');
  });

  console.log(fails ? '\n=== SMOKE TEST v6.2 SCAN : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v6.2 SCAN : OK ===');
  if (errors.length){ console.error('Erreurs applicatives :'); errors.slice(0, 6).forEach(e => console.error('  ' + e)); }
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
