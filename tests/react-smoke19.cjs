/* Smoke v5.0 — séquences & appréciations (CRUD, poids), saisie des notes
   restreinte au plan de la classe, moyennes devoir/composition, appréciations
   automatiques, statistiques, bordereau imprimable (autoPrint), reconduction
   des notes vers une autre séquence, annulation des notes d'un élève,
   bulletins par période (année / trimestre / séquence). */
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

(async () => {
  await wait(700);

  await step('configuration : séquences par défaut, poids trimestriels = 100 %', async () => {
    await login('admin', 'admin2026');
    nav(/Séquences & appréciations/); await wait(500);
    const t = norm($('#view').textContent);
    if (!/Séquences de l'année/.test(t)) throw new Error('section séquences absente');
    if (!/Le total des poids par trimestre doit faire 100 %/.test(t)) throw new Error('règle des poids absente');
    if (!/Séquence 1/.test(t) || !/Séquence 6/.test(t)) throw new Error('séquences par défaut absentes');
    const kpis = $$('.kpi').map(k => norm(k.textContent));
    if (kpis.filter(k => /100 %/.test(k)).length !== 3) throw new Error('poids trimestriels ≠ 100 % : ' + kpis.join(' | '));
    if (!/40 %/.test(t) || !/60 %/.test(t)) throw new Error('poids 40/60 absents');
  });

  await step('configuration : onglet appréciations, fourchettes par défaut', async () => {
    click($$('.tab').find(b => /Appréciations/.test(norm(b.textContent)))); await wait(400);
    const t = norm($('#view').textContent);
    for (const mot of ['Insuffisant', 'Passable', 'Assez bien', 'Bien', 'Très bien', 'Excellent']){
      if (!t.includes(mot)) throw new Error('appréciation manquante : ' + mot);
    }
    if (!/0 – 10/.test(t) || !/18 – 20/.test(t)) throw new Error('fourchettes min–max absentes');
    if (!/min ≤ note < max/.test(t)) throw new Error('règle des fourchettes absente');
  });

  await step('configuration : création puis suppression d\u2019une séquence (T3, 20 %)', async () => {
    click($$('.tab').find(b => /Séquences/.test(norm(b.textContent)) && !/Appréciations/.test(norm(b.textContent)))); await wait(400);
    click($$('#view button').find(b => /Nouvelle séquence/.test(norm(b.textContent)))); await wait(400);
    setInput($('#ff-libelle'), 'Séquence 7');
    setSel($('#ff-trimestre'), '3');
    setInput($('#ff-poids'), '20');
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    let row = $$('#view tbody tr').find(r => /Séquence 7/.test(norm(r.textContent)));
    if (!row) throw new Error('séquence 7 non créée');
    if (!/120 %/.test(norm($('#view').textContent))) throw new Error('total T3 non recalculé à 120 %');
    const b = base();
    if ((b.sequences || []).length !== 7) throw new Error('7e séquence absente du stockage');
    /* suppression (bloquée si notes rattachées — pas de note sur la 7) */
    click(row.querySelector('button[title="Supprimer"]')); await wait(300);
    click($('#modal-root .btn-danger')); await wait(500);
    if ($$('#view tbody tr').some(r => /Séquence 7/.test(norm(r.textContent)))) throw new Error('séquence 7 non supprimée');
    if (!/100 %/.test(norm($('.kpis').textContent))) throw new Error('T3 non revenu à 100 %');
  });

  await step('configuration : modification d\u2019une fourchette + garde-fou chevauchement', async () => {
    click($$('.tab').find(b => /Appréciations/.test(norm(b.textContent)))); await wait(400);
    const rowBien = $$('#view tbody tr').find(r => />Bien</.test(r.innerHTML));
    if (!rowBien) throw new Error('ligne « Bien » introuvable');
    click(rowBien.querySelector('button[title="Modifier"]')); await wait(400);
    setInput($('#ff-max'), '15.5');
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    if (!/14 – 15,5/.test(norm($('#view').textContent))) throw new Error('fourchette non mise à jour');
    click($$('#view tbody tr').find(r => />Bien</.test(r.innerHTML)).querySelector('button[title="Modifier"]')); await wait(400);
    setInput($('#ff-max'), '16');
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    /* chevauchement refusé : 15–17 empiète sur 14–16 et 16–18 */
    click($$('#view button').find(b => /Nouvelle appréciation/.test(norm(b.textContent)))); await wait(400);
    setInput($('#ff-min'), '15'); setInput($('#ff-max'), '17'); setInput($('#ff-libelle'), 'Test chevauchement');
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    if (!$('#toast-root .toast.t-err')) throw new Error('chevauchement accepté à tort');
    click($$('#modal-root button').find(b => /Annuler/.test(norm(b.textContent)))); await wait(300);
  });

  await step('saisie : matières limitées au plan de la classe, élèves actualisés', async () => {
    nav(/Saisie des notes/); await wait(500);
    const t = norm($('#view').textContent);
    if (!/plan de la classe/.test(t)) throw new Error('mention « plan de la classe » absente');
    const sels = $$('#view select');
    if (sels.length !== 3) throw new Error('3 sélecteurs attendus (classe/matière/séquence), trouvé ' + sels.length);
    const matOpts = [...sels[1].options].map(o => norm(o.textContent));
    if (matOpts.length !== 10) throw new Error('10 matières attendues au plan de 6ème A, trouvé ' + matOpts.length);
    if (!matOpts.some(o => /Mathématiques/.test(o))) throw new Error('Mathématiques absentes');
    if (!matOpts.some(o => /Français/.test(o))) throw new Error('Français (au plan) absent');
    if (matOpts.some(o => /Littérature|Latin|Allemand/.test(o))) throw new Error('matière hors plan proposée');
    const seqOpts = [...sels[2].options].map(o => norm(o.textContent));
    if (seqOpts.length !== 6 || !/T1/.test(seqOpts[0]) || !/40 %/.test(seqOpts[0])) throw new Error('séquences mal proposées : ' + seqOpts.join('|'));
    const rows = $$('#view tbody tr').length;
    if (rows !== 12) throw new Error('12 élèves attendus dans 6ème A, trouvé ' + rows);
    /* changement de classe → la liste des élèves suit */
    const clOpts = [...sels[0].options].map(o => o.value);
    setSel(sels[0], clOpts.find(v => v !== sels[0].value)); await wait(500);
    const rows2 = $$('#view tbody tr').length;
    if (rows2 === rows) throw new Error('liste d\u2019élèves inchangée après changement de classe');
    setSel(sels[0], clOpts[0]); await wait(500);
  });

  await step('saisie : une seule note par séquence (v5.4), appréciations auto', async () => {
    const sels = $$('#view select');
    setSel(sels[2], [...sels[2].options].find(o => /Séquence 5/.test(norm(o.textContent))).value); await wait(400);
    const inputs = $$('#view .note-in').filter(i => !i.disabled);
    if (inputs.length !== 12) throw new Error('un champ par élève attendu (12), trouvé ' + inputs.length);
    setInput(inputs[0], '12'); inputs[0].dispatchEvent(new w.Event('focusout', { bubbles:true }));
    setInput(inputs[1], '8.5'); inputs[1].dispatchEvent(new w.Event('focusout', { bubbles:true }));
    setInput(inputs[2], '16'); inputs[2].dispatchEvent(new w.Event('focusout', { bubbles:true }));
    await wait(600);
    const b = base();
    const ns = (b.notes || []).filter(n => String(n.sequence) === '5');
    if (ns.length !== 3) throw new Error('3 notes attendues sur la séquence 5, trouvé ' + ns.length);
    if (!ns.every(n => typeof n.sequence === 'string')) throw new Error('séquence non stockée en chaîne');
    if (!ns.every(n => n.type === 'evaluation')) throw new Error('type inattendu : ' + ns.map(n => n.type).join(','));
    if (!ns.some(n => n.valeur === 12) || !ns.some(n => n.valeur === 8.5) || !ns.some(n => n.valeur === 16)) throw new Error('valeurs incorrectes');
    const t = norm($('#view').textContent);
    for (const mot of ['Assez bien', 'Insuffisant', 'Très bien']) if (!t.includes(mot)) throw new Error('appréciation auto manquante : ' + mot);
    if (!/3\/12/.test(t)) throw new Error('compteur 3/12 absent');
    if (!/67 %/.test(t)) throw new Error('pourcentage ≥10 incorrect');
  });

  await step('saisie : modification de note (normalisation une note unique)', async () => {
    const inputs = $$('#view .note-in');
    setInput(inputs[1], '11'); inputs[1].dispatchEvent(new w.Event('focusout', { bubbles:true }));
    await wait(600);
    const b = base();
    const ns = (b.notes || []).filter(n => String(n.sequence) === '5');
    if (ns.length !== 3) throw new Error('toujours 3 notes attendues (mise à jour en place), trouvé ' + ns.length);
    if (!ns.some(n => n.valeur === 11) || ns.some(n => n.valeur === 8.5)) throw new Error('note 8,5 non remplacée par 11');
    const t = norm($('#view').textContent);
    if (!/3\/12/.test(t)) throw new Error('compteur 3/12 absent après modification');
  });

  await step('statistiques : modale complète (moyenne, min/max, répartition)', async () => {
    click($$('#view .card-h button').find(b => /Statistiques/.test(norm(b.textContent)))); await wait(500);
    const m = norm($('#modal-root').textContent);
    for (const mot of ['Moyenne de la classe', 'Note la plus basse', 'Note la plus haute', 'Répartition par appréciation', '≥ 10 / 20']){
      if (!m.includes(mot)) throw new Error('statistique manquante : ' + mot);
    }
    if (!m.includes('13')) throw new Error('moyenne de classe 13 absente (12+11+16)/3');
    click($$('#modal-root button').find(b => /Fermer/.test(norm(b.textContent)))); await wait(300);
  });

  await step('bordereau : impression directe (autoPrint) du document complet', async () => {
    click($$('#view .card-h button').find(b => /Imprimer le bordereau/.test(norm(b.textContent)))); await wait(1100);
    const m = norm($('#modal-root').textContent);
    for (const mot of ['Bordereau de notes', 'Matricule', 'Note /20', 'Appréciation', 'préfet des études', 'Moyenne de la classe']){
      if (!m.includes(mot)) throw new Error('élément du bordereau manquant : ' + mot);
    }
    if (printed < 1) throw new Error('impression directe non déclenchée');
    if (!$('#print-host')) throw new Error('zone d\u2019impression absente');
    if ($$('#print-host tbody tr').length !== 12) throw new Error('bordereau incomplet : ' + $$('#print-host tbody tr').length + ' lignes');
    click($$('#modal-root button').find(b => /Fermer/.test(norm(b.textContent)))); await wait(400);
  });

  await step('reconduction : copie des notes de la séquence 5 vers la séquence 6', async () => {
    click($$('#view .card-h button').find(b => /Reconduire/.test(norm(b.textContent)))); await wait(400);
    const m = norm($('#modal-root').textContent);
    if (!/Reconduire les notes/.test(m) || !/Séquence cible/.test(m)) throw new Error('modale de reconduction incomplète');
    const target = $$('#modal-root select')[0];
    const opts = [...target.options].map(o => norm(o.textContent));
    if (opts.some(o => /Séquence 5/.test(o))) throw new Error('séquence source proposée comme cible');
    setSel(target, [...target.options].find(o => /Séquence 6/.test(norm(o.textContent))).value);
    click($$('#modal-root .btn-pri').find(b => /Reconduire/.test(norm(b.textContent)))); await wait(400);
    click($$('#modal-root .btn-pri').find(b => /Reconduire/.test(norm(b.textContent)))); await wait(600);
    const b = base();
    const seq6 = (b.notes || []).filter(n => String(n.sequence) === '6');
    if (seq6.length !== 3) throw new Error('3 notes attendues sur la séquence 6, trouvé ' + seq6.length);
    if (!seq6.some(n => n.valeur === 12) || !seq6.some(n => n.valeur === 11) || !seq6.some(n => n.valeur === 16)) throw new Error('valeurs reconduites incorrectes');
    if (!norm(d.body.textContent).includes('reconduite')) throw new Error('toast de reconduction absent');
    /* bascule sur la séquence 6 : les valeurs sont là */
    const sels = $$('#view select');
    const seqOpt = [...sels[2].options].find(o => /Séquence 6/.test(norm(o.textContent)));
    setSel(sels[2], seqOpt.value); await wait(500);
    const vals = $$('#view .note-in').slice(0, 3).map(i => i.value);
    if (vals.join(',') !== '12,11,16') throw new Error('notes reconduites non visibles : ' + vals.join(','));
  });

  await step('annulation : effacement des notes d\u2019un élève (matière + séquence)', async () => {
    const row = $$('#view tbody tr')[0];
    click(row.querySelector('button[title^="Annuler la note"]')); await wait(300);
    const m = norm($('#modal-root').textContent);
    if (!/Annuler la note/.test(m)) throw new Error('modale d\u2019annulation absente');
    click($('#modal-root .btn-danger')); await wait(600);
    const b = base();
    const rest = (b.notes || []).filter(n => String(n.sequence) === '6');
    if (rest.length !== 2) throw new Error('3 - 1 note attendue sur la séquence 6 après annulation, trouvé ' + rest.length);
    if ($$('#view .note-in')[0].value !== '') throw new Error('champ non vidé après annulation');
    if (!/note\(s\) annulée\(s\)/.test(norm(d.body.textContent))) throw new Error('toast d\u2019annulation absent');
  });

  await step('bulletins : périodes année/trimestre/séquence + colonne appréciation', async () => {
    nav(/Bulletins/); await wait(500);
    const selPer = $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))));
    if (!selPer) throw new Error('sélecteur de période absent');
    const optLabels = [...selPer.options].map(o => norm(o.textContent));
    if (!optLabels.some(o => /Trimestre 1/.test(o)) || !optLabels.some(o => /Séquence 1/.test(o))) throw new Error('options de période incomplètes : ' + optLabels.join('|'));
    setSel(selPer, 'T1'); await wait(500);
    const t = norm($('#view').textContent);
    if (!/Appréciation/.test(t)) throw new Error('colonne appréciation absente');
    if (!/Trimestre 1/.test(t)) throw new Error('libellé de période absent');
    if (!$$('.badge').length) throw new Error('aucun badge d\u2019appréciation');
  });

  await step('enseignant : page séquences cachée, matières = plan ∩ ses enseignements', async () => {
    await login('enseignant', 'enseignant2026');
    if (navLabels().some(l => /Séquences & appréciations/.test(l))) throw new Error('menu séquences visible pour l\u2019enseignant');
    nav(/Saisie des notes/); await wait(500);
    const sels = $$('#view select');
    const matOpts = [...sels[1].options].map(o => norm(o.textContent));
    if (!matOpts.length) throw new Error('aucune matière proposée');
    if (matOpts.some(o => /Français|HGEO|SVT|EPS/.test(o))) throw new Error('matière hors périmètre proposée : ' + matOpts.join('|'));
    if (!matOpts.some(o => /Mathématiques|Anglais/.test(o))) throw new Error('matière enseignée absente');
    const inputs = $$('#view .note-in').filter(i => !i.disabled);
    if (!inputs.length) throw new Error('saisie non autorisée pour l\u2019enseignant');
  });

  await step('profil lecteur : consultation seule, aucun champ actif', async () => {
    await login('lecteur', 'lecteur2026');
    nav(/Saisie des notes/); await wait(500);
    if (!$$('#view .note-in').length) throw new Error('grille absente');
    if ($$('#view .note-in').some(i => !i.disabled)) throw new Error('champ actif pour un lecteur');
    if (!/Consultation seule/.test(norm($('#view').textContent))) throw new Error('bandeau consultation absente');
  });

  await wait(400);
  if (errors.length){ console.error('✗ erreurs React :', errors.slice(0, 4)); fails++; }
  else console.log('✓ aucune erreur React pendant tout le parcours');

  console.log(fails ? '\n=== SMOKE v5.0 NOTES : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v5.0 NOTES & SÉQUENCES : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
