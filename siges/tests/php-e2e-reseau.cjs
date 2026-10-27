/* E2E v7.2 — RÉSEAU D'ÉTABLISSEMENTS / PREMIER SUPERADMINISTRATEUR (jetable) :
   Phase A — installation production SANS réseau :
   • un seul compte (administrateur) ; aucun superadmin ;
   • l'administrateur crée le premier superadministrateur par le chemin de
     l'application (POST /api/db — autorisé pour un administrateur) ;
   • le nouveau compte se connecte : rôle superadmin, console réseau.
   Phase B — installation production AVEC la case « Réseau d'établissements » :
   • DEUX comptes créés (administrateur + superadministrateur) ;
   • le superadministrateur se connecte (console réseau), l'administrateur
     aussi (établissement) ; identifiants distincts contrôlés.
   Autoporté : extrait le zip, installe, teste, nettoie (bases jetables). */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 4111;
const B = 'http://127.0.0.1:' + PORT;
const ZIP = process.env.ZIP || '/home/user/AurelSchoolSIGES-v7.2.zip';
const TMP = '/tmp/reseau68';
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
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

async function installer(DB, extra){
  const page = await httpReq('GET', B + '/install.php', null, {});
  const cookies = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const nonce = (page.body.match(/name="nonce" value="([^"]+)"/) || [])[1];
  const post = fields => Object.entries(fields).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const inst = await httpReq('POST', B + '/install.php',
    post(Object.assign({ nonce, action:'installer', adresse:B + '/', mysql_host:'127.0.0.1', mysql_port:'3306',
      mysql_user:'aurel', mysql_pass:'aurel2026', mysql_base:DB, creer_base:'1', mode:'vide',
      etab_nom:'Groupe Scolaire E2E', admin_user:'admin', admin_nom:'Admin E2E', admin_pwd:'admin2026', admin_pwd2:'admin2026' }, extra || {})),
    { 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookies });
  if (!/Installation terminée/.test(inst.body)) throw new Error('installation impossible : ' + inst.body.replace(/<[^>]+>/g, ' ').slice(0, 300));
  const h = JSON.parse((await httpReq('GET', B + '/api/health')).body);
  if (!h.ok || h.version !== '7.2') throw new Error('attendu v7.2 : ' + JSON.stringify(h));
}
async function login(u, p){
  const r = await httpReq('POST', B + '/api/auth/login', JSON.stringify({ username:u, pwd:p }));
  const j = JSON.parse(r.body);
  if (!j.ok) throw new Error('login ' + u + ' refusé : ' + JSON.stringify(j).slice(0, 120));
  return j;
}

(async () => {
  execSync(`rm -rf ${TMP} && mkdir -p ${TMP} && unzip -q ${ZIP} -d ${TMP}`, { stdio:'pipe' });
  const APP = path.join(TMP, 'aurel-school-siges');
  try { execSync('sudo mariadb -e "DROP DATABASE IF EXISTS aurel_res68a; DROP DATABASE IF EXISTS aurel_res68b;"', { stdio:'pipe' }); } catch(e){}

  /* ---------- Phase A : sans réseau ---------- */
  srv = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: APP, stdio:'ignore' });
  await sleep(1500);
  await step('A1. installation production sans réseau : un seul compte', async () => {
    await installer('aurel_res68a');
    const j = await login('admin', 'admin2026');
    if (j.user.role !== 'admin') throw new Error('rôle inattendu : ' + j.user.role);
    const db = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + j.token })).body).db;
    if ((db.users || []).length !== 1) throw new Error((db.users || []).length + ' comptes au lieu de 1');
    if ((db.users || []).some(u => u.role === 'superadmin')) throw new Error('un superadmin existe déjà ?!');
  });

  await step('A2. l\u2019administrateur crée le premier superadministrateur (chemin de l\u2019application)', async () => {
    const j = await login('admin', 'admin2026');
    const cur = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + j.token })).body);
    const db = cur.db;
    const salt = 'e2esalt68';
    db.users.push({ id:'us-super', username:'direction', nom:'Direction Générale', role:'superadmin',
      actif:true, salt, hash:sha(salt + ':direction2026'), dernierAcces:null, etablissementId:null });
    const push = await httpReq('POST', B + '/api/db', JSON.stringify({ rev:cur.rev, db }),
      { Authorization:'Bearer ' + j.token });
    const pj = JSON.parse(push.body);
    if (!pj.ok) throw new Error('création refusée par le serveur : ' + JSON.stringify(pj).slice(0, 150));
  });

  await step('A3. le superadministrateur se connecte : console réseau', async () => {
    const j = await login('direction', 'direction2026');
    if (j.user.role !== 'superadmin') throw new Error('rôle inattendu : ' + j.user.role);
    if (j.user.etablissementId) throw new Error('le superadmin ne doit appartenir à aucun établissement');
  });

  /* ---------- Phase B : case « Réseau d'établissements » ---------- */
  await step('B1. installation AVEC réseau : deux comptes créés', async () => {
    srv.kill('SIGKILL');
    execSync(`rm -f ${APP}/config.php && rm -rf ${APP}/data`, { stdio:'pipe' });
    srv = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: APP, stdio:'ignore' });
    await sleep(1200);
    await installer('aurel_res68b', { reseau:'1', su_user:'dgnet', su_nom:'Direction Générale', su_pwd:'reseau2026', su_pwd2:'reseau2026' });
    const db = JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + (await login('admin','admin2026')).token })).body).db;
    const roles = (db.users || []).map(u => u.role).sort().join(',');
    if (roles !== 'admin,superadmin') throw new Error('comptes créés : ' + roles);
    const su = db.users.find(u => u.role === 'superadmin');
    if (su.username !== 'dgnet' || su.etablissementId !== null) throw new Error('superadmin mal formé : ' + JSON.stringify(su).slice(0, 120));
  });

  await step('B2. les deux comptes se connectent (rôles distincts)', async () => {
    const su = await login('dgnet', 'reseau2026');
    if (su.user.role !== 'superadmin') throw new Error('dg devrait être superadmin');
    const ad = await login('admin', 'admin2026');
    if (ad.user.role !== 'admin') throw new Error('admin devrait rester admin');
  });

  await step('B3. garde : identifiant superadmin ≠ administrateur (validation installateur)', async () => {
    srv.kill('SIGKILL');
    execSync(`rm -f ${APP}/config.php && rm -rf ${APP}/data`, { stdio:'pipe' });
    try { execSync('sudo mariadb -e "DROP DATABASE IF EXISTS aurel_res68c;"', { stdio:'pipe' }); } catch(e){}
    srv = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: APP, stdio:'ignore' });
    await sleep(1200);
    const page = await httpReq('GET', B + '/install.php', null, {});
    const cookies = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const nonce = (page.body.match(/name="nonce" value="([^"]+)"/) || [])[1];
    const post = fields => Object.entries(fields).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    const inst = await httpReq('POST', B + '/install.php',
      post({ nonce, action:'installer', adresse:B + '/', mysql_host:'127.0.0.1', mysql_port:'3306',
        mysql_user:'aurel', mysql_pass:'aurel2026', mysql_base:'aurel_res68c', creer_base:'1', mode:'vide',
        etab_nom:'X', admin_user:'admin', admin_nom:'A', admin_pwd:'admin2026', admin_pwd2:'admin2026',
        reseau:'1', su_user:'admin', su_nom:'DG', su_pwd:'reseau2026', su_pwd2:'reseau2026' }),
      { 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookies });
    if (/Installation terminée/.test(inst.body)) throw new Error('identifiants identiques acceptés !');
    if (!/doit être différent de celui de l'administrateur/.test(inst.body.replace(/&#039;|&apos;/g, "'"))) throw new Error('message attendu absent');
  });

  console.log(fails ? '\n=== E2E RÉSEAU v7.2 : ÉCHEC (' + fails + ') ===' : '\n=== E2E RÉSEAU v7.2 : OK ===');
  try { srv && srv.kill('SIGKILL'); } catch(e){}
  try { execSync('sudo mariadb -e "DROP DATABASE IF EXISTS aurel_res68a; DROP DATABASE IF EXISTS aurel_res68b; DROP DATABASE IF EXISTS aurel_res68c;"', { stdio:'pipe' }); } catch(e){}
  try { execSync('rm -rf ' + TMP, { stdio:'pipe' }); } catch(e){}
  process.exit(fails ? 1 : 0);
})().catch(e => {
  console.error('ERREUR FATALE :', e.message);
  try { srv && srv.kill('SIGKILL'); } catch(_){}
  try { execSync('sudo mariadb -e "DROP DATABASE IF EXISTS aurel_res68a; DROP DATABASE IF EXISTS aurel_res68b; DROP DATABASE IF EXISTS aurel_res68c;"', { stdio:'pipe' }); } catch(_){}
  try { execSync('rm -rf ' + TMP, { stdio:'pipe' }); } catch(_){}
  process.exit(1);
});
