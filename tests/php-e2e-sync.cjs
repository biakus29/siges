/* E2E v7.0 — SYNCHRONISATION SANS PERTE (serveur PHP + MySQL, base jetable) :
   Reproduit le bug historique « les noms disparaissent après
   enregistrement » : deux enregistrements rapprochés partaient avec le même
   numéro de révision — le serveur répondait 409 au second et l'application
   rechargeait l'état serveur : la seconde modification disparaissait.
   Vérifie la correction :
   • les envois vers le serveur sont SÉRIALISÉS (file d'attente) : deux
     créations en rafale (la première artificiellement ralentie) aboutissent
     TOUTES LES DEUX dans MySQL ;
   • la base reçue du serveur n'est pas renvoyée (pas de révision fantôme).
   Autoporté : extrait le zip, installe une base PRODUCTION (vide — depuis
   la v6.7 l'installateur ne crée plus de démonstration), injecte le jeu de
   test via l'API, démarre son propre serveur sur le port 4110, teste, puis
   nettoie tout. Prérequis : php, mariadb locaux ; zip = env ZIP. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4110;
const B = 'http://127.0.0.1:' + PORT;
const DB = 'aurel_sync66';
const ZIP = process.env.ZIP || '/home/user/AurelSchoolSIGES-v7.2.zip';
const TMP = '/tmp/sync66';
let fails = 0, srv = null;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }
function httpReq(method, url, body, headers){
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: Object.assign({ 'Content-Type':'application/json' }, headers || {}) }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  /* ---------- montage : zip → serveur → installation PRODUCTION + jeu de test ---------- */
  execSync(`rm -rf ${TMP} && mkdir -p ${TMP} && unzip -q ${ZIP} -d ${TMP}`, { stdio:'pipe' });
  const APP = path.join(TMP, 'aurel-school-siges');
  try { execSync(`sudo mariadb -e "DROP DATABASE IF EXISTS ${DB};"`, { stdio:'pipe' }); } catch(e){}
  srv = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: APP, stdio:'ignore', detached: false });
  await sleep(1500);
  let page = await httpReq('GET', B + '/install.php', null, {});
  const cookies = (page.headers && page.headers['set-cookie'] ? page.headers['set-cookie'] : []).map(c => c.split(';')[0]).join('; ');
  const nonce = (page.body.match(/name="nonce" value="([^"]+)"/) || [])[1];
  const post = fields => Object.entries(fields).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const inst = await httpReq('POST', B + '/install.php',
    post({ nonce, action:'installer', adresse:B + '/', mysql_host:'127.0.0.1', mysql_port:'3306',
      mysql_user:'aurel', mysql_pass:'aurel2026', mysql_base:DB, creer_base:'1', mode:'vide',
      etab_nom:'Collège Sync Test', admin_user:'admin', admin_nom:'Admin Sync', admin_pwd:'admin2026', admin_pwd2:'admin2026' }),
    { 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookies });
  if (!/Installation terminée/.test(inst.body)) throw new Error('installation production impossible : ' + inst.body.slice(0, 300));
  const health = JSON.parse((await httpReq('GET', B + '/api/health')).body);
  if (!health.ok || health.version !== '7.2') throw new Error('attendu v7.1 : ' + JSON.stringify(health));
  /* v6.7 : le jeu de test n'existe plus à l'installation — on l'injecte via
     l'API (opération légitime d'un administrateur) pour retrouver un
     établissement avec séquences et comptes. */
  const lg = await httpReq('POST', B + '/api/auth/login', JSON.stringify({ username:'admin', pwd:'admin2026' }));
  const tok = JSON.parse(lg.body).token;
  const cur = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body);
  const seedMod = await import('file://' + path.resolve(__dirname, '../src/core/seed.js'));
  const pj = JSON.parse((await httpReq('POST', B + '/api/db', JSON.stringify({ rev: cur.rev, db: seedMod.buildSeed() }),
    { Authorization:'Bearer ' + tok })).body);
  if (!pj.ok) throw new Error('injection du jeu de test impossible : ' + JSON.stringify(pj).slice(0, 200));
  const rev0 = pj.rev;

  const html = (await httpReq('GET', B + '/')).body;
  const js = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
  let premierPostFait = false;
  const errors = [];
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, '')
      + '<scr' + 'ipt>window.__AUREL_POLL_MS = 15000;</scr' + 'ipt><scr' + 'ipt>' + js + '</scr' + 'ipt>',
    { runScripts:'dangerously', url: B + '/', pretendToBeVisual:true,
      beforeParse(w){
        w.scrollTo = () => {}; w.print = () => {};
        w.fetch = (url, opts) => new Promise((resolve, reject) => {
          const u = new URL(String(url), B + '/');
          const isPostDb = (opts && opts.method === 'POST') && /\/api\/db$/.test(u.pathname);
          const envoi = () => {
            const req = http.request(u.href, { method:(opts && opts.method) || 'GET', headers:(opts && opts.headers) || {} }, res => {
              let d = '';
              res.on('data', c => d += c);
              res.on('end', () => resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode,
                json: () => Promise.resolve(JSON.parse(d)), text: () => Promise.resolve(d)
              }));
            });
            req.on('error', reject);
            if (opts && opts.body) req.write(opts.body);
            req.end();
          };
          /* le PREMIER envoi de la base est ralenti de 800 ms : garantit le
             chevauchement avec le second enregistrement (l'ancien code
             perdait alors la seconde modification — conflit 409). */
          if (isPostDb && !premierPostFait){ premierPostFait = true; setTimeout(envoi, 800); }
          else envoi();
        });
        w.addEventListener('error', e => errors.push(e.message));
        w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(/i.test(s)) errors.push('console.error: ' + s); };
      } });
  const w = dom.window, d = w.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
  function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
  function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
  const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));

  await wait(1200);
  await step('connexion admin (serveur)', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(1500);
    if (!$('#app')) throw new Error('app absente après login');
  });

  await step('deux créations en rafale (1er envoi ralenti de 800 ms) : aucune perte', async () => {
    nav(/Séquences & appréciations/); await wait(700);
    const submitSeq = async libelle => {
      click($$('#view button').filter(b => !b.closest('.nav-i')).find(b => /Nouvelle séquence/.test(norm(b.textContent))));
      let waitModal = 0; while (!$('#ff-libelle') && waitModal++ < 40) await wait(100);
      setInput($('#ff-libelle'), libelle);
      const btn = $$('#modal-root .m-f .btn-pri, #modal-root .btn-pri').find(b => /Enregistrer|Ajouter|Créer/.test(norm(b.textContent)));
      if (!btn) throw new Error('bouton d\u2019enregistrement de la séquence introuvable');
      click(btn);
    };
    await submitSeq('Sync Test A');
    await wait(150);   /* pas d'attente : enchaîner immédiatement */
    /* séquence B — pendant que l'envoi de A est encore en vol */
    await submitSeq('Sync Test B');
    await wait(3000);   /* le temps que la file sérialisée pousse A puis B */
    /* vérification DIRECTE côté serveur : les deux séquences dans MySQL */
    const r = await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok });
    const j = JSON.parse(r.body);
    const base = (j.db.bases || []).find(x => x.id === 'etab-001') || j.db;
    const noms = (base.sequences || []).map(s => s.libelle);
    if (!noms.includes('Sync Test A')) throw new Error('« Sync Test A » PERDUE côté serveur — séquences : ' + noms.filter(n => /Sync/.test(n)).join(', '));
    if (!noms.includes('Sync Test B')) throw new Error('« Sync Test B » PERDUE côté serveur (bug historique) — ' + noms.filter(n => /Sync/.test(n)).join(', '));
    if (j.rev < rev0 + 2) throw new Error('révision serveur inattendue : ' + rev0 + ' → ' + j.rev + ' (2 envois attendus)');
    if (!premierPostFait) throw new Error('le test n\u2019a pas ralenti le premier envoi (invalide)');
  });

  await step('la base reçue du serveur n\u2019est pas renvoyée (aucune révision fantôme)', async () => {
    const revA = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body).rev;
    await wait(1800);   /* aucun changement local : aucune nouvelle révision ne doit apparaître */
    const revB = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body).rev;
    if (revB !== revA) throw new Error('révision serveur montée sans modification (' + revA + ' → ' + revB + ') : renvoi de la base reçue');
  });

  await step('v7.2 — diagnostic de connexion intégré (badge cliquable)', async () => {
    const badge = $('#sync-badge');
    if (!badge) throw new Error('badge de synchronisation absent');
    click(badge);
    let n = 0; while (!$('#diag-modal') && n++ < 50) await wait(100);
    if (!$('#diag-modal')) throw new Error('fenêtre de diagnostic absente après clic sur le badge');
    const runBtn = $$('button').find(b => /Lancer les tests/.test(norm(b.textContent)));
    if (!runBtn) throw new Error('bouton « Lancer les tests » introuvable');
    click(runBtn);
    let m = 0;
    while (m++ < 160){ if ($('#diag-conclusion')) break; await wait(250); }
    if (!$('#diag-conclusion')) throw new Error('diagnostic non terminé (pas de conclusion)');
    const rows = $$('#diag-modal .diag-row');
    if (rows.length < 4) throw new Error('tests incomplets : ' + rows.length + '/4 lignes affichées');
    const txt = norm($('#diag-modal').textContent);
    if (!/api\/health/.test(txt)) throw new Error('test de sonde absent');
    if (!/POST api\/db/.test(txt)) throw new Error('test d\u2019envoi absent');
    if (!/HTTP 200|HTTP 409/.test(norm(rows[3].textContent))) throw new Error('envoi de test non réussi : ' + norm(rows[3].textContent).slice(0, 120));
    const closeBtn = $$('#diag-modal .m-x')[0];
    if (closeBtn) click(closeBtn);
    await wait(300);
  });

  await step('v7.2 — transport AUREL1 (base64) décodé par le serveur + JSON legacy accepté', async () => {
    const revServ = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body).rev;
    const corps = JSON.stringify({ rev: revServ + 1000, db: { users: [{ id:'us-x', username:'x', role:'admin', hash:'x', salt:'x' }], etablissements: [], bases: [] } });
    const b64 = Buffer.from(corps, 'utf8').toString('base64');
    /* transport v7.2 : corps base64 + text/plain — doit être décodé puis
       refusé PROPREMENT (409 : révision volontairement périmée) */
    const r1 = await httpReq('POST', B + '/api/db', 'AUREL1:' + b64,
      { Authorization:'Bearer ' + tok, 'Content-Type':'text/plain;charset=UTF-8' });
    if (r1.status !== 409) throw new Error('AUREL1 : attendu 409, reçu ' + r1.status + ' — ' + String(r1.body).slice(0, 140));
    /* ancien format JSON : toujours accepté (compatibilité) */
    const r2 = await httpReq('POST', B + '/api/db', corps,
      { Authorization:'Bearer ' + tok, 'Content-Type':'application/json' });
    if (r2.status !== 409) throw new Error('JSON legacy : attendu 409, reçu ' + r2.status + ' — ' + String(r2.body).slice(0, 140));
  });

  if (errors.length){ console.error('Erreurs runtime :'); errors.slice(0, 8).forEach(e => console.error('  ' + e)); fails++; }
  console.log(fails ? '\n=== E2E SYNCHRONISATION v7.2 : ÉCHEC (' + fails + ') ===' : '\n=== E2E SYNCHRONISATION v7.2 : OK ===');

  /* ---------- nettoyage ---------- */
  try { srv && srv.kill('SIGKILL'); } catch(e){}
  try { execSync(`sudo mariadb -e "DROP DATABASE IF EXISTS ${DB};"`, { stdio:'pipe' }); } catch(e){}
  try { execSync('rm -rf ' + TMP, { stdio:'pipe' }); } catch(e){}
  process.exit(fails ? 1 : 0);
})().catch(e => {
  console.error('ERREUR FATALE :', e.message);
  try { srv && srv.kill('SIGKILL'); } catch(_){}
  try { execSync(`sudo mariadb -e "DROP DATABASE IF EXISTS ${DB};"`, { stdio:'pipe' }); } catch(_){}
  try { execSync('rm -rf ' + TMP, { stdio:'pipe' }); } catch(_){}
  process.exit(1);
});
