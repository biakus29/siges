/* Smoke v6.4 — INSTALLATION SANS DONNÉES DE TEST, SAUVEGARDE & MENUS :
   • menus réorganisés avec cohérence : Scolarité, Finances (suivi puis
     paramétrage), Pédagogie — structure, Pédagogie — notes & bilans,
     Administration ; ordre des entrées préservé pour chaque profil ;
   • Personnalisation : 4 onglets, « Sauvegarde auto » visible avec la
     mention « mode serveur » en local ;
   • (l'installateur sans perte et la sauvegarde automatique réelle sont
     vérifiés côté serveur par tests/php-e2e-backup.cjs). */
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
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
const groups = () => $$('.nav-g').map(n => norm(n.textContent));
const labels = () => $$('.nav-i span:first-of-type').map(n => norm(n.textContent));
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

  await step('menus v6.4 : groupes cohérents dans l\u2019ordre logique', async () => {
    await login('admin', 'admin2026');
    const grp = groups();
    const attendu = ['Scolarité', 'Finances', 'Pédagogie — structure', 'Pédagogie — notes & bilans', 'Administration'];
    if (grp.join('|') !== attendu.join('|')) throw new Error('groupes attendus : ' + attendu.join(' | ') + ' — lus : ' + grp.join(' | '));
  });

  await step('21 entrées, structure avant bilans, finances : suivi avant paramétrage', async () => {
    const labs = labels();
    if (labs.length !== 21) throw new Error('21 entrées de menu attendues, trouvé ' + labs.length);
    const iStructure = labs.indexOf('Séquences & appréciations');
    const iNotes = labs.indexOf('Saisie des notes');
    if (iStructure < 0 || iNotes < 0 || iNotes < iStructure) throw new Error('« notes & bilans » doit suivre la structure');
    const iRapports = labs.indexOf('Rapports financiers');
    const iFrais = labs.indexOf('Types de frais');
    if (iRapports < 0 || iFrais < 0 || iFrais < iRapports) throw new Error('en Finances, le suivi (rapports) doit précéder le paramétrage (frais)');
    const iGrille = labs.indexOf('Grille tarifaire');
    if (iGrille < iFrais) throw new Error('Grille tarifaire doit suivre Types de frais');
  });

  await step('l\u2019ordre des menus de l\u2019enseignant est préservé', async () => {
    await login('enseignant', 'enseignant2026');
    const attendu = ['Tableau de bord', 'Matières', 'Plan des enseignements', 'Saisie des notes', 'Bulletins & rapports', 'Statistiques'];
    const labs = labels();
    if (labs.join('|') !== attendu.join('|')) throw new Error('menus enseignant : ' + labs.join('|'));
  });

  await step('économe : finances complètes, structure en lecture seule, ni notes ni administration', async () => {
    await login('econome', 'econome2026');
    const grp = groups();
    if (!grp.includes('Scolarité') || !grp.includes('Finances')) throw new Error('groupes Scolarité/Finances attendus : ' + grp.join(' | '));
    if (grp.includes('Administration')) throw new Error('groupe Administration visible par l\u2019économe');
    if (grp.includes('Pédagogie — notes & bilans')) throw new Error('notes & bilans visibles par l\u2019économe');
    const labs = labels();
    for (const interdit of ['Matières', 'Plan des enseignements', 'Séquences & appréciations', 'Enseignants',
      'Saisie des notes', 'Bulletins & rapports', 'Statistiques', 'Utilisateurs & profils'])
      if (labs.includes(interdit)) throw new Error('« ' + interdit + ' » visible par l\u2019économe');
    for (const autorise of ['Années scolaires', 'Niveaux', 'Classes'])
      if (!labs.includes(autorise)) throw new Error('« ' + autorise + ' » (lecture) absent pour l\u2019économe');
  });

  await step('personnalisation : 4 onglets dont « Sauvegarde auto »', async () => {
    await login('admin', 'admin2026');
    nav(/Personnalisation/); await wait(500);
    const tabs = $$('.tabs .tab').map(b => norm(b.textContent));
    if (tabs.length !== 4) throw new Error('4 onglets attendus, lus : ' + tabs.join(' | '));
    if (!/Sauvegarde auto/.test(tabs[3])) throw new Error('onglet Sauvegarde auto absent : ' + tabs.join(' | '));
  });

  await step('sauvegarde auto : mention « mode serveur » en local, aucun bouton d\u2019action', async () => {
    click($$('.tabs .tab').find(b => /Sauvegarde auto/.test(norm(b.textContent)))); await wait(400);
    const t = norm($('#view').textContent);
    if (!/Fonctionnalité du mode serveur/.test(t)) throw new Error('mention « mode serveur » absente');
    if (!/s\\u2019exécute sur le serveur/.test(t) && !/s'exécute sur le serveur/.test(t)) throw new Error('explication serveur absente');
    if ($$('#view button').some(b => /Sauvegarder maintenant|Tester le répertoire/.test(norm(b.textContent))))
      throw new Error('aucun bouton d\u2019action attendu en mode local');
  });

  await step('import de base : le libellé accepte ZIP ou JSON', async () => {
    click($$('.tabs .tab')[0]); await wait(400);
    const t = norm($('#view').textContent);
    if (!/Importer une base \(ZIP ou JSON\)/.test(t)) throw new Error('libellé « Importer une base (ZIP ou JSON) » absent');
  });

  console.log(fails ? '\n=== SMOKE TEST v6.4 SAUVEGARDE & MENUS : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v6.4 SAUVEGARDE & MENUS : OK ===');
  if (errors.length){ console.error('Erreurs applicatives :'); errors.slice(0, 8).forEach(e => console.error('  ' + e)); }
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
