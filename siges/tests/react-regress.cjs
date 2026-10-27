/* ============================================================
   Régression UI consolidée (v1.0 → v1.6) — jsdom, rendu réel.
   Prérequis : bundle de test /tmp/bundle.react.test.js + jsdom
   (npm install jsdom dans /tmp/jsdomtest si l'environnement fut purgé).
   Exécution : node tests/react-regress.js
   ============================================================ */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const css = fs.readFileSync('/home/user/aurel-react/src/styles.css', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
let printCalls = 0, blobCalls = 0;
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.print = () => { printCalls++; };
    w.URL.createObjectURL = () => { blobCalls++; return 'blob:test'; };
    w.addEventListener('error', e => errors.push(e.message));
    w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(|defaultProps|navigation/i.test(s)) errors.push('console.error: ' + s); };
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const norm = s => s.replace(/\u202f|\u00a0/g, ' ');
const LS = () => { const d = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1')); const b = (Array.isArray(d && d.bases) && (d.bases.find(x => x.id === 'etab-001') || d.bases[0])) || d;
  return (d && d.bases) ? Object.assign({}, b, { users:d.users, etablissements:d.etablissements, bases:d.bases }) : d; };
function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x instanceof RegExp ? x.test(n.textContent) : n.textContent.includes(x)));
const btnTxt = (re, root) => $$((root || d) + ' button').filter(b => !b.closest('.nav-i')).find(b => re.test(norm(b.textContent)));
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  await wait(600);
  let ls = null;

  await step('connexion admin', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(500);
    if (!$('#app')) throw new Error('app absente');
    ls = LS();
  });

  await step('rapports : statistiques et répartition par âge séparées (7 cartes)', async () => {
    nav(/Rapport/); await wait(400);
    const cards = $$('.ycard');
    if (cards.length !== 7) throw new Error(cards.length + ' carte(s) au lieu de 7');
    const st = cards.find(c => norm(c.textContent).includes('Statistiques des inscrits'));
    const ag = cards.find(c => norm(c.textContent).includes('Répartition par âge'));
    if (!st || !ag) throw new Error('cartes stats/âges introuvables');
    click(st.querySelector('button')); await wait(350);
    if (!$('#modal-root .rcp-tbl')) throw new Error('état statistiques non rendu');
    if (!norm($('#modal-root').textContent).includes('Effectif')) throw new Error('tableau effectifs absent');
    click($('#modal-root .m-x')); await wait(250);
    click(ag.querySelector('button')); await wait(350);
    if (!$('#modal-root .rcp-tbl')) throw new Error('état âges non rendu');
    if (!norm($('#modal-root').textContent).includes('âge moyen')) throw new Error('âge moyen absent');
    click($('#modal-root .m-x')); await wait(250);
  });

  await step('encaissement : recherche élève, paiement, reçu, chronologie', async () => {
    nav(/Paiement|Encaissement/); await wait(400);
    const ls0 = LS();
    const cible = ls0.eleves.find(e => e.anneeId === 'an26' && !ls0.paiements.some(p => p.eleveId === e.id && p.statut !== 'annule'));
    if (!cible) throw new Error('aucun élève avec solde pour le test');
    const openBtn = $$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouveau paiement/i.test(norm(b.textContent)));
    if (!openBtn) throw new Error('bouton Nouveau paiement introuvable sur la page Paiements');
    click(openBtn); await wait(400);
    const srch = $('#modal-root .srch input');
    if (!srch) throw new Error('recherche élève absente (étape 1 PayModal)');
    setInput(srch, cible.matricule); await wait(400);
    const res = $$('#modal-root .pm-row').filter(r => norm(r.textContent).includes(cible.matricule));
    if (!res.length) throw new Error('aucun résultat de recherche');
    click(res[0]); await wait(500);
    const money = $('#modal-root input.money');
    if (!money) throw new Error('formulaire montant absent (étape 2 PayModal) — modale : ' + norm($('#modal-root').textContent).replace(/\s+/g, ' ').slice(0, 180));
    setInput(money, '5000'); await wait(120);
    const form = $('#modal-root form');
    if (!form) throw new Error('formulaire d\u2019encaissement absent');
    form.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const ls1 = LS();
    if (ls1.paiements.length !== ls0.paiements.length + 1) throw new Error('paiement non enregistré');
    const nw = ls1.paiements[ls1.paiements.length - 1];
    if (!/^REC-/.test(nw.numero)) throw new Error('numéro de reçu invalide : ' + nw.numero);
    /* chronologie : le nouveau reçu doit être en tête du tableau */
    const first = $$('#view tbody tr')[0];
    if (!first || !norm(first.cells[0].textContent).includes(nw.numero.slice(-4))) throw new Error('nouveau reçu pas en tête (col0 = ' + (first ? norm(first.cells[0].textContent) : '—') + ')');
  });

  await step('impression directe sur la page Paiements (journal de caisse)', async () => {
    if ($('#modal-root .m-x')) { click($('#modal-root .m-x')); await wait(300); }  /* refermer un éventuel reçu */
    const p = printCalls;
    const pr = $$('button').filter(b => !b.closest('.nav-i')).find(b => norm(b.textContent).trim() === 'Imprimer');
    if (!pr) throw new Error('bouton Imprimer absent');
    click(pr); await wait(700);
    if (printCalls !== p + 1) throw new Error('window.print non appelé');
    if (!$('#print-host')) throw new Error('hôte d\u2019impression absent');
    const thDH = $$('#print-host .rcp-tbl th').some(th => norm(th.textContent).replace(/\s+/g, '').includes('Date·Heure'));
    if (!thDH) throw new Error('colonne Date · Heure fusionnée absente');
  });

  await step('export CSV élèves : modale Télécharger/Copier/aperçu', async () => {
    nav('Élèves'); await wait(400);
    const b = blobCalls;
    const ex = $$('button').filter(x => !x.closest('.nav-i')).find(x => /Exporter CSV/i.test(norm(x.textContent)));
    if (!ex) throw new Error('bouton Exporter CSV absent');
    click(ex); await wait(350);
    const prev = $('#csv-preview');
    if (!prev) throw new Error('aperçu CSV absent');
    if (!(prev.value || '').includes('Matricule')) throw new Error('contenu CSV inattendu');
    const dl = $$('#modal-root button').find(x => /Télécharger/i.test(norm(x.textContent)));
    if (!dl) throw new Error('bouton Télécharger absent');
    click(dl); await wait(200);
    if (blobCalls !== b + 1) throw new Error('téléchargement non déclenché');
    click($('#modal-root .m-x')); await wait(250);
  });

  await step('grille : clonage vers d\u2019autres classes', async () => {
    nav(/Grille/); await wait(400);
    const cell = $('#view input.money');
    setInput(cell, '27000'); await wait(120);
    cell.dispatchEvent(new w.Event('focusout', { bubbles:true })); await wait(350);
    const cloneBtn = $$('button').find(x => norm(x.textContent).includes('Cloner vers'));
    if (!cloneBtn) throw new Error('bouton Cloner vers absent');
    click(cloneBtn); await wait(350);
    const rows = $$('#modal-root .clone-row');
    if (rows.length < 10) throw new Error('destinations trop peu nombreuses : ' + rows.length);
    const c6b = rows.find(r => norm(r.textContent).includes('6ème B'));
    const c5a = rows.find(r => norm(r.textContent).includes('5ème A'));
    click(c6b.querySelector('input')); click(c5a.querySelector('input')); await wait(150);
    $('#modal-root form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(450);
    const ls = LS();
    const t6b = ls.tarifs.find(t => t.anneeId === 'an26' && t.cibleType === 'classe' && t.cibleId === 'cl6b' && t.fraisId === 'fr-inscr');
    const t5a = ls.tarifs.find(t => t.anneeId === 'an26' && t.cibleType === 'classe' && t.cibleId === 'cl5a' && t.fraisId === 'fr-inscr');
    if (!t6b || t6b.montant !== 27000) throw new Error('cl6b non clonée');
    if (!t5a || t5a.montant !== 27000) throw new Error('cl5a non clonée');
  });

  await step('annulation des réductions d\u2019un élève (situation, économe uniquement)', async () => {
    const ls0 = LS();
    const bs = ls0.bourses.find(b => b.actif !== false && b.anneeId === 'an26');
    if (!bs) throw new Error('aucune bourse active');
    const elv = ls0.eleves.find(e => e.id === bs.eleveId);
    nav('Élèves'); await wait(300);
    setInput($('.srch input'), elv.matricule); await wait(350);
    /* v5.4 : les informations de paiement sont réservées à l'économe — admin : ni bouton ni colonne */
    if ($('button[title="Situation des frais"]')) throw new Error('bouton Situation visible pour un non-économe');
    if (norm($('#view').textContent).includes('Solde')) throw new Error('colonne Solde visible pour un non-économe');
    /* bascule vers l'économe */
    click($('button[title="Se déconnecter"]')); await wait(600);
    setInput($('#li-user'), 'econome'); setInput($('#li-pass'), 'econome2026');
    click($('.lw-btn')); await wait(800);
    nav('Élèves'); await wait(400);
    setInput($('.srch input'), elv.matricule); await wait(350);
    click($('button[title="Situation des frais"]')); await wait(400);
    const btn = $$('button').find(b => b.textContent.includes('Annuler les réductions'));
    if (!btn) throw new Error('bouton Annuler les réductions absent');
    click(btn); await wait(300);
    const okBtn = $$('#modal-root button').find(b => b.textContent.includes('Annuler les réductions') && b.classList.contains('btn-danger'));
    if (!okBtn) throw new Error('confirmation absente');
    click(okBtn); await wait(450);
    const ls1 = LS();
    if (ls1.bourses.filter(b => b.eleveId === elv.id && b.actif !== false).length) throw new Error('réductions encore actives');
    /* retour au compte admin pour la suite du parcours */
    click($('button[title="Se déconnecter"]')); await wait(600);
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(800);
  });

  await step('photos des élèves : import + affichage', async () => {
    nav('Élèves'); await wait(300);
    setInput($('.srch input'), ''); await wait(200);
    const add = $$('button').filter(b => !b.closest('.nav-i')).find(b => /Inscrire un élève/i.test(norm(b.textContent)));
    click(add); await wait(400);
    /* v1.10 : étape de choix (ancien / nouveau) avant la fiche */
    const saisir = $$('#modal-root button').find(b => /Saisir un nouvel \u00e9l\u00e8ve|Saisir un nouvel élève/i.test(norm(b.textContent)));
    if (saisir){ click(saisir); await wait(400); }
    const form = $('#modal-root form');
    const fileInp = form.querySelector('.photo-pick input[type="file"]');
    if (!fileInp) throw new Error('sélecteur de photo absent');
    const png = new w.File([new Uint8Array([137,80,78,71,13,10,26,10])], 'photo.png', { type:'image/png' });
    Object.defineProperty(fileInp, 'files', { value:[png], configurable:true });
    fileInp.dispatchEvent(new w.Event('change', { bubbles:true }));
    await wait(400);
    if (!$('.photo-pick img')) throw new Error('aperçu photo absent');
    const setSel = (sel, v) => { Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(sel, v); sel.dispatchEvent(new w.Event('change', { bubbles:true })); };
    setSel(form.querySelector('select[name="classeId"]'), 'cl6a');
    setInput(form.querySelector('input[name="nom"]'), 'TESTREG');
    setInput(form.querySelector('input[name="prenom"]'), 'Alixe');
    form.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(450);
    const el = LS().eleves.find(e => e.nom === 'TESTREG');
    if (!el || !String(el.photo || '').startsWith('data:image/png')) throw new Error('photo non persistée');
    setInput($('.srch input'), 'TESTREG'); await wait(350);
    if (!$('#view tbody img.ava')) throw new Error('photo absente de la liste');
  });

  await step('lisibilité : zébrage + en-têtes gris', async () => {
    setInput($('.srch input'), ''); await wait(250);
    const rows = $$('#view tbody tr').filter(r => !r.classList.contains('row-late'));
    if (rows[1] && w.getComputedStyle(rows[1].cells[0]).backgroundColor !== 'rgb(250, 248, 243)') throw new Error('zébrure absente');
    const th = $('.tbl th');
    if (!th) throw new Error('en-tête de tableau absent');
    const bg = w.getComputedStyle(th).backgroundColor;
    if (bg !== 'rgb(240, 237, 229)') throw new Error('en-tête non ivoire (v4.2) : ' + bg);
  });

  await step('aucune erreur React', () => {
    const real = errors.filter(e => !/Warning/.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  console.log(fails ? '\n=== ' + fails + ' ÉCHEC(S) ===' : '\n=== RÉGRESSION CONSOLIDÉE v1.0→v1.6 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
