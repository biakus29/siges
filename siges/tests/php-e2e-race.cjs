/* E2E v7.2 — COURSE DÉTECTION/CONNEXION + REPLI LOCAL (jetable) :
   Reproduit le défaut signalé : « Après installation, l'application affiche
   "Serveur injoignable, modification conservée en local" et aucune donnée
   n'est disponible après déconnexion/reconnexion ».
   CAUSE : la connexion cliquée AVANT la fin de la détection du serveur
   basculait par erreur en mode LOCAL (jeu de démonstration local, qui
   accepte admin/admin2026) — les saisies restaient dans le navigateur.
   Phase 1 — serveur LENt (health artificiellement ralenti de 3 s) :
   • la connexion cliquée pendant la détection DOIT attendre la sonde et
     se faire CÔTÉ SERVEUR (0 élèves de la base vide, pas les 461 du jeu
     local de secours) ;
   • la modification (journal de connexion) DOIT arriver dans MySQL.
   Phase 2 — sonde en échec puis serveur revenu :
   • 1er appel health refusé (503) → écran de connexion : avertissement
     « mode local de secours » VISIBLE ;
   • la tentative de connexion RETENTE la sonde → connexion serveur OK.
   Autoporté : extrait le zip, patche la COPIE de test (ralentissement et
   panne simulée), installe, teste, nettoie. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4114;
const B = 'http://127.0.0.1:' + PORT;
const ZIP = process.env.ZIP || '/home/user/AurelSchoolSIGES-v7.2.zip';
const TMP = '/tmp/race69';
const DB = 'aurel_race69';
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
const post = fields => Object.entries(fields).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

function bootApp(){
  const html = fs.readFileSync(path.join(TMP, 'aurel-school-siges', 'index.html'), 'utf8');
  const js = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, '') + '<scr' + 'ipt>' + js + '</scr' + 'ipt>',
    { runScripts:'dangerously', url: B + '/', pretendToBeVisual:true,
      beforeParse(w){
        w.scrollTo = () => {}; w.print = () => {};
        w.fetch = (url, opts) => new Promise((resolve, reject) => {
          const u = new URL(String(url), B + '/');
          const req = http.request(u.href, { method:(opts && opts.method) || 'GET', headers:(opts && opts.headers) || {} }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode,
              json: () => Promise.resolve(JSON.parse(d)), text: () => Promise.resolve(d) }));
          });
          req.on('error', reject);
          if (opts && opts.body) req.write(opts.body);
          req.end();
        });
        w.addEventListener('error', () => {});
        w.console.error = () => {};
      } });
  return dom;
}

(async () => {
  execSync(`rm -rf ${TMP} && mkdir -p ${TMP} && unzip -q ${ZIP} -d ${TMP}`, { stdio:'pipe' });
  const APP = path.join(TMP, 'aurel-school-siges');
  try { execSync(`sudo mariadb -e "DROP DATABASE IF EXISTS ${DB};"`, { stdio:'pipe' }); } catch(e){}

  /* ---- installation production (admin/admin2026 — comme l'utilisateur) ---- */
  srv = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: APP, stdio:'ignore' });
  await sleep(1200);
  {
    const page = await httpReq('GET', B + '/install.php', null, {});
    const cookies = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const nonce = (page.body.match(/name="nonce" value="([^"]+)"/) || [])[1];
    const inst = await httpReq('POST', B + '/install.php',
      post({ nonce, action:'installer', adresse:B + '/', mysql_host:'127.0.0.1', mysql_port:'3306',
        mysql_user:'aurel', mysql_pass:'aurel2026', mysql_base:DB, creer_base:'1', mode:'vide',
        etab_nom:'Collège Race Test', admin_user:'admin', admin_nom:'Admin Race', admin_pwd:'admin2026', admin_pwd2:'admin2026' }),
      { 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookies });
    if (!/Installation terminée/.test(inst.body)) throw new Error('installation impossible : ' + inst.body.replace(/<[^>]+>/g, ' ').slice(0, 250));
  }

  /* ---- PHASE 1 : health ralenti de 3 s — connexion pendant la détection ---- */
  {
    const idx = path.join(APP, 'api', 'index.php');
    let t = fs.readFileSync(idx, 'utf8');
    const ancre = "if ($route === '/health' && $method === 'GET'){";
    if (!t.includes(ancre)) throw new Error('ancre health introuvable');
    t = t.replace(ancre, ancre + "\n  usleep(3000000); /* TEST : simule un serveur distant lent au premier appel */", 1);
    fs.writeFileSync(idx, t);
    const lg = await httpReq('POST', B + '/api/auth/login', JSON.stringify({ username:'admin', pwd:'admin2026' }));
    const tok = JSON.parse(lg.body).token;

    const dom = bootApp();
    const w = dom.window, d = w.document;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
    const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
    function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
    function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }

    await wait(400);          /* la sonde (health) est EN COURS — elle prend 3 s */
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn'));      /* connexion cliquée PENDANT la détection */
    await wait(6500);         /* sonde 3 s + connexion + récupération de la base */

    await step('P1. connexionPendantDétection → session SERVEUR (pas le jeu local)', async () => {
      if (!$('#app')) throw new Error('application absente après connexion');
      const t2 = norm(d.body.textContent);
      if (t2.includes('Collège Race Test') === false && t2.includes('Admin Race') === false)
        throw new Error('établissement de l\u2019installation absent — session locale (jeu de démonstration) au lieu du serveur ?');
    });
    await step('P1. base SERVEUR (0 élève), pas le jeu local (461)', async () => {
      click($$('.nav-i').find(n => /Élèves & inscriptions/.test(norm(n.textContent)))); await wait(600);
      const rows = $$('#view tbody tr').length;
      if (/BON-26-|Egbe Kevin/.test(norm($('#view').textContent))) throw new Error('jeu de démonstration LOCAL affiché — la course n\u2019est pas corrigée !');
      console.log('   (lignes élèves affichées : ' + rows + ' — base vide attendue)');
    });
    await step('P1. le journal de connexion est bien arrivé dans MySQL', async () => {
      const j = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body);
      const base = (j.db.bases || [])[0] || j.db;
      const evts = (base.journal || []).concat(j.db.journalGlobal || []);
      const conn = evts.some(e => /Connexion réussie \(serveur\)/.test(e.details || ''));
      if (!conn) throw new Error('journal de connexion serveur introuvable (rev=' + j.rev + ') — événements : ' + evts.slice(0, 3).map(e => e.action).join(', '));
      if (j.rev < 2) throw new Error('révision serveur inattendue : ' + j.rev + ' (le journal aurait dû être poussé)');
    });
    await step('P1. aucun envoi de base locale non issue du serveur', async () => {
      const j = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body);
      const base = (j.db.bases || [])[0] || j.db;
      if ((base.eleves || []).length > 0) throw new Error('des élèves du jeu local ont été envoyés au serveur !');
      if (/Démo|Bonneau/.test(JSON.stringify(j.db.etablissements || []))) throw new Error('l\u2019établissement de démonstration a écrasé celui du serveur !');
    });
    w.close();
  }

  /* ---- PHASE 2 : sonde refusée une fois → avertissement + re-sonde à la connexion ---- */
  {
    srv.kill('SIGKILL'); await sleep(300);
    execSync(`rm -f ${APP}/config.php && rm -rf ${APP}/data`, { stdio:'pipe' });
    try { execSync(`sudo mariadb -e "DROP DATABASE IF EXISTS ${DB};"`, { stdio:'pipe' }); } catch(e){}
    /* le premier /api/health échoue (503), les suivants répondent */
    const idx = path.join(APP, 'api', 'index.php');
    let t = fs.readFileSync(idx, 'utf8');
    t = t.replace("usleep(3000000); /* TEST : simule un serveur distant lent au premier appel */", '', 1);
    const ancre = "if ($route === '/health' && $method === 'GET'){";
    t = t.replace(ancre, ancre + "\n  { $pf = __DIR__ . '/../data/hfail.flag'; if (!is_file($pf)){ @touch($pf); http_response_code(503); header('Content-Type: application/json'); echo '{\"ok\":false}'; exit; } } /* TEST : 1er appel en échec */", 1);
    fs.writeFileSync(idx, t);
    srv = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: APP, stdio:'ignore' });
    await sleep(1200);
    {
      const page = await httpReq('GET', B + '/install.php', null, {});
      const cookies = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      const nonce = (page.body.match(/name="nonce" value="([^"]+)"/) || [])[1];
      const inst = await httpReq('POST', B + '/install.php',
        post({ nonce, action:'installer', adresse:B + '/', mysql_host:'127.0.0.1', mysql_port:'3306',
          mysql_user:'aurel', mysql_pass:'aurel2026', mysql_base:DB, creer_base:'1', mode:'vide',
          etab_nom:'Collège Race Test', admin_user:'admin', admin_nom:'Admin Race', admin_pwd:'admin2026', admin_pwd2:'admin2026' }),
        { 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookies });
      if (!/Installation terminée/.test(inst.body)) throw new Error('installation phase 2 impossible');
    }
    const dom = bootApp();
    const w = dom.window, d = w.document;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const $ = s => d.querySelector(s);
    const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
    function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
    function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }

    await wait(1500);   /* sonde : 1er appel → 503 → repli local détecté */
    await step('P2. repli local SIGNALÉ sur l\u2019écran de connexion', async () => {
      const note = $('#li-localwarn');
      if (!note) throw new Error('avertissement « mode local de secours » absent de l\u2019écran de connexion');
      if (!/mode local de secours/.test(norm(note.textContent))) throw new Error('avertissement incomplet');
    });
    await step('P2. la connexion RETENTE la sonde → session serveur', async () => {
      setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
      click($('.lw-btn'));
      let n = 0; while (!$('#app') && n++ < 60) await wait(250);
      if (!$('#app')) throw new Error('connexion refusée (le re-sondage n\u2019a pas fonctionné ?)');
      await wait(2500);   /* récupération + journal */
      const lg = await httpReq('POST', B + '/api/auth/login', JSON.stringify({ username:'admin', pwd:'admin2026' }));
      const tok = JSON.parse(lg.body).token;
      const j = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body);
      const base = (j.db.bases || [])[0] || j.db;
      const evts = (base.journal || []).concat(j.db.journalGlobal || []);
      if (!evts.some(e => /Connexion réussie \(serveur\)/.test(e.details || '')))
        throw new Error('la session n\u2019est PAS passée par le serveur après re-sondage — événements : ' + evts.slice(0, 3).map(e => e.action).join(', '));
    });
    w.close();
  }

  console.log(fails ? '\n=== E2E COURSE v7.2 : ÉCHEC (' + fails + ') ===' : '\n=== E2E COURSE v7.2 : OK ===');
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
