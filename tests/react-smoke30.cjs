/* Smoke v8.0 — COMPÉTENCES ÉVALUÉES + ASSIDUITÉ PAR ÉVALUATION + COMPTES ENSEIGNANTS :
   • page « Compétences » (Pédagogie) : lecture des compétences de la graine,
     création et suppression (classe × trimestre × matière) ;
   • champ compétence sous chaque matière du bulletin (T1, classe avec saisie) ;
   • compte enseignant créé AUTOMATIQUEMENT à la création de la fiche :
     login = matricule, mot de passe initial = matricule ;
   • premier changement de mot de passe OBLIGATOIRE (fenêtre bloquante),
     puis connexion refusée avec l'ancien mot de passe ;
   • Discipline → onglet « Par évaluation » : grille de saisie (absences NJ/J,
     retards, consignes), enregistrement, cumuls affichés ;
   • pied de page « Version React 8.0 ». */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const crypto = require('crypto');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {}; w.print = () => {};
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
const base = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
  return (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls; };
const dbRoot = () => JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }
async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(700);
  if (!$('#app')) throw new Error('connexion refusée pour ' + u);
}

(async () => {
  await wait(700);
  await login('admin', 'admin2026');

  await step('pied de page : Version React 8.0', () => {
    if (!/Version React 8\.1/.test(norm($('footer.app-foot').textContent))) throw new Error('version du pied de page incorrecte');
  });

  /* ---------- 1. Page Compétences ---------- */
  await step('navigation : entrée « Compétences » (groupe Pédagogie)', async () => {
    const it = $$('.nav-i').find(n => /Compétences/.test(norm(n.textContent)));
    if (!it) throw new Error('entrée de menu Compétences absente');
    click(it); await wait(400);
    if (!/Compétences évaluées/.test(norm($('#view').textContent))) throw new Error('page Compétences non affichée');
  });
  await step('compétences de la graine : 3 matières pour la 6ème A au T1', async () => {
    const sels = $$('#view select');
    setSel(sels[0], [...sels[0].options].find(o => /6ème A/.test(norm(o.textContent))).value);
    await wait(300);
    const rows = $$('#view tbody tr');
    if (rows.length !== 3) throw new Error('3 compétences attendues (m1/m2/m3), trouvé ' + rows.length);
    const t = norm($('#view').textContent);
    if (!/Compétence\(s\) évaluée\(s\)/.test(t) || !/décimaux/.test(t)) throw new Error('lignes de compétences absentes du tableau');
  });
  await step('création d\u2019une compétence (2 lignes) via la fenêtre', async () => {
    click($$('#view button').find(b => /Nouvelle compétence/.test(norm(b.textContent)))); await wait(300);
    const ta = $$('#modal-root textarea');
    if (ta.length !== 2) throw new Error('2 zones de texte attendues (ligne 1 + ligne 2), trouvé ' + ta.length);
    setInput(ta[0], 'Reconnaître les figures symétriques.');
    setInput(ta[1], 'Construire le symétrique d\u2019une figure simple.');
    click($$('#modal-root button').find(b => /Créer la compétence/.test(norm(b.textContent)))); await wait(400);
    if ($$('#view tbody tr').length !== 4) throw new Error('compétence non ajoutée (attendu 4 lignes)');
    const b = base();
    if ((b.competences || []).length !== 7) throw new Error('7 compétences attendues en base, trouvé ' + (b.competences || []).length);
    if (!b.competences.some(c => (c.lignes || []).join('|').includes('symétriques'))) throw new Error('lignes saisies introuvables');
  });
  await step('suppression de la compétence créée', async () => {
    const row = $$('#view tbody tr').find(r => /symétriques/.test(norm(r.textContent)));
    if (!row) throw new Error('ligne créée introuvable dans le tableau');
    click(row.querySelector('.icon-btn[title="Supprimer"]')); await wait(300);
    click($$('#modal-root button').find(b => norm(b.textContent).trim() === 'Supprimer')); await wait(400);
    if ($$('#view tbody tr').length !== 3) throw new Error('compétence non supprimée');
    if ((base().competences || []).length !== 6) throw new Error('base non mise à jour après suppression');
    if (!base().competences.some(c => c.matiereId === 'm1' && c.trimestre === 1)) throw new Error('la compétence MATIÈRE (m1) de la graine a été supprimée à la place !');
  });
  await step('validation : matière déjà saisie au trimestre non proposée en doublon', async () => {
    click($$('#view button').find(b => /Nouvelle compétence/.test(norm(b.textContent)))); await wait(300);
    const sel = $$('#modal-root select')[0];
    if (!sel) throw new Error('sélecteur de matière absent');
    if ([...sel.options].some(o => /MATH/.test(norm(o.textContent))))
      throw new Error('la matière MATH (déjà saisie au T1) est encore proposée : doublon possible');
    if ((base().competences || []).length !== 6) throw new Error('état de la base modifié');
    click($('#modal-root .m-x')); await wait(200);
  });

  /* ---------- 2. Compte enseignant automatique ---------- */
  let matEns = 'ENS-999';
  await step('fiche enseignant → compte automatique (login = matricule, mdp = matricule)', async () => {
    nav(/Enseignants/); await wait(400);
    click($$('#view button').find(b => /Nouvel enseignant/.test(norm(b.textContent)))); await wait(300);
    const inputs = $$('#modal-root input');
    const champ = ph => inputs.find(i => norm(i.placeholder) === ph || norm(i.title) === ph);
    setInput($$('#modal-root input')[0], matEns);          /* matricule */
    const byLabel = lb => { const l = $$('#modal-root label').find(x => norm(x.textContent).replace(/\s*\*$/, '').trim() === lb);
      return l ? (l.htmlFor ? d.getElementById(l.htmlFor) : l.querySelector('input')) : null; };
    setInput(byLabel('Nom'), 'MEKONGO'); setInput(byLabel('Prénom'), 'Céline');
    click($$('#modal-root button').find(b => /Créer la fiche/.test(norm(b.textContent)))); await wait(500);
    const R = dbRoot();
    const u = (R.users || []).find(x => x.username === matEns);
    if (!u) throw new Error('compte ' + matEns + ' non créé');
    if (u.role !== 'enseignant' || u.mustChangePwd !== true) throw new Error('rôle/drapeau mustChangePwd incorrects : ' + JSON.stringify({ role:u.role, m:u.mustChangePwd }));
    const sha = crypto.createHash('sha256').update(u.salt + ':' + matEns).digest('hex');
    if (u.hash !== sha) throw new Error('mot de passe initial ≠ matricule');
    if (!u.enseignantId) throw new Error('compte non lié à la fiche enseignant');
  });

  /* ---------- 3. Premier changement de mot de passe obligatoire ---------- */
  await step('première connexion : fenêtre de changement OBLIGATOIRE', async () => {
    await login(matEns, matEns);
    if (!$('#mustchg')) throw new Error('fenêtre de premier changement de mot de passe absente');
  });
  await step('nouveau mot de passe accepté, fenêtre refermée', async () => {
    setInput($('#mc-p1'), 'Saisir2026!');
    setInput($('#mc-p2'), 'Saisir2026!');
    click($$('.mback button').find(b => /Définir mon mot de passe/.test(norm(b.textContent)))); await wait(500);
    if ($('#mustchg')) throw new Error('fenêtre toujours affichée après validation');
    if (!$('#app')) throw new Error('application non accessible après changement');
    const u = (dbRoot().users || []).find(x => x.username === matEns);
    if (!u || u.mustChangePwd) throw new Error('drapeau mustChangePwd non effacé');
  });
  await step('ancien mot de passe (matricule) refusé, nouveau accepté', async () => {
    let refuse = false;
    try { await login(matEns, matEns); } catch(e){ refuse = true; }
    if (!refuse) throw new Error('connexion encore acceptée avec le matricule comme mot de passe !');
    await login(matEns, 'Saisir2026!');
    if (!$('#app')) throw new Error('connexion refusée avec le nouveau mot de passe');
    /* l'enseignant voit la page Compétences (perm lecture/écriture) */
    nav(/Compétences/); await wait(400);
    if (!/Compétences évaluées/.test(norm($('#view').textContent))) throw new Error('page Compétences inaccessible à l\u2019enseignant');
  });

  /* ---------- 4. Assiduité par évaluation ---------- */
  await step('discipline : 4e onglet « Par évaluation » + saisie enregistrée', async () => {
    await login('admin', 'admin2026');
    nav(/Discipline/); await wait(400);
    const tab = $$('.tab').find(b => /Par évaluation/.test(norm(b.textContent)));
    if (!tab) throw new Error('onglet « Par évaluation » absent');
    click(tab); await wait(600);
    const sels = $$('#view select');
    if (sels.length < 2) throw new Error('sélecteurs classe/évaluation attendus, trouvé ' + sels.length);
    const oCl = [...sels[0].options].find(o => /6ème A/.test(norm(o.textContent)));
    if (!oCl) throw new Error('classe 6ème A introuvable');
    setSel(sels[0], oCl.value); await wait(400);
    const oSq = [...sels[1].options].find(o => /Séquence 1/.test(norm(o.textContent)));
    if (!oSq) throw new Error('séquence 1 introuvable');
    setSel(sels[1], oSq.value); await wait(400);
    const rows = $$('#assiduite-grid tbody tr');
    if (rows.length < 5) throw new Error('grille d\u2019élèves attendue, trouvé ' + rows.length);
    if ($$('#assiduite-grid input[type="number"]').length !== (rows.length - 1) * 4) throw new Error('4 saisies numériques par élève attendues');
    const prems = rows[0].querySelector('input[type="number"]');
    if (!prems) throw new Error('champ de saisie absent de la première ligne');
    setInput(prems, '3');
    const btnE = $$('.card button').find(b => /Enregistrer l'évaluation/.test(norm(b.textContent)));
    if (!btnE) throw new Error('bouton « Enregistrer l\u2019évaluation » introuvable');
    click(btnE); await wait(500);
    const b = base();
    const nom1 = norm(rows[0].cells[0].textContent).trim().split(' ')[0];
    const el = b.eleves.find(e => e.classeId === 'cl6a' && e.nom === nom1);
    const a = (b.assiduite || []).find(x => x.eleveId === el.id && x.sequenceId === '1');
    if (!a || String(a.absNJ) !== '3') throw new Error('assiduité non enregistrée : ' + JSON.stringify(a));
    if (!/Cumuls de la classe/.test(norm($('#view').textContent))) throw new Error('cumuls trimestre/année absents');
  });

  /* ---------- 5. Bulletin : compétences sous les matières + assiduité ---------- */
  await step('bulletin T1 : compétences affichées sous les matières + absences/retards', async () => {
    nav(/Bulletins/); await wait(500);
    const sels = $$('#view select');
    const selCl = sels.find(s => [...s.options].some(o => /6ème A/.test(norm(o.textContent))));
    if (!selCl) throw new Error('sélecteur de classe introuvable');
    setSel(selCl, [...selCl.options].find(o => /6ème A/.test(norm(o.textContent))).value); await wait(400);
    const selPer = $$('#view select').find(s => [...s.options].some(o => /Trimestre 1/.test(norm(o.textContent))));
    if (!selPer) throw new Error('sélecteur de période introuvable');
    setSel(selPer, [...selPer.options].find(o => /Trimestre 1/.test(norm(o.textContent))).value); await wait(500);
    const btn = $$('#view button').find(b => norm(b.textContent).trim() === 'Bulletin');
    if (!btn) throw new Error('bouton Bulletin introuvable');
    click(btn); await wait(500);
    const t = norm($('#modal-root').textContent);
    if (!/Compétence\(s\) :/.test(t)) throw new Error('lignes « Compétence(s) : » absentes du bulletin');
    if (!/décimaux/.test(t)) throw new Error('texte de compétence de la graine absent');
    if (!/Retards :/.test(t)) throw new Error('ligne d\u2019assiduité (retards) absente du bulletin');
    click($('#modal-root .m-x')); await wait(200);
  });

  /* ---------- 6. Enseignant : périmètre restreint ---------- */
  await step('enseignant : compétences limitées à ses matières', async () => {
    await login('enseignant', 'enseignant2026');
    nav(/Compétences/); await wait(400);
    const sels = $$('#view select');
    setSel(sels[0], [...sels[0].options].find(o => /6ème A/.test(norm(o.textContent))).value); await wait(300);
    const rows = $$('#view tbody tr');
    if (rows.length !== 1) throw new Error('1 compétence attendue pour l\u2019enseignant (mathématiques seulement), trouvé ' + rows.length);
    if (!/décimaux/.test(norm(rows[0].textContent))) throw new Error('compétence de mathématiques absente');
    if (/narratif/.test(norm($('#view tbody').textContent))) throw new Error('compétence de français visible hors du périmètre de l\u2019enseignant');
  });

  if (errors.length){ console.error('Erreurs runtime :', errors.slice(0, 5)); fails++; }
  console.log(fails ? '\n=== SMOKE v8.0 : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE v8.0 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
