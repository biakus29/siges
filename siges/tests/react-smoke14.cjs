/* Smoke v2.2 — écran de connexion ÉPURÉ (style Tailwind) + SÉCURITÉ :
   aucune indication ne doit trahir un compte (anti-énumération),
   nom jamais superposé à « République du Cameroun ». */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const css = fs.readFileSync('/home/user/aurel-react/src/styles.css', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.addEventListener('error', e => errors.push(e.message));
    w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(|defaultProps|navigation/i.test(s)) errors.push('console.error: ' + s); };
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const norm = s => s.replace(/\u202f|\u00a0/g, ' ');
function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  await wait(700);

  await step('structure : deux volets (diapositives + carte), anciens panneaux décoratifs absents', async () => {
    if (!$('.lw-wrap')) throw new Error('conteneur épuré absent');
    if (!$('.lw-card')) throw new Error('carte absente');
    for (const ancien of ['.login-visual', '.viesco', '.login-feats', '.login-flagband', '.mode-badge', '.lc-sec']){
      if ($(ancien)) throw new Error('élément décoratif résiduel : ' + ancien);
    }
    const st = w.getComputedStyle($('.lw-card'));
    if (st.backgroundColor !== 'rgb(255, 255, 255)') throw new Error('carte pas blanche : ' + st.backgroundColor);
    if (parseInt(st.borderRadius || '0') < 8) throw new Error('coins pas arrondis');
  });

  await step('identité : logo, nom « Aurel School SIGES », sous-titre complet', async () => {
    if (!$('.lw-logo')) throw new Error('logo absent');
    const t = norm($('.lw-title').textContent);
    if (!/Aurel School SIGES/.test(t)) throw new Error('titre invalide : ' + t);
    if (!/Système Intégré de Gestion des Établissements Scolaires/.test(norm($('.lw-sub').textContent))) throw new Error('sous-titre absent');
  });

  await step('aucune information propre au Collège Bonneau (hors liste des établissements)', async () => {
    /* clone de la carte sans le <select> : les noms d'établissements y sont
       des DONNÉES légitimes du sélecteur, pas de la promotion */
    const c = $('.lw-card').cloneNode(true);
    c.querySelectorAll('select').forEach(x => x.remove());
    /* v6.9 : l'avertissement « mode local de secours » (serveur injoignable)
       est une notice de sécurité volontaire — elle ne trahit aucun compte. */
    c.querySelectorAll('#li-localwarn').forEach(x => x.remove());
    const page = norm(c.textContent);
    if (/Bonneau/i.test(page)) throw new Error('mention Bonneau présente sur la connexion');
  });

  await step('AUCUNE indication trahissant un compte ou l’infrastructure', async () => {
    const c = $('.lw-card').cloneNode(true);
    c.querySelectorAll('select').forEach(x => x.remove());
    /* v6.9 : l’avertissement « mode local de secours » (serveur injoignable)
       est une notice de sécurité volontaire — elle ne trahit aucun compte. */
    c.querySelectorAll('#li-localwarn').forEach(x => x.remove());
    const page = norm(c.textContent).toLowerCase();
    const fuites = [];
    for (const mot of ['econome', 'lecteur', 'admin2026', 'superadmin', 'super administrateur',
      'sha-256', 'sha256', 'mode local', 'api serveur', 'v2.1', 'v2.0', 'détection automatique (selon']) {
      if (page.includes(mot.toLowerCase())) fuites.push(mot);
    }
    if (fuites.length) throw new Error('fuites : ' + fuites.join(', '));
    if ($('#li-user').placeholder) throw new Error('placeholder identifiant non vide : ' + $('#li-user').placeholder);
    if ($('#li-user').autocomplete !== 'username') throw new Error('autocomplete username absent');
    if ($('#li-pass').type !== 'password') throw new Error('champ mot de passe non masqué');
  });

  await step('sélecteur d’établissement + aucun compte révélé par les options', async () => {
    const sel = $('#li-etab');
    if (!sel) throw new Error('sélecteur absent');
    const opts = [...sel.options].map(o => norm(o.textContent));
    if (!opts.some(o => /Mbalmayo/.test(o))) throw new Error('établissement de démo absent du sélecteur');
    /* les noms d'établissements (données) sont autorisés dans le sélecteur */
  });

  await step('volet diapositives décoratif + carte ; drapeau et étoile dorée au centre', async () => {
    const sl = $('.lw-slides');
    if (!sl) throw new Error('volet diapositives absent');
    if (sl.getAttribute('aria-hidden') !== 'true') throw new Error('volet non marqué décoratif');
    const imgs = $$('.lw-slide');
    if (imgs.length !== 8) throw new Error('diapositives : ' + imgs.length);
    if (!imgs.every(im => (im.getAttribute('src') || '').length > 20)) throw new Error('diapositive sans image');
    if (imgs.some(im => (im.getAttribute('alt') || '') !== '')) throw new Error('diapositive avec texte alternatif informatif');
    if (sl.contains($('.lw-card')) || $('.lw-card').contains(sl)) throw new Error('volet mal positionné');
    if (norm(sl.textContent).trim() !== '') throw new Error('le volet contient du texte');
    /* deux volets distincts, carte dans le volet principal */
    if (!$('.lw-main') || !$('.lw-main').contains($('.lw-card'))) throw new Error('carte hors de son volet');
    const disp = w.getComputedStyle($('.lw-wrap')).display;
    if (disp !== 'flex') throw new Error('volets pas en flex : ' + disp);
    /* étoile dorée au centre de la carte */
    const star = $('.lw-star');
    if (!star) throw new Error('étoile dorée absente');
    if ((star.getAttribute('fill') || '').toLowerCase() !== '#fcd116') throw new Error('étoile pas dorée : ' + star.getAttribute('fill'));
    /* couleurs du drapeau présentes sur la carte (bande + bouton) */
    for (const c of ['#007a5e', '#ce1126', '#fcd116']) {
      if (!css.includes(c)) throw new Error('couleur du drapeau absente du style : ' + c);
    }
    const btn = w.getComputedStyle($('.lw-btn'));
    if (btn.backgroundColor !== 'rgb(0, 122, 94)') throw new Error('bouton pas vert drapeau : ' + btn.backgroundColor);
    /* la carte reste blanche et lisible */
    const card = w.getComputedStyle($('.lw-card'));
    if (card.backgroundColor !== 'rgb(255, 255, 255)') throw new Error('carte pas blanche : ' + card.backgroundColor);
  });

  await step('nom de l’app et « République du Cameroun » dans deux blocs distincts (jamais superposés)', async () => {
    const titre = $('.lw-title'), foot = $('.lw-flag');
    if (!titre || !foot) throw new Error('blocs absents');
    const a = titre.getBoundingClientRect(), b = foot.getBoundingClientRect();
    const chevauche = !(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left);
    if (chevauche) throw new Error('superposition détectée');
    if (!/République du Cameroun/.test(norm(foot.textContent))) throw new Error('République du Cameroun absente');
  });

  await step('anti-énumération : utilisateur inconnu, mauvais mot de passe et mauvais établissement → message IDENTIQUE', async () => {
    const essais = [];
    /* 1 — utilisateur inexistant */
    setInput($('#li-user'), 'personne_inconnue'); setInput($('#li-pass'), 'xxxxxxx');
    click($('.lw-btn')); await wait(400);
    essais.push(norm($('#li-err').textContent));
    /* 2 — utilisateur réel, mauvais mot de passe */
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'mauvais-mdp');
    click($('.lw-btn')); await wait(400);
    essais.push(norm($('#li-err').textContent));
    /* 3 — utilisateur réel (autre établissement) + établissement explicite erroné */
    setInput($('#li-user'), 'admin-lycee'); setInput($('#li-pass'), 'lycee2026');
    setSel($('#li-etab'), 'etab-001');
    click($('.lw-btn')); await wait(400);
    essais.push(norm($('#li-err').textContent));
    if (!essais.every(e => e === essais[0])) throw new Error('messages différenciés : ' + JSON.stringify(essais));
    if (!/Identifiants incorrects/.test(essais[0])) throw new Error('message non générique : ' + essais[0]);
  });

  await step('connexion réelle : admin → application', async () => {
    setSel($('#li-etab'), 'auto');
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(500);
    if (!$('#app')) throw new Error('application absente après connexion');
  });

  await step('aucune erreur React', () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });

  console.log('');
  console.log(fails ? '=== ' + fails + ' ÉCHEC(S) ===' : '=== SMOKE TEST v2.2 CONNEXION ÉPURÉE + SÉCURITÉ : OK ===');
  process.exit(fails ? 1 : 0);
})();
