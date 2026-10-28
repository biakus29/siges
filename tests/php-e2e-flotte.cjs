/* E2E v7.2 — FLOTTE D'ÉTABLISSEMENTS EN LIGNE (jetable) :
   Vérifie EXACTEMENT le cahier des charges de la flotte :
   1. installation : paramètres MySQL saisis et TESTÉS, mode réseau
      (compte superadministrateur créé) ;
   2. toutes les données dans MySQL (vérifié après chaque action via l'API) ;
   3. un ENSEIGNANT se connecte avec SES identifiants et saisit une note
      dans une classe qui lui est attribuée (et seulement celles-là) ;
   4. deux opérateurs travaillent EN MÊME TEMPS : leurs modifications
      sont FUSIONNÉES (aucune perte, vérifié dans MySQL) ;
   5. seul le SUPERADMINISTRATEUR voit le journal GLOBAL des actions ;
      l'admin d'établissement ne voit que le sien, l'enseignant n'a pas
      de journal ;
   6. l'indicateur de synchronisation est visible (barre supérieure).
   Autoporté : extrait le zip, installe, teste, nettoie. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4116;
const B = 'http://127.0.0.1:' + PORT;
const ZIP = process.env.ZIP || '/home/user/AurelSchoolSIGES-v7.2.zip';
const TMP = '/tmp/flotte70';
const DB = 'aurel_flotte70';
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

/* session applicative jsdom : pont fetch, éventuellement avec 1er POST /api/db ralenti */
function bootApp(slowFirstPost){
  const html = fs.readFileSync(path.join(TMP, 'aurel-school-siges', 'index.html'), 'utf8');
  const js = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
  let firstPostDone = false;
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, '') + '<scr' + 'ipt>' + js + '</scr' + 'ipt>',
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
              res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode,
                json: () => Promise.resolve(JSON.parse(d)), text: () => Promise.resolve(d) }));
            });
            req.on('error', reject);
            if (opts && opts.body) req.write(opts.body);
            req.end();
          };
          if (isPostDb && slowFirstPost && !firstPostDone){ firstPostDone = true; setTimeout(envoi, 900); }
          else envoi();
        });
        w.addEventListener('error', () => {});
        w.console.error = () => {};
      } });
  return dom;
}
function helpers(dom){
  const w = dom.window, d = w.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
  function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
  function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
  function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
  const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
  async function login(u, p){
    let n0 = 0; while (!$('#li-user') && n0++ < 60) await wait(100);   /* écran de connexion */
    if (!$('#li-user')) throw new Error('écran de connexion absent');
    const out = $('button[title="Se déconnecter"]');
    if (out){ click(out); await wait(500); }
    setInput($('#li-user'), u); setInput($('#li-pass'), p);
    click($('.lw-btn')); await wait(1200);
    if (!$('#app')) throw new Error('connexion refusée pour ' + u);
    await wait(1200);   /* récupération de la base serveur */
  }
  return { w, d, wait, $, $$, norm, setInput, setSel, click, nav, login };
}
async function apiDb(tok){
  return JSON.parse((await httpReq('GET', B + '/api/db', null, { Authorization:'Bearer ' + tok })).body);
}
async function apiLogin(u, p){
  const r = await httpReq('POST', B + '/api/auth/login', JSON.stringify({ username:u, pwd:p }));
  const j = JSON.parse(r.body);
  if (!j.ok) throw new Error('login ' + u + ' refusé');
  return j.token;
}

(async () => {
  execSync(`rm -rf ${TMP} && mkdir -p ${TMP} && unzip -q ${ZIP} -d ${TMP}`, { stdio:'pipe' });
  const APP = path.join(TMP, 'aurel-school-siges');
  try { execSync(`sudo mariadb -e "DROP DATABASE IF EXISTS ${DB};"`, { stdio:'pipe' }); } catch(e){}
  srv = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: APP, stdio:'ignore' });
  await sleep(1500);

  /* ---------- 1. installation : MySQL testé + réseau ---------- */
  let tokAdmin;
  await step('1. installation : paramètres MySQL saisis/testés + case réseau (superadmin)', async () => {
    const page = await httpReq('GET', B + '/install.php', null, {});
    const cookies = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const nonce = (page.body.match(/name="nonce" value="([^"]+)"/) || [])[1];
    const inst = await httpReq('POST', B + '/install.php',
      post({ nonce, action:'installer', adresse:B + '/', mysql_host:'127.0.0.1', mysql_port:'3306',
        mysql_user:'aurel', mysql_pass:'aurel2026', mysql_base:DB, creer_base:'1', mode:'vide',
        etab_nom:'Groupe Scolaire La Flotte', admin_user:'admin', admin_nom:'Administrateur Général',
        admin_pwd:'admin2026', admin_pwd2:'admin2026',
        reseau:'1', su_user:'direction', su_nom:'Direction du Réseau', su_pwd:'reseau2026', su_pwd2:'reseau2026' }),
      { 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookies });
    if (!/Installation terminée/.test(inst.body)) throw new Error('installation refusée : ' + inst.body.replace(/<[^>]+>/g, ' ').slice(0, 250));
    const h = JSON.parse((await httpReq('GET', B + '/api/health')).body);
    if (!h.ok || h.version !== '7.2') throw new Error('v7.2 attendue : ' + JSON.stringify(h));
    tokAdmin = await apiLogin('admin', 'admin2026');
    await apiLogin('direction', 'reseau2026');   /* le superadmin existe bien */
  });

  /* ---------- 2. jeu de données (classes, plan, élèves) via l'API ---------- */
  let classeId, matId, seqId, eleveId;
  await step('2. données de travail injectées dans MySQL (classes, plan, élèves)', async () => {
    const j = await apiDb(tokAdmin);
    const seedMod = await import('file://' + path.resolve(__dirname, '../src/core/seed.js'));
    const seed = seedMod.buildSeed();
    /* le compte réseau créé à l'installation doit survivre au jeu de test */
    const crypto = require('crypto');
    const saltDg = 'flottedg70';
    seed.users.push({ id:'us-super-flotte', username:'direction', nom:'Direction du Réseau', role:'superadmin',
      actif:true, salt:saltDg, hash:crypto.createHash('sha256').update(saltDg + ':reseau2026').digest('hex'),
      dernierAcces:null, etablissementId:null });
    const push = await httpReq('POST', B + '/api/db', JSON.stringify({ rev: j.rev, db: seed }),
      { Authorization:'Bearer ' + tokAdmin });
    if (!JSON.parse(push.body).ok) throw new Error('injection refusée : ' + push.body.slice(0, 150));
    const j2 = await apiDb(tokAdmin);
    const base = (j2.db.bases || [])[0];
    classeId = base.classes.find(c => c.libelle === '6ème A').id;
    matId = base.matieres.find(m => /Mathématiques/.test(m.libelle)).id;
    seqId = base.sequences[0].id;
    eleveId = base.eleves.find(e => e.classeId === classeId).id;
    if (!classeId || !matId || !eleveId) throw new Error('données de travail incomplètes');
  });

  /* ---------- 3. enseignant du plan : connexion par SES identifiants ---------- */
  await step('3. enseignant (fiche liée au plan) : connexion par ses identifiants', async () => {
    await apiLogin('enseignant', 'enseignant2026');   /* compte du jeu, fiche ens-03 */
  });

  /* ---------- 4. l'enseignant saisit une note dans SES classes attribuées ---------- */
  await step('4. enseignant : SEULES ses classes/matières attribuées + note saisie → MySQL', async () => {
    const dom = bootApp(false);
    const H = helpers(dom);
    await H.login('enseignant', 'enseignant2026');
    /* périmètre : finances, journal et comptes interdits */
    const navs = H.$$('.nav-i').map(n => H.norm(n.textContent)).join('|');
    if (/Encaissements|Journal d\u2019activité|Utilisateurs & profils|Bourses/.test(navs))
      throw new Error('l\u2019enseignant voit des menus interdits : ' + navs);
    if (!/Saisie des notes/.test(navs)) throw new Error('la saisie des notes est absente des menus de l\u2019enseignant');
    H.nav(/Saisie des notes/); await H.wait(600);
    const sels = H.$$('#view select');
    if (sels.length < 3) throw new Error('sélecteurs classe/matière/séquence absents');
    /* SEULEMENT les classes de son plan (6ème A/B, 5ème A/B — pas 4ème/3ème) */
    const clOpts = [...sels[0].options].map(o => H.norm(o.textContent));
    if (clOpts.length !== 4 || !clOpts.every(o => /6ème|5ème/.test(o)))
      throw new Error('périmètre classes attendu : 6ème A/B + 5ème A/B — proposé : ' + clOpts.join(', '));
    /* SEULEMENT ses matières AU PLAN de la classe choisie (6ème A → Maths ;
       la Physique n'est au plan qu'à partir de la 5ème) */
    const matOpts = [...sels[1].options].map(o => H.norm(o.textContent));
    if (matOpts.length !== 1 || !/Mathématiques/.test(matOpts[0]))
      throw new Error('seule Mathématiques est attendue au plan de 6ème A pour cet enseignant — proposé : ' + matOpts.join(', '));
    /* saisit une note distinctive pour le PREMIER élève affiché (6ème A, Maths) */
    H.setSel(sels[0], sels[0].value); await H.wait(400);
    const inps = H.$$('#view .note-in').filter(i => !i.disabled);
    if (!inps.length) throw new Error('aucun champ de note');
    const tr0 = inps[0].closest('tr');
    const nomPremier = H.norm(tr0.textContent);
    H.setInput(inps[0], '12.25'); inps[0].dispatchEvent(new H.w.Event('focusout', { bubbles:true }));
    await H.wait(2500);   /* envoi vers le serveur */
    /* vérification DIRECTE dans MySQL via l'API — sur l'élève affiché */
    const j = await apiDb(tokAdmin);
    const base = (j.db.bases || [])[0];
    const cible = base.eleves.find(e => e.classeId === classeId && nomPremier.includes(e.nom) && nomPremier.includes(e.prenom));
    if (!cible) throw new Error('élève affiché introuvable dans la base');
    const note = (base.notes || []).find(n => n.eleveId === cible.id && n.matiereId === matId
      && String(n.sequence) === String(seqId) && String(n.valeur) === '12.25');
    if (!note) throw new Error('la note de l\u2019enseignant (' + cible.nom + ' ' + cible.prenom + ') n\u2019est PAS dans MySQL — notes de la séquence : '
      + (base.notes || []).filter(n => String(n.sequence) === String(seqId) && n.matiereId === matId).length);
    /* l'indicateur de synchronisation est visible */
    if (!H.$('#sync-badge')) throw new Error('indicateur de synchronisation absent de la barre supérieure');
    H.w.close();
  });

  /* ---------- 5. deux opérateurs SIMULTANÉS → fusion ---------- */
  await step('5. opérateurs simultanés : modifications FUSIONNÉES dans MySQL', async () => {
    /* A (admin, session 1) : son premier envoi (journal de connexion) est
       ralenti de 900 ms ; B (admin, session 2) enregistre PENDANT ce vol →
       l'envoi de A est refusé (409) puis FUSIONNÉ avec la base serveur. */
    const domA = bootApp(true);
    const A = helpers(domA);
    await A.login('admin', 'admin2026');
    const domB = bootApp(false);
    const Bp = helpers(domB);
    await Bp.login('admin', 'admin2026');
    /* B crée sa séquence (pousse immédiatement) */
    Bp.nav(/Séquences & appréciations/); await Bp.wait(700);
    Bp.click(Bp.$$('#view button').filter(b => !b.closest('.nav-i')).find(b => /Nouvelle séquence/.test(Bp.norm(b.textContent))));
    let nb = 0; while (!Bp.$('#ff-libelle') && nb++ < 40) await Bp.wait(100);
    Bp.setInput(Bp.$('#ff-libelle'), 'Flotte Simultané B');
    Bp.click(Bp.$$('#modal-root .m-f .btn-pri, #modal-root .btn-pri').find(b => /Enregistrer|Ajouter|Créer/.test(Bp.norm(b.textContent))));
    await Bp.wait(2800);   /* B pousse pendant que l'envoi ralenti de A est encore en vol */
    /* A crée SA séquence (sa file : 409 → fusion → renvoi) */
    A.nav(/Séquences & appréciations/); await A.wait(700);
    A.click(A.$$('#view button').filter(b => !b.closest('.nav-i')).find(b => /Nouvelle séquence/.test(A.norm(b.textContent))));
    let na = 0; while (!A.$('#ff-libelle') && na++ < 40) await A.wait(100);
    A.setInput(A.$('#ff-libelle'), 'Flotte Simultané A');
    A.click(A.$$('#modal-root .m-f .btn-pri, #modal-root .btn-pri').find(b => /Enregistrer|Ajouter|Créer/.test(A.norm(b.textContent))));
    await A.wait(4500);   /* le temps de la fusion et du renvoi */
    const j = await apiDb(tokAdmin);
    const base = (j.db.bases || [])[0];
    const seqA = (base.sequences || []).some(s => s.libelle === 'Flotte Simultané A');
    const seqB = (base.sequences || []).some(s => s.libelle === 'Flotte Simultané B');
    if (!seqB) throw new Error('la séquence de l\u2019opérateur B a été PERDUE');
    if (!seqA) throw new Error('la séquence de l\u2019opérateur A a été PERDUE (fusion défaillante)');
    console.log('   (les DEUX séquences des opérateurs simultanés sont dans MySQL)');
    A.w.close(); Bp.w.close();
  });

  /* ---------- 6. journal global : superadmin SEULEMENT ---------- */
  await step('6. journal global visible du superadmin SEULEMENT', async () => {
    /* admin d'établissement : journal sans mention globale */
    const domAdm = bootApp(false);
    const Adm = helpers(domAdm);
    await Adm.login('admin', 'admin2026');
    Adm.nav(/Journal d'activité/); await Adm.wait(500);
    if (/Toutes les actions — tous les établissements/.test(Adm.norm(Adm.$('#view').textContent)))
      throw new Error('l\u2019admin d\u2019établissement voit le journal GLOBAL');
    if (Adm.$$('#view thead th').some(th => /Établissement/.test(Adm.norm(th.textContent))))
      throw new Error('colonne Établissement visible de l\u2019admin');
    Adm.w.close();
    /* superadmin : journal global */
    const domSu = bootApp(false);
    const Su = helpers(domSu);
    await Su.login('direction', 'reseau2026');
    const btnOuvrir = Su.$$('button').filter(b => !b.closest('.nav-i') && /Ouvrir/.test(Su.norm(b.textContent)));
    if (!btnOuvrir.length) throw new Error('console réseau absente du superadmin');
    Su.click(btnOuvrir[0]); await Su.wait(800);
    Su.nav(/Journal d'activité/); await Su.wait(500);
    const t = Su.norm(Su.$('#view').textContent);
    if (!/Toutes les actions — tous les établissements/.test(t)) throw new Error('mention journal global absente du superadmin');
    if (!Su.$$('#view thead th').some(th => /Établissement/.test(Su.norm(th.textContent))))
      throw new Error('colonne Établissement absente du superadmin');
    Su.w.close();
  });

  console.log(fails ? '\n=== E2E FLOTTE v7.2 : ÉCHEC (' + fails + ') ===' : '\n=== E2E FLOTTE v7.2 : OK ===');
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
