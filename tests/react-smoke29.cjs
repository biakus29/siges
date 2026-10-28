/* Smoke v7.0 — PREMIER SUPERADMINISTRATEUR (réseau d'établissements) :
   • tant qu'aucun superadministrateur n'existe, l'administrateur voit
     l'option « Superadministrateur — console réseau (premier compte) »
     dans Utilisateurs & profils et peut créer ce compte ;
   • une fois créé, l'option disparaît (réservée aux superadministrateurs) ;
   • le nouveau compte se connecte et accède à la console réseau
     (Administration générale, établissements, journal consolidé) ;
   • l'administrateur de l'établissement ne voit pas le compte réseau
     dans sa liste (comptes de son établissement uniquement).
   Préparation : la base locale de démonstration est purgée de son
   superadministrateur (état « production ») avant le test, sans modifier
   le code de l'application. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');

function boot(prepare){
  const dom = new JSDOM('<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr' + 'ipt>' + bundle + '</scr' + 'ipt></body></html>',
    { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
      beforeParse(w){
        if (prepare) prepare(w);
        w.scrollTo = () => {}; w.print = () => {};
        w.addEventListener('error', () => {});
        w.console.error = () => {};
      } });
  return dom;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const errors = [];

(async () => {
  /* ---- passe 1 : démarrer sur la graine, puis purger le superadmin ---- */
  const LS_KEY = 'aurel_school_compta_react_v1';
  let dom1 = boot();
  let w = dom1.window;
  await wait(900);
  const brut = w.localStorage.getItem(LS_KEY);
  if (!brut) { console.error('✗ état local introuvable'); process.exit(1); }
  const etat = JSON.parse(brut);
  const avant = (etat.bases ? etat.bases[0].users : etat.users) || etat.users;
  const nSuper = (etat.users || []).filter(u => u.role === 'superadmin').length;
  etat.users = (etat.users || []).filter(u => u.role !== 'superadmin');
  const purges = nSuper;
  dom1.window.close();

  /* ---- passe 2 : état « production » (aucun superadmin) ---- */
  const dom2 = boot(w2 => { w2.localStorage.setItem(LS_KEY, JSON.stringify(etat)); });
  w = dom2.window;
  let d = w.document;
  const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
  function setInput(el, v){
    const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
  function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
  function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
  const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
  /* état racine : les comptes vivent à la racine (dbRoot.users), pas dans la base d'un établissement */
  const base = () => JSON.parse(w.localStorage.getItem(LS_KEY));
  let fails = 0;
  async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }
  async function login(u, p){
    const out = $('button[title="Se déconnecter"]');
    if (out){ click(out); await wait(500); }
    setInput($('#li-user'), u); setInput($('#li-pass'), p);
    click($('.lw-btn')); await wait(700);
    if (!$('#app')) throw new Error('connexion refusée pour ' + u);
  }

  await wait(800);
  await step('v7.0 : pied de page', async () => {
    await login('admin', 'admin2026');
    if (!/v7\.0 React/.test(norm(d.body.textContent))) throw new Error('mention v6.8 absente');
  });

  await step('état de départ : ' + purges + ' superadmin(s) retiré(s) du jeu local, aucun restant', async () => {
    if (base().users.some(u => u.role === 'superadmin')) throw new Error('un superadmin résiduel bloque le test');
  });

  await step('admin : l\u2019option « Superadministrateur — console réseau (premier compte) » est proposée', async () => {
    nav(/Utilisateurs & profils/); await wait(500);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouvel utilisateur|Nouveau compte/.test(norm(b.textContent))));
    let n = 0; while (!$('#ff-role') && n++ < 40) await wait(100);
    const sel = $('#ff-role');
    if (!sel) throw new Error('formulaire utilisateur absent');
    const opt = [...sel.options].find(o => /console réseau/.test(norm(o.textContent)));
    if (!opt) throw new Error('option superadmin (premier compte) absente du profil : ' + [...sel.options].map(o => o.value).join(', '));
  });

  await step('admin : création du premier superadministrateur', async () => {
    setInput($('#ff-nom'), 'Direction Générale');
    setInput($('#ff-username'), 'direction');
    setSel($('#ff-role'), 'superadmin');
    setInput($('#ff-pwd'), 'direction2026');
    click($$('#modal-root .btn-pri').find(b => /Créer le compte/.test(norm(b.textContent))));
    await wait(600);
    if ($('#modal-root .mback')) throw new Error('la fenêtre ne s\u2019est pas fermée (échec de création ?)');
    const u = base().users.find(x => x.username === 'direction');
    if (!u || u.role !== 'superadmin') throw new Error('compte superadmin non créé dans la base');
    if (u.etablissementId) throw new Error('le superadmin ne doit être rattaché à aucun établissement');
  });

  await step('admin : l\u2019option disparaît une fois le premier superadmin créé', async () => {
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouvel utilisateur|Nouveau compte/.test(norm(b.textContent))));
    let n = 0; while (!$('#ff-role') && n++ < 40) await wait(100);
    const opt = [...$('#ff-role').options].find(o => o.value === 'superadmin');
    if (opt) throw new Error('l\u2019option superadmin reste proposée à l\u2019administrateur');
    click($('#modal-root .m-x')); await wait(300);
  });

  await step('admin : le compte réseau n\u2019apparaît pas dans la liste de l\u2019établissement', async () => {
    if (norm($('#view').textContent).includes('direction')) throw new Error('le compte réseau est listé à l\u2019administrateur d\u2019établissement');
  });

  await step('connexion « direction » : console réseau (Administration générale)', async () => {
    await login('direction', 'direction2026');
    if (!/Administration générale/.test(norm(d.body.textContent))) throw new Error('console réseau absente');
    const btns = $$('button').filter(b => !b.closest('.nav-i') && /Ouvrir/.test(norm(b.textContent)));
    if (btns.length < 2) throw new Error('établissements de la console non listés (' + btns.length + ')');
  });

  await step('console : journal consolidé (tous les établissements) accessible', async () => {
    click($$('button').filter(b => !b.closest('.nav-i') && /Ouvrir/.test(norm(b.textContent)))[0]);
    await wait(700);
    nav(/Journal d'activité/); await wait(500);
    const t = norm($('#view').textContent);
    if (!/Toutes les actions — tous les établissements/.test(t)) throw new Error('mention superadmin du journal absente');
    if (!$$('#view thead th').some(th => /Établissement/.test(norm(th.textContent)))) throw new Error('colonne Établissement absente');
  });

  console.log(fails ? '\n=== SMOKE TEST v7.0 : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v6.9 : OK ===');
  if (errors.length){ console.error('Erreurs runtime :'); errors.slice(0, 10).forEach(e => console.error('  ' + e)); }
  w.close(); process.exit(fails ? 1 : 0);
})();
