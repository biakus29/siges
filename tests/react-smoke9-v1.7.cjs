/* Smoke test v1.7 — bouton admin « Supprimer les données de test » */
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
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const LS = () => { const d = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1')); const b = (Array.isArray(d && d.bases) && (d.bases.find(x => x.id === 'etab-001') || d.bases[0])) || d;
  return (d && d.bases) ? Object.assign({}, b, { users:d.users, etablissements:d.etablissements, bases:d.bases }) : d; };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  await wait(600);
  let avant = null;
  await step('connexion admin', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(500);
    if (!$('#app')) throw new Error('app absente');
    avant = LS();
    if (!avant.eleves.length) throw new Error('la base de démonstration est vide avant test');
  });

  await step('carte « Données de test » visible (admin uniquement)', async () => {
    click($$('.nav-i').find(n => n.textContent.includes('Personnalisation des états'))); await wait(400);
    const vue = norm($('#view').textContent);
    if (!vue.includes('Données de test')) throw new Error('carte absente');
    if (!vue.includes('Action irréversible')) throw new Error('avertissement absent');
    if (!vue.includes(avant.eleves.length + ' élève(s)')) throw new Error('compteur élèves incorrect');
    if (!vue.includes(avant.paiements.length + ' paiement(s)')) throw new Error('compteur paiements incorrect');
    const btn = $$('button').find(b => norm(b.textContent).includes('Supprimer les données de test'));
    if (!btn) throw new Error('bouton de suppression absent');
    if (btn.disabled) throw new Error('bouton désactivé alors que la base contient des données');
  });

  await step('purge : confirmation puis suppression effective', async () => {
    click($$('button').find(b => norm(b.textContent).includes('Supprimer les données de test'))); await wait(300);
    const okBtn = $$('#modal-root button').find(b => b.classList.contains('btn-danger') && norm(b.textContent).includes('Supprimer définitivement'));
    if (!okBtn) throw new Error('confirmation dangereuse absente');
    if (!norm($('#modal-root').textContent).includes('irréversible')) throw new Error('mention irréversible absente');
    click(okBtn); await wait(500);
    const apres = LS();
    if (apres.eleves.length) throw new Error(apres.eleves.length + ' élève(s) restant(s)');
    if (apres.paiements.length) throw new Error(apres.paiements.length + ' paiement(s) restant(s)');
    if (apres.bourses.length) throw new Error(apres.bourses.length + ' bourse(s) restante(s)');
    if (apres.journal.length !== 1 || apres.journal[0].action !== 'suppression') throw new Error('journal attendu : 1 entrée suppression, obtenu : ' + apres.journal.length + ' / ' + (apres.journal[0] || {}).action);
    if (apres.classes.length !== avant.classes.length) throw new Error('classes perdues');
    if (apres.annees.length !== avant.annees.length) throw new Error('années perdues');
    if (apres.tarifs.length !== avant.tarifs.length) throw new Error('tarifs perdus');
    if (apres.frais.length !== avant.frais.length) throw new Error('types de frais perdus');
    if (apres.users.length < 4) throw new Error('comptes utilisateurs perdus');
    if ((apres.settings || {}).nomEtablissement !== (avant.settings || {}).nomEtablissement) throw new Error('personnalisation perdue');
    if (!$('#toast-root .toast')) throw new Error('notification absente');
  });

  await step('bouton désactivé une fois la base vide', async () => {
    const btn = $$('button').find(b => norm(b.textContent).includes('Supprimer les données de test'));
    if (!btn) throw new Error('bouton absent');
    if (!btn.disabled) throw new Error('bouton encore actif');
    if (!norm($('#view').textContent).includes('Aucune donnée à supprimer')) throw new Error('message base vide absent');
  });

  await step('application stable après purge (élèves vides, tableau de bord)', async () => {
    click($$('.nav-i').find(n => n.textContent.includes('Élèves'))); await wait(350);
    if (!norm($('#view').textContent).includes('Aucun élève trouvé')) throw new Error('message base vide absent de la page Élèves');
    click($$('.nav-i').find(n => n.textContent.includes('Tableau de bord'))); await wait(350);
    if (!$('#app')) throw new Error('app plantée après purge');
  });

  await step('aucune erreur React', () => {
    const real = errors.filter(e => !/Warning/.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  console.log(fails ? '\n=== ' + fails + ' ÉCHEC(S) ===' : '\n=== SMOKE TEST v1.7 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
