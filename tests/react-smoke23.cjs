/* Smoke (v5.5→v5.7) — Discipline, absences, sanctions, bordereaux enrichis,
   QR code de sécurité, documents scolaires, titulaires & censeurs :
   • Discipline : 3 onglets — faits, absences (saisie par classe/période,
     heures J/NJ, sanctions automatiques par plages paramétrables),
     bilans par élève/trimestre/année imprimables ;
   • bordereaux : moyenne min/max/générale, taux de réussite, répartition
   par intervalle avec pourcentages ;
   • bulletin : QR code de sécurité + vérification (signature SHA-256),
   sections paramétrables, ajustement A4 ;
   • documents : tableaux d'honneur (seuils), certificats de scolarité,
   cartes scolaires, badges (QR) ;
   • organisation : titulaire par classe (périmètre synchronisé),
   censeur par niveau, enseignant limité à ses classes en saisie. */
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
    w.print = () => {};
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
function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
const LS = () => { const ls = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1'));
  const b = (Array.isArray(ls.bases) && (ls.bases.find(x => x.id === 'etab-001') || ls.bases[0])) || ls;
  return (ls.bases) ? Object.assign({}, b, { users:ls.users }) : ls; };
const modalTxt = () => norm($('#modal-root').textContent);
const ouverte = () => !!$('#modal-root .mback');
const fermer = async () => { click($('#modal-root .m-x')); await wait(300); if (ouverte()) throw new Error('croix n\u2019a pas fermé'); };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

async function login(u, p){
  const out = $('button[title="Se déconnecter"]');
  if (out){ click(out); await wait(500); }
  if (!$('#li-user')) throw new Error('écran de connexion absent');
  setInput($('#li-user'), u); setInput($('#li-pass'), p);
  click($('.lw-btn')); await wait(800);
}
const tabsDisc = () => $$('#view [role="tab"]');
const rowEleve = nom => $$('#view tbody tr').find(r => r.textContent.includes(nom));
/* v5.6 : lignes de la carte « Synthèse par élève » (derrière la grille de saisie) */
const rowsSynthese = () => [...d.querySelectorAll('#view .card')]
  .filter(c => /Synthèse par élève/.test(norm(c.textContent))).flatMap(c => [...c.querySelectorAll('tbody tr')]);
const rowSyn = nom => rowsSynthese().find(r => r.textContent.includes(nom));

(async () => {
  await step('connexion : écran SIGES opérationnel', async () => {
    await wait(700);
    if (!$('#li-user')) throw new Error('écran de connexion absent');
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(800);
    if (!$('button[title="Se déconnecter"]')) throw new Error('connexion refusée');
  });

  /* ---------------- Discipline : onglet Absences ---------------- */
  await step('discipline : 3 onglets — faits, absences, bilans', async () => {
    nav(/Discipline & absences/); await wait(500);
    const tabs = tabsDisc();
    if (tabs.length !== 3) throw new Error('3 onglets attendus, trouvé ' + tabs.length);
    for (const l of ['Faits de discipline', 'Absences', 'Bilans & sanctions'])
      if (!tabs.some(t => norm(t.textContent).includes(l))) throw new Error('onglet « ' + l + ' » absent');
  });

  await step('absences : synthèse par classe et période (J/NJ en heures)', async () => {
    click(tabsDisc().find(t => /Absences/.test(norm(t.textContent)))); await wait(500);
    const t = norm($('#view').textContent);
    for (const mot of ['Synthèse par élève — 6ème A', 'Heures justifiées', 'Heures non justifiées',
      'Sanction applicable', 'Journal des absences'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent');
    /* Mbarga Pascaline : 1 h justifiée + 2 h non justifiées (T1) — sous le seuil : pas de sanction */
    const r0 = rowSyn('Mbarga Pascaline');
    if (!r0) throw new Error('ligne Mbarga Pascaline introuvable dans la synthèse');
    const c0 = [...r0.cells].map(c => norm(c.textContent).replace(/\s+/g, ' ').trim());
    if (c0.length < 5) throw new Error('colonnes J/NJ attendues : ' + JSON.stringify(c0));
    if (!c0.includes('1') || !c0.includes('2') || !c0.includes('3')) throw new Error('totaux 1 J / 2 NJ / 3 attendus : ' + JSON.stringify(c0));
    if (/Avertissement|Blâme|Exclusion|Conseil/.test(c0)) throw new Error('sanction inattendue sous le seuil de 3 : ' + c0);
    /* Foncham Guy : 6 h NJ → Blâme */
    const r8 = rowSyn('Foncham Guy');
    if (!r8) throw new Error('ligne Foncham Guy introuvable dans la synthèse');
    if (!norm(r8.textContent).includes('Blâme')) throw new Error('Blâme attendu pour 6 ½ j. NJ');
    if (!norm(rowSyn('Mbarga Bernadette').textContent).includes('Avertissement écrit')) throw new Error('Avertissement écrit attendu pour 4 ½ j. NJ');
    /* 9 absences de démonstration en 6ème A (année) */
    if (!t.includes('Absences saisies')) throw new Error('KPI absences absent');
  });

  await step('absences : filtre par trimestre (T2 ≠ année)', async () => {
    const selP = $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))) && [...s.options].some(o => /Trimestre/.test(norm(o.textContent))));
    if (!selP) throw new Error('sélecteur de période absent');
    setSel(selP, 'T2'); await wait(400);
    const r0 = rowSyn('Mbarga Pascaline');
    if (!r0) throw new Error('ligne introuvable en T2');
    if (/Avertissement|Blâme/.test(norm(r0.textContent))) throw new Error('aucune absence T2 pour cet élève — sanction inattendue');
    const r5 = rowSyn('Atangana Irène');
    if (!r5 || !norm(r5.textContent).includes('Avertissement écrit')) throw new Error('Atangana Irène : 3 ½ j. NJ en T2 → Avertissement écrit');
    setSel(selP, ''); await wait(400);
  });

  await step('absences : saisie PAR CLASSE (grille) — durée, motif, justification, suppression', async () => {
    /* la carte « Saisie des absences » affiche la grille de toute la classe */
    const grid = $$('#view table.tbl').find(t => t.querySelector('.abs-in'));
    if (!grid) throw new Error('grille de saisie par classe absente');
    if ($$('#view .abs-in').length < 10) throw new Error('la grille doit lister toute la classe, trouvé ' + $$('#view .abs-in').length);
    const avant = (LS().discipline || []).filter(f => f.classeId === 'cl6a' && f.categorie === 'absence').length;
    const idP = LS().eleves.find(e => e.nom === 'Mbarga' && e.prenom === 'Pascaline' && e.classeId === 'cl6a' && e.anneeId === 'an26').id;
    /* date du jour sélectionné : 15/04/2026 (T3) */
    const dIn = $('#view input[type="date"]');
    if (!dIn) throw new Error('sélecteur de date absent');
    setInput(dIn, '2026-04-15'); await wait(400);
    const rowP = $$('#view tbody tr').find(r => r.textContent.includes('Mbarga Pascaline'));
    /* 1) durée saisie sur la ligne → enregistrement immédiat */
    const duree = rowP.querySelector('.abs-in');
    setInput(duree, '2'); duree.dispatchEvent(new w.Event('focusout', { bubbles:true })); duree.blur(); await wait(600);
    const d0 = LS().discipline.find(f => f.eleveId === idP && f.date === '2026-04-15');
    if (!d0 || d0.duree !== 2 || d0.justifie !== false) throw new Error('absence de grille non enregistrée : ' + JSON.stringify(d0));
    if ((LS().discipline || []).filter(f => f.classeId === 'cl6a' && f.categorie === 'absence').length !== avant + 1) throw new Error('compteur incohérent');
    if (d0.description !== 'Absence non justifiée') throw new Error('motif par défaut attendu : ' + d0.description);
    /* 2) motif complété sur la ligne */
    const rowP2 = $$('#view tbody tr').find(r => r.textContent.includes('Mbarga Pascaline'));
    const motif = rowP2.querySelector('.cell-in');
    setInput(motif, 'Maladie (grille)'); motif.dispatchEvent(new w.Event('focusout', { bubbles:true })); motif.blur(); await wait(500);
    if (LS().discipline.find(f => f.eleveId === idP && f.date === '2026-04-15').description !== 'Maladie (grille)') throw new Error('motif non enregistré');
    /* 3) case justifiée sur la ligne */
    const rowP3 = $$('#view tbody tr').find(r => r.textContent.includes('Mbarga Pascaline'));
    const chk = rowP3.querySelector('input[type="checkbox"]');
    click(chk); await wait(500);
    const d2 = LS().discipline.find(f => f.eleveId === idP && f.date === '2026-04-15');
    if (!d2.justifie || d2.gravite !== 1) throw new Error('justification non enregistrée : ' + JSON.stringify(d2));
    /* ligne de total du jour présente */
    if (!norm($('#view').textContent).includes('JOURNÉE DU 2026-04-15')) throw new Error('total du jour absent');
    /* 2 (T1) + 2 (T3, justifiées) → sanction sans objet : NJ restent 2 < 3 */
    if (/Avertissement écrit/.test(norm(rowSyn('Mbarga Pascaline').textContent))) throw new Error('sanction inattendue (NJ < seuil)');
    /* 4) suppression depuis la grille */
    const rowP4 = $$('#view tbody tr').find(r => r.textContent.includes('Mbarga Pascaline'));
    click(rowP4.querySelector('button[title^="Supprimer"]')); await wait(400);
    click($('#modal-root .btn-danger')); await wait(600);
    if ((LS().discipline || []).some(f => f.eleveId === idP && f.date === '2026-04-15')) throw new Error('absence non supprimée depuis la grille');
  });

  await step('absences : édition par le journal (modale individuelle inchangée)', async () => {
    /* le journal conserve l'édition modale : on modifie puis on restaure */
    const jrn = $$('#view tbody tr').find(r => /Mbarga Bernadette/.test(norm(r.textContent)) && /Absence/.test(norm(r.textContent)));
    if (!jrn) throw new Error('journal : aucune absence de Mbarga Bernadette');
    const f0 = LS().discipline.find(f => f.eleveId === (LS().eleves.find(e => e.nom === 'Mbarga' && e.prenom === 'Bernadette' && e.classeId === 'cl6a' && e.anneeId === 'an26') || {}).id && f.categorie === 'absence');
    const d0 = f0 ? f0.duree : null;
    click(jrn.querySelector('button[title="Modifier"]')); await wait(400);
    if (!$('#ab-duree')) throw new Error('modale d\u2019édition absente');
    setInput($('#ab-duree'), String((d0 || 2) + 1));
    $('#modal-root form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const f1 = LS().discipline.find(f => f.id === f0.id);
    if (f1.duree !== (d0 || 2) + 1) throw new Error('durée non modifiée par la modale');
    /* restauration */
    const jrn2 = $$('#view tbody tr').find(r => /Mbarga Bernadette/.test(norm(r.textContent)) && /Absence/.test(norm(r.textContent)));
    click(jrn2.querySelector('button[title="Modifier"]')); await wait(400);
    setInput($('#ab-duree'), String(d0 || 2));
    $('#modal-root form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    if (LS().discipline.find(f => f.id === f0.id).duree !== (d0 || 2)) throw new Error('durée non restaurée');
  });

  /* ---------------- Sanctions paramétrables ---------------- */
  await step('paramétrage : plages de sanctions modifiables (Paramètres → Discipline)', async () => {
    nav(/Personnalisation/); await wait(600);
    const t = norm($('#view').textContent);
    if (!/Discipline — sanctions d'absences/.test(t)) throw new Error('carte sanctions absente');
    const mins = $$('#view table.tbl input[type="number"]').filter(i => parseInt(i.min, 10) === 0);
    if (!mins.length) throw new Error('champs « De (h) » introuvables');
    setInput(mins[0], '2');
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Enregistrer les plages/.test(norm(b.textContent))));
    await wait(500);
    const sa = LS().sanctionsAbs || [];
    if (!sa.length || sa[0].min !== 2) throw new Error('plage non enregistrée : ' + JSON.stringify(sa[0]));
    /* retour sur les absences : 2 h NJ devient sanctionnable (plage 2-5) */
    nav(/Discipline & absences/); await wait(400);
    click(tabsDisc().find(x => /Absences/.test(norm(x.textContent)))); await wait(500);
    if (!norm(rowSyn('Mbarga Pascaline').textContent).includes('Avertissement écrit'))
      throw new Error('seuil abaissé à 2 : la sanction devrait apparaître');
    /* restauration du seuil 3 */
    nav(/Personnalisation/); await wait(500);
    const mins2 = $$('#view table.tbl input[type="number"]').filter(i => parseInt(i.min, 10) === 0);
    setInput(mins2[0], '3');
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Enregistrer les plages/.test(norm(b.textContent))));
    await wait(500);
    if ((LS().sanctionsAbs || [{}])[0].min !== 3) throw new Error('seuil non restauré');
  });

  /* ---------------- Bilans disciplinaires ---------------- */
  await step('bilans : synthèse par élève (T1/T2/T3/année) + impression', async () => {
    nav(/Discipline & absences/); await wait(400);
    click(tabsDisc().find(x => /Bilans & sanctions/.test(norm(x.textContent)))); await wait(500);
    const t = norm($('#view').textContent);
    for (const mot of ['Bilans disciplinaires — 6ème A', 'Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Autres faits'])
      if (!t.includes(mot)) throw new Error('« ' + mot + ' » absent');
    /* Mbarga Pascaline : T1 = 1 J / 2 NJ ; année = 2 NJ */
    const r0 = rowEleve('Mbarga Pascaline');
    if (!r0) throw new Error('ligne introuvable');
    if (!norm(r0.textContent).includes('Blâme') === false) {} /* Foncham : Blâme */
    if (!rowEleve('Foncham Guy').textContent.includes('Blâme')) throw new Error('Blâme attendu dans le bilan');
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Imprimer le bilan annuel/.test(norm(b.textContent))));
    await wait(500);
    if (!ouverte()) throw new Error('état bilan non ouvert');
    const m = modalTxt();
    for (const mot of ['Bilan disciplinaire', 'Trimestre 1', 'Sanction (absences NJ)', 'TOTAUX', 'Blâme', "heures d'absence justifiées", 'Le Surveillant général'])
      if (!m.includes(mot)) throw new Error('« ' + mot + ' » absent de l\u2019état');
    await fermer();
  });

  /* ---------------- Bordereaux enrichis ---------------- */
  await step('bordereau de résultats : min, max, moyenne générale, réussite, intervalles (%)', async () => {
    nav(/Bulletins/); await wait(600);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Bordereau de résultats/.test(norm(b.textContent))));
    await wait(500);
    const m = modalTxt();
    for (const mot of ['Moyenne min. :', 'Moyenne max. :', 'Moyenne générale :', 'Taux de réussite (≥ 10/20)', 'Répartition par intervalle de moyenne'])
      if (!m.includes(mot)) throw new Error('« ' + mot + ' » absent du bordereau');
    if (!/\(\d+ %\)/.test(m)) throw new Error('pourcentages par intervalle absents');
    await fermer();
  });

  await step('bordereau de matière : min/max + répartition en pourcentages', async () => {
    nav(/Saisie des notes/); await wait(600);
    click($$('#view .card-h button').find(b => /Imprimer le bordereau/.test(norm(b.textContent))));
    await wait(500);
    const m = modalTxt();
    for (const mot of ['Moyenne de la classe', 'Min :', 'Max :', '% ≥ 10'])
      if (!m.includes(mot)) throw new Error('« ' + mot + ' » absent');
    if (!/\(\d+ %\)/.test(m)) throw new Error('répartition sans pourcentages');
    await fermer();
  });

  /* ---------------- Bulletin : QR + sections ---------------- */
  await step('bulletin : génération du code de sécurité puis QR imprimé', async () => {
    nav(/Personnalisation/); await wait(600);
    const t0 = norm($('#view').textContent);
    if (!t0.includes('QR code de sécurité')) throw new Error('section QR absente des Paramètres');
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Générer/.test(norm(b.textContent))));
    await wait(300);
    click($('button.btn-pri:not(.btn-sm)')); await wait(500);   /* Enregistrer */
    const st = LS().settings || {};
    if (!/^([0-9a-f]{16})$/.test((st.bulletin || {}).codeSecurite || '')) throw new Error('code de sécurité non enregistré : ' + JSON.stringify((st.bulletin || {}).codeSecurite));
  });

  await step('récapitulatif annuel : QR code présent, tient en A4 (auto-ajustement)', async () => {
    nav(/Bulletins/); await wait(500);
    const selP = $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))));
    setSel(selP, ''); await wait(500);
    const row = $$('#view tbody tr').find(r => /\d,\d{2}/.test(norm(r.textContent)));
    if (!row) throw new Error('aucune ligne avec moyenne');
    click(row.querySelector('button')); await wait(600);
    const rcpEl = $('#modal-root .rcp');
    if (!rcpEl) throw new Error('récapitulatif absent');
    const wCss = w.getComputedStyle(rcpEl).width;
    if (wCss !== '756px') throw new Error('aperçu attendu à la largeur A4 — 20 cm (756 px), trouvé ' + wCss);
    const svg = $('#modal-root svg[data-qr]');
    if (!svg) throw new Error('QR code absent du récapitulatif annuel');
    const payload = svg.getAttribute('data-qr');
    if (!/^AUREL-SIGES\|ETAB:/.test(payload) || !/\|SIG:[0-9a-f]{12}$/.test(payload)) throw new Error('payload QR inattendu : ' + payload.slice(0, 60));
    if (payload.length > 271) throw new Error('payload QR trop long pour l\u2019encodeur');
    const m = modalTxt();
    for (const mot of ['RÉCAPITULATIF ANNUEL DES NOTES', 'Bilan disciplinaire annuel', 'heure(s)', 'Scanner pour vérifier'])
      if (!m.includes(mot)) throw new Error('« ' + mot + ' » absent');
    await fermer();
    /* le bulletin de séquence porte aussi le QR + le nom du titulaire */
    setSel(selP, '1'); await wait(500);
    const rowS = $$('#view tbody tr').find(r => /\d,\d{2}/.test(norm(r.textContent)));
    click(rowS.querySelector('button')); await wait(600);
    if (!$('#modal-root svg[data-qr]')) throw new Error('QR absent du bulletin de séquence');
    if (!modalTxt().includes('Achille Tankeu')) throw new Error('nom du titulaire absent du bulletin');
    await fermer();
    setSel(selP, ''); await wait(400);
  });

  await step('vérification : QR authentique accepté, QR falsifié refusé', async () => {
    /* récupérer un payload depuis un récapitulatif */
    const row = $$('#view tbody tr').find(r => /\d,\d{2}/.test(norm(r.textContent)));
    click(row.querySelector('button')); await wait(500);
    const payload = $('#modal-root svg[data-qr]').getAttribute('data-qr');
    await fermer();
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Vérifier un bulletin/.test(norm(b.textContent))));
    await wait(400);
    const ta = $('#modal-root textarea');
    if (!ta) throw new Error('modale de vérification absente');
    setInput(ta, payload);
    click($$('#modal-root button').find(b => /Vérifier/.test(norm(b.textContent)) && b.classList.contains('btn-pri')));
    await wait(400);
    let m = modalTxt();
    if (!m.includes('Document authentique')) throw new Error('QR authentique refusé');
    for (const mot of ['Élève', 'Classe', 'Moyenne']) if (!m.includes(mot)) throw new Error('données lues incomplètes');
    /* falsification : on modifie la moyenne dans le texte */
    setInput(ta, payload.replace(/MOY:[0-9,]+\/20/, 'MOY:19,99/20'));
    click($$('#modal-root button').find(b => /Vérifier/.test(norm(b.textContent)) && b.classList.contains('btn-pri')));
    await wait(400);
    m = modalTxt();
    if (!m.includes('NON CONFORME')) throw new Error('QR falsifié accepté');
    await fermer();
  });

  await step('bulletin : sections paramétrables (bilan disciplinaire débrayable)', async () => {
    nav(/Personnalisation/); await wait(600);
    const chk = $$('label.chk').find(l => /Bilan disciplinaire annuel/.test(norm(l.textContent)));
    if (!chk) throw new Error('case « Bilan disciplinaire annuel » introuvable');
    click(chk.querySelector('input')); await wait(200);
    click($('button.btn-pri:not(.btn-sm)')); await wait(500);
    nav(/Bulletins/); await wait(500);
    const row = $$('#view tbody tr').find(r => /\d,\d{2}/.test(norm(r.textContent)));
    click(row.querySelector('button')); await wait(600);
    if (modalTxt().includes('Bilan disciplinaire annuel')) throw new Error('le bilan devrait être masqué');
    if (!modalTxt().includes('RÉCAPITULATIF ANNUEL')) throw new Error('récapitulatif vide');
    await fermer();
    /* rétablissement */
    nav(/Personnalisation/); await wait(500);
    const chk2 = $$('label.chk').find(l => /Bilan disciplinaire annuel/.test(norm(l.textContent)));
    click(chk2.querySelector('input')); await wait(200);
    click($('button.btn-pri:not(.btn-sm)')); await wait(500);
    const sv = ((LS().settings || {}).bulletin || {}).sections || {};
    if (sv.bilan !== true) throw new Error('section bilan non rétablie : ' + JSON.stringify(sv));
  });

  /* ---------------- Documents scolaires ---------------- */
  await step('tableaux d\u2019honneur : seuils paramétrables et listes imprimées', async () => {
    nav(/Bulletins/); await wait(500);
    const selP = $$('#view select').find(s => [...s.options].some(o => /Année complète/.test(norm(o.textContent))));
    setSel(selP, '1'); await wait(500);   /* Séquence 1 : les moyennes sont bien réparties */
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Tableaux d'honneur/.test(norm(b.textContent))));
    await wait(400);
    const inputs = $$('#modal-root input[type="number"]');
    if (inputs.length < 2) throw new Error('seuils non éditables');
    setInput(inputs[0], '14'); setInput(inputs[1], '12');
    click($$('#modal-root button').find(b => /Générer/.test(norm(b.textContent))));
    await wait(600);
    const m = modalTxt();
    for (const mot of ['FÉLICITATIONS', "TABLEAU D'HONNEUR", '6ème A', 'Seuils'])
      if (!m.includes(mot)) throw new Error('« ' + mot + ' » absent');
    const lignes = $$('#modal-root tbody tr').filter(r => /\d,\d{2}/.test(norm(r.textContent)));
    if (lignes.length < 3) throw new Error('moins de 3 élèves honorés attendus en séquence 1, trouvé ' + lignes.length);
    await fermer();
    setSel(selP, ''); await wait(400);
  });

  await step('certificats de scolarité : un par élève de la classe', async () => {
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Certificats, cartes & badges/.test(norm(b.textContent))));
    await wait(400);
    const sels = $$('#modal-root select');
    if (sels.length < 2) throw new Error('type/classe non proposés');
    setSel(sels[0], 'certificat');
    const opt6a = [...sels[1].options].find(o => /6ème A/.test(norm(o.textContent)));
    setSel(sels[1], opt6a.value);
    click($$('#modal-root button').find(b => /Imprimer/.test(norm(b.textContent))));
    await wait(600);
    const m = modalTxt();
    for (const mot of ['CERTIFICAT DE SCOLARITÉ', 'régulièrement inscrit', 'pour servir et valoir ce que de droit', 'Fait à'])
      if (!m.includes(mot)) throw new Error('« ' + mot + ' » absent');
    const n = (m.match(/CERTIFICAT DE SCOLARITÉ/g) || []).length;
    if (n !== 12) throw new Error('12 certificats attendus (effectif 6ème A), trouvé ' + n);
    await fermer();
  });

  await step('cartes scolaires et badges : planche avec QR par élève', async () => {
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Certificats, cartes & badges/.test(norm(b.textContent))));
    await wait(400);
    const sels = $$('#modal-root select');
    setSel(sels[0], 'carte');
    setSel(sels[1], [...sels[1].options].find(o => /6ème A/.test(norm(o.textContent))).value);
    click($$('#modal-root button').find(b => /Imprimer/.test(norm(b.textContent))));
    await wait(600);
    if (!modalTxt().includes('Cartes scolaires')) throw new Error('titre cartes absent');
    if (!modalTxt().includes('à découper')) throw new Error('consigne de découpage absente');
    if ($$('#modal-root svg[data-qr]').length !== 12) throw new Error('12 QR attendus sur les cartes, trouvé ' + $$('#modal-root svg[data-qr]').length);
    if (!modalTxt().includes('Interne') && !modalTxt().includes('Externe')) throw new Error('régime absent des cartes');
    await fermer();
    /* badges */
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Certificats, cartes & badges/.test(norm(b.textContent))));
    await wait(400);
    const sels2 = $$('#modal-root select');
    setSel(sels2[0], 'badge');
    setSel(sels2[1], [...sels2[1].options].find(o => /6ème A/.test(norm(o.textContent))).value);
    click($$('#modal-root button').find(b => /Imprimer/.test(norm(b.textContent))));
    await wait(600);
    if (!modalTxt().includes('Badges des élèves')) throw new Error('titre badges absent');
    if ($$('#modal-root svg[data-qr]').length !== 12) throw new Error('12 QR attendus sur les badges');
    if (!/Mat\. :/.test(modalTxt())) throw new Error('matricule absent des badges');
    await fermer();
  });

  /* ---------------- Titulaire par classe ---------------- */
  await step('titulaire par classe : colonne, définition et synchronisation du périmètre', async () => {
    nav(/Classes/); await wait(500);
    if (!norm($('#view').textContent).includes('Titulaire')) throw new Error('colonne Titulaire absente');
    const row6a = $$('#view tbody tr').find(r => /6ème A/.test(norm(r.textContent)));
    if (!row6a || !norm(row6a.textContent).includes('Achille Tankeu')) throw new Error('titulaire de la 6ème A non affiché');
    /* affectation sur la 5ème B */
    const row5b = $$('#view tbody tr').find(r => /5ème B/.test(norm(r.textContent)));
    click(row5b.querySelector('button[title="Modifier"]')); await wait(400);
    const selT = $('#form-modal-form select[name="titulaireId"]');
    if (!selT) throw new Error('sélecteur Titulaire absent de la fiche classe');
    setSel(selT, [...selT.options].find(o => /Achille Tankeu/.test(norm(o.textContent))).value);
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const b = LS();
    const cl5b = b.classes.find(c => c.id === 'cl5b');
    const uTit = b.users.find(u => u.id === 'us-tit');
    if (cl5b.titulaireId !== 'us-tit') throw new Error('titulaire non enregistré sur la 5ème B');
    if (!Array.isArray(uTit.classesIds) || !uTit.classesIds.includes('cl5b')) throw new Error('périmètre du titulaire non synchronisé : ' + JSON.stringify(uTit.classesIds));
    const row5b2 = $$('#view tbody tr').find(r => /5ème B/.test(norm(r.textContent)));
    if (!norm(row5b2.textContent).includes('Achille Tankeu')) throw new Error('titulaire non affiché pour la 5ème B');
    /* retrait */
    click(row5b2.querySelector('button[title="Modifier"]')); await wait(400);
    setSel($('#form-modal-form select[name="titulaireId"]'), '');
    $('#form-modal-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await wait(500);
    const b2 = LS();
    if (b2.classes.find(c => c.id === 'cl5b').titulaireId) throw new Error('titulaire non retiré');
    if ((b2.users.find(u => u.id === 'us-tit').classesIds || []).includes('cl5b')) throw new Error('classe non retirée du périmètre');
  });

  /* ---------------- Censeur par niveau ---------------- */
  await step('censeur par niveau : colonne Censeur sur la page Niveaux', async () => {
    nav(/Niveaux/); await wait(500);
    const t = norm($('#view').textContent);
    if (!t.includes('Censeur')) throw new Error('colonne Censeur absente');
    const row6 = $$('#view tbody tr').find(r => /Sixième/.test(norm(r.textContent)));
    if (!row6) throw new Error('niveau Sixième introuvable');
    if (!norm(row6.textContent).includes('Odile Ngo Bell')) throw new Error('censeure du collège non affichée sur Sixième');
    const row2 = $$('#view tbody tr').find(r => /Seconde/.test(norm(r.textContent)));
    if (row2 && norm(row2.textContent).includes('Odile Ngo Bell')) throw new Error('censeure affichée hors de son cycle (Seconde)');
  });

  /* ---------------- Enseignant : ses classes uniquement ---------------- */
  await step('enseignant : saisie par élève limitée aux classes qui lui sont affectées', async () => {
    await login('enseignant', 'enseignant2026');
    nav(/Saisie des notes/); await wait(600);
    click($$('.tab').find(b => /Par élève/.test(norm(b.textContent)))); await wait(500);
    const selC = $$('#view select')[0];
    if (!selC) throw new Error('sélecteur de classe absent (Par élève)');
    const labs = [...selC.options].map(o => norm(o.textContent));
    if (labs.some(l => /3ème|4ème|Terminale|2nde|1ère/.test(l))) throw new Error('classe hors périmètre proposée : ' + labs.join(' | '));
    if (labs.length < 3) throw new Error('au moins 3 classes attendues (6A/6B/5A/5B), trouvé ' + labs.length);
    /* onglet Par matière : même périmètre */
    click($$('.tab').find(b => /Par matière/.test(norm(b.textContent)))); await wait(500);
    const labs2 = [...$$('#view select')[0].options].map(o => norm(o.textContent));
    if (labs2.some(l => /3ème|4ème|Terminale|2nde|1ère/.test(l))) throw new Error('Par matière : classe hors périmètre');
    await login('admin', 'admin2026');
  });

  /* ---------------- v5.7 : menus, moyenne annuelle, WhatsApp, imports ---------------- */
  await step('menus réorganisés (v6.4) : Scolarité, Finances, Pédagogie structure/notes, Administration', async () => {
    const grp = $$('.nav-g').map(n => norm(n.textContent));
    for (const g of ['Scolarité', 'Finances', 'Pédagogie — structure', 'Pédagogie — notes & bilans', 'Administration'])
      if (!grp.includes(g)) throw new Error('groupe « ' + g + ' » absent : ' + grp.join(' | '));
    if (grp.includes('Configuration') || grp.includes('Inscriptions')) throw new Error('anciens groupes encore présents');
    if (!$$('.nav-i span:first-of-type').some(n => /Discipline & absences/.test(norm(n.textContent))))
      throw new Error('intitulé « Discipline & absences » absent');
  });

  await step('saisie par élève : moyenne ANNUELLE affichée en temps réel', async () => {
    nav(/Saisie des notes/); await wait(600);
    click($$('.tab').find(b => /Par élève/.test(norm(b.textContent)))); await wait(500);
    const kpi = $$('#view .kpis, #view .eleve-head').flatMap(z => [...z.querySelectorAll('*')])
      .find(z => /Moyenne annuelle \/ 20/.test(norm(z.textContent)));
    if (!kpi) throw new Error('indicateur « Moyenne annuelle / 20 » absent du mode Par élève');
    const zone = norm(kpi.closest('.eh-kpis') ? kpi.closest('.eh-kpis').textContent : kpi.textContent);
    if (!/\d,\d{2}/.test(zone) && !zone.includes('—')) throw new Error('valeur annuelle illisible : ' + zone.slice(0, 80));
    if (!/rang annuel/.test(zone) && !/aucune note/.test(zone)) throw new Error('rang annuel absent : ' + zone.slice(0, 120));
  });

  await step('bulletins : envoi du résumé au parent par WhatsApp (contact enregistré)', async () => {
    nav(/Bulletins/); await wait(600);
    let capture = '';
    const oldOpen = w.open;
    w.open = url => { capture = String(url); return {}; };
    try {
      const btn = $$('button').filter(b => !b.closest('.nav-i')).find(b => /Envoyer le résumé du bulletin/.test(b.title || ''));
      if (!btn) throw new Error('bouton WhatsApp absent des lignes de bulletins');
      click(btn); await wait(300);
      if (!/^https:\/\/wa\.me\/237\d{9}\?text=/.test(capture)) throw new Error('lien WhatsApp inattendu : ' + capture.slice(0, 60));
      const corps = decodeURIComponent(capture.split('text=')[1] || '');
      if (!/Bulletin|Moyenne/.test(corps)) throw new Error('message sans résumé : ' + corps.slice(0, 80));
    } finally { w.open = oldOpen; }
  });

  await step('imports et impressions disponibles sur les listes (élèves, matières)', async () => {
    nav(/Élèves/); await wait(500);
    if (!$$('button').some(b => /Importer des élèves/.test(norm(b.textContent)))) throw new Error('import élèves absent');
    nav(/Matières/); await wait(500);
    if (!$$('button').some(b => /Importer/.test(norm(b.textContent)))) throw new Error('import matières absent');
    if (!$$('button').some(b => /Imprimer la liste/.test(norm(b.textContent)))) throw new Error('impression matières absente');
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Imprimer la liste/.test(norm(b.textContent)))); await wait(500);
    if (!ouverte()) throw new Error('liste imprimable non ouverte');
    if (!modalTxt().includes('Catalogue des matières')) throw new Error('contenu de la liste imprimable inattendu');
    await fermer();
  });

  await wait(400);
  if (errors.length){ console.error('✗ erreurs React :', errors.slice(0, 4)); fails++; }
  else console.log('✓ aucune erreur React pendant tout le parcours');

  console.log(fails ? '\n=== SMOKE TEST (v5.5→v5.7) : ÉCHEC (' + fails + ') ===' : '\n=== SMOKE TEST (v5.5→v5.7) : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
