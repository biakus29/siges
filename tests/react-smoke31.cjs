/* Smoke v8.1 — MODÈLES DE DOCUMENTS : BASES PROPOSÉES, CONCEPTEUR PLEIN ÉCRAN,
   CHAMPS EXPLICITES, ÉDITER/DUPLIQUER/EXPORTER JSON, THÈME DU GRAND MENU :
   • la base livrée contient 11 modèles de base (2-3 par type), tous avec
     Modifier / Dupliquer / Exporter / Par défaut / Supprimer ;
   • galerie « Modèles de base proposés » : 11 cartes avec description,
     bouton « Créer une copie » ;
   • création guidée : choix du modèle de base + description sous le formulaire ;
   • concepteur : fenêtre PLEIN ÉCRAN (.modal.fullscreen), zoom (−/+/Ajuster),
     sélecteur de champ groupé par familles (optgroup) + description du champ,
     bouton « Exporter (JSON) » dans le pied ;
   • duplication d'un modèle de base → concepteur → enregistrement → liste +1 ;
   • export JSON : contenu au format modele-document ;
   • thème de couleurs : nuances --side-* appliquées à la racine (grand menu). */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
let capturedBlob = null;
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {}; w.print = () => {};
    w.URL.createObjectURL = b => { capturedBlob = b; return 'blob:test'; };
    w.URL.revokeObjectURL = () => {};
    if (!w.Blob.prototype.arrayBuffer){
      w.Blob.prototype.arrayBuffer = function(){ return new Promise((res, rej) => {
        const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsArrayBuffer(this); }); };
    }
    w.addEventListener('error', e => errors.push(e.message));
    w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(|defaultProps|navigation/i.test(s)) errors.push('console.error: ' + s); };
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const norm = s => (s || '').replace(/\u202f|\u00a0/g, ' ');
function setInput(el, v){
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function setSel(el, v){
  Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
const base = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
  return (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls; };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }
async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(700);
  if (!$('#app')) throw new Error('connexion refusée pour ' + u);
}
const toasts = () => norm($('#toast-root').textContent);

(async () => {
  await wait(700);
  await login('admin', 'admin2026');
  nav(/Personnalisation/); await wait(500);
  click($$('.tabs .tab').find(b => /Modèles de documents/.test(norm(b.textContent)))); await wait(500);

  /* ---------- 1. base livrée : 11 modèles de base, actions complètes ---------- */
  await step('base livrée : 11 modèles de base (2-3 par type) dans la liste', () => {
    const t = norm($('#view').textContent);
    if (!/Modèles enregistrés \(11\)/.test(t)) throw new Error('attendu 11 modèles, lu : ' + (t.match(/Modèles enregistrés \((\d+)\)/) || [])[1]);
    for (const nom of ['Bulletin — Classique', 'Bulletin — Compact', 'Bulletin — Compétences', 'Carte — Standard', 'Badge — Nominatif'])
      if (!t.includes(nom)) throw new Error('modèle de base absent : ' + nom);
  });
  await step('chaque modèle de base : Modifier / Dupliquer / Exporter / Par défaut', () => {
    const rows = $$('#view .tbl tbody tr');
    if (rows.length !== 11) throw new Error('11 lignes attendues, trouvé ' + rows.length);
    const row = rows.find(r => /Bulletin — Compact/.test(norm(r.textContent)));
    const btns = [...row.querySelectorAll('button')].map(b => norm(b.textContent).trim());
    for (const lib of ['Modifier', 'Dupliquer', 'Exporter', 'Par défaut'])
      if (!btns.includes(lib)) throw new Error('action « ' + lib + ' » absente : ' + btns.join('/'));
  });

  /* ---------- 2. galerie des modèles proposés ---------- */
  await step('galerie « Modèles de base proposés » : 11 cartes + descriptions', () => {
    const t = norm($('#view').textContent);
    if (!/Modèles de base proposés/.test(t)) throw new Error('carte galerie absente');
    if ($$('#view .dsn-preset').length !== 11) throw new Error('11 modèles proposés attendus, trouvé ' + $$('#view .dsn-preset').length);
    if ($$('#view .dsn-preset-g').length !== 5) throw new Error('5 types de documents attendus dans la galerie');
    if (!/En-tête officiel/.test(t) || !/FÉLICITATIONS/.test(t)) throw new Error('descriptions des modèles absentes');
  });
  await step('galerie : « Créer une copie » ouvre le concepteur prérempli', async () => {
    const card = $$('#view .dsn-preset').find(c => /Compact/.test(norm(c.textContent)));
    click([...card.querySelectorAll('button')].find(b => /Créer une copie/.test(norm(b.textContent))));
    await wait(500);
    if (!$('.modal.fullscreen')) throw new Error('concepteur plein écran non ouvert');
    const inp = $('[aria-label="Nom du modèle"]');
    if (!/Bulletin — Compact/.test(norm(inp.value))) throw new Error('nom prérempli attendu, lu : ' + inp.value);
    if (!$('#modal-root .dsn-page')) throw new Error('canevas absent');
    const logos = $$('#modal-root .dsn-item').filter(i => /Logo/.test(norm(i.textContent)));
    if (!logos.length) throw new Error('le preset Compact doit contenir un bloc Logo (pas d\u2019en-tête officiel)');
    click($$('.m-f button').find(b => /Fermer/.test(norm(b.textContent)))); await wait(300);
  });

  /* ---------- 3. création guidée : choix du modèle de base ---------- */
  await step('création : sélecteur « Modèle de base » + description affichée', async () => {
    const t0 = norm($('#view').textContent);
    if (!/Modèle de base/.test(t0)) throw new Error('sélecteur de modèle de base absent');
    const sels = $$('#view select');
    const selPreset = sels.find(s => [...s.options].some(o => /Classique/.test(norm(o.textContent)))
      && [...s.options].some(o => /Compact/.test(norm(o.textContent))));
    if (!selPreset) throw new Error('options Classique/Compact absentes');
    setSel(selPreset, [...selPreset.options].find(o => /Compétences/.test(norm(o.textContent))).value); await wait(300);
    if (!/sous chaque matière/.test(norm($('#view').textContent))) throw new Error('description du modèle de base non affichée');
    setInput($('[aria-label="Nom du nouveau modèle"]'), 'Mon bulletin APC');
    click($$('#view button').find(b => /Créer avec le concepteur/.test(norm(b.textContent)))); await wait(500);
    if (!$('.modal.fullscreen')) throw new Error('concepteur non ouvert');
    const t = norm($('#modal-root').textContent);
    if (!/Page 210 × 297 mm/.test(t)) throw new Error('canevas A4 absent');
    click($$('.m-f button').find(b => /^Enregistrer$/.test(norm(b.textContent).trim()))); await wait(400);
    if (!/enregistré/.test(toasts())) throw new Error('enregistrement refusé : ' + toasts().slice(0, 120));
    click($$('.m-f button').find(b => /Fermer/.test(norm(b.textContent)))); await wait(400);
    if (!/Modèles enregistrés \(12\)/.test(norm($('#view').textContent))) throw new Error('liste attendue à 12');
  });

  /* ---------- 4. concepteur plein écran + zoom ---------- */
  await step('concepteur : fenêtre PLEIN ÉCRAN + commandes de zoom', async () => {
    click($$('#view .tbl button').find(b => /Modifier/.test(norm(b.textContent)) && /Compact/.test(norm(b.closest('tr').textContent)))); await wait(500);
    const fs2 = $('.modal.fullscreen');
    if (!fs2) throw new Error('classe .modal.fullscreen absente');
    const zz = $('#modal-root .dsn-zoom');
    if (!zz) throw new Error('barre de zoom absente');
    if (!/Ajuster/.test(norm(zz.textContent)) || !/%/.test(norm(zz.textContent))) throw new Error('contrôles de zoom incomplets : ' + norm(zz.textContent));
    const avant = norm(zz.textContent).match(/(\d+) %/)[1];
    click([...zz.querySelectorAll('button')].find(b => /^\+$/.test(norm(b.textContent)))); await wait(200);
    const apres = norm(zz.textContent).match(/(\d+) %/)[1];
    if (Number(apres) <= Number(avant)) throw new Error('le zoom + ne grandit pas l\u2019aperçu (' + avant + ' → ' + apres + ')');
    click([...zz.querySelectorAll('button')].find(b => /Ajuster/.test(norm(b.textContent)))); await wait(200);
  });

  /* ---------- 5. champs dynamiques groupés + explicites ---------- */
  await step('champ dynamique : familles groupées + description du champ', async () => {
    click($$('#modal-root .dsn-palette button').find(b => /Champ dynamique/.test(norm(b.textContent)))); await wait(400);
    const sel = $('#modal-root [aria-label="Champ dynamique"]');
    if (!sel) throw new Error('sélecteur de champ absent (bloc non sélectionné ?)');
    const grp = sel.querySelectorAll('optgroup');
    if (grp.length < 3) throw new Error('groupes de champs attendus (≥ 3), trouvé ' + grp.length);
    const labels = [...grp].map(g => g.label);
    if (!labels.some(l => /Élève/.test(l)) || !labels.some(l => /établissement/i.test(l))) throw new Error('familles attendues : ' + labels.join(' | '));
    setSel(sel, [...sel.options].find(o => /matricule/i.test(norm(o.textContent)) && o.value === 'eleve.matricule') ? 'eleve.matricule' : 'eleve.matricule');
    await wait(300);
    if (!/Numéro unique de l/.test(norm($('#modal-root .dsn-props').textContent))) throw new Error('description du champ non affichée');
  });

  /* ---------- 6. export JSON depuis le concepteur ---------- */
  await step('concepteur : bouton « Exporter (JSON) » → contenu modele-document', async () => {
    capturedBlob = null;
    click($$('.m-f button').find(b => /Exporter \(JSON\)/.test(norm(b.textContent)))); await wait(400);
    if (!capturedBlob) throw new Error('aucun fichier généré');
    const txt = norm(String(w.chunkToString ? '' : '') ) || '';
    const bytes = new Uint8Array(await capturedBlob.arrayBuffer());
    const contenu = new TextDecoder ? '' : '';
    let json = '';
    const dec = w.TextDecoder || TextDecoder;
    json = new dec().decode(bytes);
    if (!JSON.parse(json).modele || JSON.parse(json).format !== 'modele-document')
      throw new Error('format inattendu : ' + json.slice(0, 80));
    if (!JSON.parse(json).modele.nom) throw new Error('modèle exporté sans nom');
    click($$('.m-f button').find(b => /Fermer/.test(norm(b.textContent)))); await wait(300);
  });

  /* ---------- 7. dupliquer un modèle de base → nouveau modèle ---------- */
  await step('duplication d\u2019un modèle de base → « (copie) » puis enregistrement', async () => {
    const row = $$('#view .tbl tbody tr').find(r => /Certificat — Scolarité/.test(norm(r.textContent)));
    click([...row.querySelectorAll('button')].find(b => /Dupliquer/.test(norm(b.textContent)))); await wait(500);
    const inp = $('[aria-label="Nom du modèle"]');
    if (!/copie/.test(norm(inp.value))) throw new Error('nom de copie attendu, lu : ' + inp.value);
    click($$('.m-f button').find(b => /^Enregistrer$/.test(norm(b.textContent).trim()))); await wait(400);
    click($$('.m-f button').find(b => /Fermer/.test(norm(b.textContent)))); await wait(400);
    const b = base();
    if ((b.modelesDocs || []).length !== 13) throw new Error('13 modèles attendus en base, trouvé ' + (b.modelesDocs || []).length);
    if (!b.modelesDocs.some(m => /copie/.test(m.nom))) throw new Error('copie absente de la base');
  });

  /* ---------- 8. thème de couleurs → GRAND MENU ---------- */
  await step('thème « Vert forêt » : nuances du grand menu appliquées', async () => {
    click($$('.tabs .tab').find(b => /Thème de couleurs/.test(norm(b.textContent)))); await wait(400);
    const avant = w.document.documentElement.style.getPropertyValue('--side-mid');
    if (avant) throw new Error('le thème par défaut ne doit PAS poser --side-mid (valeurs :root)');
    click($$('.theme-preset').find(b => /Vert forêt/.test(norm(b.textContent)))); await wait(200);
    click($$('#view button').find(b => /Enregistrer le thème/.test(norm(b.textContent)))); await wait(400);
    const racine = w.document.documentElement;
    const mid = racine.style.getPropertyValue('--side-mid');
    if (!mid) throw new Error('nuance --side-mid du grand menu absente après changement de thème');
    if (mid.toLowerCase() !== '#1a3427') throw new Error('nuance --side-mid inattendue : ' + mid);
    if (!racine.style.getPropertyValue('--side-top') || !racine.style.getPropertyValue('--side-bot'))
      throw new Error('nuances --side-top/--side-bot absentes');
    if (!/Thème enregistré/.test(toasts())) throw new Error('toast d\u2019enregistrement du thème absent');
  });
  await step('retour au thème par défaut : nuances du menu retirées', async () => {
    click($$('#view .card button').find(b => /Valeurs par défaut/.test(norm(b.textContent)))); await wait(200);
    click($$('#view button').find(b => /Enregistrer le thème/.test(norm(b.textContent)))); await wait(400);
    if (w.document.documentElement.style.getPropertyValue('--side-mid'))
      throw new Error('les nuances du menu doivent être retirées avec le thème par défaut');
  });

  if (errors.length){ console.error('Erreurs runtime :', errors.slice(0, 5)); fails++; }
  console.log(fails ? '\n=== SMOKE v8.1 : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE v8.1 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
