/* E2E v6.6 — SAUVEGARDE AUTOMATIQUE (serveur PHP + MySQL, base de test jetable) :
   configuration (répertoire local ou réseau, fréquence, retention), test du
   répertoire, sauvegarde immédiate à l'activation, sauvegarde à la demande,
   purge au-delà du nombre de copies, déclenchement automatique paresseux,
   accès réservé à l'administrateur, contenu du fichier (base complète). */
const fs = require('fs');
const path = require('path');
const E2E_URL = process.env.E2E_URL || 'http://127.0.0.1:8080';
const APP_DIR = process.env.APP_DIR || path.resolve(__dirname, '..');
const BK_DIR = path.join(APP_DIR, 'data', 'test-backups');

let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }
const j = (r) => r.json();
const H = (tok) => ({ 'Content-Type':'application/json', ...(tok ? { Authorization:'Bearer ' + tok } : {}) });

(async () => {
  let tok = '', tokLecteur = '';

  /* état de départ propre (test rejouable) */
  fs.rmSync(BK_DIR, { recursive:true, force:true });
  try { fs.unlinkSync(path.join(APP_DIR, 'data', 'backup.json')); } catch(e){}

  await step('santé : version 7.0', async () => {
    const r = await j(await fetch(E2E_URL + '/api/health'));
    if (!r.ok || r.version !== '7.2') throw new Error('attendu v7.1, reçu ' + JSON.stringify(r).slice(0, 80));
  });

  await step('connexion admin (et lecteur pour le contrôle d\u2019accès)', async () => {
    const r = await j(await fetch(E2E_URL + '/api/auth/login', { method:'POST', headers:H(), body:JSON.stringify({ username:'admin', pwd:'admin2026' }) }));
    if (!r.ok) throw new Error('connexion admin refusée');
    tok = r.token;
    const rl = await j(await fetch(E2E_URL + '/api/auth/login', { method:'POST', headers:H(), body:JSON.stringify({ username:'lecteur', pwd:'lecteur2026' }) }));
    if (!rl.ok) throw new Error('connexion lecteur refusée');
    tokLecteur = rl.token;
  });

  await step('état initial : sauvegarde inactive par défaut (aucune donnée de test)', async () => {
    const r = await j(await fetch(E2E_URL + '/api/backup', { headers:H(tok) }));
    if (!r.ok || r.cfg.actif !== false) throw new Error('cfg.actif attendu false : ' + JSON.stringify(r.cfg));
    if (!Array.isArray(r.fichiers) || r.fichiers.length) throw new Error('liste attendue vide');
  });

  await step('accès réservé : lecteur refusé (403)', async () => {
    const r = await fetch(E2E_URL + '/api/backup', { headers:H(tokLecteur) });
    if (r.status !== 403) throw new Error('403 attendu pour le lecteur, reçu ' + r.status);
  });

  await step('test du répertoire : valide et invalide', async () => {
    fs.rmSync(BK_DIR, { recursive:true, force:true });
    fs.mkdirSync(BK_DIR, { recursive:true });
    const ok = await j(await fetch(E2E_URL + '/api/backup/test', { method:'POST', headers:H(tok), body:JSON.stringify({ dir:BK_DIR }) }));
    if (!ok.ok) throw new Error('répertoire valide refusé : ' + ok.msg);
    const ko = await j(await fetch(E2E_URL + '/api/backup/test', { method:'POST', headers:H(tok), body:JSON.stringify({ dir:'/tmp/inexistant-aurel' }) }));
    if (ko.ok || ko.status !== undefined) { /* jout renvoie 400 */ }
    if (!(!ko.ok)) throw new Error('répertoire inexistant accepté à tort');
  });

  await step('activation : première sauvegarde immédiate (fréquence 1 h, 2 copies)', async () => {
    const r = await j(await fetch(E2E_URL + '/api/backup/settings', { method:'POST', headers:H(tok),
      body:JSON.stringify({ actif:true, dir:BK_DIR, freq:'1h', garder:2 }) }));
    if (!r.ok) throw new Error('activation refusée : ' + r.msg);
    if (!r.cfg.actif) throw new Error('cfg.actif attendu true');
    if (!r.premiere || r.premiere.ok !== true) throw new Error('première sauvegarde attendue : ' + JSON.stringify(r.premiere));
    if (!r.fichiers.length) throw new Error('fichier absent de la liste');
  });

  await step('contenu du fichier : base complète au format sauvegarde', async () => {
    const fichiers = fs.readdirSync(BK_DIR).filter(f => /^aurel-sauvegarde-.*\.json$/.test(f));
    if (fichiers.length !== 1) throw new Error('1 fichier attendu, trouvé ' + fichiers.length);
    const charge = JSON.parse(fs.readFileSync(path.join(BK_DIR, fichiers[0]), 'utf8'));
    if (charge.application !== 'aurel-school-siges' || charge.format !== 'sauvegarde-automatique')
      throw new Error('format inattendu : ' + charge.format);
    if (!charge.db || !Array.isArray(charge.db.users) || !charge.db.users.length) throw new Error('base absente du fichier');
    if (!(charge.db.bases && charge.db.bases.length && charge.db.bases[0].eleves.length > 100))
      throw new Error('données de la base absentes du fichier');
  });

  await step('sauvegarde à la demande + purge au-delà de 2 copies', async () => {
    await new Promise(r => setTimeout(r, 1100));   /* noms de fichiers à la seconde */
    const r1 = await j(await fetch(E2E_URL + '/api/backup/now', { method:'POST', headers:H(tok), body:'{}' }));
    if (!r1.ok) throw new Error('sauvegarde manuelle refusée : ' + r1.msg);
    await new Promise(r => setTimeout(r, 1100));
    const r2 = await j(await fetch(E2E_URL + '/api/backup/now', { method:'POST', headers:H(tok), body:'{}' }));
    if (!r2.ok) throw new Error('2e sauvegarde manuelle refusée : ' + r2.msg);
    const n = fs.readdirSync(BK_DIR).filter(f => /^aurel-sauvegarde-.*\.json$/.test(f)).length;
    if (n !== 2) throw new Error('2 fichiers attendus après purge (garder=2), trouvé ' + n);
    if (!r2.fichiers.length === 2) { /* assertion souple : la liste reflète le répertoire */ }
    if (r2.fichiers.length !== 2) throw new Error('liste serveur : 2 fichiers attendus, ' + r2.fichiers.length);
  });

  await step('déclenchement automatique : échéance atteinte → requête API → nouvelle sauvegarde', async () => {
    /* simule une dernière sauvegarde ancienne (il y a 2 h, fréquence 1 h) */
    const cfgF = path.join(APP_DIR, 'data', 'backup.json');
    const cfg = JSON.parse(fs.readFileSync(cfgF, 'utf8'));
    cfg.derniere = Math.floor(Date.now() / 1000) - 7200;
    fs.writeFileSync(cfgF, JSON.stringify(cfg));
    /* les noms de fichiers ont une résolution d'une seconde : attendre la seconde suivante */
    await new Promise(r => setTimeout(r, 1200));
    const avant = fs.readdirSync(BK_DIR).filter(f => /^aurel-sauvegarde/.test(f)).sort();
    const h = await j(await fetch(E2E_URL + '/api/health'));     /* déclenche le hook */
    if (!h.ok) throw new Error('health injoignable');
    await new Promise(r => setTimeout(r, 500));
    const apres = fs.readdirSync(BK_DIR).filter(f => /^aurel-sauvegarde-.*\.json$/.test(f)).sort();
    if (apres.length && apres[apres.length - 1] === avant[avant.length - 1])
      throw new Error('aucune nouvelle sauvegarde automatique déclenchée');
    const cfg2 = JSON.parse(fs.readFileSync(cfgF, 'utf8'));
    if (cfg2.derniere <= cfg.derniere) throw new Error('horodatage de sauvegarde non mis à jour');
    const n = apres.length;
    if (n > 2) throw new Error('purge non appliquée après sauvegarde automatique : ' + n + ' fichiers');
  });

  await step('répertoire invalide à l\u2019activation : refus propre', async () => {
    const r = await j(await fetch(E2E_URL + '/api/backup/settings', { method:'POST', headers:H(tok),
      body:JSON.stringify({ actif:true, dir:'/tmp/inexistant-aurel', freq:'24h', garder:5 }) }));
    if (r.ok) throw new Error('activation sur répertoire invalide acceptée à tort');
  });

  await step('désactivation', async () => {
    const r = await j(await fetch(E2E_URL + '/api/backup/settings', { method:'POST', headers:H(tok),
      body:JSON.stringify({ actif:false, dir:BK_DIR, freq:'24h', garder:2 }) }));
    if (!r.ok || r.cfg.actif !== false) throw new Error('désactivation impossible');
  });

  /* nettoyage */
  fs.rmSync(BK_DIR, { recursive:true, force:true });
  try { fs.unlinkSync(path.join(APP_DIR, 'data', 'backup.json')); } catch(e){}

  console.log(fails ? '\n=== E2E SAUVEGARDE v6.6 : ÉCHEC (' + fails + ') ===' : '\n=== E2E SAUVEGARDE v6.6 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
