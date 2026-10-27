/* E2E v8.1 — CORRECTIF DE DÉCONNEXION (serveur PHP + MySQL, jetable) :
   avant v8.0, la garde anti-perte comparait la base locale à une référence
   jamais actualisée après un envoi réussi : l'avertissement « modifications
   non enregistrées, patientez » restait affiché PERMANENTEMENT, quelle que
   soit l'attente (l'envoi avait déjà réussi). Le correctif actualise la
   référence dès que le serveur confirme l'envoi. Ce test vérifie :
   • après une modification envoyée et confirmée, la déconnexion est
     immédiate et SANS avertissement ;
   • la donnée a bien atteint MySQL (aucune perte) ;
   • la reconnexion fonctionne aussitôt.
   Usage : E2E_URL=http://127.0.0.1:4107 node tests/php-e2e-logout.cjs
   (le bundle de test /tmp/bundle.react.test.js doit être à jour). */
const { JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom');
const http = require('http');
const fs = require('fs');
const B = 'http://127.0.0.1:4107';

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

(async () => {
  const html = (await httpReq('GET', '/')).body;
  const js = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
  const errors = [];
  const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, '') + '<scr'+'ipt>' + js + '</scr'+'ipt>',
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
        w.addEventListener('error', e => errors.push(e.message));
        w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(/i.test(s)) errors.push('console.error: ' + s); };
      } });
  const w = dom.window, d = w.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => d.querySelector(s);
  function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
  function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
  let fails = 0;
  const step = (n, fn) => { try { fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } };

  await wait(1000);
  /* 1. connexion serveur */
  setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
  click($('.lw-btn')); await wait(2500);
  if (!$('#app')){ console.error('FATAL : connexion impossible'); process.exit(1); }
  console.log('✓ connexion serveur (mode', (w.localStorage.getItem('asc_token') || w.sessionStorage.getItem('asc_token')) ? 'jeton présent' : '?', ')');

  /* 2. une modification (création d'une matière) → envoi vers le serveur */
  const navs = [...d.querySelectorAll('.nav-i')];
  click(navs.find(n => /Matières/.test(n.textContent))); await wait(500);
  const btnNew = [...d.querySelectorAll('#view button')].find(b => /Nouvelle matière/.test(b.textContent));
  if (!btnNew) console.log('DEBUG #view :', d.querySelector('#view').textContent.replace(/\s+/g, ' ').slice(0, 300));
  click(btnNew); await wait(400);
  const inp = [...d.querySelectorAll('#modal-root input')];
  setInput(inp[0], 'TESTV8'); setInput(inp[1], 'Matière de test v8.0');
  click([...d.querySelectorAll('#modal-root button')].find(b => /Enregistrer/.test(b.textContent)));
  await wait(3000);   /* laisser l'envoi sérialisé atteindre le serveur */

  /* 3. déconnexion : NE DOIT PLUS afficher l'avertissement permanent */
  const avant = d.body.textContent;
  click($('button[title="Se déconnecter"]')); await wait(800);
  const apres = d.body.textContent;
  step('déconnexion : plus d\u2019avertissement « modifications non enregistrées » après envoi confirmé', () => {
    if (/Modifications non enregistrées/.test(apres))
      throw new Error('l\u2019avertissement s\u2019affiche encore — correctif inefficace');
  });
  step('déconnexion : retour à l\u2019écran de connexion', () => {
    if (!$('#li-user')) throw new Error('écran de connexion absent');
  });

  /* 4. la donnée est bien sur le serveur (jamais perdue) */
  const lg = await httpReq('POST', '/api/auth/login', JSON.stringify({ username:'admin', pwd:'admin2026' }));
  const tok = JSON.parse(lg.body).token;
  const db = JSON.parse((await httpReq('GET', '/api/db', null, { Authorization:'Bearer ' + tok })).body);
  const ok = (db.db.bases || []).some(b => (b.matieres || []).some(m => m.code === 'TESTV8'));
  step('modification bien enregistrée côté serveur (MySQL)', () => { if (!ok) throw new Error('matière TESTV8 absente du serveur'); });

  /* 5. reconnexion possible */
  setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
  click($('.lw-btn')); await wait(2000);
  step('reconnexion immédiate après déconnexion', () => { if (!$('#app')) throw new Error('reconnexion refusée'); });

  if (errors.length){ console.error('Erreurs runtime :', errors.slice(0, 3)); fails++; }
  console.log(fails ? '=== CORRECTIF DÉCONNEXION : ÉCHEC (' + fails + ') ===' : '=== CORRECTIF DÉCONNEXION v8.1 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
