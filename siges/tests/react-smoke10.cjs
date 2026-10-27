/* Smoke test v1.8 — ZIP export/import, droits par utilisateur, entetes gris, verrouillage 5 min */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const css = fs.readFileSync('/home/user/aurel-react/src/styles.css', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
let capturedBlob = null;
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.URL.createObjectURL = b => { capturedBlob = b; return 'blob:test'; };
    w.URL.revokeObjectURL = () => {};
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
  let base = null;
  await step('connexion admin', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(500);
    if (!$('#app')) throw new Error('app absente');
    base = LS();
  });

  let zipBytes = null;
  await step('export ZIP de la base (signature PK + contenu JSON)', async () => {
    nav(/Personnalisation/); await wait(400);
    const card = $$('.card').find(c => norm(c.textContent).includes('Sauvegarde & restauration'));
    if (!card) throw new Error('carte Sauvegarde absente');
    const btn = $$('button').find(b => norm(b.textContent).includes('Exporter la base (ZIP)'));
    if (!btn) throw new Error('bouton Exporter (ZIP) absent');
    click(btn); await wait(300);
    if (!capturedBlob) throw new Error('aucun blob genere');
    zipBytes = new Uint8Array(await capturedBlob.arrayBuffer());
    if (zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4B) throw new Error('signature ZIP absente');
    const txt = new TextDecoder().decode(zipBytes);
    if (!txt.includes('aurel-base.json')) throw new Error('entree aurel-base.json absente');
    if (!txt.includes('COLLÈGE BONNEAU')) throw new Error('donnees absentes de l archive');
    if (!$('#toast-root .toast')) throw new Error('notification absente');
  });

  await step('import ZIP : purge puis restauration complete', async () => {
    /* 1. purger les donnees de test */
    const purger = $$('button').find(b => norm(b.textContent).includes('Supprimer les données de test'));
    if (!purger) throw new Error('bouton purge absent');
    click(purger); await wait(250);
    click($$('#modal-root button').find(b => b.classList.contains('btn-danger'))); await wait(450);
    if (LS().eleves.length) throw new Error('purge ineffective');
    /* 2. importer l archive exportee precedemment */
    const inp = $('input[type="file"][accept=".zip,.json,application/zip,application/json"]');
    if (!inp) throw new Error('champ import ZIP/JSON absent');
    const f = new w.File([zipBytes], 'sauvegarde.zip', { type:'application/zip' });
    Object.defineProperty(inp, 'files', { value:[f], configurable:true });
    inp.dispatchEvent(new w.Event('change', { bubbles:true }));
    await wait(400);
    const okBtn = $$('#modal-root button').find(b => b.classList.contains('btn-danger') && norm(b.textContent).includes('Importer'));
    if (!okBtn) throw new Error('confirmation import absente : ' + norm($('#modal-root').textContent).slice(0, 100));
    click(okBtn); await wait(500);
    const apres = LS();
    if (apres.eleves.length !== base.eleves.length) throw new Error('eleves non restaures : ' + apres.eleves.length + ' != ' + base.eleves.length);
    if (apres.paiements.length !== base.paiements.length) throw new Error('paiements non restaures');
    if (apres.settings.nomEtablissement !== base.settings.nomEtablissement) throw new Error('personnalisation non restauree');
    const j = apres.journal[0];
    if (!j || j.action !== 'import') throw new Error('entree journal import absente : ' + JSON.stringify(j).slice(0, 80));
  });

  await step('droits par utilisateur : restriction appliquee au lecteur', async () => {
    nav(/Utilisateurs/); await wait(400);
    const row = $$('#view tbody tr').find(r => norm(r.textContent).includes('@lecteur'));
    if (!row) throw new Error('ligne lecteur introuvable');
    const shield = row.querySelector('button[title="Définir les droits d\'accès"]');
    if (!shield) throw new Error('bouton droits absent');
    /* l admin ne doit pas avoir de bouton droits */
    const adminRow = $$('#view tbody tr').find(r => norm(r.textContent).includes('@admin'));
    if (adminRow.querySelector('button[title="Définir les droits d\'accès"]')) throw new Error('admin modifiable (interdit)');
    click(shield); await wait(350);
    if (!$('#modal-root .perm-tbl')) throw new Error('matrice droits absente');
    /* eleves -> aucun ; bourses -> ecriture */
    const rows = $$('#modal-root .perm-row');
    const elRow = rows.find(r => norm(r.textContent).includes('Élèves'));
    const boRow = rows.find(r => norm(r.textContent).includes('Bourses'));
    if (!elRow || !boRow) throw new Error('lignes modules absentes');
    click(elRow.querySelectorAll('.perm-opt input')[1]);   /* aucun */
    click(boRow.querySelectorAll('.perm-opt input')[3]);   /* ecriture */
    $('#modal-root form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(450);
    const lec = LS().users.find(u => u.username === 'lecteur');
    if (!lec.perms || lec.perms.eleves !== 'n' || lec.perms.bourses !== 'w') throw new Error('perms non enregistrees : ' + JSON.stringify(lec.perms));
    if (!$('#toast-root .toast')) throw new Error('notification absente');
  });

  await step('application immediate : lecteur sans Élèves, avec Paiements', async () => {
    const deco = $('button[title="Se déconnecter"]');
    click(deco); await wait(600);
    setInput($('#li-user'), 'lecteur'); setInput($('#li-pass'), 'lecteur2026');
    click($('.lw-btn')); await wait(700);
    if (!$('#app')) throw new Error('connexion lecteur echouee');
    const navs = $$('.nav-i').map(n => norm(n.textContent));
    if (navs.some(t => t.includes('Élèves'))) throw new Error('module Élèves encore visible : ' + navs.join(' / '));
    if (!navs.some(t => t.includes('Encaissements') || t.includes('Paiements'))) throw new Error('module Paiements absent');
    if (!navs.some(t => t.includes('Bourses'))) throw new Error('Bourses absent (ecriture accordee => doit rester visible)');
  });

  await step('entetes d\'etats sans bleu (bandeau + colonnes)', async () => {
    const deco = $('button[title="Se déconnecter"]');
    click(deco); await wait(500);
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(600);
    nav(/Rapport/); await wait(400);
    click($$('.ycard').find(c => norm(c.textContent).includes('Statistiques des inscrits')).querySelector('button'));
    await wait(400);
    const head = $('#modal-root .rcp-head');
    if (!head) throw new Error('bandeau etat absent');
    const bg = w.getComputedStyle(head).backgroundColor;
    if (bg !== 'rgb(244, 245, 247)') throw new Error('bandeau non gris : ' + bg);
    const th = $('#modal-root .rcp-tbl th');
    const bg2 = w.getComputedStyle(th).backgroundColor;
    if (bg2 !== 'rgb(242, 243, 245)') throw new Error('entete colonnes non gris : ' + bg2);
    click($('#modal-root .m-x')); await wait(200);
  });

  await step('aucune erreur React', () => {
    const real = errors.filter(e => !/Warning/.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  /* ---- verrouillage apres inactivite (instance separee, delai raccourci) ---- */
  console.log('— verrouillage inactivité (délai test : 2,5 s) —');
  const errors2 = [];
  const dom2 = new JSDOM('<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style>' +
    '<scr'+'ipt>window.__AUREL_INACTIVITE_MS = 2500;</scr'+'ipt></head><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>',
    { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
      beforeParse(w2){
        w2.scrollTo = () => {};
        w2.addEventListener('error', e => errors2.push(e.message));
        w2.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(/i.test(s)) errors2.push('console.error: ' + s); };
      } });
  const w2 = dom2.window, d2 = w2.document;
  await wait(600);
  let lockOk = false;
  try {
    Object.getOwnPropertyDescriptor(w2.HTMLInputElement.prototype, 'value').set.call(d2.querySelector('#li-user'), 'admin');
    d2.querySelector('#li-user').dispatchEvent(new w2.Event('input', { bubbles:true }));
    Object.getOwnPropertyDescriptor(w2.HTMLInputElement.prototype, 'value').set.call(d2.querySelector('#li-pass'), 'admin2026');
    d2.querySelector('#li-pass').dispatchEvent(new w2.Event('input', { bubbles:true }));
    d2.querySelector('.lw-btn').dispatchEvent(new w2.MouseEvent('click', { bubbles:true, cancelable:true }));
    await wait(500);
    if (!d2.querySelector('#app')) throw new Error('connexion echouee');
    /* plus aucune interaction : attendre le verrouillage */
    for (let i = 0; i < 14 && !lockOk; i++){
      await wait(500);
      if (d2.querySelector('#root .login-card') || d2.querySelector('#li-user')) lockOk = true;
    }
    if (!lockOk) throw new Error('session non verrouillee apres inactivite');
    const txt = norm(d2.querySelector('#root').textContent);
    if (!/verrouill/i.test(txt)) throw new Error('message de verrouillage absent');
    if (errors2.filter(e => !/Warning/.test(e)).length) throw new Error('erreurs : ' + errors2.slice(0, 2).join(' | '));
    console.log('✓ verrouillage de session après inactivité (2,5 s en test = 5 min en production)');
  } catch(e){ console.error('✗ verrouillage —', e.message); fails++; }

  console.log(fails ? '\n=== ' + fails + ' ÉCHEC(S) ===' : '\n=== SMOKE TEST v1.8 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
