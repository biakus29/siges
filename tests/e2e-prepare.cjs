/* Prépare un serveur E2E sur une installation FRAÎCHE (fichiers + base vide).
   Depuis la v6.7, l'installateur ne crée plus de démonstration : ce script
   1) installe en mode PRODUCTION (base vide + compte admin admin/admin2026
      + établissement « Collège E2E »), puis
   2) injecte le jeu de données de test complet (buildSeed) via l'API
      (POST /api/db, opération légitime d'un administrateur), afin que les
      suites E2E (élèves, paiements, profils…) trouvent des données.
   Usage :
     E2E_URL=http://127.0.0.1:4107 DB=aurel_e2e node tests/e2e-prepare.cjs
   Options env : DB (base, déf. aurel_e2e), MYSQL_USER/MYSQL_PASS (déf.
   aurel/aurel2026), HOST (déf. 127.0.0.1). Le serveur PHP doit déjà tourner
   sur E2E_URL avec des fichiers non installés et la base inexistante. */
const http = require('http');
const path = require('path');
const B = process.env.E2E_URL || 'http://127.0.0.1:8080';
const DB = process.env.DB || 'aurel_e2e';
const MU = process.env.MYSQL_USER || 'aurel';
const MP = process.env.MYSQL_PASS || 'aurel2026';
const HOST = process.env.HOST || '127.0.0.1';

function httpReq(method, urlPath, body, headers){
  return new Promise((resolve, reject) => {
    const req = http.request(B + urlPath, { method, headers: Object.assign({ 'Content-Type':'application/json' }, headers || {}) }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
const post = fields => Object.entries(fields).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

(async () => {
  /* 1. installation production (base vide) */
  const page = await httpReq('GET', '/install.php', null, {});
  if (/déjà installée/i.test(page.body)) throw new Error('le serveur est déjà installé — repartez de fichiers frais');
  const cookies = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const nonce = (page.body.match(/name="nonce" value="([^"]+)"/) || [])[1];
  const inst = await httpReq('POST', '/install.php',
    post({ nonce, action:'installer', adresse:B + '/', mysql_host:HOST, mysql_port:'3306',
      mysql_user:MU, mysql_pass:MP, mysql_base:DB, creer_base:'1', mode:'vide',
      etab_nom:'Collège E2E', admin_user:'admin', admin_nom:'Admin E2E', admin_pwd:'admin2026', admin_pwd2:'admin2026' }),
    { 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookies });
  if (!/Installation terminée/.test(inst.body)) throw new Error('installation impossible : ' + inst.body.replace(/<[^>]+>/g, ' ').slice(0, 300));
  const health = JSON.parse((await httpReq('GET', '/api/health')).body);
  if (!health.ok || health.version !== '7.2') throw new Error('attendu v7.1 : ' + JSON.stringify(health));
  console.log('✓ installation production v7.2 (base vide, admin/admin2026, Collège E2E)');

  /* 2. injection du jeu de test via l'API (droits administrateur) */
  const lg = await httpReq('POST', '/api/auth/login', JSON.stringify({ username:'admin', pwd:'admin2026' }));
  const tok = JSON.parse(lg.body).token;
  const cur = JSON.parse((await httpReq('GET', '/api/db', null, { Authorization:'Bearer ' + tok })).body);
  const seedMod = await import('file://' + path.resolve(__dirname, '../src/core/seed.js'));
  const seed = seedMod.buildSeed();
  const push = await httpReq('POST', '/api/db', JSON.stringify({ rev: cur.rev, db: seed }),
    { Authorization:'Bearer ' + tok, 'Content-Type':'application/json' });
  const pj = JSON.parse(push.body);
  if (!pj.ok) throw new Error('injection du jeu de test refusée : ' + JSON.stringify(pj).slice(0, 200));
  /* 3. vérification : les données de test sont bien là */
  const apres = JSON.parse((await httpReq('GET', '/api/db', null, { Authorization:'Bearer ' + tok })).body);
  const nb = (apres.db.bases || []).reduce((n, b) => n + (b.eleves || []).length, 0);
  if (nb < 400) throw new Error('jeu de test incomplet (' + nb + ' élèves)');
  console.log('✓ jeu de test injecté via l\u2019API : ' + nb + ' élèves, rev ' + cur.rev + ' → ' + apres.rev);
  console.log('serveur prêt : ' + B);
})().catch(e => { console.error('PRÉPARATION E2E : ÉCHEC —', e.message); process.exit(1); });
