/* Smoke v5.1 — Console réseau du superadministrateur :
   vue d'ensemble consolidée (indicateurs, tableau comparatif, barres de
   recouvrement), pilotage des établissements (suspension/réactivation avec
   blocage effectif des connexions côté application), comptes de tout le
   réseau (recherche, filtres, désactivation, réinitialisation de mot de
   passe), journal fusionné (global + chaque établissement) filtrable. */
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
const tab = t => click($$('.tab').find(b => t.test(norm(b.textContent))));
const root = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1')); return ls; };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

async function login(u, p, attendu = true){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  if (!$('#li-user')) throw new Error('écran de connexion absent');
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(700);
  if (attendu && !$('#app')) throw new Error('connexion refusée pour ' + u);
  if (!attendu && $('#app')) throw new Error('connexion acceptée à tort pour ' + u);
}

(async () => {
  await wait(700);

  await step('superadmin : console réseau — vue d\u2019ensemble consolidée', async () => {
    await login('superadmin', 'super2026');
    const tabs = $$('.tab').map(t => norm(t.textContent));
    for (const t of ['Vue d\u2019ensemble', 'Établissements', 'Comptes', 'Journal réseau']) if (!tabs.some(x => x.includes(t))) throw new Error('onglet manquant : ' + t + ' → ' + tabs.join('|'));
    const t = norm($('#view').textContent);
    if (!/Établissements du réseau/.test(t) || !/Activité récente du réseau/.test(t)) throw new Error('sections de la vue d\u2019ensemble absentes');
    /* total réseau dynamique : somme des élèves de l'année active de chaque base */
    const ls = root();
    const attendu = (ls.bases || []).reduce((n, b) => {
      const ay = (b.annees || []).find(a => a.active);
      return n + (ay ? (b.eleves || []).filter(e => e.anneeId === ay.id).length : 0);
    }, 0);
    if (!t.includes(String(attendu))) throw new Error('total réseau ' + attendu + ' élèves absent');
    if (!/2 \/ 2/.test(t)) throw new Error('KPI 2/2 établissements actifs absent');
    if (!/Recouvrement/.test(t)) throw new Error('colonne recouvrement absente');
    const kpis = $$('.kpi').length;
    if (kpis < 6) throw new Error('KPI réseau incomplets : ' + kpis);
    const bars = $$('#view .bar > i').filter(i => parseInt(i.style.width, 10) > 0);
    if (!bars.length) throw new Error('aucune barre de recouvrement remplie');
    const cmp = $$('#view table thead').find(th => /Recouvrement/.test(norm(th.textContent)));
    if (!cmp) throw new Error('tableau comparatif introuvable');
  });

  await step('établissements : suspension du Lycée (confirmation dangereuse)', async () => {
    tab(/Établissements/); await wait(400);
    if ($$('.etab-card').length !== 2) throw new Error('2 cartes attendues, trouvé ' + $$('.etab-card').length);
    const card = $$('.etab-card').find(c => /Lycée/.test(norm(c.textContent)));
    if (!card) throw new Error('carte Lycée introuvable');
    click([...card.querySelectorAll('button')].find(b => /Suspendre/.test(norm(b.textContent)))); await wait(300);
    if (!$('#modal-root .btn-danger')) throw new Error('confirmation dangereuse absente');
    click($('#modal-root .btn-danger')); await wait(500);
    if (!/suspendu/.test(norm(card.textContent))) throw new Error('badge suspendu absent de la carte');
    const ls = root();
    const e = ls.etablissements.find(x => x.id === 'etab-002');
    if (!e || e.actif !== false) throw new Error('suspension non persistée');
    /* les données ne sont PAS supprimées */
    const b = ls.bases.find(x => x.id === 'etab-002');
    if (!b.eleves.length) throw new Error('données élèves perdues lors de la suspension');
  });

  await step('vue d\u2019ensemble : suspension visible (KPI 1/2 + bannière)', async () => {
    tab(/Vue d\u2019ensemble/); await wait(400);
    const t = norm($('#view').textContent);
    if (!/1 \/ 2/.test(t)) throw new Error('KPI 1/2 absent');
    if (!/suspendu\(s\) : Lycée/.test(t.replace(/\s+/g, ' '))) throw new Error('bannière d\u2019établissement suspendu absente');
  });

  await step('comptes : filtres, désactivation et réinitialisation de mot de passe', async () => {
    tab(/Comptes/); await wait(400);
    let rows = $$('#view tbody tr');
    if (rows.length !== 12) throw new Error('12 comptes attendus, trouvé ' + rows.length);
    /* filtre établissement = Lycée */
    const sels = $$('#view select');
    setSel(sels[0], 'etab-002'); await wait(400);
    rows = $$('#view tbody tr');
    if (rows.length !== 1 || !/admin-lycee/.test(norm(rows[0].textContent))) throw new Error('filtre Lycée : 1 compte admin-lycee attendu');
    setSel(sels[0], 'all'); await wait(300);
    /* filtre rôle = superadmin */
    setSel(sels[1], 'superadmin'); await wait(400);
    rows = $$('#view tbody tr');
    if (rows.length !== 1 || !/superadmin/.test(norm(rows[0].textContent))) throw new Error('filtre rôle superadmin incorrect');
    if (!/Administration générale/.test(norm(rows[0].textContent))) throw new Error('badge « Administration générale » absent');
    setSel(sels[1], 'all'); await wait(300);
    /* recherche */
    setInput($('#view .srch input'), 'lycee'); await wait(400);
    rows = $$('#view tbody tr');
    if (rows.length !== 1) throw new Error('recherche « lycee » : 1 résultat attendu, trouvé ' + rows.length);
    setInput($('#view .srch input'), ''); await wait(300);
    /* désactivation du censeur (Collège Bonneau) */
    const rowCens = $$('#view tbody tr').find(r => /censeur/.test(norm(r.textContent)));
    if (!rowCens) throw new Error('ligne censeur introuvable');
    click(rowCens.querySelector('button[title="Désactiver le compte"]')); await wait(300);
    click($('#modal-root .btn-danger')); await wait(500);
    if (!/désactivé/.test(norm($$('#view tbody tr').find(r => /censeur/.test(norm(r.textContent))).textContent)))
      throw new Error('badge désactivé absent');
    const ls = root();
    if (!ls.users.find(u => u.username === 'censeur' && u.actif === false)) throw new Error('désactivation non persistée');
    /* réinitialisation du mot de passe du titulaire */
    const rowTit = $$('#view tbody tr').find(r => /titulaire/.test(norm(r.textContent)));
    click(rowTit.querySelector('button[title="Réinitialiser le mot de passe"]')); await wait(400);
    setInput($('#modal-root input'), 'reseau2026');
    click([...$$('#modal-root .btn-pri')].find(b => /Réinitialiser/.test(norm(b.textContent)))); await wait(500);
    if (!/réinitialisé/.test(norm(d.body.textContent).toLowerCase())) throw new Error('toast de réinitialisation absent');
  });

  await step('journal réseau : fusion global + établissements, filtres et recherche', async () => {
    tab(/Journal réseau/); await wait(400);
    const t = norm($('#view').textContent);
    if (!/Administration générale/.test(t)) throw new Error('entrées du journal global absentes');
    if (!/Journal d\u2019activité du réseau/.test(t)) throw new Error('titre journal réseau absent');
    const rows = $$('#view tbody tr');
    if (rows.length < 8) throw new Error('journal fusionné trop court : ' + rows.length);
    /* recherche « suspendu » → entrée de suspension (journal global) */
    setInput($('#view .srch input'), 'suspendu'); await wait(400);
    const rs = $$('#view tbody tr');
    if (!rs.length || !rs.some(r => /Administration générale/.test(norm(r.textContent)) && /Lycée/.test(norm(r.textContent))))
      throw new Error('entrée de suspension absente du journal réseau');
    setInput($('#view .srch input'), ''); await wait(300);
    /* filtre établissement = Lycée → ses événements seulement */
    const sels = $$('#view select');
    setSel(sels[0], 'etab-002'); await wait(400);
    if (!$$('#view tbody tr').length) throw new Error('aucun événement du Lycée');
    if ($$('#view tbody tr').some(r => /Collège Bonneau|Administration générale/.test(norm(r.textContent))))
      throw new Error('le filtre établissement laisse passer d\u2019autres origines');
    setSel(sels[0], 'all'); await wait(300);
    /* filtre action = connexion */
    setSel(sels[1], 'connexion'); await wait(400);
    if (!$$('#view tbody tr').length) throw new Error('aucune connexion dans le journal');
    if ($$('#view tbody tr').some(r => !/Connexion/.test(norm(r.textContent)))) throw new Error('filtre action inopérant');
    setSel(sels[1], 'all'); await wait(300);
  });

  await step('contrôle effectif : comptes bloqués après suspension/désactivation', async () => {
    await login('admin-lycee', 'lycee2026', false);
    const err = norm($('#li-err') && $('#li-err').textContent);
    if (!/suspendu/.test(err)) throw new Error('message d\u2019établissement suspendu attendu, trouvé : ' + err);
    await login('censeur', 'censeur2026', false);
    const err2 = norm($('#li-err') && $('#li-err').textContent);
    if (!/Identifiants incorrects/.test(err2)) throw new Error('compte désactivé : message générique attendu, trouvé : ' + err2);
    /* le sélecteur de connexion ne propose plus l'établissement suspendu */
    const opts = [...$('#li-etab').options].map(o => norm(o.textContent)).join('|');
    if (/Lycée/.test(opts)) throw new Error('établissement suspendu encore proposé à la connexion : ' + opts);
    if (!/Collège Bonneau/.test(opts)) throw new Error('établissement actif absent du sélecteur : ' + opts);
    /* le mot de passe réinitialisé fonctionne */
    await login('titulaire', 'reseau2026');
    await login('superadmin', 'super2026');
  });

  await step('réactivation : levée immédiate du blocage', async () => {
    tab(/Établissements/); await wait(400);
    const card = $$('.etab-card').find(c => /Lycée/.test(norm(c.textContent)));
    click([...card.querySelectorAll('button')].find(b => /Réactiver/.test(norm(b.textContent)))); await wait(300);
    const okBtn = [...$$('#modal-root button')].find(b => /Réactiver/.test(norm(b.textContent)) && b.classList.contains('btn-pri'));
    if (!okBtn) throw new Error('bouton de confirmation Réactiver (non dangereux) absent');
    click(okBtn); await wait(500);
    if (/suspendu/.test(norm(card.textContent))) throw new Error('badge suspendu encore présent');
    tab(/Comptes/); await wait(400);
    const rowCens = $$('#view tbody tr').find(r => /censeur/.test(norm(r.textContent)));
    click(rowCens.querySelector('button[title="Activer le compte"]')); await wait(300);
    click($('#modal-root .btn-pri')); await wait(500);
    if (!/actif/.test(norm($$('#view tbody tr').find(r => /censeur/.test(norm(r.textContent))).textContent)))
      throw new Error('compte censeur non réactivé');
    /* l'administrateur du Lycée se reconnecte */
    await login('admin-lycee', 'lycee2026');
    const t = norm(d.body.textContent);
    if (!/Lycée/.test(t)) throw new Error('contexte Lycée non ouvert après réactivation');
    await login('superadmin', 'super2026');
  });

  await step('superadmin : ouverture d\u2019un établissement depuis la console', async () => {
    tab(/Vue d\u2019ensemble/); await wait(400);
    const cmpHead = $$('#view table thead').find(th => /Recouvrement/.test(norm(th.textContent)));
    const tbl = cmpHead.closest('table');
    const rowLyc = [...tbl.querySelectorAll('tbody tr')].find(r => /Lycée/.test(norm(r.textContent)));
    click([...rowLyc.querySelectorAll('button')].find(b => /Ouvrir/.test(norm(b.textContent)))); await wait(600);
    if (!/Tableau de bord/.test(norm($('.tb-title h1') && $('.tb-title h1').textContent))) throw new Error('tableau de bord non ouvert');
    if (!/Encaissements mensuels/.test(norm($('#view').textContent))) throw new Error('contenu du tableau de bord absent');
    if (!$('.sb-etabsel')) throw new Error('sélecteur d\u2019établissement absent pour le superadmin');
    /* retour console via le menu « Administration générale » */
    click($$('.nav-i').find(n => /Administration générale/.test(norm(n.textContent)))); await wait(500);
    if (!/Console superadministrateur/.test(norm($('#view').textContent))) throw new Error('retour console impossible');
  });

  await wait(400);
  if (errors.length){ console.error('✗ erreurs React :', errors.slice(0, 4)); fails++; }
  else console.log('✓ aucune erreur React pendant tout le parcours');

  console.log(fails ? '\n=== SMOKE v5.1 CONSOLE RÉSEAU : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v5.1 CONSOLE RÉSEAU : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
