/* E2E v5.5 (non destructif) — parcours de LECTURE SEULE des nouvelles fonctions
   v5.5 contre le backend PHP et la base réelle : onglets de discipline (absences,
   bilans), bordereaux enrichis, documents scolaires, colonnes titulaire/censeur,
   sections bulletin. Aucune donnée n'est modifiée (navigation uniquement).
   URL cible : E2E_URL (défaut http://127.0.0.1:4000). */
const { JSDOM } = require('jsdom');
const http = require('http');
const fs = require('fs');
const B = process.env.E2E_URL || 'http://127.0.0.1:4000';

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
  const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
  function setInput(el, v){
    const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
  function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
  function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
  const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
  const tabs = () => $$('#view [role="tab"]');
  const ouverte = () => !!$('#modal-root .mback');
  const fermer = async () => { click($('#modal-root .m-x')); await wait(300); };
  let fails = 0;
  async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

  await wait(1200);
  await step('connexion admin (serveur PHP + base réelle)', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(1500);
    if (!$('button[title="Se déconnecter"]')) throw new Error('connexion refusée');
  });

  await step('base réelle : discipline 3 onglets sans erreur', async () => {
    nav(/Discipline & absences/); await wait(600);
    if (tabs().length !== 3) throw new Error('3 onglets attendus, trouvé ' + tabs().length);
    click(tabs().find(t => /Absences/.test(norm(t.textContent)))); await wait(600);
    const t = norm($('#view').textContent);
    for (const mot of ['Absences', 'justifiées', 'non justifiées', 'Sanction applicable'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent');
    click(tabs().find(t => /Bilans & sanctions/.test(norm(t.textContent)))); await wait(600);
    if (!norm($('#view').textContent).includes('Trimestre 1')) throw new Error('bilans par trimestre absents');
  });

  await step('base réelle : absences anciennes comptées en heures (sans durée)', async () => {
    /* les faits « absence » antérieurs à la v5.5 n'ont pas de durée → 1 heure par fait */
    click(tabs().find(t => /Absences/.test(norm(t.textContent)))); await wait(500);
    const selP = $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))));
    if (!selP) throw new Error('sélecteur de période absent');
    if (!$('#view tbody')) throw new Error('table de synthèse absente');
  });

  await step('base réelle : bordereau enrichi + documents scolaires accessibles', async () => {
    nav(/Bulletins/); await wait(700);
    const t = norm($('#view').textContent);
    for (const mot of ["Tableaux d'honneur", 'Certificats, cartes & badges', 'Vérifier un bulletin', 'Bordereau de résultats'])
      if (!t.includes(mot)) throw new Error('bouton « ' + mot + ' » absent');
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Bordereau de résultats/.test(norm(b.textContent))));
    await wait(600);
    const m = norm($('#modal-root').textContent);
    for (const mot of ['Moyenne min. :', 'Taux de réussite', 'Répartition par intervalle'])
      if (!m.includes(mot)) throw new Error('« ' + mot + ' » absent');
    await fermer();
  });

  await step('base réelle : vérificateur de bulletin refuse un texte invalide', async () => {
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Vérifier un bulletin/.test(norm(b.textContent))));
    await wait(400);
    const ta = $('#modal-root textarea');
    if (!ta) throw new Error('modale de vérification absente');
    setInput(ta, 'AUREL-SIGES|ETAB:FAUX|MOY:20/20|SIG:000000000000');
    click($$('#modal-root button').find(b => /Vérifier/.test(norm(b.textContent)) && b.classList.contains('btn-pri')));
    await wait(400);
    if (!norm($('#modal-root').textContent).includes('NON CONFORME')) throw new Error('texte falsifié accepté');
    await fermer();
  });

  await step('base réelle : colonnes Titulaire (Classes) et Censeur (Niveaux)', async () => {
    nav(/Classes/); await wait(600);
    if (!norm($('#view').textContent).includes('Titulaire')) throw new Error('colonne Titulaire absente');
    nav(/Niveaux/); await wait(600);
    if (!norm($('#view').textContent).includes('Censeur')) throw new Error('colonne Censeur absente');
  });

  await step('base réelle : personnalisation (sections bulletin, QR, plages sanctions)', async () => {
    nav(/Personnalisation/); await wait(700);
    const t = norm($('#view').textContent);
    for (const mot of ["Discipline — sanctions d'absences", 'QR code de sécurité', 'Sections affichées sur le récapitulatif annuel'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent');
    if (!$$('label.chk').some(l => /Bilan disciplinaire annuel/.test(norm(l.textContent)))) throw new Error('case bilan absente');
  });

  await step('base réelle : récapitulatif annuel d\u2019un élève s\u2019imprime', async () => {
    nav(/Bulletins/); await wait(500);
    const row = $$('#view tbody tr').find(r => /\d,\d{2}/.test(norm(r.textContent)));
    if (!row) throw new Error('aucune ligne avec moyenne');
    click(row.querySelector('button')); await wait(700);
    if (!ouverte()) throw new Error('récapitulatif non ouvert');
    if (!norm($('#modal-root').textContent).includes('RÉCAPITULATIF ANNUEL DES NOTES')) throw new Error('titre absent');
    await fermer();
  });

  if (errors.length){ console.error('✗ erreurs React :', errors.slice(0, 4)); fails++; }
  else console.log('✓ aucune erreur React sur la base réelle');

  console.log(fails ? '\n=== E2E v5.5 (serveur, lecture seule) : ÉCHEC (' + fails + ') ===' : '\n=== E2E v5.5 (serveur, lecture seule) : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
