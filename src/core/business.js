/* Logique métier — fonctions pures prenant la base en premier paramètre */
import { sum, todayISO } from './utils.js';
import { hashPwd, sha256utf8 } from './sha256.js';

export const yearById   = (db,id) => db.annees.find(a => a.id === id) || null;
export const activeYear = db => db.annees.find(a => a.active) || null;
export const niveauById = (db,id) => db.niveaux.find(n => n.id === id) || null;
export const classById  = (db,id) => db.classes.find(c => c.id === id) || null;
export const fraisById  = (db,id) => db.frais.find(f => f.id === id) || null;
export const eleveById  = (db,id) => db.eleves.find(e => e.id === id) || null;
export const userById   = (db,id) => (db.users || []).find(u => u.id === id) || null;

export function niveauxSorted(db){ return db.niveaux.slice().sort((a,b)=> a.ordre - b.ordre); }
export function fraisSorted(db){ return db.frais.slice().sort((a,b)=> a.ordre - b.ordre); }
export function classesSorted(db){
  return db.classes.slice().sort((a,b)=>{
    const na = niveauById(db, a.niveauId), nb = niveauById(db, b.niveauId);
    const oa = na ? na.ordre : 99, ob = nb ? nb.ordre : 99;
    return oa !== ob ? oa - ob : (a.libelle < b.libelle ? -1 : 1);
  });
}
/* Classes proposées par les écrans pédagogiques (notes, bulletins,
   statistiques) : TOUTES les classes du périmètre, même sans élève inscrit
   cette année — une classe vide est signalée dans son libellé (optionClasse). */
export function classesPerimetre(db, classesIds){
  const all = classesSorted(db);
  return classesIds ? all.filter(c => classesIds.includes(c.id)) : all;
}
export function effectifClasse(db, anneeId, classeId){
  return (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === classeId).length;
}
/* Première classe ayant des élèves (sélection par défaut), sinon la première */
export function classeParDefaut(db, anneeId, classes){
  const c = classes.find(x => effectifClasse(db, anneeId, x.id) > 0) || classes[0];
  return c ? c.id : '';
}
export function optionClasse(db, anneeId, c){
  const nv = niveauById(db, c.niveauId);
  return { value:c.id, label:c.libelle + (nv ? ' — ' + nv.libelle : '')
    + (effectifClasse(db, anneeId, c.id) ? '' : ' (aucun élève)') };
}
export const classesOf = (db, niveauId) => classesSorted(db).filter(c => c.niveauId === niveauId);
export function elevesOfYear(db, anneeId){
  return db.eleves.filter(e => e.anneeId === anneeId)
    .sort((a,b)=> (a.nom+a.prenom) < (b.nom+b.prenom) ? -1 : 1);
}
export const boursesOfYear = (db, anneeId) => (db.bourses || []).filter(b => b.anneeId === anneeId);

/* Tarif défini explicitement pour une cible (niveau ou classe) et un régime
   (null/undefined = commun aux internes et externes) */
/* Situation de l'élève pour la grille : nouveau ou ancien.
   Champ explicite sinon dérivation (élève présent une année antérieure). */
export function statutEleveOf(db, eleve){
  if (eleve && (eleve.statutEleve === 'ancien' || eleve.statutEleve === 'nouveau')) return eleve.statutEleve;
  if (!eleve) return 'nouveau';
  const dejaInscrit = (db.eleves || []).some(e => e.anneeId !== eleve.anneeId
    && e.nom === eleve.nom && e.prenom === eleve.prenom
    && (!eleve.dateNaissance || !e.dateNaissance || e.dateNaissance === eleve.dateNaissance));
  return dejaInscrit ? 'ancien' : 'nouveau';
}

export function tarifFor(db, anneeId, fraisId, cibleType, cibleId, regime, statut){
  const rg = regime || null, st = statut || null;
  const t = db.tarifs.find(x => x.anneeId === anneeId && x.fraisId === fraisId
    && x.cibleType === cibleType && x.cibleId === cibleId
    && (x.regime || null) === rg && (x.statutEleve || null) === st);
  return t ? t.montant : null;
}
/* Tarif effectif : classe+statut > classe+régime > classe > niveau+statut >
   niveau+régime > niveau (les couches statut/régime sont prioritaires sur le commun). */
export function tarifEffectif(db, anneeId, fraisId, classeId, regime, statut){
  const cl = classById(db, classeId);
  if (!cl) return null;
  let t = tarifFor(db, anneeId, fraisId, 'classe', classeId, regime, statut);
  if (t != null) return t;
  t = tarifFor(db, anneeId, fraisId, 'classe', classeId, null, statut);
  if (t != null) return t;
  t = tarifFor(db, anneeId, fraisId, 'classe', classeId, regime);
  if (t != null) return t;
  t = tarifFor(db, anneeId, fraisId, 'classe', classeId);
  if (t != null) return t;
  t = tarifFor(db, anneeId, fraisId, 'niveau', cl.niveauId, null, statut);
  if (t != null) return t;
  t = tarifFor(db, anneeId, fraisId, 'niveau', cl.niveauId, regime);
  if (t != null) return t;
  return tarifFor(db, anneeId, fraisId, 'niveau', cl.niveauId);
}

/* ---------- Bourses & réductions ---------- */
export function boursesOfEleve(db, eleve){
  return (db.bourses || []).filter(b => b.actif !== false && b.eleveId === eleve.id && b.anneeId === eleve.anneeId);
}
/* Réduction accordée sur un frais (somme des bourses actives, plafonnée au tarif) */
export function reductionFor(db, eleve, fraisId, du){
  if (!du) return 0;
  let red = 0;
  boursesOfEleve(db, eleve).forEach(b => {
    if (b.fraisId && b.fraisId !== fraisId) return;
    if (b.pourcentage) red += Math.round(du * b.pourcentage / 100);
    else if (b.montant) red += Math.min(b.montant, du);
  });
  return Math.min(du, red);
}
/* Valeur estimée d'une bourse sur l'année (pour les listes) */
export function bourseValeur(db, b){
  const el = eleveById(db, b.eleveId);
  if (!el) return 0;
  let base = 0;
  fraisSorted(db).forEach(f => {
    if (b.fraisId && b.fraisId !== f.id) return;
    const du = tarifEffectif(db, el.anneeId, f.id, el.classeId, el.regime, statutEleveOf(db, el));
    if (du != null) base += du;
  });
  if (b.pourcentage) return Math.round(base * b.pourcentage / 100);
  return Math.min(b.montant || 0, base);
}

/* Situation détaillée d'un élève, frais par frais (réductions incluses) */
export function situationRows(db, eleve){
  return fraisSorted(db).map(f => {
    const du = tarifEffectif(db, eleve.anneeId, f.id, eleve.classeId, eleve.regime, statutEleveOf(db, eleve));
    if (du == null) return { frais:f, du:null, reduction:null, net:null, paye:null, solde:null, applicable:false };
    const reduction = reductionFor(db, eleve, f.id, du);
    const net = du - reduction;
    const paye = sum(db.paiements.filter(p => p.eleveId === eleve.id && p.fraisId === f.id && p.statut === 'valide'), p => p.montant);
    return { frais:f, du, reduction, net, paye, solde:Math.max(0, net - paye), applicable:true };
  });
}
export function situationTotals(db, eleve){
  const rows = situationRows(db, eleve).filter(r => r.applicable);
  const brut = sum(rows, r => r.du);
  const reduction = sum(rows, r => r.reduction);
  const net = brut - reduction;
  const paye = sum(rows, r => r.paye);
  const soldeOblig = sum(rows.filter(r => r.frais.obligatoire), r => r.solde);
  return { brut, reduction, net, paye, solde:Math.max(0, net - paye), aJour:soldeOblig === 0 };
}

/* Agrégats annuels en une passe (nets de réductions) */
export function yearAggregates(db, anneeId){
  const payBy = {}; let todayN = 0, todayM = 0; const t = todayISO();
  db.paiements.forEach(p => {
    if (p.anneeId !== anneeId || p.statut !== 'valide') return;
    payBy[p.eleveId] = payBy[p.eleveId] || {};
    payBy[p.eleveId][p.fraisId] = (payBy[p.eleveId][p.fraisId] || 0) + p.montant;
    if (p.date.slice(0,10) === t){ todayN++; todayM += p.montant; }
  });
  const fra = fraisSorted(db);
  const perClasse = {}, perNiveau = {};
  const els = db.eleves.filter(e => e.anneeId === anneeId);
  let attendu = 0, encaisse = 0, effectif = 0, totalReductions = 0, aJourTotal = 0;
  els.forEach(e => {
    const cl = classById(db, e.classeId); if (!cl) return;
    const cAg = perClasse[cl.id] = perClasse[cl.id] || { classe:cl, effectif:0, effectifTotal:0, attendu:0, reduction:0, encaisse:0, aJour:0 };
    const nvAg = perNiveau[cl.niveauId] = perNiveau[cl.niveauId] || { niveau:niveauById(db, cl.niveauId), attendu:0, reduction:0, encaisse:0 };
    cAg.effectifTotal++;
    let soldeOblig = 0;
    fra.forEach(f => {
      const du = tarifEffectif(db, anneeId, f.id, cl.id, e.regime, statutEleveOf(db, e));
      if (du == null) return;
      const red = reductionFor(db, e, f.id, du);
      const net = du - red;
      const paye = Math.min(net, (payBy[e.id] && payBy[e.id][f.id]) || 0);
      attendu += net; encaisse += paye; totalReductions += red;
      cAg.attendu += net; cAg.reduction += red; cAg.encaisse += paye;
      nvAg.attendu += net; nvAg.reduction += red; nvAg.encaisse += paye;
      if (f.obligatoire) soldeOblig += Math.max(0, net - paye);
    });
    if (e.statut === 'actif'){
      effectif++; cAg.effectif++;
      if (soldeOblig === 0){ cAg.aJour++; aJourTotal++; }
    }
  });
  return { payBy, effectif, effectifTotal:els.length, attendu, encaisse, totalReductions, aJourTotal,
           taux: attendu > 0 ? Math.min(1, encaisse/attendu) : 0,
           aujourdhui:{ n:todayN, montant:todayM }, perNiveau, perClasse };
}

export function nextReceipt(db, anneeId){
  const yy = (yearById(db, anneeId) || { libelle:'0000-0' }).libelle.slice(2,4);
  let max = 0;
  db.paiements.filter(p => p.anneeId === anneeId).forEach(p => {
    const m = /^REC-\d\d-(\d+)$/.exec(p.numero);
    if (m) max = Math.max(max, parseInt(m[1],10));
  });
  return 'REC-' + yy + '-' + String(max+1).padStart(4,'0');
}

export function nextMatricule(db, anneeId){
  const yy = (yearById(db, anneeId) || { libelle:'0000-0' }).libelle.slice(2,4);
  let max = 0;
  db.eleves.filter(e => e.anneeId === anneeId).forEach(e => {
    const m = /^BON-\d\d-(\d+)$/.exec(e.matricule);
    if (m) max = Math.max(max, parseInt(m[1],10));
  });
  return 'BON-'+yy+'-'+String(max+1).padStart(4,'0');
}

export function verifyLogin(db, username, pwd){
  const u = db.users.find(x => x.username.toLowerCase() === String(username||'').trim().toLowerCase());
  if (!u) return { ok:false, reason:'inconnu' };
  if (!u.actif) return { ok:false, reason:'inactif' };
  if (u.hash !== hashPwd(u.salt, pwd)) return { ok:false, reason:'motdepasse' };
  return { ok:true, user:u };
}

/* ---------- Paramètres de personnalisation (états, en-têtes, logo) ---------- */
export const SETTINGS_DEFAUT = {
  nomEtablissement: 'COLLÈGE BONNEAU',
  sousTitre: "Établissement d'enseignement secondaire catholique",
  mention: 'Intendance — Aurel School SIGES',
  adresse: '',
  telephone: '',
  email: '',
  piedEtat: 'Document interne — Collège Bonneau',
  logo: ''   /* dataURL de l'image importée */
};
export function settingsOf(db){
  return { ...SETTINGS_DEFAUT, ...((db && db.settings) || {}) };
}

/* ---------- Tranches & échéances ---------- */
const pad2b = n => String(n).padStart(2, '0');

/* Tranches normalisées d'un frais (repli : tranche unique 100 % au 30/09),
   triées dans l'ordre chronologique de l'année scolaire. */
export function tranchesOfFrais(db, fraisId){
  const f = fraisById(db, fraisId);
  let list = (f && Array.isArray(f.tranches)) ? f.tranches.slice() : [];
  if (!list.length) list = [{ label:'Tranche unique', pourcentage:100, jour:30, mois:9 }];
  list = list.map((t, i) => ({
    id: 't' + (i + 1),
    label: String(t.label || '').trim() || ('T' + (i + 1)),
    pourcentage: Math.max(0, Math.round(Number(t.pourcentage) || 0)),
    jour: Math.min(31, Math.max(1, parseInt(t.jour, 10) || 1)),
    mois: Math.min(12, Math.max(1, parseInt(t.mois, 10) || 9))
  }));
  list.sort((a, b) => {
    const oa = a.mois >= 8 ? a.mois : a.mois + 12;   /* sept-déc = 1re partie de l'année scolaire */
    const ob = b.mois >= 8 ? b.mois : b.mois + 12;
    return oa !== ob ? oa - ob : a.jour - b.jour;
  });
  return list.map((t, i) => ({ ...t, id:'t' + (i + 1) }));
}

/* Échéance concrète (ISO AAAA-MM-JJ) d'une tranche pour une année scolaire */
export function trancheISO(annee, tr){
  const y0 = parseInt(((annee && annee.debut) || '2026-09-01').slice(0, 4), 10) || 2026;
  const y = tr.mois >= 8 ? y0 : y0 + 1;
  return y + '-' + pad2b(tr.mois) + '-' + pad2b(tr.jour);
}

/* Montants de tranches pour un montant donné (dernière tranche = reste, écarts d'arrondi absorbés) */
export function trancheMontants(montant, tranches){
  const out = []; let cumul = 0;
  tranches.forEach((tr, i) => {
    const reste = Math.max(0, montant - cumul);
    const m = i === tranches.length - 1 ? reste : Math.min(reste, Math.round(montant * tr.pourcentage / 100));
    out.push(m); cumul += m;
  });
  return out;
}

/* Index des paiements valides d'une année : eleveId -> fraisId -> montant cumulé */
export function payIndexOf(db, anneeId){
  const payBy = {};
  db.paiements.forEach(p => {
    if (p.anneeId !== anneeId || p.statut !== 'valide') return;
    payBy[p.eleveId] = payBy[p.eleveId] || {};
    payBy[p.eleveId][p.fraisId] = (payBy[p.eleveId][p.fraisId] || 0) + p.montant;
  });
  return payBy;
}

/* Solvabilité détaillée d'un élève, tranche par tranche.
   Exigible = cumul des tranches dont l'échéance est passée.
   Insolvable = au moins un frais OBLIGATOIRE dont l'exigible n'est pas réglé. */
export function solvabiliteEleve(db, eleve, payBy){
  const annee = yearById(db, eleve.anneeId);
  const pays = payBy || payIndexOf(db, eleve.anneeId);
  const t = todayISO();
  let net = 0, paye = 0, exigible = 0, reste = 0, insolvable = false;
  const parFrais = [];
  fraisSorted(db).forEach(f => {
    const du = tarifEffectif(db, eleve.anneeId, f.id, eleve.classeId, eleve.regime, statutEleveOf(db, eleve));
    if (du == null) return;
    const reduction = reductionFor(db, eleve, f.id, du);
    const nNet = du - reduction;
    const pPaye = (pays[eleve.id] && pays[eleve.id][f.id]) || 0;
    const trs = tranchesOfFrais(db, f.id);
    const montants = trancheMontants(nNet, trs);
    let cumul = 0, exFrais = 0;
    const tranches = trs.map((tr, i) => {
      cumul += montants[i];
      const iso = trancheISO(annee, tr);
      const due = iso <= t;
      const payeCumul = Math.min(pPaye, cumul);
      const etat = payeCumul >= cumul ? 'payee' : (due ? 'retard' : 'avenir');
      if (due) exFrais = cumul;
      return { id:tr.id, label:tr.label, iso, montant:montants[i], exigibleCumul:cumul, payeCumul, due, etat };
    });
    const insol = pPaye < exFrais && f.obligatoire;
    net += nNet; paye += Math.min(pPaye, nNet); exigible += exFrais;
    if (insol){ reste += Math.max(0, exFrais - pPaye); insolvable = true; }
    parFrais.push({ frais:f, du, reduction, net:nNet, paye:Math.min(pPaye, nNet),
      solde:Math.max(0, nNet - pPaye), exigible:exFrais,
      resteDu:Math.max(0, exFrais - Math.min(pPaye, nNet)),
      enRetard:pPaye < exFrais, insolvable:insol, tranches });
  });
  return { parFrais, net, paye, exigible, reste, insolvable };
}

/* Solvabilité de tous les élèves d'une année : compteurs + répartition par classe */
export function solvabiliteAnnee(db, anneeId){
  const payBy = payIndexOf(db, anneeId);
  const parEleve = {};
  db.eleves.filter(e => e.anneeId === anneeId).forEach(e => {
    const s = solvabiliteEleve(db, e, payBy);
    parEleve[e.id] = {
      insolvable:s.insolvable, exigible:s.exigible, reste:s.reste,
      retards:s.parFrais.filter(x => x.insolvable)
        .map(x => ({ fraisId:x.frais.id, libelle:x.frais.libelle, solde:x.resteDu }))
    };
  });
  const parClasse = {}; let insolvables = 0, soldeExigible = 0;
  db.eleves.filter(e => e.anneeId === anneeId && e.statut === 'actif').forEach(e => {
    const cl = classById(db, e.classeId); if (!cl) return;
    const c = parClasse[cl.id] = parClasse[cl.id] || { classe:cl, effectif:0, insolvables:0, solde:0 };
    c.effectif++;
    const r = parEleve[e.id];
    if (r && r.insolvable){ c.insolvables++; c.solde += r.reste; insolvables++; soldeExigible += r.reste; }
  });
  return { parEleve, parClasse, insolvables, soldeExigible };
}

/* ================================================================
   MULTI-ÉTABLISSEMENTS (v2.1)
   Structure : db.etablissements[] + db.bases{ [etabId]: { annees,
   niveaux, classes, frais, tarifs, eleves, paiements, bourses,
   anciens, journal, settings } }. Les comptes (db.users) sont globaux ;
   chacun porte etablissementId, sauf le superadministrateur.
   ================================================================ */
export const COLL_BASES = ['annees','niveaux','classes','frais','tarifs','eleves','paiements','bourses','anciens','journal','settings','matieres','notes','discipline','groupes','enseignants','plan','sequences','appreciations','appreciationsApc','appreciationsMoyenne','appreciationsMoyenneApc','sanctionsAbs','modelesDocs'];

export function newEtabId(db){
  let n = 1;
  const ids = new Set((db.etablissements || []).map(e => e.id));
  while (ids.has('etab-' + String(n).padStart(3, '0'))) n++;
  return 'etab-' + String(n).padStart(3, '0');
}

export function emptyBase(){
  return { annees:[], niveaux:[], classes:[], frais:[], tarifs:[], eleves:[],
    paiements:[], bourses:[], anciens:[], journal:[], settings:{},
    matieres:[], notes:[], discipline:[], groupes:[], enseignants:[], plan:[], sequences:[], appreciations:[],
    appreciationsApc:[], appreciationsMoyenne:[], appreciationsMoyenneApc:[] };
}

export function etabsOf(db){
  return (db.etablissements || []).filter(e => e && e.id);
}

export function baseOf(db, etabId){
  if (!Array.isArray(db.bases)) return null;
  return db.bases.find(b => b && b.id === etabId) || null;
}

/* Séquences par défaut : 6 séquences, 2 par trimestre, poids 40/60 (v5) */
export function defaultSequences(){
  return [
    { id:'1', libelle:'Séquence 1', trimestre:1, poids:40 },
    { id:'2', libelle:'Séquence 2', trimestre:1, poids:60 },
    { id:'3', libelle:'Séquence 3', trimestre:2, poids:40 },
    { id:'4', libelle:'Séquence 4', trimestre:2, poids:60 },
    { id:'5', libelle:'Séquence 5', trimestre:3, poids:40 },
    { id:'6', libelle:'Séquence 6', trimestre:3, poids:60 }
  ];
}
/* Appréciations par défaut : fourchettes de notes (v5) */
export function defaultAppreciations(){
  return [
    { id:'ap1', min:0, max:10, libelle:'Insuffisant' },
    { id:'ap2', min:10, max:12, libelle:'Passable' },
    { id:'ap3', min:12, max:14, libelle:'Assez bien' },
    { id:'ap4', min:14, max:16, libelle:'Bien' },
    { id:'ap5', min:16, max:18, libelle:'Très bien' },
    { id:'ap6', min:18, max:20, libelle:'Excellent' }
  ];
}

/* v6.0 — APC (Approche Par Compétences) : échelle d'appréciation par niveau
   de maîtrise (Cameroun, MINESEC) : Non Acquis / En cours d'acquisition /
   Acquis / Expert. Éditable comme l'échelle classique. */
export function defaultAppreciationsApc(){
  return [
    { id:'na1', min:0, max:10, libelle:'Non Acquis' },
    { id:'na2', min:10, max:15, libelle:'En cours d\u2019acquisition' },
    { id:'na3', min:15, max:18, libelle:'Acquis' },
    { id:'na4', min:18, max:20, libelle:'Expert' }
  ];
}
/* v6.0 — échelle d'appréciation des MOYENNES (générales / par groupe) :
   indépendante de l'échelle des notes, éditable, déclinée en mode classique
   et en mode APC. */
export function defaultAppreciationsMoyenne(){
  return [
    { id:'am1', min:0, max:10, libelle:'Insuffisant' },
    { id:'am2', min:10, max:12, libelle:'Passable' },
    { id:'am3', min:12, max:14, libelle:'Assez bien' },
    { id:'am4', min:14, max:16, libelle:'Bien' },
    { id:'am5', min:16, max:18, libelle:'Très bien' },
    { id:'am6', min:18, max:20, libelle:'Excellent' }
  ];
}

/* Base saine : toutes les collections présêtes (arrays) + settings objet.
   Les bases antérieures à la v5 (sans séquences/appréciations) reçoivent
   les valeurs par défaut — auto-réparation au chargement. */
export function ensureBase(base){
  const b = base || emptyBase();
  const hadSeq = Object.prototype.hasOwnProperty.call(b, 'sequences');
  const hadApp = Object.prototype.hasOwnProperty.call(b, 'appreciations');
  const hadSan = Object.prototype.hasOwnProperty.call(b, 'sanctionsAbs');
  COLL_BASES.forEach(c => {
    if (c === 'settings'){ if (!b.settings || typeof b.settings !== 'object') b.settings = {}; }
    else if (!Array.isArray(b[c])) b[c] = [];
  });
  if (!hadSeq && !b.sequences.length) b.sequences = defaultSequences();
  if (!hadApp && !b.appreciations.length) b.appreciations = defaultAppreciations();
  /* v6.0 : échelles APC + moyennes — créées si absentes (bases existantes) */
  if (!b.appreciationsApc || !b.appreciationsApc.length) b.appreciationsApc = defaultAppreciationsApc();
  if (!b.appreciationsMoyenne || !b.appreciationsMoyenne.length) b.appreciationsMoyenne = defaultAppreciationsMoyenne();
  if (!b.appreciationsMoyenneApc || !b.appreciationsMoyenneApc.length) b.appreciationsMoyenneApc = defaultAppreciationsApc();
  if (!hadSan && !b.sanctionsAbs.length) b.sanctionsAbs = defaultSanctionsAbs();
  return b;
}

/* Migration d'une base v1 (école unique) vers la structure multi-établissements.
   Idempotente : une base déjà migrée est seulement normalisée. */
/* =====================================================================
   v7.0 : FUSION À TROIS VOIES — utilisation simultanée par plusieurs
   opérateurs. Quand un envoi est refusé (409 : la base a changé entre-temps
   sur le serveur), la base locale est FUSIONNÉE avec la base serveur à
   partir de leur ancêtre commun (dernière base reçue) :
   • un document modifié d'un seul côté → la version modifiée est gardée ;
   • un document créé d'un seul côté → il est gardé ;
   • un document modifié DES DEUX côtés → la version locale est gardée
     (dernière écriture) ;
   • une suppression distante d'un document non touché localement est
     respectée ; une modification locale prime sur une suppression distante.
   Les deux opérateurs conservent ainsi leur travail, establishment par
   établissement, collection par collection.
   ===================================================================== */
const _jsonEq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
function _mergeColl(ac, lc, sc){
  const am = new Map(ac.map(d => [d.id, d]));
  const lm = new Map(lc.map(d => [d.id, d]));
  const res = [];
  const seen = new Set();
  for (const sd of sc){
    seen.add(sd.id);
    const L = lm.get(sd.id);
    const A = am.get(sd.id);
    res.push(L && A && !_jsonEq(L, A) ? L : sd);          /* modifié localement → version locale */
  }
  for (const ld of lc){
    if (seen.has(ld.id)) continue;
    const A = am.get(ld.id);
    if (!A || !_jsonEq(ld, A)) res.push(ld);              /* création ou édition locale post-suppression distante */
  }
  return res;
}
export function mergeDb(ancestor, local, server){
  if (!server || typeof server !== 'object') return local;
  if (local === server) return server;
  const a = ancestor && typeof ancestor === 'object' ? ancestor : local;
  const out = JSON.parse(JSON.stringify(server));          /* le serveur fait autorité pour la structure */
  out.users = _mergeColl(a.users || [], local.users || [], server.users || []);
  out.etablissements = _mergeColl(a.etablissements || [], local.etablissements || [], server.etablissements || []);
  out.journalGlobal = _mergeColl(a.journalGlobal || [], local.journalGlobal || [], server.journalGlobal || []).slice(0, 250);
  if (Array.isArray(local.modelesDocs) && Array.isArray(server.modelesDocs))
    out.modelesDocs = _mergeColl(a.modelesDocs || [], local.modelesDocs, server.modelesDocs);
  const am = new Map((a.bases || []).map(b => [b.id, b]));
  const lm = new Map((local.bases || []).map(b => [b.id, b]));
  const idsServ = new Set((server.bases || []).map(b => b.id));
  out.bases = (server.bases || []).map(sb => {
    const lb = lm.get(sb.id);
    const ab = am.get(sb.id);
    if (!lb) return sb;
    const nb = JSON.parse(JSON.stringify(sb));
    for (const c of COLL_BASES){
      if (c === 'settings'){
        if (ab && _jsonEq(lb.settings, ab.settings)) nb.settings = sb.settings;
        else if (!_jsonEq(lb.settings, sb.settings)) nb.settings = lb.settings;
        continue;
      }
      if (Array.isArray(lb[c]) && Array.isArray(sb[c])){
        nb[c] = _mergeColl(ab ? (ab[c] || []) : [], lb[c], sb[c]);
        if (c === 'journal') nb[c] = nb[c].slice(0, 250);
      }
    }
    return nb;
  });
  /* base créée localement pendant que le serveur changeait */
  for (const lb of (local.bases || [])){
    if (!idsServ.has(lb.id) && !(am.has(lb.id))) out.bases.push(JSON.parse(JSON.stringify(lb)));
  }
  return out;
}

export function migrateMultiEtab(db){
  if (!db || typeof db !== 'object') return db;
  if (!Array.isArray(db.users)) return db;

  /* forme « carte » associative (jamais diffusée) -> liste d'objets portant id */
  if (db.bases && !Array.isArray(db.bases) && typeof db.bases === 'object'){
    db.bases = Object.keys(db.bases).map(k => Object.assign({ id:k }, db.bases[k]));
    if (!Array.isArray(db.etablissements) || !db.etablissements.length){
      db.etablissements = db.bases.map((b, i) => ({ id:b.id, code:b.id.replace('etab-', 'ETAB-').toUpperCase(),
        nom:(b.settings && b.settings.nomEtablissement) || ('Établissement ' + (i + 1)), ville:'', pays:'Cameroun',
        adresse:'', telephone:'', email:'', actif:true, creeLe:todayISO() }));
    }
  }

  if (!Array.isArray(db.bases) || !Array.isArray(db.etablissements) || !db.etablissements.length){
    /* école unique historique (v1.x) -> premier établissement ; les collections
       historiques déménagent dans sa base puis sont retirées de la racine. */
    const nom = (db.settings && (db.settings.nomEtablissement || db.settings.nom)) || 'Établissement principal';
    const ville = (db.settings && db.settings.ville) || '';
    const etab = { id:'etab-001', code:'ETAB-001', nom, ville, pays:'Cameroun',
      adresse:'', telephone:'', email:'', actif:true, creeLe:todayISO() };
    const base = emptyBase();
    COLL_BASES.forEach(c => { base[c] = (c === 'settings') ? (db.settings || {}) : (db[c] || []); });
    base.id = etab.id;
    db.etablissements = [etab];
    db.bases = [base];
    COLL_BASES.forEach(c => { if (c !== 'settings') delete db[c]; });
    delete db.settings;
    db.users.forEach(u => { if (u.role !== 'superadmin') u.etablissementId = u.etablissementId || etab.id; });
  }
  db.etablissements.forEach(e => { if (!e.id) e.id = newEtabId(db); });
  db.bases.forEach(b => ensureBase(b));
  const ids = new Set(etabsOf(db).map(e => e.id));
  db.bases.forEach(b => { if (!ids.has(b.id)) b.id = ids.has(b.id) ? b.id : (etabsOf(db)[0] ? etabsOf(db)[0].id : 'etab-001'); });
  db.bases = db.bases.filter((b, i) => db.bases.findIndex(x => x.id === b.id) === i);
  if (!db.bases.length){ const b = emptyBase(); b.id = etabsOf(db)[0] ? etabsOf(db)[0].id : 'etab-001'; db.bases.push(b); }
  /* résidus historiques éventuels à la racine : les données vivent dans les bases */
  if (Array.isArray(db.bases) && db.bases.length){
    /* v6.9 : « journal » aussi — l'installateur (v6.7+) laisse un journal
       racine VIDE : sa présence dérivait les écritures (connexions…) vers
       une collection jamais affichée. Les bases v1.x ont déjà leur journal
       copié dans leur base (COLL_BASES) lors de la migration mono→multi. */
    ['annees','niveaux','classes','frais','tarifs','eleves','paiements','bourses','anciens','matieres','notes','discipline','journal'].forEach(c => { delete db[c]; });
  }
  if (!Array.isArray(db.journalGlobal)) db.journalGlobal = [];
  db.users.forEach(u => { if (u.role === 'superadmin') u.etablissementId = null; });
  return db;
}


/* ================================================================
   v3.0 — PÉRIMÈTRES PAR PROFIL et modules PÉDAGOGIE / DISCIPLINE
   ================================================================ */

/* Classes visibles par l'utilisateur (null = tout l'établissement).
   - censeur : classes des niveaux de son cycle
   - surveillant de secteur / titulaire : classes attribuées
   - enseignant : toutes les classes (mais seules SES matières en saisie) */
export function scopeClassesIds(base, u){
  if (!u || !base) return null;
  const R = u.role;
  if (R === 'enseignant'){
    /* périmètre issu du plan des enseignements (fiche liée), sinon attribution manuelle historique */
    if (u.enseignantId){
      const ids = [...new Set((base.plan || []).filter(e => e.enseignantId === u.enseignantId).map(e => e.classeId))];
      return (base.classes || []).filter(c => ids.includes(c.id)).map(c => c.id);
    }
    const mats = new Set(u.matieresIds || []);
    if (!mats.size) return [];
    return [...new Set((base.plan || []).filter(e => mats.has(e.matiereId)).map(e => e.classeId))];
  }
  if (['admin','superadmin','surveillant','operateur','econome','lecteur'].includes(R)) return null;
  if (R === 'censeur'){
    const nids = new Set(u.niveauxIds || []);
    return (base.classes || []).filter(c => nids.has(c.niveauId)).map(c => c.id);
  }
  if (R === 'surveillant_secteur' || R === 'titulaire'){
    const ids = new Set(u.classesIds || []);
    return (base.classes || []).filter(c => ids.has(c.id)).map(c => c.id);
  }
  return null;
}

/* v5.5 : comptes censeurs actifs (avec leurs niveaux attribués).
   users vit à la racine du document : le passer en second paramètre. */
export function censeursOf(base, users){
  return ((users || (base && base.users) || [])).filter(u => u.role === 'censeur' && u.actif !== false);
}

/* Matières éditables par l'utilisateur (null = toutes) — enseignant : les siennes */
export function scopeMatieresIds(base, u){
  if (!u || !base) return null;
  if (u.role === 'enseignant'){
    if (u.enseignantId)
      return [...new Set((base.plan || []).filter(e => e.enseignantId === u.enseignantId).map(e => e.matiereId))];
    return (u.matieresIds || []);
  }
  return null;
}

/* ---- Plan des enseignements (v4) ---- */
/* Entrées du plan d'une classe, triées par ordre d'affichage au bulletin */
export function planOf(base, classeId){
  return (base.plan || []).filter(e => e.classeId === classeId).sort((a,b) => (a.ordre||99) - (b.ordre||99));
}
/* Coefficient effectif d'une matière dans une classe : défini par le plan, sinon 1.
   (v4.1 : ni le groupe ni le coefficient ne sont des propriétés d'une matière —
   ils sont attribués dans le plan des enseignements de chaque classe.) */
export function coefOf(base, classeId, matiereId){
  const e = (base.plan || []).find(x => x.classeId === classeId && x.matiereId === matiereId);
  return (e && e.coefficient) || 1;
}
/* Groupes dans lesquels une matière est effectivement enseignée (via les plans) */
export function groupesOfMatiere(base, matiereId){
  const ids = [...new Set((base.plan || []).filter(e => e.matiereId === matiereId && e.groupeId).map(e => e.groupeId))];
  return (base.groupes || []).filter(g => ids.includes(g.id));
}

/* L'utilisateur peut-il agir sur cette classe (notes / discipline) ? */
export function canClasse(base, u, classeId){
  const sc = scopeClassesIds(base, u);
  return sc == null || sc.includes(classeId);
}

/* ---------- Moyennes ----------
   Périodes (v5) : id de séquence ('1'…'6'…), trimestre 'T1'|'T2'|'T3',
   ou null = année entière. Les comparaisons de séquence passent par
   String() : les notes anciennes stockent 1..6 (nombre), les nouvelles
   l'identifiant de la séquence. */
export function notesDe(base, anneeId, eleveId, matiereId){
  return (base.notes || []).filter(n => n.anneeId === anneeId && n.eleveId === eleveId
    && n.matiereId === matiereId && typeof n.valeur === 'number' && n.valeur >= 0);
}
export function sequencesSorted(base){
  return (base.sequences || []).slice()
    .sort((a,b) => (a.trimestre || 1) - (b.trimestre || 1) || String(a.id).localeCompare(String(b.id), 'fr', { numeric:true }));
}
export function sequencesOfTrimestre(base, tri){
  return sequencesSorted(base).filter(sq => parseInt(sq.trimestre, 10) === parseInt(tri, 10));
}
/* ---------- v6.5 : DEVOIRS pondérés par séquence ----------
   L'administrateur définit, pour chaque séquence, 0 à N devoirs — chaque
   devoir portant un pourcentage (le total doit faire 100 %). Les notes de
   devoir sont saisies par les enseignants ; elles NE figurent PAS dans les
   bulletins. Pour une séquence qui comporte des devoirs, la note
   séquentielle est CALCULÉE automatiquement : Σ(note × pourcentage) des
   devoirs saisis (prorata sur les pourcentages saisis si un devoir manque).
   Une séquence sans devoir garde la saisie directe d'une note unique. */
export function devoirsDe(base, seq){
  if (!seq) return [];
  const sq = typeof seq === 'object' ? seq
    : (base.sequences || []).find(s => String(s.id) === String(seq));
  if (!sq || !Array.isArray(sq.devoirs)) return [];
  return sq.devoirs.filter(d => d && d.id && String(d.libelle || '').trim() !== ''
    && parseFloat(d.pourcentage) > 0);
}
export function aDevoirs(base, seq){ return devoirsDe(base, seq).length > 0; }
/* Validation de la configuration des devoirs d'une séquence :
   → { ok, msg } — liste vide admise (saisie directe). */
export function devoirsValides(list){
  if (!Array.isArray(list)) return { ok:false, msg:'Configuration de devoirs invalide.' };
  if (list.length > 10) return { ok:false, msg:'10 devoirs au maximum par séquence.' };
  const libelles = new Set();
  for (const d of list){
    const lib = String((d && d.libelle) || '').trim();
    const pct = parseFloat((d && d.pourcentage));
    if (!lib) return { ok:false, msg:'Chaque devoir doit avoir un libellé.' };
    if (lib.length > 40) return { ok:false, msg:'Libellé de devoir trop long (40 caractères max).' };
    const k = lib.toLowerCase();
    if (libelles.has(k)) return { ok:false, msg:'Deux devoirs ne peuvent pas porter le même libellé (« ' + lib + ' »).' };
    libelles.add(k);
    if (!(pct >= 1 && pct <= 100)) return { ok:false, msg:'Pourcentage invalide : « ' + lib + ' » (entre 1 et 100 %).' };
  }
  if (list.length){
    const tot = list.reduce((t, d) => t + parseFloat(d.pourcentage), 0);
    if (Math.round(tot) !== 100)
      return { ok:false, msg:'Le total des pourcentages doit faire 100 % (actuellement ' + String(Math.round(tot * 10) / 10).replace('.', ',') + ' %).' };
  }
  return { ok:true, msg:'' };
}
/* Détail des devoirs d'un élève pour une matière et une séquence :
   [{ id, libelle, pourcentage, note }] — note = null si non saisie. */
export function devoirsDetail(base, anneeId, eleveId, matiereId, seqId){
  const dv = devoirsDe(base, seqId);
  if (!dv.length) return [];
  const ns = notesDe(base, anneeId, eleveId, matiereId)
    .filter(n => String(n.sequence) === String(seqId) && n.type === 'devoir');
  return dv.map(d => {
    const n = ns.find(x => String(x.devoirId) === String(d.id));
    return { id:d.id, libelle:String(d.libelle), pourcentage:parseFloat(d.pourcentage) || 0,
      note:(n && typeof n.valeur === 'number') ? n.valeur : null };
  });
}
/* La note séquentielle d'un élève (matière, séquence à devoirs) :
   moyenne pondérée des devoirs SAISIS (null si aucun). */
export function noteSequentielle(base, anneeId, eleveId, matiereId, seqId){
  const det = devoirsDetail(base, anneeId, eleveId, matiereId, seqId);
  if (!det.length) return null;
  let som = 0, pds = 0;
  det.forEach(d => { if (d.note != null){ som += d.note * d.pourcentage; pds += d.pourcentage; } });
  return pds > 0 ? Math.round((som / pds) * 100) / 100 : null;
}
export function moyenneMatiere(base, anneeId, eleveId, matiereId, periode){
  if (typeof periode === 'string' && /^T[1-3]$/.test(periode)){
    /* trimestre : moyenne pondérée des séquences du trimestre (poids en %) */
    let som = 0, pds = 0;
    sequencesOfTrimestre(base, periode[1]).forEach(sq => {
      const m = moyenneMatiere(base, anneeId, eleveId, matiereId, sq.id);
      if (m != null){ som += m * (sq.poids || 0); pds += (sq.poids || 0); }
    });
    return pds > 0 ? Math.round((som / pds) * 100) / 100 : null;
  }
  if (periode == null || periode === ''){
    /* v6.5 : l'année est la moyenne NON pondérée des notes de chaque séquence —
       une séquence à devoirs contribue pour sa note séquentielle CALCULÉE,
       jamais pour ses notes de devoir brutes (sinon elles seraient comptées
       une par une et pèseraient trop lourd dans l'année). */
    const seqs = sequencesSorted(base);
    const vals = seqs.map(sq => moyenneMatiere(base, anneeId, eleveId, matiereId, sq.id)).filter(v => v != null);
    if (vals.length) return Math.round(vals.reduce((t, v) => t + v, 0) / vals.length * 100) / 100;
    /* repli : notes rattachées à une séquence inconnue (base importée) */
    const ids = new Set(seqs.map(s => String(s.id)));
    let orph = notesDe(base, anneeId, eleveId, matiereId).filter(n => !ids.has(String(n.sequence)));
    if (orph.length){
      let som = 0, coef = 0;
      orph.forEach(n => { const p = n.type === 'composition' ? 2 : 1; som += n.valeur * p; coef += p; });
      return Math.round((som / coef) * 100) / 100;
    }
    return null;
  }
  let ns = notesDe(base, anneeId, eleveId, matiereId);
  ns = ns.filter(n => String(n.sequence) === String(periode));
  /* v6.5 : séquence à devoirs → note séquentielle CALCULÉE (prorata des
     pourcentages saisis) ; les éventuelles notes d'évaluation sont ignorées. */
  if (aDevoirs(base, periode)) return noteSequentielle(base, anneeId, eleveId, matiereId, periode);
  if (!ns.length) return null;
  let som = 0, coef = 0;
  ns.forEach(n => { const p = n.type === 'composition' ? 2 : 1; som += n.valeur * p; coef += p; });
  return Math.round((som / coef) * 100) / 100;
}
export function moyenneGenerale(base, anneeId, eleveId, periode){
  /* coefficient de pondération : celui du PLAN de la classe de l'élève */
  const el = (base.eleves || []).find(x => x.id === eleveId);
  const clsId = el ? el.classeId : null;
  const coef = m => coefOf(base, clsId, m.id);
  const els = (base.matieres || []).filter(m => moyenneMatiere(base, anneeId, eleveId, m.id, periode) != null);
  if (!els.length) return null;
  const som = els.reduce((t, m) => t + moyenneMatiere(base, anneeId, eleveId, m.id, periode) * (coef(m) || 1), 0);
  const cof = els.reduce((t, m) => t + (coef(m) || 1), 0);
  return Math.round((som / cof) * 100) / 100;
}

/* ---------- Appréciations (fourchettes de notes, v5) ---------- */
export function appreciationsSorted(base){
  return (base.appreciations || []).slice().sort((a,b) => (a.min || 0) - (b.min || 0));
}
/* Appréciation d'une note : première fourchette où note < max ; la dernière
   couvre 20 inclus. Retourne null si aucune fourchette n'est définie. */
export function appreciationOf(base, note){
  const list = appreciationsSorted(base);
  if (!list.length || note == null || isNaN(note)) return null;
  if (note < list[0].min) return null;                       /* sous la première fourchette */
  for (const a of list){
    if (note >= a.min && note < a.max) return a.libelle;     /* min inclus, max exclu */
  }
  const top = list[list.length - 1];
  return note <= top.max ? top.libelle : null;               /* borne supérieure incluse (20/20) */
}
/* ---------- v6.0 : deux modes d'appréciation par classe + moyennes ----------
   Chaque classe choisit son mode : 'classique' (fourchettes de notes) ou
   'apc' (niveaux de maîtrise). Les bulletins, récapitulatifs et mentions
   utilisent l'échelle du mode de la classe ; l'appréciation des MOYENNES
   (générale et par groupe) dispose de sa propre échelle, déclinée par mode. */
export function appreciationModeOf(base, classe){
  return (classe && classe.appreciationMode === 'apc') ? 'apc' : 'classique';
}
export function appreciationsApcSorted(base){
  const l = base && Array.isArray(base.appreciationsApc) && base.appreciationsApc.length ? base.appreciationsApc : defaultAppreciationsApc();
  return l.slice().sort((a,b) => (a.min || 0) - (b.min || 0));
}
export function appreciationsMoyenneSorted(base, mode){
  const apc = mode === 'apc';
  const l = apc ? (base && base.appreciationsMoyenneApc) : (base && base.appreciationsMoyenne);
  const arr = Array.isArray(l) && l.length ? l : (apc ? defaultAppreciationsApc() : defaultAppreciationsMoyenne());
  return arr.slice().sort((a,b) => (a.min || 0) - (b.min || 0));
}
function libelleDansEchelle(list, note){
  if (!list.length || note == null || isNaN(note)) return null;
  if (note < list[0].min) return null;
  for (const a of list){ if (note >= a.min && note < a.max) return a.libelle; }
  const top = list[list.length - 1];
  return note <= top.max ? top.libelle : null;
}
/* Appréciation d'une NOTE selon le mode de la classe */
export function appreciationNoteOf(base, classe, note){
  return libelleDansEchelle(appreciationModeOf(base, classe) === 'apc'
    ? appreciationsApcSorted(base) : appreciationsSorted(base), note);
}
/* Appréciation d'une MOYENNE (générale / groupe) selon le mode de la classe */
export function appreciationMoyenneOf(base, classe, note){
  return libelleDansEchelle(appreciationsMoyenneSorted(base, appreciationModeOf(base, classe)), note);
}
/* v6.0 : rang et moyenne de CLASSE d'un élève dans UNE matière (modèle du
   récapitulatif annuel : colonnes Moy.Cla. et Rang par discipline) */
export function rangMatiere(base, anneeId, classeId, eleveId, matiereId, periode){
  const els = (base.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === classeId && e.statut !== 'radie');
  const vals = els.map(e => ({ id:e.id, moy:moyenneMatiere(base, anneeId, e.id, matiereId, periode) }))
    .filter(x => x.moy != null);
  if (!vals.length) return { rang:null, moyClasse:null, min:null, max:null, n:0 };
  vals.sort((a,b) => b.moy - a.moy);
  const idx = vals.findIndex(x => x.id === eleveId);
  return {
    rang: idx >= 0 ? idx + 1 : null,
    moyClasse: Math.round(vals.reduce((t,x) => t + x.moy, 0) / vals.length * 100) / 100,
    min: Math.min(...vals.map(x => x.moy)),
    max: Math.max(...vals.map(x => x.moy)),
    n: vals.length
  };
}

/* Statistiques d'une série de notes (bordereaux) */
export function statsNotes(base, valeurs){
  const vals = (valeurs || []).filter(v => typeof v === 'number' && !isNaN(v));
  if (!vals.length) return { n:0, moy:null, min:null, max:null, ge10:0, pct:null, repartition:[] };
  const moy = Math.round((vals.reduce((t, v) => t + v, 0) / vals.length) * 100) / 100;
  const rep = {};
  appreciationsSorted(base).forEach(a => { rep[a.libelle] = 0; });
  vals.forEach(v => {
    const lib = appreciationOf(base, v);
    if (lib) rep[lib] = (rep[lib] || 0) + 1;
  });
  const total = vals.length;
  return { n: total, moy,
    min: Math.min(...vals), max: Math.max(...vals),
    ge10: vals.filter(v => v >= 10).length,
    pct: Math.round(vals.filter(v => v >= 10).length / total * 100),
    repartition: Object.keys(rep).map(k => ({ libelle:k, n:rep[k], pct: Math.round(rep[k] / total * 100) })) };
}

/* ---------- Discipline ---------- */
export const DISCIPLINE_CATS = {
  retard:'Retard', absence:'Absence', tenue:'Tenue / uniforme',
  indiscipline:'Indiscipline', travail:'Travail non fait', autre:'Autre'
};
export const GRAVITE_LABEL = { 1:'Léger', 2:'Moyen', 3:'Grave' };
export function faitsDe(base, anneeId, eleveId){
  return (base.discipline || []).filter(f => f.anneeId === anneeId && f.eleveId === eleveId);
}

/* ================================================================
   v5.5 — DISCIPLINE : ABSENCES PAR CLASSE/PÉRIODE & SANCTIONS
   Une absence = fait disciplinaire de catégorie « absence », portant
   une durée en heures (1 par défaut). Trimestre déduit de la
   date : sept→déc = T1, janv→mars = T2, avr→août = T3. */
export function defaultSanctionsAbs(){
  return [
    { id:'sa1', min:3, max:5, sanction:'Avertissement écrit' },
    { id:'sa2', min:6, max:9, sanction:'Blâme' },
    { id:'sa3', min:10, max:14, sanction:'Exclusion temporaire (2 jours)' },
    { id:'sa4', min:15, max:999, sanction:'Conseil de discipline' }
  ];
}
export function sanctionsAbsOf(base){
  const l = base && Array.isArray(base.sanctionsAbs) ? base.sanctionsAbs : [];
  return l.length ? l.slice().sort((a,b) => (a.min || 0) - (b.min || 0)) : defaultSanctionsAbs();
}
export function trimestreOfDate(dateISO){
  const m = parseInt(String(dateISO || '').slice(5, 7), 10);
  if (!m || m >= 9) return 1;
  if (m >= 4) return 3;
  return 2;
}
/* Absences (heures) d'un élève pour une période : '' = année, 'T1'-'T3'. */
export function absencesDe(base, anneeId, eleveId, periode){
  let just = 0, nonJust = 0, faits = 0;
  (base.discipline || []).forEach(f => {
    if (f.anneeId !== anneeId || f.eleveId !== eleveId || f.categorie !== 'absence') return;
    if (periode && trimestreOfDate(f.date) !== parseInt(String(periode).replace('T', ''), 10)) return;
    const d = Math.max(1, parseInt(f.duree, 10) || 1);
    faits++;
    if (f.justifie) just += d; else nonJust += d;
  });
  return { just, nonJust, total: just + nonJust, faits };
}
/* Sanction applicable au nombre d’heures non justifiées (null = aucune). */
export function sanctionAbsencesFor(base, nonJust){
  const pl = sanctionsAbsOf(base);
  const p = pl.find(x => nonJust >= (x.min || 0) && nonJust <= (x.max || 0));
  return p ? p.sanction : null;
}

/* ================================================================
   v5.5 — QR CODE DE SÉCURITÉ DES BULLETINS
   Le QR transporte les chiffres clés + une signature SHA-256 (12 hex)
   calculée avec le code de sécurité de l'établissement (Personnalisation des états →
   Bulletin). Vérification : Bulletins & rapports → « Vérifier un bulletin ». */
export const qrFold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7E]/g, '').replace(/\|/g, '/').trim();
export function bulletinQrData(db, { eleveId, periodeLabel, moy, rang }){
  const st = settingsOf(db);
  const bul = bulletinOf(db);
  const el = (db.eleves || []).find(x => x.id === eleveId) || {};
  const an = (db.annees || []).find(a => a.id === el.anneeId) || {};
  const cl = classById(db, el.classeId) || {};
  const core = ['AUREL-SIGES',
    'ETAB:' + qrFold(st.nomEtablissement).slice(0, 40),
    'AN:' + qrFold(an.libelle).slice(0, 20),
    'ELV:' + qrFold(String(el.matricule || '') + ' ' + String(el.nom || '').toUpperCase() + ' ' + String(el.prenom || '').toUpperCase()).slice(0, 44),
    'CLA:' + qrFold(cl.libelle).slice(0, 16),
    'PER:' + qrFold(periodeLabel).slice(0, 24),
    'MOY:' + (moy == null ? 'NC' : String(moy).replace('.', ',') + '/20'),
    'RANG:' + (rang || '-'),
    'EMIS:' + todayISO().slice(0, 10)
  ].join('|');
  const sig = sha256utf8(String(bul.codeSecurite || '') + '|' + core).slice(0, 12);
  return core + '|SIG:' + sig;
}
/* Vérifie un texte de QR code : renvoie { ok, raison, data }. */
export function verifieQrTexte(db, texte){
  const t = String(texte || '').trim();
  const i = t.lastIndexOf('|SIG:');
  if (i < 0) return { ok:false, raison:'QR illisible : signature absente.', data:null };
  const core = t.slice(0, i), sig = t.slice(i + 5).trim();
  if (!/^[0-9a-f]{12}$/.test(sig)) return { ok:false, raison:'Signature illisible (12 caractères hexadécimaux attendus).', data:null };
  const data = {};
  core.split('|').forEach(pp => { const k = pp.indexOf(':'); if (k > 0) data[pp.slice(0, k)] = pp.slice(k + 1); });
  const bul = bulletinOf(db);
  const attendu = sha256utf8(String(bul.codeSecurite || '') + '|' + core).slice(0, 12);
  if (attendu !== sig) return { ok:false, raison:'Signature NON CONFORME — le document a probablement été modifié.', data };
  return { ok:true, raison:null, data };
}

/* ============== v5.1 : CONSOLE RÉSEAU (superadministrateur) ============== */
/* Statistiques consolidées de tous les établissements (année active de chacun). */
export function networkStats(dbRoot){
  const etabs = Array.isArray(dbRoot.etablissements) ? dbRoot.etablissements : [];
  const users = Array.isArray(dbRoot.users) ? dbRoot.users : [];
  const bases = Array.isArray(dbRoot.bases) ? dbRoot.bases : [];
  const rows = etabs.map(e => {
    const b = bases.find(x => x && x.id === e.id) || {};
    const ay = activeYear(b);
    const eleves = ay ? (b.eleves || []).filter(x => x.anneeId === ay.id) : [];
    let attendu = 0;
    eleves.forEach(el => { attendu += situationTotals(b, el).net; });
    const paie = (b.paiements || []).filter(p => p.anneeId === (ay ? ay.id : '') && p.statut === 'valide');
    const encaisse = paie.reduce((s, p) => s + p.montant, 0);
    const comptes = users.filter(u => u.etablissementId === e.id);
    const journal = Array.isArray(b.journal) ? b.journal : [];
    return {
      etab:e, annee:ay ? ay.libelle : null,
      eleves:eleves.length, attendu, encaisse,
      recouvrement:attendu > 0 ? Math.min(100, Math.round(encaisse / attendu * 100)) : null,
      enseignants:(b.enseignants || []).length,
      comptes:comptes.length, comptesActifs:comptes.filter(u => u.actif).length,
      notes:(b.notes || []).length, anciens:(b.anciens || []).length,
      derniereAct:journal.length ? journal[0].date : null,
      actif:e.actif !== false
    };
  });
  const tot = {
    etabs:etabs.length, etabsActifs:rows.filter(r => r.actif).length,
    eleves:rows.reduce((s, r) => s + r.eleves, 0),
    attendu:rows.reduce((s, r) => s + r.attendu, 0),
    encaisse:rows.reduce((s, r) => s + r.encaisse, 0),
    enseignants:rows.reduce((s, r) => s + r.enseignants, 0),
    comptes:users.length, comptesActifs:users.filter(u => u.actif).length,
    notes:rows.reduce((s, r) => s + r.notes, 0),
    anciens:rows.reduce((s, r) => s + r.anciens, 0)
  };
  tot.recouvrement = tot.attendu > 0 ? Math.min(100, Math.round(tot.encaisse / tot.attendu * 100)) : null;
  return { rows, tot };
}

/* Journal fusionné du réseau : journal global + journaux de chaque établissement,
   triés du plus récent au plus ancien, avec le nom de l'établissement d'origine. */
export function mergedJournal(dbRoot, max = 250){
  const etabs = Array.isArray(dbRoot.etablissements) ? dbRoot.etablissements : [];
  const bases = Array.isArray(dbRoot.bases) ? dbRoot.bases : [];
  const out = [];
  (Array.isArray(dbRoot.journalGlobal) ? dbRoot.journalGlobal : []).forEach(j => {
    out.push(Object.assign({}, j, { etabId:null, etabNom:'Administration générale' }));
  });
  bases.forEach(b => {
    const e = etabs.find(x => x && x.id === b.id);
    (Array.isArray(b.journal) ? b.journal : []).forEach(j => {
      out.push(Object.assign({}, j, { etabId:b.id, etabNom:e ? e.nom : b.id }));
    });
  });
  out.sort((a, b) => (a.date || '') < (b.date || '') ? 1 : -1);
  return out.slice(0, max);
}

/* ============== v5.2 : MATIÈRES INDISPENSABLES AU CLASSEMENT ==============
   Chaque classe peut définir un ensemble de matières indispensables : un
   élève sans note dans l'une d'elles, pour une période donnée (séquence,
   trimestre ou année), est « non classé » (NC) — il ne reçoit pas de rang. */
export function matieresObligatoires(base, classeId){
  const cl = (base.classes || []).find(c => c.id === classeId);
  const ids = cl && Array.isArray(cl.matieresOblig) ? cl.matieresOblig : [];
  return ids.map(id => (base.matieres || []).find(m => m.id === id)).filter(Boolean);
}

/* Matières indispensables manquantes pour la période (pour expliquer le NC). */
export function matieresManquantes(base, anneeId, eleveId, periode){
  const el = (base.eleves || []).find(e => e.id === eleveId);
  if (!el) return [];
  return matieresObligatoires(base, el.classeId)
    .filter(m => moyenneMatiere(base, anneeId, eleveId, m.id, periode) == null);
}

/* ---------- v6.1 : SCAN DES NOTES MANQUANTES (aide de l’agent de saisie) ----------
   Pour une classe et une séquence (évaluation) données, état des lieux de la
   saisie, matière par matière du plan : complète, partielle ou sans aucune
   note — avec les élèves concernés, le total des notes manquantes et les
   élèves sans aucune note. Recalculé à chaque affichage (instantané). */
export function scanNotesManquantes(base, anneeId, classeId, sequenceId){
  const plan = planOf(base, classeId);
  const eleves = (base.eleves || [])
    .filter(e => e.anneeId === anneeId && e.classeId === classeId && e.statut !== 'radie')
    .sort((a, b) => String(a.nom + ' ' + a.prenom).localeCompare(String(b.nom + ' ' + b.prenom), 'fr'));
  const seq = String(sequenceId == null ? '' : sequenceId);
  /* v6.5 : la séquence peut être notée par devoirs pondérés — un élève est
     complet quand TOUS les devoirs de la séquence sont saisis. */
  const dvSeq = devoirsDe(base, seq);
  const oblig = new Set(matieresObligatoires(base, classeId).map(m => m.id));
  const planMats = new Set(plan.map(en => en.matiereId));
  const lignes = plan.map(en => {
    const mat = (base.matieres || []).find(m => m.id === en.matiereId);
    if (!mat) return null;
    const notes = (base.notes || []).filter(n => n.matiereId === mat.id && String(n.sequence) === seq
      && eleves.some(e => e.id === n.eleveId));
    let saisies, manquants, notesSaisies, attendues;
    if (dvSeq.length){
      const parEleve = eleves.map(e => ({
        e, dv: dvSeq.filter(d => notes.some(n => n.eleveId === e.id
          && n.type === 'devoir' && String(n.devoirId) === String(d.id)))
      }));
      manquants = parEleve.filter(x => x.dv.length < dvSeq.length).map(x => x.e);
      saisies = eleves.length - manquants.length;      /* élèves complets */
      notesSaisies = parEleve.reduce((t, x) => t + x.dv.length, 0);
      attendues = eleves.length * dvSeq.length;
    } else {
      const ayant = new Set(notes.map(n => n.eleveId));
      manquants = eleves.filter(e => !ayant.has(e.id));
      saisies = notes.length;
      notesSaisies = notes.length;
      attendues = eleves.length;
    }
    return {
      matiereId: mat.id, code: mat.code || '', libelle: mat.libelle || mat.code || '?',
      coefficient: en.coefficient || 1, indispensable: oblig.has(mat.id),
      enseignantId: en.enseignantId || '',
      effectif: eleves.length, saisies, manquantes: manquants.length,
      notesSaisies, notesAttendues: attendues,
      elevesManquants: manquants.map(e => ({ id:e.id, matricule:e.matricule || '—', nom:(e.nom + ' ' + e.prenom).trim() })),
      statut: !notes.length ? 'vide' : (!manquants.length ? 'complete' : 'partielle')
    };
  }).filter(Boolean);
  const notees = new Set((base.notes || [])
    .filter(n => String(n.sequence) === seq && planMats.has(n.matiereId)
      && eleves.some(e => e.id === n.eleveId)).map(n => n.eleveId));
  const sansAucune = eleves.filter(e => !notees.has(e.id))
    .map(e => ({ id:e.id, matricule:e.matricule || '—', nom:(e.nom + ' ' + e.prenom).trim() }));
  const resume = {
    matieres: lignes.length,
    completes: lignes.filter(l => l.statut === 'complete').length,
    partielles: lignes.filter(l => l.statut === 'partielle').length,
    vides: lignes.filter(l => l.statut === 'vide').length,
    aSaisir: lignes.filter(l => l.statut !== 'complete').length,
    notesSaisies: lignes.reduce((s, l) => s + l.notesSaisies, 0),
    notesManquantes: lignes.reduce((s, l) => s + (dvSeq.length
      ? Math.max(0, l.notesAttendues - l.notesSaisies) : l.manquantes), 0)
  };
  return { lignes, eleves, sansAucune, resume };
}

/* ---------- v6.2 : SYNTHÈSE PAR ÉVALUATION ET PAR CLASSE (notes manquantes) ----------
   Vue matricielle pour l'agent de saisie : pour chaque classe (et chaque
   matière du plan), le nombre de notes manquantes SÉQUENCE PAR SÉQUENCE
   (toutes les évaluations de l'année en colonnes), avec totaux par matière,
   par séquence, par classe et total général. Même statut par cellule :
   vide / partielle / complète. */
export function scanNotesManquantesAnnee(base, anneeId, classesIds){
  const sequences = sequencesSorted(base).map(sq => ({
    id: String(sq.id), libelle: sq.libelle || '',
    court: String(sq.libelle || '').replace(/^Séquence\s*/i, 'S'),
    trimestre: sq.trimestre, poids: sq.poids, devoirs: devoirsDe(base, sq)
  }));
  const classes = [];
  let totauxGlobaux = sequences.map(() => 0);
  let cellsToDo = 0, cellsTotal = 0, totalGeneral = 0;
  for (const cid of (classesIds || [])){
    const cl = (base.classes || []).find(c => c.id === cid);
    const plan = planOf(base, cid);
    const eleves = (base.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === cid && e.statut !== 'radie');
    if (!cl || !plan.length || !eleves.length) continue;
    const oblig = new Set(matieresObligatoires(base, cid).map(m => m.id));
    const ids = new Set(eleves.map(e => e.id));
    const saisies = new Map();   /* clé « matiereId|sequence » → nombre de notes */
    const devoirVus = new Set(); /* clé « eleveId|matiereId|sequence|devoirId » (v6.5) */
    (base.notes || []).forEach(n => {
      if (!ids.has(n.eleveId)) return;
      const k = n.matiereId + '|' + n.sequence;
      saisies.set(k, (saisies.get(k) || 0) + 1);
      if (n.type === 'devoir' && n.devoirId != null) devoirVus.add(n.eleveId + '|' + k + '|' + n.devoirId);
    });
    const matieres = plan.map(en => {
      const mat = (base.matieres || []).find(m => m.id === en.matiereId);
      if (!mat) return null;
      const parSequence = sequences.map(sq => {
        const n = saisies.get(mat.id + '|' + sq.id) || 0;
        /* v6.5 : séquence à devoirs — élève complet = tous les devoirs saisis */
        if (sq.devoirs.length){
          let complets = 0;
          eleves.forEach(e => {
            if (sq.devoirs.every(d => devoirVus.has(e.id + '|' + mat.id + '|' + sq.id + '|' + d.id))) complets++;
          });
          const manquantes = eleves.length - complets;
          return { sequenceId: sq.id, saisies: complets, manquantes,
            statut: !n ? 'vide' : (manquantes === 0 ? 'complete' : 'partielle') };
        }
        const manquantes = Math.max(0, eleves.length - n);
        return { sequenceId: sq.id, saisies: n, manquantes,
          statut: !n ? 'vide' : (manquantes === 0 ? 'complete' : 'partielle') };
      });
      return { matiereId: mat.id, code: mat.code || '', libelle: mat.libelle || mat.code || '?',
        coefficient: en.coefficient || 1, indispensable: oblig.has(mat.id),
        parSequence, totalManquantes: parSequence.reduce((t, x) => t + x.manquantes, 0) };
    }).filter(Boolean);
    const totauxParSequence = sequences.map((sq, i) => matieres.reduce((t, m) => t + m.parSequence[i].manquantes, 0));
    const totalManquantes = totauxParSequence.reduce((x, y) => x + y, 0);
    const cells = matieres.length * sequences.length;
    const todo = matieres.reduce((t, m) => t + m.parSequence.filter(x => x.statut !== 'complete').length, 0);
    cellsTotal += cells; cellsToDo += todo; totalGeneral += totalManquantes;
    totauxGlobaux = totauxGlobaux.map((v, i) => v + totauxParSequence[i]);
    classes.push({ classeId: cid, libelle: cl.libelle || String(cid), effectif: eleves.length,
      matieres, totauxParSequence, totalManquantes, cellsToDo: todo, cellsTotal: cells });
  }
  return { sequences, classes, totauxGlobaux, totalGeneral, cellsToDo, cellsTotal };
}

/* Classement d'une classe pour une période :
   → { rangs: Map(éléveId → rang), nonClasses: Set, classés: [{eleveId, moy, rang}] }
   v5.4 : non classé = aucune note dans TOUTES les matières indispensables
   (ou aucune moyenne) ; une seule note indispensable suffit à classer. */
export function classementClasse(base, anneeId, classeId, periode){
  const els = (base.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === classeId && e.statut !== 'radie');
  const oblig = matieresObligatoires(base, classeId);
  const lignes = els.map(el => {
    /* v5.4 : non classé = aucune note dans TOUTES les matières indispensables */
    const manque = oblig.length > 0 && oblig.every(m => moyenneMatiere(base, anneeId, el.id, m.id, periode) == null);
    return { eleveId:el.id, moy:moyenneGenerale(base, anneeId, el.id, periode), manque };
  });
  const classables = lignes.filter(l => l.moy != null && !l.manque)
    .sort((a, b) => b.moy - a.moy);
  const rangs = new Map();
  classables.forEach((l, i) => rangs.set(l.eleveId, i + 1));
  const nonClasses = new Set(lignes.filter(l => !rangs.has(l.eleveId)).map(l => l.eleveId));
  return { rangs, nonClasses, classes:classables.map((l, i) => ({ ...l, rang:i + 1 })) };
}

/* ============== v5.4 : GROUPES DU PLAN, MOYENNES PAR GROUPE ============== */
/* Groupes représentés dans le plan d'une classe, dans l'ordre d'apparition
   au bulletin. Retourne [{ id, grp }] (grp = null si groupe inconnu). */
export function groupesDuPlan(base, classeId){
  const out = [], seen = new Set();
  planOf(base, classeId).forEach(e => {
    const gid = e.groupeId || '_';
    if (!seen.has(gid)){ seen.add(gid); out.push({ id:gid, grp:(base.groupes || []).find(g => g.id === gid) || null }); }
  });
  return out;
}

/* Moyenne d'un élève pour un groupe de matières du plan de sa classe,
   pour une période : → { points, coef, moy } ou null (aucune note).
   points = Σ moyennes × coefficient des matières notées du groupe. */
export function moyenneGroupe(base, anneeId, eleveId, groupeId, periode){
  const el = (base.eleves || []).find(e => e.id === eleveId);
  if (!el) return null;
  const entries = planOf(base, el.classeId).filter(e => (e.groupeId || '_') === groupeId);
  let pts = 0, cof = 0;
  entries.forEach(e => {
    const m = moyenneMatiere(base, anneeId, eleveId, e.matiereId, periode);
    if (m != null){ const c = e.coefficient || 1; pts += m * c; cof += c; }
  });
  return cof > 0 ? { points:Math.round(pts * 100) / 100, coef:cof, moy:Math.round(pts / cof * 100) / 100 } : null;
}

/* ============== v5.4 : PERSONNALISATION DU BULLETIN ============== */
export const BULLETIN_DEFAUT = {
  blocGauche: 'RÉPUBLIQUE DU CAMEROUN\nPaix — Travail — Patrie\nMinistère des Enseignements Secondaires\nDélégation Régionale du Sud',
  blocDroit: "DIOCÈSE D'EBOLOWA\nCOLLÈGE BONNEAU\nTout pour tous\nB.P. 910 — Tél. 674 50 42 91 / 697 03 16 95",
  titre: 'RÉCAPITULATIF ANNUEL DES NOTES',
  lieu: 'Ebolowa',
  signature: 'La Sœur Principale',
  /* v5.5 : sections affichées + QR code de sécurité */
  qrCode: true,
  codeSecurite: '',
  sections: { bilan:true, synthese:true, rang:true, signatures:true, effectif:true }
};
export function bulletinOf(db){
  const st = settingsOf(db || {});
  const sv = (st && st.bulletin) || {};
  const b = { ...BULLETIN_DEFAUT, ...sv };
  b.sections = { ...BULLETIN_DEFAUT.sections, ...(sv.sections || {}) };
  return b;
}
