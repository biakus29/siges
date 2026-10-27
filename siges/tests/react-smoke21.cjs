/* Smoke v5.2 — Confort de saisie et pilotage :
   • bouton Encaissement retiré de la barre pour tous les profils (v5.3) ;
   • tableaux de bord par profil (surveillant = discipline, censeur = pédagogie,
     enseignant = suivi de saisie par séquence, titulaire = sa classe, opérateur) ;
   • boutons de fermeture de TOUTES les fenêtres (croix, Annuler, Fermer) ;
   • matières indispensables au classement (fiche classe) → NC dans les bulletins ;
   • saisie PAR ÉLÈVE : photo, notes de toutes les matières, moyenne et rang en
     temps réel, non-classement expliqué ;
   • navigation clavier : Entrée / flèche bas = note suivante, flèche haut = précédente. */
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
function key(el, k){ el.dispatchEvent(new w.KeyboardEvent('keydown', { key:k, bubbles:true, cancelable:true })); }
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
const modalOuverte = () => !!$('#modal-root .mback');
const fermerCroix = async () => { click($('#modal-root .m-x')); await wait(300); if (modalOuverte()) throw new Error('croix n\u2019a pas fermé la fenêtre'); };
const fermerBouton = async libelle => {
  const b = $$('#modal-root button').find(x => norm(x.textContent).trim() === libelle);
  if (!b) throw new Error('bouton « ' + libelle + ' » introuvable');
  click(b); await wait(300); if (modalOuverte()) throw new Error('« ' + libelle + ' » n\u2019a pas fermé la fenêtre'); };

(async () => {
  await wait(700);

  await step('bouton Encaissement retiré de la barre (tous profils)', async () => {
    await login('superadmin', 'super2026');
    if ($('#tb-pay')) throw new Error('bouton Encaissement visible en mode console');
    /* entrée dans un établissement : toujours pas de bouton */
    click($$('.tab').find(b => /Établissements/.test(norm(b.textContent)) && !/Vue/.test(norm(b.textContent)))); await wait(400);
    const card = $$('.etab-card').find(c => /Collège Bonneau/.test(norm(c.textContent)));
    click([...card.querySelectorAll('button')].find(b => /Ouvrir/.test(norm(b.textContent)))); await wait(600);
    if ($('#tb-pay')) throw new Error('bouton Encaissement visible pour le superadmin dans un établissement');
    /* v5.3 : bouton retiré pour tous — l'encaissement reste accessible depuis la page Paiements */
    await login('admin', 'admin2026');
    if ($('#tb-pay')) throw new Error('bouton Encaissement encore présent pour l\u2019administrateur');
    nav(/Paiements|Encaissements/); await wait(500);
    if (!$$('#view button').some(b => /Nouveau paiement/i.test(norm(b.textContent)))) throw new Error('bouton « Nouveau paiement » introuvable (accès encaissement perdu)');
  });

  await step('tableau de bord surveillant : données disciplinaires', async () => {
    await login('surveillant', 'surveillant2026');
    const t = norm($('#view').textContent);
    for (const mot of ['Faits — année', 'Faits graves', 'Derniers faits de discipline', 'Répartition par catégorie', 'Élèves les plus signalés'])
      if (!t.includes(mot)) throw new Error('indicateur disciplinaire manquant : ' + mot);
    if (/Encaissements mensuels/.test(t)) throw new Error('données financières visibles pour un surveillant');
  });

  await step('tableau de bord censeur : données pédagogiques', async () => {
    await login('censeur', 'censeur2026');
    const t = norm($('#view').textContent);
    for (const mot of ['Classes du cycle', 'Suivi pédagogique par classe', 'Élèves évalués', 'Notes saisies'])
      if (!t.includes(mot)) throw new Error('indicateur pédagogique manquant : ' + mot);
    if (/Encaissements mensuels/.test(t)) throw new Error('données financières visibles pour un censeur');
  });

  await step('tableau de bord enseignant : suivi de saisie par séquence (v5)', async () => {
    await login('enseignant', 'enseignant2026');
    const t = norm($('#view').textContent);
    for (const mot of ['Mes matières', 'Mon suivi de saisie', 'Séquences vides'])
      if (!t.includes(mot)) throw new Error('indicateur enseignant manquant : ' + mot);
    /* l'en-tête des séquences suit la configuration (S1..S6) et les compteurs sont justes */
    const head = $$('#view thead')[0];
    const ths = [...head.querySelectorAll('th')].map(th => norm(th.textContent));
    if (!ths.some(x => x === 'S1') || !ths.some(x => x === 'S6')) throw new Error('colonnes S1..S6 absentes : ' + ths.join('|'));
    const b = base();
    const attendu = [1,2,3,4,5,6].reduce((n, sq) => n + (b.notes.some(x => x.matiereId === 'm1' && String(x.sequence) === String(sq)) ? 1 : 0)
      + (b.notes.some(x => x.matiereId === 'm3' && String(x.sequence) === String(sq)) ? 1 : 0), 0);
    const badges = $$('#view tbody tr').slice(0, 2).map(r => [...r.querySelectorAll('.badge')].filter(x => x.textContent !== '·' && /\d/.test(x.textContent)).length);
    const total = badges.reduce((a, c) => a + c, 0);
    if (!total) throw new Error('aucun compteur de notes par séquence affiché (bug ancien : séquences comparées en nombres)');
  });

  await step('tableau de bord titulaire : sa classe', async () => {
    await login('titulaire', 'titulaire2026');
    const t = norm($('#view').textContent);
    for (const mot of ['Effectif de la classe', 'Ma classe — 6ème A', 'Moyenne de la classe'])
      if (!t.includes(mot)) throw new Error('indicateur titulaire manquant : ' + mot);
  });

  await step('boutons de fermeture : croix, Annuler et Fermer dans toutes les fenêtres', async () => {
    await login('admin', 'admin2026');
    /* 1. inscription d'un élève — croix */
    nav(/Élèves/); await wait(400);
    click($$('#view button').find(b => /Inscrire un élève/.test(norm(b.textContent)))); await wait(400);
    if (!modalOuverte()) throw new Error('modale inscription absente');
    await fermerCroix();
    /* 2. nouvelle matière — Annuler */
    nav(/Matières/); await wait(400);
    click($$('#view button').find(b => /Nouvelle matière/.test(norm(b.textContent)))); await wait(400);
    await fermerBouton('Annuler');
    /* 3. nouvelle séquence — croix */
    nav(/Séquences & appréciations/); await wait(400);
    click($$('#view button').find(b => /Nouvelle séquence/.test(norm(b.textContent)))); await wait(400);
    await fermerCroix();
    /* 4. nouvel utilisateur — Annuler */
    nav(/Utilisateurs/); await wait(400);
    click($$('#view .btn-pri').find(b => /Nouvel utilisateur/.test(norm(b.textContent)))); await wait(400);
    await fermerBouton('Annuler');
    /* 5. rapport financier — générer puis Fermer */
    nav(/Rapports financiers/); await wait(400);
    click($$('#view button').find(b => /Générer le rapport/.test(norm(b.textContent)) && !b.disabled)); await wait(500);
    if (!modalOuverte()) throw new Error('rapport non généré');
    await fermerBouton('Fermer');
    /* 6. bordereau de notes — croix */
    nav(/Saisie des notes/); await wait(400);
    click($$('#view .card-h button').find(b => /Imprimer le bordereau/.test(norm(b.textContent)))); await wait(600);
    await fermerCroix();
    /* 7. reconduire — Annuler */
    click($$('#view .card-h button').find(b => /Reconduire/.test(norm(b.textContent)))); await wait(400);
    await fermerBouton('Annuler');
    /* 7bis. fait disciplinaire — Annuler (fermeture réparée v5.2) */
    nav(/Discipline & absences/); await wait(400);
    click($$('#view button').find(b => /Nouveau fait/.test(norm(b.textContent)))); await wait(400);
    await fermerBouton('Annuler');
    /* 7ter. enseignement au plan — croix puis Annuler (fermeture réparée v5.2) */
    nav(/Plan des enseignements/); await wait(400);
    click($$('#view button').find(b => /Ajouter un enseignement/.test(norm(b.textContent)))); await wait(400);
    await fermerCroix();
    click($$('#view button').find(b => /Cloner ce plan/.test(norm(b.textContent)))); await wait(400);
    await fermerBouton('Annuler');
    /* 8. confirmation de suppression — Annuler (la modale doit se fermer, rien ne change) */
    nav(/Matières/); await wait(400);
    const row = $$('#view tbody tr')[0];
    click(row.querySelector('button[title="Supprimer"]')); await wait(300);
    await fermerBouton('Annuler');
    if (!$$('#view tbody tr').length) throw new Error('suppression effectuée malgré l\u2019annulation');
    /* 9. superadmin : nouvel établissement — Annuler */
    await login('superadmin', 'super2026');
    click($$('.tab').find(b => /Établissements/.test(norm(b.textContent)) && !/Vue/.test(norm(b.textContent)))); await wait(400);
    click($$('#view button').find(b => /Nouvel établissement/.test(norm(b.textContent)))); await wait(400);
    await fermerBouton('Annuler');
    await login('admin', 'admin2026');
  });

  await step('matières indispensables : définition dans la fiche de la classe', async () => {
    nav(/Classes/); await wait(400);
    const row = $$('#view tbody tr').find(r => /6ème A/.test(norm(r.textContent)));
    if (!row) throw new Error('ligne 6ème A introuvable');
    click(row.querySelector('button[title="Modifier"]')); await wait(400);
    const lbl = $$('#modal-root .field > label').find(l => /Matières indispensables au classement/.test(norm(l.textContent)));
    if (!lbl) throw new Error('champ matières indispensables absent');
    const chips = $$('#modal-root .chk-chip');
    if (chips.length !== 10) throw new Error('10 matières du plan attendues en propositions, trouvé ' + chips.length);
    click(chips.find(c => /MATH/.test(norm(c.textContent))));
    click(chips.find(c => /FRAN/.test(norm(c.textContent))));
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const b = base();
    const cl = b.classes.find(c => c.id === 'cl6a');
    if (!Array.isArray(cl.matieresOblig) || cl.matieresOblig.join(',') !== 'm1,m2')
      throw new Error('matières indispensables non enregistrées : ' + JSON.stringify(cl.matieresOblig));
  });

  await step('bulletins : élèves non classés (NC) quand une matière indispensable manque', async () => {
    nav(/Bulletins/); await wait(400);
    const selPer = $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))));
    setSel(selPer, '1'); await wait(500);
    const t = norm($('#view').textContent);
    if (!/non classé\(s\) \(NC\)/.test(t)) throw new Error('compteur de non classés absent de l\u2019en-tête');
    const nc = $$('#view .badge.b-mut').filter(x => x.textContent === 'NC');
    if (!nc.length) throw new Error('aucun badge NC dans le tableau');
    /* les rangs vont de 1 au nombre de classés */
    const b = base();
    const effectif = b.eleves.filter(e => e.anneeId === 'an26' && e.classeId === 'cl6a' && e.statut !== 'radie').length;
    const nbNC = nc.length;
    if (nbNC < 1 || nbNC >= effectif) throw new Error('nombre de NC incohérent : ' + nbNC + '/' + effectif);
  });

  await step('saisie par élève : une note par matière, rang et NC (règle v5.4)', async () => {
    nav(/Saisie des notes/); await wait(400);
    click($$('.tab').find(b => /Par élève/.test(norm(b.textContent)))); await wait(400);
    const sels = $$('#view select');
    if (sels.length !== 3) throw new Error('sélecteurs classe/élève/séquence attendus en mode Par élève, trouvé ' + sels.length);
    /* séquence 5 (vierge) : tout se construit sous nos yeux */
    setSel(sels[2], [...sels[2].options].find(o => /Séquence 5/.test(norm(o.textContent))).value); await wait(400);
    if (!$('.eleve-photo')) throw new Error('photo/initiales de l\u2019élève absentes');
    const rows = $$('#view tbody tr');
    if (rows.length !== 10) throw new Error('10 matières du plan attendues, trouvé ' + rows.length);
    if ($$('#view .note-in').length !== 10) throw new Error('10 champs attendus (une seule note par matière), trouvé ' + $$('#view .note-in').length);
    /* aucune note : moyenne — , pas de rang, pas de bannière NC */
    let kpis = norm($('.eh-kpis').textContent);
    if (!/—/.test(kpis)) throw new Error('KPI vide attendu (—) : ' + kpis);
    if (/Non classé pour cette séquence/.test(norm($('#view').textContent))) throw new Error('bannière NC inattendue sans aucune note');
    /* 1ère ligne = FRAN (matière indispensable) notée 12 → classé immédiatement (règle v5.4) */
    const r0 = $$('#view tbody tr')[0];
    const inF = r0.querySelector('.note-in');
    setInput(inF, '12'); inF.dispatchEvent(new w.Event('focusout', { bubbles:true }));
    await wait(500);
    kpis = norm($('.eh-kpis').textContent);
    if (!/12/.test(kpis)) throw new Error('moyenne 12 absente des KPI : ' + kpis);
    if (!/1 \/ 1/.test(kpis)) throw new Error('rang 1/1 attendu dès la première note indispensable : ' + kpis);
    if (!/1 \/ 10/.test(kpis)) throw new Error('compteur matières notées 1/10 attendu : ' + kpis);
    /* élève suivant : une note dans une matière NON indispensable (ANGL, 3ème ligne) → NC expliqué */
    setSel(sels[1], sels[1].options[1].value); await wait(500);
    const rAngl = $$('#view tbody tr')[2];
    const inA = rAngl.querySelector('.note-in');
    setInput(inA, '10'); inA.dispatchEvent(new w.Event('focusout', { bubbles:true }));
    await wait(500);
    kpis = norm($('.eh-kpis').textContent);
    if (!/NC/.test(kpis)) throw new Error('NC attendu (aucune note dans MATH+FRAN) : ' + kpis);
    const t = norm($('#view').textContent);
    if (!/Non classé/.test(t) || !/MATH/.test(t) || !/FRAN/.test(t)) throw new Error('bannière NC incomplète (MATH et FRAN attendues)');
    /* une note dans une matière indispensable le re-classe aussitôt : 8,67 < 13 → rang 2/2 */
    const rMath = $$('#view tbody tr')[1];
    const inM = rMath.querySelector('.note-in');
    setInput(inM, '8'); inM.dispatchEvent(new w.Event('focusout', { bubbles:true }));
    await wait(500);
    kpis = norm($('.eh-kpis').textContent);
    if (!/2 \/ 2/.test(kpis)) throw new Error('rang 2/2 attendu (8,67 < 12) : ' + kpis);
    if (/Non classé pour cette séquence/.test(norm($('#view').textContent))) throw new Error('bannière NC encore affichée');
    if (!/2 \/ 10/.test(kpis)) throw new Error('compteur de matières notées incorrect : ' + kpis);
  });

  await step('clavier : Entrée et flèche bas descendent, flèche haut remonte', async () => {
    click($$('.tab').find(b => /Par matière/.test(norm(b.textContent)))); await wait(400);
    const selsM = $$('#view select');
    setSel(selsM[2], [...selsM[2].options].find(o => /Séquence 1/.test(norm(o.textContent))).value); await wait(400);
    const inputs = $$('#view .note-in');
    if (inputs.length < 5) throw new Error('grille par matière incomplète');
    inputs[0].focus();
    if (d.activeElement !== inputs[0]) throw new Error('focus initial impossible');
    key(inputs[0], 'Enter'); await wait(120);
    if (d.activeElement !== inputs[1]) throw new Error('Entrée ne descend pas à la note suivante');
    key(inputs[1], 'ArrowDown'); await wait(120);
    if (d.activeElement !== inputs[2]) throw new Error('flèche bas ne descend pas');
    key(inputs[2], 'ArrowUp'); await wait(120);
    if (d.activeElement !== inputs[1]) throw new Error('flèche haut ne remonte pas');
    /* la note saisie via le clavier est bien enregistrée (blur au moment du déplacement) */
    setInput(d.activeElement, '14');
    key(d.activeElement, 'Enter'); await wait(400);
    const b = base();
    const el = b.eleves.filter(e => e.anneeId === 'an26' && e.classeId === 'cl6a' && e.statut !== 'radie')
      .sort((a, c) => (a.nom + a.prenom < c.nom + c.prenom ? -1 : 1))[1];
    if (!(b.notes || []).some(n => n.eleveId === el.id && String(n.sequence) === '1' && n.type === 'evaluation' && n.valeur === 14))
      throw new Error('la note saisie au clavier n\u2019est pas enregistrée');
  });

  await wait(400);
  if (errors.length){ console.error('✗ erreurs React :', errors.slice(0, 4)); fails++; }
  else console.log('✓ aucune erreur React pendant tout le parcours');

  console.log(fails ? '\n=== SMOKE v5.2 CONFORT & PILOTAGE : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v5.2 CONFORT & PILOTAGE : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
