/* Smoke v1.9 — ajout/suppression types de frais + noms utilisateurs actualisés */
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
const LS = () => { const d = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1')); const b = (Array.isArray(d && d.bases) && (d.bases.find(x => x.id === 'etab-001') || d.bases[0])) || d;
  return (d && d.bases) ? Object.assign({}, b, { users:d.users, etablissements:d.etablissements, bases:d.bases }) : d; };
function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  await wait(600);
  await step('connexion admin', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(500);
    if (!$('#app')) throw new Error('app absente');
  });

  await step('ajout d\u2019un type de frais (tranche par défaut)', async () => {
    nav(/Types de frais/); await wait(400);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouveau type de frais/i.test(norm(b.textContent)))); await wait(350);
    const form = $('#modal-root form');
    if (!form) throw new Error('formulaire absent');
    setInput(form.querySelector('input[name="code"]'), 'TSTF');
    setInput(form.querySelector('input[name="libelle"]'), 'Frais de test v1.9');
    form.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(450);
    const f = LS().frais.find(x => x.code === 'TSTF');
    if (!f) throw new Error('frais TSTF non créé');
    if (!Array.isArray(f.tranches) || f.tranches.length !== 1 || f.tranches[0].pourcentage !== 100) throw new Error('tranche par défaut absente : ' + JSON.stringify(f.tranches));
    if (!norm($('#view').textContent).includes('Frais de test v1.9')) throw new Error('frais absent de la liste');
  });

  await step('suppression d\u2019un frais sans paiement', async () => {
    const row = $$('#view tbody tr').find(r => norm(r.textContent).includes('TSTF'));
    if (!row) throw new Error('ligne TSTF introuvable');
    click(row.querySelector('button[title="Supprimer"]')); await wait(300);
    const ok = $$('#modal-root button').find(b => b.classList.contains('btn-danger'));
    if (!ok) throw new Error('confirmation absente');
    click(ok); await wait(450);
    if (LS().frais.some(x => x.code === 'TSTF')) throw new Error('TSTF encore présent');
    if (!$('#toast-root .toast')) throw new Error('notification absente');
  });

  await step('suppression d\u2019un frais AVEC paiements (confirmée)', async () => {
    const avant = LS();
    const nPa = avant.paiements.filter(p => p.fraisId === 'fr-anim').length;
    if (!nPa) throw new Error('fr-anim sans paiement — choisir un autre frais');
    const nTarifs = avant.tarifs.filter(t => t.fraisId === 'fr-anim').length;
    const row = $$('#view tbody tr').find(r => norm(r.textContent).includes('Animation'));
    if (!row) throw new Error('ligne Animation introuvable');
    click(row.querySelector('button[title="Supprimer"]')); await wait(300);
    const ok = $$('#modal-root button').find(b => b.classList.contains('btn-danger'));
    if (!ok) throw new Error('confirmation absente');
    if (!norm($('#modal-root').textContent).includes(nPa + ' paiement(s)')) throw new Error('avertissement paiements absent');
    click(ok); await wait(500);
    const apres = LS();
    if (apres.frais.some(x => x.id === 'fr-anim')) throw new Error('fr-anim encore présent');
    if (apres.paiements.length !== avant.paiements.length - nPa) throw new Error('paiements non supprimés : ' + apres.paiements.length + ' != ' + (avant.paiements.length - nPa));
    if (apres.tarifs.some(t => t.fraisId === 'fr-anim')) throw new Error('tarifs résiduels');
    const j = apres.journal[0];
    if (!j || j.action !== 'suppression' || !j.details.includes('ANIM')) throw new Error('journal suppression absent : ' + JSON.stringify(j).slice(0, 90));
    console.log('   ' + nPa + ' paiement(s) et ' + nTarifs + ' tarif(s) supprimés avec le frais');
  });

  await step('bourses : nom complet actualisé (« créée par »)', async () => {
    nav(/Bourses/); await wait(400);
    const cell = $$('#view tbody tr td')[0];
    const vue = norm($('#view').textContent);
    if (!vue.includes('Sœur Marie-Claire Ngo')) throw new Error('nom complet de l admin non affiché (createdBy brut ?) : ' + vue.slice(0, 120));
  });

  await step('renommage utilisateur : topbar + journal actualisés', async () => {
    nav(/Utilisateurs/); await wait(400);
    const row = $$('#view tbody tr').find(r => norm(r.textContent).includes('@admin'));
    if (!row) throw new Error('ligne admin introuvable');
    click(row.querySelector('button[title="Modifier"]')); await wait(350);
    const form = $('#modal-root form');
    setInput(form.querySelector('input[name="nom"]'), 'Direction Générale Test');
    setInput(form.querySelector('input[name="username"]'), 'direction');
    form.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const u = LS().users.find(x => x.id === 'us-admin');
    if (u.username !== 'direction' || u.nom !== 'Direction Générale Test') throw new Error('renommage non enregistré');
    /* topbar : nom actualisé (resync v1.5) */
    if (!norm($('#app').textContent).includes('Direction Générale Test')) throw new Error('topbar non actualisée');
    /* journal : identifiants uid résolus -> nouveau nom */
    nav(/Journal/); await wait(400);
    const jrow = $$('#view tbody tr').find(r => norm(r.textContent).includes('direction'));
    if (!jrow) throw new Error('journal : entrées récentes sans nom actualisé');
    const ancienne = $$('#view tbody tr').some(r => /\(@admin\)|\badmin\b/.test(norm(r.textContent)) && r.textContent.includes('Type de frais'));
    console.log('   journal actualisé (uid → direction) ✓');
  });

  await step('application stable (pages clés)', async () => {
    nav(/Grille/); await wait(400);
    if (!$('#view')) throw new Error('grille cassée');
    nav(/Élèves/); await wait(300);
    if (!$('#view tbody')) throw new Error('élèves cassés');
  });

  await step('aucune erreur React', () => {
    const real = errors.filter(e => !/Warning/.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  console.log(fails ? '\n=== ' + fails + ' ÉCHEC(S) ===' : '\n=== SMOKE TEST v1.9 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
