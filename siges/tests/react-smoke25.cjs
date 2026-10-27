/* Smoke v6.3 — MODÈLES DE DOCUMENTS & THÈME DE COULEURS :
   onglets de la personnalisation, création d'un modèle de bulletin dans le
   concepteur (palette, texte, style, géométrie mm), définition par défaut,
   impression réelle avec le modèle personnalisé, retour au modèle standard,
   export / import JSON, suppression, format exact des cartes (85×55 mm),
   thème de couleurs (palette, application immédiate, retour par défaut),
   accès réservé à l'administrateur. */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.print = () => {};
    w.addEventListener('error', e => errors.push(e.message));
    w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(|defaultProps|navigation/i.test(s)) errors.push('console.error: ' + s); }
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
const modalOuverte = () => !!$('#modal-root .mback');
const fermerCroix = async () => { click($('#modal-root .m-x')); await wait(300); if (modalOuverte()) throw new Error('croix n\u2019a pas fermé la fenêtre'); };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  if (!$('#li-user')) throw new Error('écran de connexion absent');
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(700);
  if (!$('#app')) throw new Error('connexion refusée pour ' + u);
}
const toasts = () => $$('#toast-root .toast').map(t => norm(t.textContent)).join(' | ');
const baseLs = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
  return (Array.isArray(ls.bases) && ls.bases.find(x => x.id === 'etab-001')) || ls; };

(async () => {
  await wait(700);

  await step('personnalisation : 3 onglets (états / thème / modèles), contenu actuel intact', async () => {
    await login('admin', 'admin2026');
    nav(/Personnalisation/); await wait(500);
    const tabs = $$('.tabs .tab').map(b => norm(b.textContent));
    if (tabs.length !== 4) throw new Error('4 onglets attendus, lus : ' + tabs.join(' | '));
    if (!/Établissement & états/.test(tabs[0]) || !/Thème de couleurs/.test(tabs[1]) || !/Modèles de documents/.test(tabs[2]) || !/Sauvegarde auto/.test(tabs[3]))
      throw new Error('libellés d\u2019onglets inattendus : ' + tabs.join(' | '));
    const t = norm($('#view').textContent);
    for (const mot of [/Logo de l.établissement/, /Bulletin — récapitulatif annuel des notes/, /Sauvegarde & restauration/])
      if (!(mot instanceof RegExp ? mot.test(t) : t.includes(mot))) throw new Error('contenu existant absent : ' + mot);
  });

  await step('concepteur : création d\u2019un modèle de bulletin (palette, blocs, canevas)', async () => {
    click($$('.tabs .tab').find(b => /Modèles de documents/.test(norm(b.textContent)))); await wait(400);
    const t0 = norm($('#view').textContent);
    if (!/Modèles enregistrés \(0\)/.test(t0)) throw new Error('liste des modèles vide attendue au départ');
    if (!/Aucun modèle personnalisé/.test(t0)) throw new Error('état vide attendu');
    setInput($('[aria-label="Nom du nouveau modèle"]'), 'Bulletin essai v6.3');
    click($$('#view button').find(b => /Créer avec le concepteur/.test(norm(b.textContent)))); await wait(500);
    if (!modalOuverte()) throw new Error('concepteur non ouvert');
    const t = norm($('#modal-root').textContent);
    if (!/Concepteur — Bulletin de notes/.test(t)) throw new Error('titre du concepteur absent');
    for (const mot of ['Ajouter un bloc', 'Texte libre', 'Tableau des notes', 'QR code', 'Bilan disciplinaire', 'Signatures'])
      if (!t.includes(mot)) throw new Error('palette incomplète : ' + mot);
    if ($$('#modal-root .dsn-item').length !== 9) throw new Error('9 blocs de départ attendus, trouvé ' + $$('#modal-root .dsn-item').length);
    if (!$('#modal-root .dsn-page')) throw new Error('canevas absent');
    if (!/Page 210 × 297 mm/.test(t)) throw new Error('dimensions A4 absentes');
  });

  await step('édition : ajout d\u2019un texte, style, position au millimètre, enregistrement', async () => {
    click($$('#modal-root .dsn-palette button').find(b => /Texte libre/.test(norm(b.textContent)))); await wait(300);
    if ($$('#modal-root .dsn-item').length !== 10) throw new Error('10 blocs attendus après ajout, trouvé ' + $$('#modal-root .dsn-item').length);
    const ta = $('#modal-root [aria-label="Texte du bloc"]');
    if (!ta) throw new Error('champ Texte du bloc absent (bloc non sélectionné ?)');
    setInput(ta, 'BULLETIN PERSONNALISÉ v6.3 — {eleve.nomComplet}');
    setInput($('#modal-root [aria-label="Taille"]'), '16');
    setSel($('#modal-root [aria-label="Alignement"]'), 'centre');
    setInput($('#modal-root [aria-label="Position X"]'), '5');
    setInput($('#modal-root [aria-label="Position Y"]'), '56');
    setInput($('#modal-root [aria-label="Largeur"]'), '190');
    setInput($('#modal-root [aria-label="Hauteur"]'), '12');
    /* aperçu intégré puis retour à l'édition */
    click($$('#modal-root button').find(b => norm(b.textContent).trim() === 'Aperçu')); await wait(400);
    if (!/BULLETIN PERSONNALISÉ v6.3/.test(norm($('#modal-root').textContent))) throw new Error('aperçu : texte personnalisé absent');
    click($$('#modal-root button').find(b => norm(b.textContent).trim() === 'Édition')); await wait(300);
    click($$('#modal-root button').find(b => /^Enregistrer$/.test(norm(b.textContent).trim()))); await wait(400);
    if (!/enregistré \(10 bloc/.test(toasts())) throw new Error('toast d\u2019enregistrement attendu : ' + toasts().slice(0, 140));
    click($$('#modal-root button').find(b => norm(b.textContent).trim() === 'Fermer')); await wait(400);
    const t = norm($('#view').textContent);
    if (!/Modèles enregistrés \(1\)/.test(t) || !/Bulletin essai v6.3/.test(t)) throw new Error('modèle absent de la liste');
    if (!/Bulletin de notes/.test(t) || !/Toutes/.test(t)) throw new Error('type / période du modèle mal affichés');
  });

  await step('modèle par défaut : bascule et badge', async () => {
    click($$('#view button').find(b => norm(b.textContent).trim() === 'Par défaut')); await wait(400);
    if (!$$('.tbl .badge').some(b => /Par défaut/.test(norm(b.textContent)))) throw new Error('badge « Par défaut » absent');
    const b = baseLs();
    if (!(b.settings && b.settings.modeleDefaut && b.settings.modeleDefaut.bulletin)) throw new Error('défaut non persisté dans la base');
  });

  await step('impression : le récapitulatif utilise le modèle personnalisé', async () => {
    nav(/Bulletins & rapports/); await wait(600);
    const sel = $$('#view select').find(s => /Modèle standard/.test([...s.options].map(o => norm(o.textContent)).join('|')));
    if (!sel) throw new Error('sélecteur de modèle absent de la page Bulletins');
    const opt = [...sel.options].find(o => /Bulletin essai v6.3/.test(norm(o.textContent)));
    if (!opt || sel.value !== opt.value) throw new Error('modèle par défaut non sélectionné');
    const btn = $$('#view button').find(b => /^Récapitulatif$/.test(norm(b.textContent).trim()));
    if (!btn) throw new Error('bouton Récapitulatif absent');
    click(btn); await wait(700);
    const t = norm($('#modal-root').textContent);
    if (!/BULLETIN PERSONNALISÉ v6.3/.test(t)) throw new Error('texte du modèle absent du document');
    if (/\{eleve/.test(t)) throw new Error('champ dynamique non résolu');
    if (!/Bilan disciplinaire annuel/.test(t) || !/Décision du conseil/.test(t)) throw new Error('blocs du modèle (bilan, décision) absents');
    await fermerCroix();
  });

  await step('retour au modèle standard après retrait du défaut', async () => {
    nav(/Personnalisation/); await wait(400);
    click($$('.tabs .tab').find(b => /Modèles de documents/.test(norm(b.textContent)))); await wait(400);
    click($$('#view button').find(b => /Retirer défaut/.test(norm(b.textContent)))); await wait(400);
    nav(/Bulletins & rapports/); await wait(600);
    const sel = $$('#view select').find(s => /Modèle standard/.test([...s.options].map(o => norm(o.textContent)).join('|')));
    if (!sel || sel.value !== '') throw new Error('modèle standard non rétabli');
    click($$('#view button').find(b => /^Récapitulatif$/.test(norm(b.textContent).trim()))); await wait(700);
    const t = norm($('#modal-root').textContent);
    if (/BULLETIN PERSONNALISÉ/.test(t)) throw new Error('le modèle standard ne doit plus être utilisé');
    if (!/RÉCAPITULATIF ANNUEL DES NOTES/.test(t)) throw new Error('document standard absent');
    await fermerCroix();
  });

  await step('export JSON puis import (collage) d\u2019un modèle', async () => {
    nav(/Personnalisation/); await wait(400);
    click($$('.tabs .tab').find(b => /Modèles de documents/.test(norm(b.textContent)))); await wait(400);
    click($$('#view button').find(b => /Exporter/.test(norm(b.textContent)))); await wait(300);
    if (!/exporté|bloqué/.test(toasts())) throw new Error('toast d\u2019export attendu : ' + toasts().slice(0, 120));
    click($$('#view button').find(b => /Importer \(JSON\)/.test(norm(b.textContent)))); await wait(400);
    const json = JSON.stringify({ application:'aurel-school-siges', format:'modele-document', version:1,
      modele:{ typeDoc:'bulletin', nom:'Modèle importé v6.3', periode:'tous',
        page:{ format:'A4', orientation:'portrait', marges:{ h:10, b:10, g:10, d:10 } },
        blocs:[
          { id:'x1', type:'texte', texte:'BULLETIN IMPORTÉ — {eleve.classe}', x:5, y:5, w:180, h:10,
            style:{ police:'Georgia', taille:14, gras:true, italique:false, souligne:false, alignement:'centre', couleur:'', fond:'', bordure:false } },
          { id:'x2', type:'signatures', x:10, y:250, w:190, h:24, options:{ gauche:'Le titulaire', droite:'La Principale' } } ] } });
    const ta = $('#modal-root [aria-label="JSON du modèle"]');
    if (!ta) throw new Error('zone de collage JSON absente');
    setInput(ta, json);
    click($$('#modal-root button').find(b => /Importer$/.test(norm(b.textContent).trim()))); await wait(500);
    if (!/Concepteur — Bulletin de notes/.test(norm($('#modal-root').textContent))) throw new Error('concepteur non ouvert après import');
    if (!/Modèle importé v6.3/.test($('#modal-root [aria-label="Nom du modèle"]').value)) throw new Error('nom du modèle importé absent');
    click($$('#modal-root button').find(b => /^Enregistrer$/.test(norm(b.textContent).trim()))); await wait(400);
    click($$('#modal-root button').find(b => norm(b.textContent).trim() === 'Fermer')); await wait(400);
    const t = norm($('#view').textContent);
    if (!/Modèles enregistrés \(2\)/.test(t) || !/Modèle importé v6.3/.test(t)) throw new Error('modèle importé absent de la liste');
  });

  await step('suppression d\u2019un modèle (confirmation)', async () => {
    const row = $$('.tbl tbody tr').find(r => /Modèle importé v6.3/.test(norm(r.textContent)));
    if (!row) throw new Error('ligne du modèle importé introuvable');
    click(row.querySelector('button[title="Supprimer ce modèle"]')); await wait(400);
    const okBtn = $$('#modal-root button').find(b => b.classList.contains('btn-danger'));
    if (!okBtn) throw new Error('confirmation de suppression absente');
    click(okBtn); await wait(500);
    const t = norm($('#view').textContent);
    if (/Modèle importé v6.3/.test(t)) throw new Error('modèle non supprimé');
    if (!/Modèles enregistrés \(1\)/.test(t)) throw new Error('liste attendue : 1 modèle');
  });

  await step('carte scolaire : format exact 85 × 55 mm dans le concepteur', async () => {
    const selType = $$('#view select')[0];
    const optCarte = [...selType.options].find(x => /Carte scolaire/.test(norm(x.textContent)));
    setSel(selType, optCarte.value);
    setInput($('[aria-label="Nom du nouveau modèle"]'), 'Carte essai v6.3');
    click($$('#view button').find(b => /Créer avec le concepteur/.test(norm(b.textContent)))); await wait(500);
    const t = norm($('#modal-root').textContent);
    if (!/Page 85 × 55 mm/.test(t)) throw new Error('format carte 85×55 mm absent');
    if (!/Photo de l.élève/.test(t)) throw new Error('bloc photo non proposé pour une carte');
    click($$('#modal-root button').find(b => norm(b.textContent).trim() === 'Fermer')); await wait(400);
    if (!/Modèles enregistrés \(1\)/.test(norm($('#view').textContent))) throw new Error('fermeture sans enregistrement : la liste ne doit pas changer');
  });

  await step('thème de couleurs : palette bordeaux appliquée immédiatement', async () => {
    click($$('.tabs .tab').find(b => /Thème de couleurs/.test(norm(b.textContent)))); await wait(400);
    const t = norm($('#view').textContent);
    if (!/Palettes proposées/.test(t) || !/Navy & or \(par défaut\)/.test(t)) throw new Error('palettes absentes');
    click($$('.theme-preset').find(b => /Bordeaux/.test(norm(b.textContent)))); await wait(200);
    if ($('[aria-label="Couleur primaire"]').value.toLowerCase() !== '#7a2e3a') throw new Error('couleur primaire non mise à jour : ' + $('[aria-label="Couleur primaire"]').value);
    click($$('#view button').find(b => /Enregistrer le thème/.test(norm(b.textContent)))); await wait(400);
    const racine = w.document.documentElement;
    const v = racine.style.getPropertyValue('--navy-800');
    if (v.toLowerCase() !== '#7a2e3a') throw new Error('variable --navy-800 non appliquée : "' + v + '"');
    if (!racine.style.getPropertyValue('--gold-600')) throw new Error('variable --gold-600 absente');
    if (!/Thème enregistré/.test(toasts())) throw new Error('toast d\u2019enregistrement du thème attendu');
    const b = baseLs();
    if (!(b.settings && b.settings.theme && b.settings.theme.primaire === '#7A2E3A')) throw new Error('thème non persisté dans la base');
  });

  await step('thème : retour au thème par défaut', async () => {
    click($$('#view .card button').find(b => /Valeurs par défaut/.test(norm(b.textContent)))); await wait(200);
    click($$('#view button').find(b => /Enregistrer le thème/.test(norm(b.textContent)))); await wait(400);
    const racine = w.document.documentElement;
    if (racine.style.getPropertyValue('--navy-800')) throw new Error('les variables du thème doivent être retirées');
    const b = baseLs();
    if (b.settings && b.settings.theme) throw new Error('thème non retiré de la base');
  });

  await step('accès réservé : la personnalisation est interdite aux autres profils', async () => {
    await login('lecteur', 'lecteur2026');
    if ($$('.nav-i').some(n => /Personnalisation/.test(norm(n.textContent)))) throw new Error('menu Personnalisation visible par le lecteur');
  });

  console.log(fails ? '\n=== SMOKE TEST v6.3 MODÈLES & THÈME : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST v6.3 MODÈLES & THÈME : OK ===');
  if (errors.length){ console.error('Erreurs applicatives :'); errors.slice(0, 8).forEach(e => console.error('  ' + e)); }
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
