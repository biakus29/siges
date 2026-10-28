/* Smoke v1.10 — CRUD classes/niveaux (avec cascade), anciens élèves : import + préremplissage */
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
const LS = () => { const d = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1')); const b = (Array.isArray(d && d.bases) && (d.bases.find(x => x.id === 'etab-001') || d.bases[0])) || d;
  return (d && d.bases) ? Object.assign({}, b, { users:d.users, etablissements:d.etablissements, bases:d.bases }) : d; };
function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function setSel(el, v){ Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('change', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
const modalForm = () => { const f = $('#modal-root form'); if (!f) throw new Error('formulaire absent'); return f; };
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  await wait(600);
  await step('connexion admin', async () => {
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(500);
    if (!$('#app')) throw new Error('app absente');
  });

  await step('CRUD niveau : création, modification, suppression', async () => {
    nav(/Niveaux/); await wait(400);
    /* création */
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouveau niveau/i.test(norm(b.textContent)))); await wait(350);
    let f = modalForm();
    setInput(f.querySelector('input[name="code"]'), 'TST');
    setInput(f.querySelector('input[name="libelle"]'), 'Section de test');
    setSel(f.querySelector('select[name="cycle"]'), 'Collège');
    setInput(f.querySelector('input[name="ordre"]'), '9');
    f.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true })); await wait(400);
    if (!LS().niveaux.some(n => n.code === 'TST')) throw new Error('niveau TST non créé');
    /* modification */
    const row = $$('#view tbody tr').find(r => norm(r.textContent).includes('TST'));
    click(row.querySelector('button[title="Modifier"]')); await wait(350);
    f = modalForm();
    setInput(f.querySelector('input[name="libelle"]'), 'Section modifiée');
    f.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true })); await wait(400);
    if (!LS().niveaux.find(n => n.code === 'TST').libelle.includes('modifiée')) throw new Error('modification non enregistrée');
    /* suppression (sans classes) */
    const row2 = $$('#view tbody tr').find(r => norm(r.textContent).includes('TST'));
    click(row2.querySelector('button[title="Supprimer"]')); await wait(300);
    click($$('#modal-root button').find(b => b.classList.contains('btn-danger'))); await wait(400);
    if (LS().niveaux.some(n => n.code === 'TST')) throw new Error('niveau TST encore présent');
  });

  await step('CRUD classe : création et suppression (vide)', async () => {
    nav(/Classes/); await wait(400);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouvelle classe/i.test(norm(b.textContent)))); await wait(350);
    const f = modalForm();
    setInput(f.querySelector('input[name="libelle"]'), '6ème Z');
    setSel(f.querySelector('select[name="niveauId"]'), 'nv6');
    f.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true })); await wait(400);
    if (!LS().classes.some(c => c.libelle === '6ème Z')) throw new Error('classe non créée');
    const row = $$('#view tbody tr').find(r => norm(r.textContent).includes('6ème Z'));
    click(row.querySelector('button[title="Supprimer"]')); await wait(300);
    click($$('#modal-root button').find(b => b.classList.contains('btn-danger'))); await wait(400);
    if (LS().classes.some(c => c.libelle === '6ème Z')) throw new Error('classe encore présente');
  });

  await step('suppression d\u2019un niveau AVEC classes et élèves (cascade confirmée)', async () => {
    nav(/Niveaux/); await wait(400);
    const avant = LS();
    const nCls = avant.classes.filter(c => c.niveauId === 'nv6').length;
    const nEl = avant.eleves.filter(e => avant.classes.some(c => c.id === e.classeId && c.niveauId === 'nv6')).length;
    if (!nCls || !nEl) throw new Error('nv6 sans contenu ?');
    const row = $$('#view tbody tr').find(r => norm(r.textContent).includes('Sixième'));
    click(row.querySelector('button[title="Supprimer"]')); await wait(300);
    const modal = norm($('#modal-root').textContent);
    if (!modal.includes(nCls + ' classe(s)')) throw new Error('avertissement classes absent');
    if (!modal.includes(nEl + ' élève(s)')) throw new Error('avertissement élèves absent');
    click($$('#modal-root button').find(b => b.classList.contains('btn-danger'))); await wait(500);
    const apres = LS();
    if (apres.niveaux.some(n => n.id === 'nv6')) throw new Error('niveau encore présent');
    if (apres.classes.some(c => c.niveauId === 'nv6')) throw new Error('classes résiduelles');
    const elvNv6 = apres.eleves.filter(e => ['cl6a','cl6b'].includes(e.classeId)).length;
    if (elvNv6) throw new Error('élèves résiduels : ' + elvNv6);
    console.log('   cascade : ' + nCls + ' classe(s), ' + nEl + ' élève(s) supprimés avec le niveau');
  });

  await step('import de la liste des anciens élèves (CSV)', async () => {
    nav(/Élèves/); await wait(400);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Anciens élèves \(0\)/i.test(norm(b.textContent)))); await wait(400);
    const csv = 'Matricule;Nom;Prénom;Sexe;Date de naissance;Lieu de naissance;Nom du père;Profession du père;Téléphone du père;Nom de la mère;Profession de la mère;Téléphone de la mère;Ancien établissement;Adresse;Tuteur;Téléphone;Régime\n' +
      'ANC-001;Abena;Marie;F;12/05/2014;Yaoundé;M. Abena Jean;Commerçant;6 90 11 22 33;Mme Abena Rose;Enseignante;6 91 44 55 66;CES de Nkolbisson;Quartier Damas, Yaoundé;Mme Abena Rose;6 91 44 55 66;externe\n' +
      'ANC-002;Fotso;Éric;M;03/11/2013;Bafoussam;M. Fotso Pierre;Cultivateur;6 77 00 11 22;Mme Fotso Anne;Ménagère;6 78 33 44 55;Lycée de Biyem-Assi;Quartier Odza, Yaoundé;M. Fotso Pierre;6 77 00 11 22;interne\n' +
      'ANC-003;Nkoulou;Grace;F;25/02/2015;Douala;M. Nkoulou Paul;Chauffeur;6 99 88 77 66;Mme Nkoulou Jeanne;Couturière;6 98 77 66 55;Complexe scolaire La Grâce;Quartier Melen, Yaoundé;Mme Nkoulou Jeanne;6 98 77 66 55;externe\n';
    const inp = $('#modal-root input[type="file"]');
    if (!inp) throw new Error('sélecteur de fichier absent');
    const fcsv = new w.File([csv], 'anciens.csv', { type:'text/csv' });
    Object.defineProperty(inp, 'files', { value:[fcsv], configurable:true });
    inp.dispatchEvent(new w.Event('change', { bubbles:true }));
    await wait(500);
    const vue = norm($('#modal-root').textContent);
    if (!vue.includes('3 fiche(s)')) throw new Error('aperçu 3 fiches absent : ' + vue.slice(0, 150));
    click($$('#modal-root button').find(b => /Importer 3 fiche/i.test(norm(b.textContent)))); await wait(450);
    const anc = LS().anciens || [];
    if (anc.length !== 3) throw new Error('anciens non importés : ' + anc.length);
    const a1 = anc[0];
    if (a1.prenom !== 'Marie' || a1.dateNaissance !== '2014-05-12' || a1.pereNom !== 'M. Abena Jean') throw new Error('fiche mal normalisée : ' + JSON.stringify(a1).slice(0, 120));
    if (!$('#toast-root .toast')) throw new Error('notification absente');
  });

  await step('inscription : recherche d\u2019un ancien → fiche préremplie → élève créé', async () => {
    const matriculeSuivant = 'BON-26-' + String(200).padStart(4, '0'); /* info seulement */
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Inscrire un élève/i.test(norm(b.textContent)))); await wait(400);
    const srch = $('#modal-root .srch input');
    if (!srch) throw new Error('recherche absent du choix d\u2019inscription');
    setInput(srch, 'Abena'); await wait(350);
    const rows = $$('#modal-root .pm-row');
    if (!rows.length) throw new Error('aucun ancien trouvé pour Abena');
    if (!norm(rows[0].textContent).includes('ANC-001')) throw new Error('fiche ANC-001 absente');
    click(rows[0]); await wait(500);
    /* formulaire prérempli */
    const f = modalForm();
    const val = n => { const el = f.querySelector('[name="' + n + '"]'); return el ? el.value : null; };
    if (val('nom') !== 'Abena') throw new Error('nom non prérempli : ' + val('nom'));
    if (val('prenom') !== 'Marie') throw new Error('prénom non prérempli');
    if (val('dateNaissance') !== '2014-05-12') throw new Error('date non préremplie : ' + val('dateNaissance'));
    if (val('pereNom') !== 'M. Abena Jean') throw new Error('père non prérempli');
    if (val('matricule') !== 'ANC-001') throw new Error('ancien matricule doit être repris (v6.0) : ' + val('matricule'));
    if (val('classeId')) throw new Error('classe doit être vide à compléter');
    if (!norm($('#modal-root').textContent).includes('préremplie')) throw new Error('bannière préremplie absente');
    /* compléter et enregistrer */
    setSel(f.querySelector('select[name="classeId"]'), 'cl5a');
    f.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true })); await wait(500);
    const el = LS().eleves.find(e => e.nom === 'ABENA' && e.prenom === 'Marie');
    if (!el) throw new Error('élève non créé');
    if (el.dateNaissance !== '2014-05-12') throw new Error('date non conservée : ' + el.dateNaissance);
    if (el.pereNom !== 'M. Abena Jean' || el.tuteur !== 'Mme Abena Rose') throw new Error('infos parents perdues');
    if (el.regime !== 'externe') throw new Error('régime non repris');
    if (el.classeId !== 'cl5a') throw new Error('classe non enregistrée');
    if (el.matricule !== 'ANC-001') throw new Error('matricule repris non conservé : ' + el.matricule);
  });

  await step('inscription d\u2019un nouvel élève (saisie normale) toujours possible', async () => {
    const xs = $$('.m-x'); if (xs.length) click(xs[xs.length - 1]); await wait(300);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Inscrire un élève/i.test(norm(b.textContent)))); await wait(400);
    click($$('#modal-root button').find(b => /Saisir un nouvel élève/i.test(norm(b.textContent)))); await wait(450);
    const f = modalForm();
    setInput(f.querySelector('input[name="nom"]'), 'NOUVEAU');
    setInput(f.querySelector('input[name="prenom"]'), 'Test');
    setSel(f.querySelector('select[name="classeId"]'), 'cl5a');
    f.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true })); await wait(450);
    if (!LS().eleves.some(e => e.nom === 'NOUVEAU')) throw new Error('nouvel élève non créé');
  });

  await step('aucune erreur React', () => {
    const real = errors.filter(e => !/Warning/.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  console.log(fails ? '\n=== ' + fails + ' ÉCHEC(S) ===' : '\n=== SMOKE TEST v1.10 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
