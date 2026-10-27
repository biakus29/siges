/* E2E générique : application React (rendu réel jsdom) ↔ backend PHP.
   URL cible : variable d'environnement E2E_URL (défaut http://127.0.0.1:8080).
   Utilisé seul (serveur déjà installé) ou via php-e2e-mysql.cjs (réinstallation
   MySQL complète sur base de test, puis E2E). Backend PHP + MySQL exclusifs. */
const { JSDOM } = require('jsdom');
const http = require('http');
const fs = require('fs');
const B = process.env.E2E_URL || 'http://127.0.0.1:8080';

function httpReq(method, path, body, headers){
  return new Promise((resolve, reject) => {
    const req = http.request(B + path, { method, headers: Object.assign({'Content-Type':'application/json'}, headers || {}) }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const login0 = await httpReq('POST', '/api/auth/login', JSON.stringify({username:'admin',pwd:'admin2026'}));
  const tok = JSON.parse(login0.body).token;
  const db0 = JSON.parse((await httpReq('GET', '/api/db', null, {Authorization:'Bearer '+tok})).body);
  const rev0 = db0.rev;
  const baseOf = d => (Array.isArray(d.bases) && (d.bases.find(x => x.id === 'etab-001') || d.bases[0])) || d;
  const B0 = baseOf(db0.db);
  const cible = B0.eleves.find(e => e.anneeId === 'an26' && !B0.paiements.some(p => p.eleveId === e.id && p.statut !== 'annule'));
  if (!cible) throw new Error('aucun élève avec solde');
  console.log('serveur ' + B + ' : rev=' + rev0 + ', ' + B0.paiements.length + ' paiements, ' + ((db0.db.etablissements || []).length || 1) + ' établissement(s) — cible : ' + cible.matricule);

  const html = (await httpReq('GET', '/')).body;
  const js = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');

  const errors = [];
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, '')
      + '<scr'+'ipt>window.__AUREL_POLL_MS = 1500;</scr'+'ipt><scr'+'ipt>' + js + '</scr'+'ipt>',
    { runScripts:'dangerously', url: B + '/', pretendToBeVisual:true,
      beforeParse(w){
        w.scrollTo = () => {};
        w.print = () => {};
        w.fetch = (url, opts) => new Promise((resolve, reject) => {
          const u = new URL(String(url), B + '/');
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
        });
        w.addEventListener('error', e => errors.push(e.message));
        w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(/i.test(s)) errors.push('console.error: ' + s); };
      } });
  const w = dom.window, d = w.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const norm = s => s.replace(/\u202f|\u00a0/g, ' ');
  function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
  function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
  const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
  let fails = 0;
  async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

  await wait(1200);
  await step('connexion au serveur PHP détectée (sonde /api/health)', async () => {
    if (!/API Serveur/i.test($('#root').textContent) && !/connect/i.test($('#root').textContent))
      throw new Error('badge serveur absent');
  });
  await step('connexion admin via le backend PHP', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(1500);
    if (!$('#app')) throw new Error('app absente après login');
  });
  await step('données serveur chargées (élèves de l\u2019année active)', async () => {
    nav(/Élèves/); await wait(600);
    if ($$('#view tbody tr').length < 5) throw new Error('liste élèves vide');
  });
  await step('encaissement complet → poussé vers le serveur PHP', async () => {
    nav(/Paiement|Encaissement/); await wait(600);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouveau paiement/i.test(norm(b.textContent)))); await wait(400);
    setInput($('#modal-root .srch input'), cible.matricule); await wait(500);
    const row = $$('#modal-root .pm-row').find(r => norm(r.textContent).includes(cible.matricule));
    if (!row) throw new Error('élève introuvable');
    click(row); await wait(600);
    setInput($('#modal-root input.money'), '5000');
    $('#modal-root form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(2000);
    if (!$('#toast-root .toast')) throw new Error('notification absente');
  });
  await step('persistance vérifiée dans la base du serveur', async () => {
    const db1raw = await httpReq('GET', '/api/db', null, {Authorization:'Bearer '+tok});
    const db1 = JSON.parse(db1raw.body);
    if (!db1.ok || !db1.db) throw new Error('GET /api/db refusé (' + db1raw.status + ') : ' + String(db1raw.body).slice(0, 120));
    if (db1.rev <= rev0) throw new Error('révision non incrémentée');
    const B1 = baseOf(db1.db);
    if (B1.paiements.length !== B0.paiements.length + 1) throw new Error('paiement non poussé : ' + B1.paiements.length);
    const nw = B1.paiements[B1.paiements.length - 1];
    if (nw.eleveId !== cible.id || nw.montant !== 5000) throw new Error('paiement inattendu');
    console.log('   reçu ' + nw.numero + ' enregistré — rev ' + rev0 + ' → ' + db1.rev);
  });
  await step('rafraîchissement automatique : modification serveur visible sans rechargement', async () => {
    if ($('#modal-root .m-x')) { click($('#modal-root .m-x')); await wait(300); }
    const curRaw = await httpReq('GET', '/api/db', null, {Authorization:'Bearer '+tok});
    const cur = JSON.parse(curRaw.body);
    if (!cur.ok || !cur.db) throw new Error('GET /api/db refusé (' + curRaw.status + ') : ' + String(curRaw.body).slice(0, 120));
    const ndb = cur.db;
    const NBASE = baseOf(ndb);
    const autre = NBASE.eleves.find(e => e.anneeId === 'an26' && e.id !== cible.id
      && !NBASE.paiements.some(p => p.eleveId === e.id && p.statut !== 'annule' && p.date.slice(0,10) === new Date().toISOString().slice(0,10)));
    const num = 9000 + NBASE.paiements.length;
    const numeroExt = 'REC-26-' + String(num).padStart(4,'0');
    NBASE.paiements.push({ id:'pa-ext-' + num, numero:numeroExt, anneeId:'an26',
      eleveId:autre.id, fraisId:'fr-inscr', montant:3000, mode:'especes', reference:'',
      date:new Date().toISOString().slice(0,16), userId:'us-eco', statut:'valide', note:'', motifAnnulation:'' });
    const push = await httpReq('POST', '/api/db', JSON.stringify({ rev:cur.rev, db:ndb }), {Authorization:'Bearer '+tok});
    if (push.status !== 200) throw new Error('push externe refusé : ' + push.status + ' ' + push.body.slice(0,80));
    let visible = false;
    for (let i = 0; i < 14; i++){
      await wait(500);
      if (norm($('#view').textContent).includes(numeroExt)){ visible = true; break; }
    }
    if (!visible) throw new Error('recu externe ' + numeroExt + ' non apparu sans rechargement');
    console.log('   ' + numeroExt + ' visible sans rechargement (polling ✓)');
  });
  await step('déconnexion via le backend PHP', async () => {
    const btn = $('button[title="Se déconnecter"]');
    if (!btn) throw new Error('bouton déconnexion absent');
    click(btn); await wait(800);
    if (!$('#root .login-card') && !$$('#root input').length) throw new Error('retour connexion absent');
  });
  await step('aucune erreur React', () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });

  console.log(fails ? '\n=== ' + fails + ' ÉCHEC(S) E2E PHP ===' : '\n=== E2E REACT ↔ PHP : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
