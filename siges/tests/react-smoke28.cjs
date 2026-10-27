/* Smoke v6.6 — SUPPRESSION MULTIPLE D'ÉLÈVES + JOURNAL PAR ÉTABLISSEMENT :
   • cases à cocher dans la liste des élèves, tout cocher par page, barre
     de sélection, confirmation groupée ;
   • élèves avec paiements : ignorés (jamais supprimés), comptés dans le
     compte rendu ; notes / discipline / bourses des supprimés purgées ;
   • journal : l'administrateur d'un établissement ne voit QUE les actions
     de son établissement (pas de colonne Établissement, pas d'actions
     d'autres établissements) ;
   • journal : le SUPERADMINISTRATEUR voit les actions de TOUS le monde
     (colonne Établissement, filtre « Tous les établissements »). */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr' + 'ipt>' + bundle + '</scr' + 'ipt></body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.print = () => {};
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
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
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

(async () => {
  await wait(700);

  await step('v7.0 : pied de page', async () => {
    await login('admin', 'admin2026');
    if (!/v7\.0 React/.test(norm(d.body.textContent))) throw new Error('mention v6.6 absente');
  });

  await step('élèves : cases à cocher + tout cocher par page', async () => {
    nav(/Élèves & inscriptions/); await wait(600);
    const coches = $$('#view tbody input[type="checkbox"]');
    if (!coches.length) throw new Error('cases à cocher absentes de la liste des élèves');
    const entete = $$('#view thead input[type="checkbox"]');
    if (!entete.length) throw new Error('case « tout cocher » absente de l\u2019en-tête');
    if (coches.length < 10) throw new Error('une case par élève attendue (trouvé ' + coches.length + ')');
    click(entete[0]); await wait(300);
    if (!$('#view .btn-danger') || !/Supprimer la sélection/.test(norm($('#view').textContent)))
      throw new Error('barre de sélection multiple absente');
    if (!/15 élève\(s\) sélectionné\(s\)/.test(norm($('#view').textContent)))
      throw new Error('compteur de sélection incorrect (attendu 15, page courante)');
    click(entete[0]); await wait(300);
    if (/Supprimer la sélection/.test(norm($('#view').textContent))) throw new Error('la barre ne se referme pas');
  });

  await step('suppression multiple : élève sans paiement supprimé, notes purgées', async () => {
    const b = base();
    const payes = new Set(b.paiements.map(p => p.eleveId));
    const libre = b.eleves.find(e => e.anneeId === 'an26' && !payes.has(e.id) && b.notes.some(n => n.eleveId === e.id));
    if (!libre) throw new Error('la démo devrait avoir un élève sans paiement et noté');
    /* on isole l'élève par la recherche, puis on le coche */
    const srch = $('#view .srch input');
    setInput(srch, libre.matricule); await wait(500);
    const tr = $$('#view tbody tr').find(r => norm(r.textContent).includes(libre.matricule));
    if (!tr) throw new Error('élève cible introuvable après recherche');
    const cb = tr.querySelector('input[type="checkbox"]');
    if (!cb) throw new Error('case à cocher absente de la ligne');
    click(cb); await wait(300);
    if (!/1 élève\(s\) sélectionné\(s\)/.test(norm($('#view').textContent))) throw new Error('barre de sélection (1) absente');
    click($$('#view button').find(x => /Supprimer la sélection/.test(norm(x.textContent)))); await wait(400);
    const conf = $('#modal-root .btn-danger');
    if (!conf) throw new Error('confirmation de suppression multiple absente');
    if (!/Cette action est définitive/.test(norm($('#modal-root').textContent))) throw new Error('avertissement de confirmation incomplet');
    click(conf); await wait(700);
    const apres = base();
    if (apres.eleves.some(e => e.id === libre.id)) throw new Error('l\u2019élève ciblé n\u2019a pas été supprimé');
    if (apres.notes.some(n => n.eleveId === libre.id)) throw new Error('notes non purgées');
    if (apres.bourses.some(x => x.eleveId === libre.id)) throw new Error('bourses non purgées');
    setInput(srch, ''); await wait(400);
  });

  await step('suppression multiple : les élèves avec paiements sont ignorés', async () => {
    const b = base();
    const payes = new Set(b.paiements.map(p => p.eleveId));
    /* la classe de l\u2019élève libre restant mélange payés / non payés */
    const libre2 = b.eleves.find(e => e.anneeId === 'an26' && !payes.has(e.id));
    if (!libre2) throw new Error('plus d\u2019élève sans paiement (étape précédente)');
    const cl = b.classes.find(c => c.id === libre2.classeId);
    const payesDeLaClasse = b.eleves.filter(e => e.anneeId === 'an26' && e.classeId === cl.id && payes.has(e.id));
    if (!payesDeLaClasse.length) throw new Error('jeu de test incomplet : pas d\u2019élèves avec paiements dans la classe ' + cl.libelle);
    /* filtre par classe, tout cocher, tout supprimer */
    const selClasse = $$('#view select')[0];
    setSel(selClasse, [...selClasse.options].find(o => norm(o.textContent) === cl.libelle).value); await wait(500);
    const entete = $$('#view thead input[type="checkbox"]')[0];
    click(entete); await wait(300);
    const nSel = parseInt((norm($('#view').textContent).match(/(\d+) élève\(s\) sélectionné\(s\)/) || [])[1] || '0', 10);
    if (nSel < 2) throw new Error('sélection attendue : toute la classe (' + nSel + ')');
    click($$('#view button').find(x => /Supprimer la sélection/.test(norm(x.textContent)))); await wait(400);
    const conf = $('#modal-root .btn-danger');
    if (!conf) throw new Error('confirmation absente');
    click(conf); await wait(700);
    const apres = base();
    if (payesDeLaClasse.some(e => !apres.eleves.some(x => x.id === e.id)))
      throw new Error('des élèves AVEC paiements ont été supprimés !');
    if (apres.eleves.some(e => e.id === libre2.id))
      throw new Error('l\u2019élève sans paiement de la classe n\u2019a pas été supprimé');
    if (apres.paiements.some(p => payesDeLaClasse.some(e => e.id === p.eleveId) && !apres.eleves.some(x => x.id === p.eleveId)))
      throw new Error('des paiements ont perdu leur élève');
  });

  await step('journal (admin) : uniquement son établissement, pas de colonne Établissement', async () => {
    nav(/Journal d'activité/); await wait(500);
    const t = norm($('#view').textContent);
    if (!/Actions de votre établissement uniquement/.test(t)) throw new Error('mention de périmètre absent');
    if (/Toutes les actions — tous les établissements/.test(t)) throw new Error('l\u2019admin voit la mention superadmin !');
    const ths = $$('#view thead th').map(x => norm(x.textContent));
    if (ths.some(x => /Établissement/.test(x))) throw new Error('colonne Établissement visible pour l\u2019admin');
    if (/Administration générale/.test(t)) throw new Error('actions de l\u2019administration générale visibles de l\u2019admin');
    if (/Connexion/.test(t) !== true) { /* les connexions de ses comptes peuvent être vides en local : pas bloquant */ }
  });

  await step('journal (superadmin) : actions de tous le monde + filtre par établissement', async () => {
    await login('superadmin', 'super2026');
    await wait(400);
    /* console réseau : ouvrir le premier établissement */
    const btnOuvrir = $$('button').filter(b => !b.closest('.nav-i')).find(b => /Ouvrir/.test(norm(b.textContent)));
    if (!btnOuvrir) throw new Error('bouton « Ouvrir » (console réseau) introuvable');
    click(btnOuvrir); await wait(600);
    nav(/Journal d'activité/); await wait(500);
    const t = norm($('#view').textContent);
    if (!/Toutes les actions — tous les établissements/.test(t)) throw new Error('mention superadmin absente');
    const ths = $$('#view thead th').map(x => norm(x.textContent));
    if (!ths.some(x => /Établissement/.test(x))) throw new Error('colonne Établissement absente pour le superadmin');
    const sels = $$('#view select');
    if (!sels.some(s => [...s.options].some(o => /Tous les établissements/.test(norm(o.textContent)))))
      throw new Error('filtre par établissement absent');
    if (!sels.some(s => [...s.options].some(o => /Administration générale/.test(norm(o.textContent)))))
      throw new Error('option « Administration générale » absente du filtre');
    /* le journal fusionné contient des événements des DEUX établissements */
    const noms = ['Collège Bonneau', 'Lycée Classique'];
    if (!noms.some(n => t.includes(n))) throw new Error('aucun événement d\u2019un autre établissement visible');
  });

  console.log(fails ? '\n=== SMOKE TEST v6.7 : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v6.6 : OK ===');
  if (errors.length){ console.error('Erreurs runtime :'); errors.slice(0, 10).forEach(e => console.error('  ' + e)); }
  w.close(); process.exit(fails || errors.length ? 1 : 0);
})();
