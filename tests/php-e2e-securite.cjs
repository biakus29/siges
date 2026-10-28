/* E2E v6.4 — SÉCURITÉ SERVEUR (base de test jetable) :
   • CSP et en-têtes de sécurité présents (pages et API) ;
   • élévation de privilèges bloquée : un LECTEUR ne peut pas s'octroyir
     le rôle administrateur par appel direct de l'API (POST /api/db) ;
   • lecteur : consultation seule (journal et propre dernierAcces exceptés) ;
   • économe : données autorisées, mais comptes/établissements protégés ;
   • plafond de taille des charges (413) ;
   • blocage après 5 mots de passe erronés (429).
   URL cible : E2E_URL (défaut http://127.0.0.1:8082). */
const http = require('http');
const B = process.env.E2E_URL || 'http://127.0.0.1:8082';

function httpReq(method, path, body, headers){
  return new Promise((resolve, reject) => {
    const req = http.request(B + path, { method, headers: Object.assign({'Content-Type':'application/json'}, headers || {}) }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
const jbody = r => { try { return JSON.parse(r.body); } catch(e){ return {}; } };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  let r = await httpReq('GET', '/api/health');
  await step('sonde : API v5.6 opérationnelle', async () => {
    const j = jbody(r);
    if (!j.ok || j.version !== '7.2') throw new Error('attendu v7.1, reçu ' + JSON.stringify(j).slice(0, 80));
  });
  await step('en-têtes de sécurité : CSP sur les pages ET sur l\u2019API', async () => {
    const page = await httpReq('GET', '/');
    const cspPage = page.headers['content-security-policy'] || '';
    const cspApi = r.headers['content-security-policy'] || '';
    if (!/default-src 'self'/.test(cspPage) || !/script-src 'self'/.test(cspPage)) throw new Error('CSP page absente : ' + cspPage);
    if (!/default-src 'none'/.test(cspApi)) throw new Error('CSP API absente : ' + cspApi);
    if ((page.headers['x-frame-options'] || '') !== 'DENY') throw new Error('X-Frame-Options absent');
  });

  /* ---- jetons ---- */
  const login = async (u, p) => jbody(await httpReq('POST', '/api/auth/login', JSON.stringify({ username:u, pwd:p })));
  const getDb = async tok => jbody(await httpReq('GET', '/api/db', null, { Authorization:'Bearer ' + tok }));
  const pushDb = async (tok, db, rev) => httpReq('POST', '/api/db', JSON.stringify({ rev, db }), { Authorization:'Bearer ' + tok });

  const adm = await login('admin', 'admin2026');
  await step('connexion administrateur', async () => { if (!adm.ok) throw new Error(adm.msg); });

  /* ---- lecteur : tentative d'élévation de privilèges ---- */
  const lec = await login('lecteur', 'lecteur2026');
  await step('connexion lecteur', async () => { if (!lec.ok) throw new Error(lec.msg); });

  await step('BLOCAGE : lecteur ne peut pas devenir administrateur (POST /api/db)', async () => {
    const d = await getDb(lec.token);
    const db = d.db;
    const me = db.users.find(u => u.id === lec.user.id);
    me.role = 'admin';                                     /* élévation de privilèges */
    const res = await pushDb(lec.token, db, d.rev);
    if (res.status !== 403) throw new Error('attendu 403, reçu ' + res.status + ' : ' + res.body.slice(0, 120));
    /* vérification : le rôle n'a pas changé côté serveur */
    const d2 = await getDb(lec.token);
    if ((d2.db.users.find(u => u.id === lec.user.id) || {}).role === 'admin') throw new Error('le rôle a été modifié !');
  });

  await step('lecteur : journal de connexion et propre dernierAcces acceptés', async () => {
    const d = await getDb(lec.token);
    const db = d.db;
    const me = db.users.find(u => u.id === lec.user.id);
    me.dernierAcces = new Date().toISOString().slice(0, 16);
    const b0 = db.bases.find(x => x.id === 'etab-001') || db.bases[0];
    b0.journal = b0.journal || [];
    b0.journal.unshift({ id:'j-test', date:me.dernierAcces, user:'lecteur', action:'connexion', details:'Test e2e' });
    const res = await pushDb(lec.token, db, d.rev);
    if (res.status !== 200) throw new Error('attendu 200, reçu ' + res.status + ' : ' + res.body.slice(0, 120));
  });

  await step('BLOCAGE : lecteur ne peut pas modifier les données (paiement)', async () => {
    const d = await getDb(lec.token);
    const db = d.db;
    const b0 = db.bases.find(x => x.id === 'etab-001') || db.bases[0];
    b0.paiements.push({ id:'p-fraud', eleveId:(b0.eleves[0] || {}).id, montant:1000, date:'2026-01-01T08:00', mode:'especes', statut:'ok' });
    const res = await pushDb(lec.token, db, d.rev);
    if (res.status !== 403) throw new Error('attendu 403, reçu ' + res.status + ' : ' + res.body.slice(0, 120));
  });

  /* ---- économe : données OK, comptes/établissements protégés ---- */
  const eco = await login('econome', 'econome2026');
  await step('connexion économe', async () => { if (!eco.ok) throw new Error(eco.msg); });

  await step('BLOCAGE : économe ne peut pas renommer un compte', async () => {
    const d = await getDb(eco.token);
    const db = d.db;
    const cible = db.users.find(u => u.id === eco.user.id) || db.users[1];
    cible.nom = 'Pirate ' + Date.now();                        /* même son propre compte */
    const res = await pushDb(eco.token, db, d.rev);
    if (res.status !== 403) throw new Error('attendu 403, reçu ' + res.status + ' : ' + res.body.slice(0, 120));
  });

  await step('BLOCAGE : économe ne peut pas suspendre un établissement', async () => {
    const d = await getDb(eco.token);
    const db = d.db;
    (db.etablissements[0] || {}).actif = false;
    const res = await pushDb(eco.token, db, d.rev);
    if (res.status !== 403) throw new Error('attendu 403, reçu ' + res.status + ' : ' + res.body.slice(0, 120));
  });

  await step('économe : encaissement légitime accepté (données de sa base)', async () => {
    const d = await getDb(eco.token);
    const db = d.db;
    const b0 = db.bases.find(x => x.id === 'etab-001') || db.bases[0];
    const el = b0.eleves.find(e => e.anneeId === 'an26') || b0.eleves[0];
    b0.paiements.push({ id:'p-eco-' + Date.now(), eleveId:el.id, montant:5000, date:'2026-09-13T09:00', mode:'especes', statut:'ok', fraisId:(b0.frais[0] || {}).id });
    const res = await pushDb(eco.token, db, d.rev);
    if (res.status !== 200) throw new Error('attendu 200, reçu ' + res.status + ' : ' + res.body.slice(0, 120));
  });

  /* ---- plafond de taille ---- */
  await step('BLOCAGE : charge de 27 Mo refusée (413)', async () => {
    const gros = 'x'.repeat(27 * 1024 * 1024);
    const res = await pushDb(adm.token, gros, 1);
    if (res.status !== 413) throw new Error('attendu 413, reçu ' + res.status);
  });

  /* ---- brouillage de mots de passe ---- */
  await step('BLOCAGE : 5 mots de passe erronés → 429 (compte factice)', async () => {
    for (let i = 0; i < 5; i++){
      const t = await login('brutetest', 'mauvais-' + i);
      if (t.ok) throw new Error('connexion acceptée avec un mauvais mot de passe !');
    }
    const t6 = await login('brutetest', 'encore-mauvais');
    if (!(t6 && t6.msg && /Trop de tentatives/.test(t6.msg))) throw new Error('6e tentative non bloquée : ' + JSON.stringify(t6).slice(0, 100));
  });

  await step('l\u2019administrateur reste connecté (aucun verrou parasite)', async () => {
    const t = await login('admin', 'admin2026');
    if (!t.ok) throw new Error(t.msg || 'connexion admin refusée');
  });

  console.log(fails ? '\n=== E2E SÉCURITÉ v6.4 : ÉCHEC (' + fails + ') ===' : '\n=== E2E SÉCURITÉ v6.4 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
