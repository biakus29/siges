/* Smoke v2.1 — architecture multi-établissements :
   sélecteur à la connexion, console superadministrateur, création/suppression
   d'établissement, bascule d'établissement, comptes rattachés. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const css = fs.readFileSync('/home/user/aurel-react/src/styles.css', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
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
const norm = s => s.replace(/\u202f|\u00a0/g, ' ');
function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  await wait(700);

  await step('connexion superadmin (auto) → console « Administration générale »', async () => {
    setInput($('#li-user'), 'superadmin'); setInput($('#li-pass'), 'super2026');
    click($('.lw-btn')); await wait(600);
    if (!$('#app')) throw new Error('application absente');
    const t = norm($('#view').textContent);
    if (!/Administration générale/.test(t)) throw new Error('console superadmin absente : ' + t.slice(0, 80));
    /* v5.1 : la console s'ouvre sur la vue d'ensemble — basculer sur l'onglet Établissements */
    const ongletEtabs = $$('.tab').find(b => /Établissements/.test(norm(b.textContent)) && !/Vue/.test(norm(b.textContent)));
    if (!ongletEtabs) throw new Error('onglet Établissements absent');
    click(ongletEtabs); await wait(400);
    if (!$$('.etab-card').length) throw new Error('cartes établissements absentes');
    if ($$('.etab-card').length !== 2) throw new Error('établissements : ' + $$('.etab-card').length + ' (attendu 2)');
  });

  await step('console : statistiques par établissement + comptes globaux', async () => {
    const t = norm($('#view').textContent);
    if (!/Collège Bonneau/.test(t)) throw new Error('Bonneau absent');
    if (!/Lycée Classique de Mbalmayo/.test(t)) throw new Error('Mbalmayo absent');
    if (!/Yaoundé/.test(t)) throw new Error('ville absente');
    if ($$('#view .nav-i').some(n => /Élèves/.test(n.textContent))) throw new Error('navigation d\u2019établissement visible en mode console');
  });

  await step('création d\u2019un nouvel établissement (formulaire)', async () => {
    const btn = $$('#view button').find(b => /Nouvel établissement/.test(norm(b.textContent)));
    if (!btn) throw new Error('bouton nouvel établissement absent');
    click(btn); await wait(300);
    const m = $('#modal-root');
    if (!m || !/Nouvel établissement/.test(norm(m.textContent))) throw new Error('modale de création absente');
    const nom = $('#ff-nom'), ville = $('#ff-ville');
    if (!nom || !ville) throw new Error('champs nom/ville introuvables');
    setInput(nom, 'Complexe Scolaire La Récussite');
    setInput(ville, 'Douala');
    const ok2 = $$('#modal-root button').find(b => /Créer/.test(norm(b.textContent)));
    if (!ok2) throw new Error('bouton créer absent');
    click(ok2); await wait(400);
    if ($$('.etab-card').length !== 3) throw new Error('établissements après création : ' + $$('.etab-card').length);
    if (!/La Récussite/.test(norm($('#view').textContent))) throw new Error('nouvel établissement non listé');
  });

  await step('ouverture du nouvel établissement → base vide + année à créer', async () => {
    const card = $$('.etab-card').find(c => /La Récussite/.test(norm(c.textContent)));
    if (!card) throw new Error('carte introuvable');
    click([...card.querySelectorAll('button')].find(b => /Ouvrir/.test(norm(b.textContent))));
    await wait(500);
    const t = norm($('#view').textContent);
    if (/Administration générale/.test(t) && !/Tableau de bord/.test(t)) throw new Error('console non quittée');
    if (!/Aucune année scolaire active/.test(norm($('#app').textContent))) throw new Error('année active inattendue dans un établissement neuf');
    const sb = norm($('.sb-brand').textContent);
    if (!/La Récussite/.test(sb)) throw new Error('barre latérale sans le nom du nouvel établissement : ' + sb);
  });

  await step('retour console + bascule vers le Collège Bonneau (données présentes)', async () => {
    const nav = $$('.nav-i').find(n => /Administration générale/.test(n.textContent));
    if (!nav) throw new Error('nav administration générale absente');
    click(nav); await wait(400);
    click($$('.tab').find(b => /Établissements/.test(norm(b.textContent)) && !/Vue/.test(norm(b.textContent)))); await wait(400);
    const card = $$('.etab-card').find(c => /Collège Bonneau/.test(norm(c.textContent)));
    if (!card) throw new Error('carte Bonneau absente');
    click([...card.querySelectorAll('button')].find(b => /Ouvrir/.test(norm(b.textContent))));
    await wait(500);
    const t = norm($('#view').textContent);
    if (/Aucune année scolaire active/.test(t)) throw new Error('année active absente chez Bonneau');
    const sb = norm($('.sb-brand').textContent);
    if (!/Collège Bonneau/.test(sb)) throw new Error('barre latérale : ' + sb);
    const sel = $('.sb-etabsel');
    if (!sel) throw new Error('sélecteur d\u2019établissement (superadmin) absent de la barre latérale');
    if ($$('#view .cnt').length === 0 && !/Élèves/.test(t)) throw new Error('navigation établissement absente');
  });

  await step('suppression de l\u2019établissement créé (cascade confirmée)', async () => {
    const nav = $$('.nav-i').find(n => /Administration générale/.test(n.textContent));
    click(nav); await wait(400);
    click($$('.tab').find(b => /Établissements/.test(norm(b.textContent)) && !/Vue/.test(norm(b.textContent)))); await wait(400);
    const card = $$('.etab-card').find(c => /La Récussite/.test(norm(c.textContent)));
    if (!card) throw new Error('carte introuvable');
    click([...card.querySelectorAll('button')].find(b => /Supprimer/.test(norm(b.textContent))));
    await wait(300);
    const m = $('#modal-root');
    if (!m || !/La Récussite/.test(norm(m.textContent))) throw new Error('confirmation absente');
    const okbtn = $$('#modal-root button').find(b => /Supprimer définitivement/.test(norm(b.textContent)));
    if (!okbtn) throw new Error('bouton de confirmation absent');
    click(okbtn); await wait(400);
    if ($$('.etab-card').length !== 2) throw new Error('établissements après suppression : ' + $$('.etab-card').length);
  });

  await step('déconnexion puis connexion à un établissement précis (admin-lycee)', async () => {
    const out = $('button[title="Se déconnecter"]');
    if (!out) throw new Error('bouton déconnexion absent');
    click(out); await wait(600);
    if (!$('#li-user')) throw new Error('écran de connexion absent');
    setSel($('#li-etab'), 'etab-002');
    setInput($('#li-user'), 'admin-lycee'); setInput($('#li-pass'), 'lycee2026');
    click($('.lw-btn')); await wait(600);
    if (!$('#app')) throw new Error('application absente');
    const sb = norm($('.sb-brand').textContent);
    if (!/Mbalmayo/.test(sb)) throw new Error('établissement Mbalmayo non ouvert : ' + sb);
    const t = norm($('#app').textContent);
    if (!/Tableau de bord/.test(t)) throw new Error('tableau de bord absent');
    if ($$('.nav-i').some(n => /Administration générale/.test(n.textContent))) throw new Error('nav superadmin visible pour un admin d\u2019établissement');
  });

  await step('compte d\u2019un autre établissement refusé sur un choix explicite', async () => {
    const out = $('button[title="Se déconnecter"]');
    click(out); await wait(600);
    setSel($('#li-etab'), 'etab-001');
    setInput($('#li-user'), 'admin-lycee'); setInput($('#li-pass'), 'lycee2026');
    click($('.lw-btn')); await wait(500);
    /* sécurité : message GÉNÉRIQUE — ne doit pas révéler que le compte existe ailleurs */
    const err = norm($('#li-err') ? $('#li-err').textContent : '');
    if (!/Identifiants incorrects/.test(err)) throw new Error('refus générique attendu, obtenu : ' + err.slice(0, 60));
  });

  await step('aucune erreur React', () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });

  console.log('');
  console.log(fails ? '=== ' + fails + ' ÉCHEC(S) ===' : '=== SMOKE TEST v2.1 MULTI-ÉTABLISSEMENTS : OK ===');
  process.exit(fails ? 1 : 0);
})();
