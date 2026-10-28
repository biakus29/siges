/* Smoke v6.5 — DEVOIRS PONDÉRÉS PAR SÉQUENCE :
   • l'administrateur définit 0 à N devoirs par séquence, chacun avec son
     pourcentage (total = 100 %) — bouton « Devoirs » de la séquence ;
   • l'activation des devoirs annule les notes d'évaluation de la séquence
     (la note séquentielle devient calculée) ;
   • la saisie propose une colonne par devoir + la note séquentielle
     calculée (Σ note × pourcentage), en modes matière et élève ;
   • les notes de devoir n'apparaissent PAS dans les bulletins — seule la
     note séquentielle (calculée) y figure ;
   • le scan des notes manquantes attend effectif × devoirs notes ;
   • la reconduction avertit du rattachement par libellé de devoir ;
   • le retrait d'un devoir supprime ses notes et met à jour la séquence. */
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
function setSel(el, v){
  Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
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

  await step('v6.5 : pied de page et colonne « Devoirs » des séquences', async () => {
    await login('admin', 'admin2026');
    if (!/v7\.0 React/.test(norm(d.body.textContent))) throw new Error('mention v6.5 absente du pied de page');
    nav(/Séquences & appréciations/); await wait(500);
    const t = norm($('#view').textContent);
    if (!/Devoirs/.test(t)) throw new Error('colonne « Devoirs » absente');
    if (!/saisie directe/.test(t)) throw new Error('mention « saisie directe » absente pour les séquences sans devoir');
    const row1 = $$('#view tbody tr').find(r => /Séquence 1/.test(norm(r.textContent)));
    if (!row1) throw new Error('ligne Séquence 1 introuvable');
    if (!row1.querySelector('button[title^="Devoirs de la séquence"]')) throw new Error('bouton Devoirs absent de la ligne');
  });

  await step('modale devoirs : ajout de 2 devoirs 40 % + 60 %, total contrôlé', async () => {
    const row1 = $$('#view tbody tr').find(r => /Séquence 1/.test(norm(r.textContent)));
    const nbEvalAvant = base().notes.filter(n => String(n.sequence) === '1' && !(n.type === 'devoir' && n.devoirId != null)).length;
    if (!nbEvalAvant) throw new Error('la démo devrait avoir des notes d\u2019évaluation sur la séquence 1 (' + nbEvalAvant + ')');
    click(row1.querySelector('button[title^="Devoirs de la séquence"]')); await wait(400);
    let m = norm($('#modal-root').textContent);
    if (!/Devoirs de « Séquence 1 »/.test(m)) throw new Error('titre de la modale incorrect');
    if (!/Aucun devoir/.test(m)) throw new Error('état vide absent');
    if (!/Total : 0 % — aucun devoir/.test(m)) throw new Error('total à 0 % absent : ' + (m.match(/Total : [^—]+—[^%]+%/g) || []).join(' | '));
    click($$('#modal-root button').find(b => /Ajouter un devoir/.test(norm(b.textContent)))); await wait(200);
    click($$('#modal-root button').find(b => /Ajouter un devoir/.test(norm(b.textContent)))); await wait(200);
    const libs = $$('#modal-root .dv-lib'), pcts = $$('#modal-root .dv-pct');
    if (libs.length !== 2 || pcts.length !== 2) throw new Error('2 lignes de devoirs attendues, trouvé ' + libs.length);
    setInput(libs[0], 'Interrogation'); setInput(pcts[0], '40');
    setInput(libs[1], 'Devoir'); setInput(pcts[1], '60');
    await wait(200);
    m = norm($('#modal-root').textContent);
    if (!/Total : 100 % — correct/.test(m)) throw new Error('total 100 % non affiché comme correct');
    if (!/ne figurent pas dans les bulletins/.test(m)) throw new Error('mention d\u2019invisibilité dans les bulletins absente');
    if (!/calculée automatiquement/.test(m)) throw new Error('mention de calcul automatique absente');
    /* validation : total ≠ 100 % refusé */
    setInput(pcts[1], '50'); await wait(200);
    click($$('#modal-root .btn-pri').find(b => /Enregistrer/.test(norm(b.textContent)))); await wait(400);
    if (!/doit faire 100 %/.test(norm(d.body.textContent))) throw new Error('total ≠ 100 % accepté sans erreur');
    setInput(pcts[1], '60'); await wait(200);
    /* enregistrement : les notes d'évaluation vont être annulées → confirmation */
    click($$('#modal-root .btn-pri').find(b => /Enregistrer/.test(norm(b.textContent)))); await wait(400);
    const conf = $('#modal-root .btn-danger');
    if (!conf) throw new Error('confirmation d\u2019annulation des notes d\u2019évaluation absente');
    if (!/note\(s\) d\u2019évaluation seront annulées/.test(norm($('#modal-root').textContent)))
      throw new Error('message d\u2019annulation incomplet');
    click(conf); await wait(600);
    const b = base();
    const sq1 = (b.sequences || []).find(s => String(s.id) === '1');
    if (!sq1 || !Array.isArray(sq1.devoirs) || sq1.devoirs.length !== 2)
      throw new Error('2 devoirs attendus sur la séquence 1 en base');
    if (sq1.devoirs[0].libelle !== 'Interrogation' || sq1.devoirs[0].pourcentage !== 40
      || sq1.devoirs[1].libelle !== 'Devoir' || sq1.devoirs[1].pourcentage !== 60)
      throw new Error('devoirs mal enregistrés : ' + JSON.stringify(sq1.devoirs));
    const restantes = b.notes.filter(n => String(n.sequence) === '1' && !(n.type === 'devoir' && n.devoirId != null)).length;
    if (restantes !== 0) throw new Error('notes d\u2019évaluation non annulées (' + restantes + ' restantes sur ' + nbEvalAvant + ')');
    const t = norm($('#view').textContent);
    if (!/2 devoirs/.test(t)) throw new Error('badge « 2 devoirs » absent de la ligne');
    if (!/40 % \+ 60 % — note calculée/.test(t)) throw new Error('résumé des pourcentages absent');
  });

  await step('saisie : une colonne par devoir, note séquentielle calculée (9,6)', async () => {
    nav(/Saisie des notes/); await wait(500);
    let t = norm($('#view').textContent);
    if (!/Interrogation \(40 %\)/.test(t)) throw new Error('colonne « Interrogation (40 %) » absente');
    if (!/Devoir \(60 %\)/.test(t)) throw new Error('colonne « Devoir (60 %) » absente');
    if (!/Note séquentielle/.test(t)) throw new Error('colonne « Note séquentielle » absente');
    if (!/2 devoirs — note calculée/.test(t)) throw new Error('badge « 2 devoirs — note calculée » absent');
    if (/Note \/ 20/.test(t)) throw new Error('colonne « Note / 20 » encore présente pour une séquence à devoirs');
    const inputs = $$('#view .note-in').filter(i => !i.disabled);
    if (inputs.length !== 24) throw new Error('24 champs attendus (12 élèves × 2 devoirs), trouvé ' + inputs.length);
    setInput(inputs[0], '12'); inputs[0].dispatchEvent(new w.Event('focusout', { bubbles:true }));
    setInput(inputs[1], '8'); inputs[1].dispatchEvent(new w.Event('focusout', { bubbles:true }));
    await wait(700);
    const b = base();
    const nd = b.notes.filter(n => String(n.sequence) === '1' && n.type === 'devoir' && n.devoirId != null);
    if (nd.length !== 2) throw new Error('2 notes de devoir attendues, trouvé ' + nd.length);
    if (!nd.some(n => n.valeur === 12) || !nd.some(n => n.valeur === 8)) throw new Error('valeurs de devoir incorrectes');
    const sq1 = (b.sequences || []).find(s => String(s.id) === '1');
    if (!nd.every(n => sq1.devoirs.some(dv => String(dv.id) === String(n.devoirId))))
      throw new Error('note de devoir mal rattachée à un devoir de la séquence');
    t = norm($('#view').textContent);
    if (!/9,6/.test(t)) throw new Error('note séquentielle calculée 9,6 (0,4×12 + 0,6×8) absente de la grille');
    /* un seul devoir saisi pour un autre élève → prorata */
    setInput(inputs[2], '10'); inputs[2].dispatchEvent(new w.Event('focusout', { bubbles:true }));
    await wait(700);
    t = norm($('#view').textContent);
    if (!/\b10\b/.test(t)) throw new Error('prorata (note du devoir unique) absent');
  });

  await step('saisie par élève : mêmes colonnes de devoirs et note calculée', async () => {
    click($$('#view [role="tab"]').find(b => /Par élève/.test(norm(b.textContent)))); await wait(500);
    const t = norm($('#view').textContent);
    if (!/Interrogation \(40 %\)/.test(t) || !/Devoir \(60 %\)/.test(t)) throw new Error('colonnes de devoirs absentes du mode par élève');
    if (!/Note séq\./.test(t)) throw new Error('colonne « Note séq. » absente du mode par élève');
    if (!/ne figurent pas sur les bulletins/.test(t)) throw new Error('pied d\u2019information devoirs absent');
    click($$('#view [role="tab"]').find(b => /Par matière/.test(norm(b.textContent)))); await wait(400);
  });

  await step('bulletin : notes de devoir invisibles, note séquentielle calculée visible', async () => {
    nav(/Bulletins/); await wait(600);
    const selPeriode = () => $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))));
    setSel(selPeriode(), '1'); await wait(600);
    const row = $$('#view tbody tr').find(r => /\d,\d/.test(norm(r.textContent)));
    if (!row) throw new Error('aucun élève avec moyenne calculée sur la séquence 1');
    click(row.querySelector('button')); await wait(700);
    const t = norm($('#modal-root').textContent);
    if (/Interrogation/.test(t)) throw new Error('libellé de devoir visible dans le bulletin !');
    if (!/9,6/.test(t)) throw new Error('note séquentielle calculée absente du bulletin');
    click($('#modal-root .m-x')); await wait(300);
  });

  await step('scan : attendues = effectif × devoirs, élève complet seulement si tout est saisi', async () => {
    nav(/Saisie des notes/); await wait(500);
    click($$('#view [role="tab"]').find(b => /Notes manquantes/.test(norm(b.textContent)))); await wait(500);
    click($$('#view button').find(b => /Séquence donnée/.test(norm(b.textContent)) && b.closest('.seg'))); await wait(500);
    const kpis = norm($('.scan-kpis').textContent);
    if (!/240 attendues/.test(kpis)) throw new Error('attendues = 12 élèves × 2 devoirs × 10 matières (240) non affichées : ' + kpis.slice(0, 120));
    const t = norm($('#view').textContent);
    if (!/1\/12/.test(t)) throw new Error('saisies « 1/12 » (un seul élève complet) absentes');
    if (!/Partielle/.test(t)) throw new Error('statut « Partielle » absent');
  });

  await step('reconduction : avertissement de rattachement par libellé de devoir', async () => {
    click($$('#view [role="tab"]').find(b => /Par matière/.test(norm(b.textContent)))); await wait(400);
    click($$('#view .card-h button').find(b => /Reconduire/.test(norm(b.textContent)))); await wait(400);
    const m = norm($('#modal-root').textContent);
    if (!/devoir de même libellé/.test(m)) throw new Error('mention de reconduction par libellé absente');
    click($('#modal-root .m-x')); await wait(300);
  });

  await step('retrait d\u2019un devoir : notes supprimées, séquence mise à jour', async () => {
    nav(/Séquences & appréciations/); await wait(500);
    const row1 = $$('#view tbody tr').find(r => /Séquence 1/.test(norm(r.textContent)));
    click(row1.querySelector('button[title^="Devoirs de la séquence"]')); await wait(400);
    if ($$('#modal-root .dv-lib').length !== 2) throw new Error('la modale devrait rouvrir avec 2 devoirs');
    click($$('#modal-root .icon-btn').find(b => (b.title || '') === 'Retirer ce devoir')); await wait(200);
    const pcts = $$('#modal-root .dv-pct');
    if (pcts.length !== 1) throw new Error('1 devoir restant attendu, trouvé ' + pcts.length);
    setInput(pcts[0], '100'); await wait(200);
    if (!/Total : 100 % — correct/.test(norm($('#modal-root').textContent))) throw new Error('total non revenu à 100 %');
    click($$('#modal-root .btn-pri').find(b => /Enregistrer/.test(norm(b.textContent)))); await wait(400);
    const conf = $('#modal-root .btn-danger');
    if (!conf) throw new Error('confirmation de suppression de notes absente');
    if (!/note\(s\) de devoir seront supprimées/.test(norm($('#modal-root').textContent)))
      throw new Error('message de suppression de notes de devoir incomplet');
    click(conf); await wait(600);
    const b = base();
    const sq1 = (b.sequences || []).find(s => String(s.id) === '1');
    if (!sq1.devoirs || sq1.devoirs.length !== 1 || sq1.devoirs[0].pourcentage !== 100)
      throw new Error('1 devoir à 100 % attendu : ' + JSON.stringify(sq1.devoirs));
    /* le premier bouton « Retirer » enlève « Interrogation » : ses 2 notes
       (12 et 10) sont supprimées, il reste la note 8 du devoir conservé */
    const nd = b.notes.filter(n => String(n.sequence) === '1' && n.type === 'devoir');
    if (nd.length !== 1) throw new Error('notes du devoir retiré non supprimées (' + nd.length + ' restante(s), 1 attendue)');
    if (nd[0].valeur !== 8 || String(nd[0].devoirId) !== String(sq1.devoirs[0].id))
      throw new Error('note restante mal rattachée : ' + JSON.stringify(nd[0]));
    const t = norm($('#view').textContent);
    if (!/1 devoir/.test(t)) throw new Error('badge « 1 devoir » absent');
  });

  console.log(fails ? '\n=== SMOKE TEST v6.5 : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v6.5 : OK ===');
  if (errors.length){ console.error('Erreurs runtime :'); errors.slice(0, 10).forEach(e => console.error('  ' + e)); }
  w.close(); process.exit(fails || errors.length ? 1 : 0);
})();
