/* =====================================================================
   v6.3 — MODÈLES DE DOCUMENTS & THÈME DE COULEURS (noyau métier)
   ---------------------------------------------------------------------
   • Modèles entièrement modulables (bulletins, tableaux d'honneur,
     certificats de scolarité, badges, cartes scolaires) : page (format,
     orientation, marges), blocs positionnés en millimètres (texte libre,
     champs dynamiques, logo, photo, QR, tableaux de notes, bilan
     disciplinaire, résultats, décision, signatures, liste d'honneur),
     style complet par bloc (police, taille, gras, italique, souligné,
     alignement, couleur, fond, bordure), import/export JSON.
   • Thème de couleurs de l'application : couleur primaire + accent,
     déclinées automatiquement en nuances, appliquées aux variables CSS.
   ===================================================================== */

/* ---------- Types de documents ---------- */
export const TYPES_DOCS = [
  { id:'bulletin',   label:'Bulletin de notes',        formats:['A4'],        orient:true,  periodes:true },
  { id:'honneur',    label:"Tableau d'honneur",        formats:['A4','A5'],   orient:true,  periodes:true },
  { id:'certificat', label:'Certificat de scolarité',  formats:['A4','A5'],   orient:true,  periodes:false },
  { id:'carte',      label:'Carte scolaire',           formats:['carte'],     orient:false, periodes:false },
  { id:'badge',      label:'Badge élève',              formats:['badge'],     orient:false, periodes:false }
];
export const typeDocOf = id => TYPES_DOCS.find(t => t.id === id) || null;

/* ---------- Formats de page (dimensions en mm) ---------- */
export const FORMATS_PAGE = {
  A4:      { label:'A4 (210 × 297 mm)',        w:210, h:297 },
  A5:      { label:'A5 (148 × 210 mm)',        w:148, h:210 },
  carte:   { label:'Carte (85 × 55 mm)',       w:85,  h:55 },
  badge:   { label:'Badge (75 × 45 mm)',       w:75,  h:45 }
};
export function pageOf(page){
  const p = page || {};
  const f = FORMATS_PAGE[p.format] || FORMATS_PAGE.A4;
  const paysage = p.orientation === 'paysage' && (typeDocOf(p.typeDoc) || {}).orient;
  return paysage ? { w:f.h, h:f.w } : { w:f.w, h:f.h };
}

/* ---------- Polices ---------- */
export const POLICES = ['Tahoma', 'Arial', 'Verdana', 'Georgia', '"Times New Roman"', '"Courier New"'];

/* ---------- Types de blocs (et disponibilité par document) ---------- */
export const BLOC_TYPES = [
  { id:'texte',         label:'Texte libre',            icone:'pencil',  dispo:['bulletin','honneur','certificat','carte','badge'],
    aide:'Texte avec champs dynamiques : {eleve.nom}, {notes.moyenne}, {date.jour}…' },
  { id:'champ',         label:'Champ dynamique',        icone:'target',  dispo:['bulletin','honneur','certificat','carte','badge'],
    aide:'Valeur d\'un champ du catalogue (nom, matricule, moyenne…).' },
  { id:'ligne',         label:'Ligne / séparateur',     icone:'chev-r',   dispo:['bulletin','honneur','certificat','carte','badge'],
    aide:'Trait horizontal.' },
  { id:'logo',          label:'Logo',                   icone:'home',    dispo:['bulletin','honneur','certificat','carte','badge'],
    aide:'Logo de l\'établissement (Personnalisation).' },
  { id:'photo',         label:'Photo de l\'élève',      icone:'user',    dispo:['bulletin','certificat','carte','badge'],
    aide:'Photo de l\'élève (ou initiales).' },
  { id:'qr',            label:'QR code',                icone:'qr',      dispo:['bulletin','carte','badge'],
    aide:'QR code de vérification / d\'identification.' },
  { id:'entete',        label:'En-tête officiel',       icone:'shield',  dispo:['bulletin','certificat'],
    aide:'Deux blocs République / Établissement (paramétrables).' },
  { id:'tableau-notes', label:'Tableau des notes',      icone:'book',    dispo:['bulletin'],
    aide:'Matières du plan groupées, avec colonnes au choix.' },
  { id:'bilan',         label:'Bilan disciplinaire',    icone:'gavel',   dispo:['bulletin'],
    aide:'Absences (NJ/J en heures) et consignes.' },
  { id:'resultats',     label:'Résultats (élève/classe)', icone:'chart', dispo:['bulletin'],
    aide:'T-Points, T-Coef, moyenne, rang, min/max de la classe.' },
  { id:'decision',      label:'Décision du conseil',    icone:'check',   dispo:['bulletin'],
    aide:'Cases Promu(e) / Redouble / Exclu(e).' },
  { id:'signatures',    label:'Signatures',             icone:'pencil',  dispo:['bulletin','honneur','certificat'],
    aide:'Deux zones de signature libellées.' },
  { id:'liste',         label:'Liste des élèves',       icone:'users',   dispo:['honneur'],
    aide:'Élèves sélectionnés (moyenne, rang).' }
];
export const blocsDispo = typeDoc => BLOC_TYPES.filter(b => b.dispo.includes(typeDoc));

/* ---------- Catalogue des champs dynamiques ---------- */
const CHAMPS_COMMUNS = [
  { cle:'date.jour',    label:'Date du jour (jj/mm/aaaa)' },
  { cle:'date.texte',   label:'Date en toutes lettres' },
  { cle:'annee.libelle', label:'Année scolaire' },
  { cle:'etab.nom',     label:'Nom de l\'établissement' },
  { cle:'etab.sousTitre', label:'Sous-titre de l\'établissement' },
  { cle:'etab.adresse', label:'Adresse de l\'établissement' },
  { cle:'etab.telephone', label:'Téléphone de l\'établissement' },
  { cle:'lieu.edition', label:'Lieu d\'édition (« Fait à … »)' },
  { cle:'etab.signataire', label:'Signataire (chef d\'établissement)' }
];
const CHAMPS_ELEVE = [
  { cle:'eleve.nomComplet', label:'Nom et prénoms de l\'élève' },
  { cle:'eleve.nom',        label:'Nom de l\'élève' },
  { cle:'eleve.prenom',     label:'Prénom(s) de l\'élève' },
  { cle:'eleve.matricule',  label:'Matricule' },
  { cle:'eleve.sexe',       label:'Sexe (M/F)' },
  { cle:'eleve.naissanceDate', label:'Date de naissance' },
  { cle:'eleve.naissanceLieu', label:'Lieu de naissance' },
  { cle:'eleve.classe',     label:'Classe' },
  { cle:'eleve.niveau',     label:'Niveau' },
  { cle:'eleve.effectif',   label:'Effectif de la classe' },
  { cle:'eleve.regime',     label:'Régime (interne/externe)' },
  { cle:'eleve.redoublant', label:'Redoublant (oui/non)' },
  { cle:'eleve.tuteur',     label:'Tuteur' },
  { cle:'eleve.telephone',  label:'Téléphone du tuteur' }
];
const CHAMPS_NOTES = [
  { cle:'notes.periode',      label:'Période (libellé)' },
  { cle:'notes.moyenne',      label:'Moyenne de l\'élève /20' },
  { cle:'notes.rang',         label:'Rang de l\'élève' },
  { cle:'notes.rangSur',      label:'Effectif classé' },
  { cle:'notes.totalPoints',  label:'Total des points' },
  { cle:'notes.totalCoef',    label:'Total des coefficients' },
  { cle:'notes.moyenneClasse', label:'Moyenne de la classe' },
  { cle:'notes.minClasse',    label:'Moyenne la plus basse' },
  { cle:'notes.maxClasse',    label:'Moyenne la plus haute' },
  { cle:'notes.mention',      label:'Mention de travail' },
  { cle:'notes.appreciation', label:'Appréciation générale' },
  { cle:'notes.nbMatieres',   label:'Matières notées' }
];
const CHAMPS_DISCIPLINE = [
  { cle:'absences.nj',    label:'Absences non justifiées (heures)' },
  { cle:'absences.j',     label:'Absences justifiées (heures)' },
  { cle:'absences.total', label:'Total des absences (heures)' }
];
export function catalogueChamps(typeDoc){
  if (typeDoc === 'honneur') return CHAMPS_COMMUNS;
  if (typeDoc === 'certificat') return CHAMPS_COMMUNS.concat(CHAMPS_ELEVE);
  if (typeDoc === 'carte' || typeDoc === 'badge') return CHAMPS_COMMUNS.concat(CHAMPS_ELEVE);
  return CHAMPS_COMMUNS.concat(CHAMPS_ELEVE, CHAMPS_NOTES, CHAMPS_DISCIPLINE);
}

/* ---------- Valeur d'un champ dans un contexte ---------- */
const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
export function resolveChamp(cle, ctx){
  const c = ctx || {};
  const num = (v, dec) => (v == null || isNaN(v)) ? '—' : String(Number(v).toFixed(dec == null ? 2 : dec)).replace('.', ',');
  switch (String(cle || '')){
    case 'date.jour':        return c.dateJour || '';
    case 'date.texte':       return c.dateTexte || '';
    case 'annee.libelle':    return (c.annee && c.annee.libelle) || '';
    case 'etab.nom':         return (c.etab && c.etab.nomEtablissement) || '';
    case 'etab.sousTitre':   return (c.etab && c.etab.sousTitre) || '';
    case 'etab.adresse':     return (c.etab && c.etab.adresse) || '';
    case 'etab.telephone':   return (c.etab && c.etab.telephone) || '';
    case 'lieu.edition':     return c.lieu || '';
    case 'etab.signataire':  return c.signataire || '';
    case 'eleve.nomComplet': return ((c.eleve && c.eleve.nom) || '') + ' ' + ((c.eleve && c.eleve.prenom) || '');
    case 'eleve.nom':        return (c.eleve && c.eleve.nom) || '';
    case 'eleve.prenom':     return (c.eleve && c.eleve.prenom) || '';
    case 'eleve.matricule':  return (c.eleve && c.eleve.matricule) || '—';
    case 'eleve.sexe':       return (c.eleve && c.eleve.sexe) === 'F' ? 'F' : 'M';
    case 'eleve.naissanceDate': {
      const d = (c.eleve && c.eleve.dateNaissance) || '';
      const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
      return x ? x[3] + '/' + x[2] + '/' + x[1] : d;
    }
    case 'eleve.naissanceLieu': return (c.eleve && c.eleve.lieuNaissance) || '';
    case 'eleve.classe':     return (c.classe && c.classe.libelle) || '';
    case 'eleve.niveau':     return (c.niveau && c.niveau.libelle) || '';
    case 'eleve.effectif':   return c.effectif != null ? String(c.effectif) : '—';
    case 'eleve.regime':     return (c.eleve && c.eleve.regime) || '';
    case 'eleve.redoublant': return (c.eleve && c.eleve.redoublant) ? 'Oui' : 'Non';
    case 'eleve.tuteur':     return (c.eleve && c.eleve.tuteur) || '';
    case 'eleve.telephone':  return (c.eleve && c.eleve.tel) || '';
    case 'notes.periode':    return c.periodeLabel || '';
    case 'notes.moyenne':    return num(c.moy);
    case 'notes.rang':       return c.rang != null ? String(c.rang) : '—';
    case 'notes.rangSur':    return c.rangSur != null ? String(c.rangSur) : '—';
    case 'notes.totalPoints': return num(c.totalPoints);
    case 'notes.totalCoef':   return num(c.totalCoef, 0);
    case 'notes.moyenneClasse': return num(c.moyenneClasse);
    case 'notes.minClasse':  return num(c.minClasse);
    case 'notes.maxClasse':  return num(c.maxClasse);
    case 'notes.mention':    return c.mention || '';
    case 'notes.appreciation': return c.appreciation || '';
    case 'notes.nbMatieres': return c.nbMatieres != null ? String(c.nbMatieres) : '—';
    case 'absences.nj':      return c.absNJ != null ? String(c.absNJ) : '0';
    case 'absences.j':       return c.absJ != null ? String(c.absJ) : '0';
    case 'absences.total':   return c.absNJ != null || c.absJ != null ? String((c.absNJ || 0) + (c.absJ || 0)) : '0';
    default: return '';
  }
}
const CLES_CONNUES = new Set(CHAMPS_COMMUNS.concat(CHAMPS_ELEVE, CHAMPS_NOTES, CHAMPS_DISCIPLINE).map(c => c.cle));
/* Remplace les {champ} d'un texte libre par leur valeur */
export function interpoler(texte, ctx){
  return String(texte == null ? '' : texte).replace(/\{([a-zA-Z.]+)\}/g, (m, cle) => {
    const v = resolveChamp(cle, ctx);
    if (v !== '' && String(v).trim() !== '') return v;
    /* champ connu mais vide : « ………… » à compléter à la main ;
       champ inconnu (faute de frappe) : laissé visible pour être corrigé */
    return CLES_CONNUES.has(cle) ? '…………' : m;
  });
}

/* ---------- Nouveau bloc / style par défaut ---------- */
export const STYLE_DEFAUT = { police:'Tahoma', taille:10, gras:false, italique:false, souligne:false,
  alignement:'gauche', couleur:'', fond:'', bordure:false };
let _seqBloc = 0;
export function newBloc(type, ctx){
  const s = { ...STYLE_DEFAUT };
  const b = { id:'b' + Date.now().toString(36) + (_seqBloc++), type, x:10, y:10, w:60, h:10, style:s, options:{} };
  if (type === 'texte'){ b.texte = 'Nouveau texte — {eleve.nomComplet}'; b.w = 80; b.h = 8; }
  if (type === 'champ'){ b.champ = 'eleve.nomComplet'; b.w = 60; b.h = 7; s.gras = true; }
  if (type === 'ligne'){ b.h = 1; b.w = 180; }
  if (type === 'logo'){ b.w = 22; b.h = 22; }
  if (type === 'photo'){ b.w = 25; b.h = 32; }
  if (type === 'qr'){ b.w = 20; b.h = 20; }
  if (type === 'entete'){ b.w = 190; b.h = 26; }
  if (type === 'tableau-notes'){ b.x = 8; b.y = 90; b.w = 194; b.h = 120; s.taille = 8.5;
    b.options = { groupes:true, note:true, coef:true, points:true, moyClasse:true, rang:true, appreciation:true }; }
  if (type === 'bilan'){ b.w = 190; b.h = 26; s.taille = 9; }
  if (type === 'resultats'){ b.w = 190; b.h = 42; s.taille = 9; }
  if (type === 'decision'){ b.w = 190; b.h = 14; s.taille = 9.5; }
  if (type === 'signatures'){ b.w = 190; b.h = 26; s.taille = 9.5;
    b.options = { gauche:'Le Professeur titulaire', droite:'{etab.signataire}' }; }
  if (type === 'liste'){ b.x = 8; b.y = 60; b.w = 190; b.h = 140; s.taille = 10;
    b.options = { moyenne:true, rang:true, appreciation:true }; }
  const p = (ctx && ctx.page) || { w:210, h:297 };
  b.x = Math.min(b.x, Math.max(0, p.w - 10));
  b.y = Math.min(b.y, Math.max(0, p.h - 10));
  return b;
}

/* ---------- Modèles de départ (création) ----------
   Mise en page prête à imprimer pour chaque document. Les positions sont
   en millimètres depuis le bord de la page (A4 : 210 × 297 mm), avec une
   marge visuelle de 10 mm. Couleurs : bleu nuit de l'établissement. */
const BLEU = '#2c3a63', GRIS = '#6e7590';
export const NOMS_MODELES_DEFAUT = {
  bulletin: 'Bulletin de notes — modèle complet',
  honneur: "Tableau d'honneur — modèle complet",
  certificat: 'Certificat de scolarité — modèle officiel',
  carte: 'Carte scolaire — modèle complet',
  badge: 'Badge élève — modèle complet'
};
export function defaultModele(typeDoc, nom){
  const t = typeDocOf(typeDoc) || TYPES_DOCS[0];
  const page = { format:(t.formats.includes('A4') ? 'A4' : t.formats[0]), orientation:'portrait',
    marges:{ h:10, b:10, g:10, d:10 }, fond:'' };
  const m = { typeDoc:t.id, periode:'tous', nom:nom || NOMS_MODELES_DEFAUT[t.id] || '', page, blocs:[] };
  const add = (type, over) => {
    const b = newBloc(type, { page:FORMATS_PAGE[page.format] });
    const style = { ...b.style, ...((over && over.style) || {}) };
    Object.assign(b, over || {}, { style });
    m.blocs.push(b);
    return b;
  };
  const st = o => ({ style:o });

  if (t.id === 'bulletin'){
    add('entete', { x:10, y:8, w:190, h:24, ...st({ taille:8 }) });
    add('logo', { x:96, y:8, w:18, h:18 });
    add('texte', { texte:'BULLETIN DE NOTES — {notes.periode}', x:10, y:34, w:190, h:8,
      ...st({ gras:true, alignement:'centre', taille:13, couleur:BLEU }) });
    add('texte', { texte:'Année scolaire {annee.libelle}', x:10, y:42, w:190, h:5,
      ...st({ alignement:'centre', taille:9.5, italique:true, couleur:GRIS }) });
    add('ligne', { x:10, y:49, w:190, ...st({ taille:1.5, couleur:BLEU }) });
    add('photo', { x:10, y:52, w:22, h:28 });
    add('champ', { champ:'eleve.nomComplet', x:36, y:52, w:130, h:6, ...st({ gras:true, taille:11.5, couleur:BLEU }) });
    add('texte', { texte:'Matricule : {eleve.matricule}     Sexe : {eleve.sexe}\n'
      + 'Né(e) le {eleve.naissanceDate} à {eleve.naissanceLieu}\n'
      + 'Classe : {eleve.classe}     Effectif : {eleve.effectif}     Régime : {eleve.regime}',
      x:36, y:59, w:130, h:20, ...st({ taille:9.5 }) });
    add('qr', { x:174, y:52, w:26, h:26 });
    add('tableau-notes', { x:10, y:83, w:190, h:116, ...st({ taille:8.5 }),
      options:{ groupes:true, note:true, coef:true, points:true, moyClasse:true, rang:true, appreciation:true } });
    add('resultats', { x:10, y:202, w:118, h:32, ...st({ taille:9 }) });
    add('texte', { texte:'Observations du professeur titulaire :', x:131, y:202, w:69, h:32,
      ...st({ taille:8.5, italique:true, bordure:true }) });
    add('bilan', { x:10, y:237, w:190, h:10, ...st({ taille:9 }) });
    add('decision', { x:10, y:249, w:190, h:7, ...st({ taille:9.5 }) });
    add('texte', { texte:'Fait à {lieu.edition}, le {date.jour}', x:110, y:258, w:90, h:5,
      ...st({ alignement:'droite', taille:9, italique:true }) });
    add('signatures', { x:10, y:264, w:190, h:26, ...st({ taille:9.5, gras:true }),
      options:{ gauche:'Le Professeur titulaire', droite:'{etab.signataire}' } });
  } else if (t.id === 'honneur'){
    add('logo', { x:10, y:10, w:22, h:22 });
    add('champ', { champ:'etab.nom', x:36, y:12, w:150, h:7, ...st({ gras:true, taille:12, couleur:BLEU }) });
    add('texte', { texte:'Année scolaire {annee.libelle}', x:36, y:20, w:150, h:5, ...st({ taille:9.5, italique:true, couleur:GRIS }) });
    add('ligne', { x:10, y:35, w:190, ...st({ taille:1.5, couleur:BLEU }) });
    add('texte', { texte:"TABLEAU D'HONNEUR", x:10, y:42, w:190, h:12,
      ...st({ gras:true, alignement:'centre', taille:20, couleur:BLEU }) });
    add('texte', { texte:'{notes.periode}', x:10, y:55, w:190, h:7, ...st({ alignement:'centre', taille:11, italique:true }) });
    add('texte', { texte:'★ : félicitations du conseil de classe', x:10, y:62, w:190, h:5,
      ...st({ alignement:'centre', taille:8.5, couleur:GRIS }) });
    add('liste', { x:10, y:70, w:190, h:176, ...st({ taille:10 }), options:{ moyenne:true, rang:true, appreciation:true } });
    add('texte', { texte:'Fait à {lieu.edition}, le {date.jour}', x:110, y:250, w:90, h:5,
      ...st({ alignement:'droite', taille:9, italique:true }) });
    add('signatures', { x:10, y:257, w:190, h:28, ...st({ taille:9.5, gras:true }),
      options:{ gauche:'Le Professeur titulaire', droite:'{etab.signataire}' } });
  } else if (t.id === 'certificat'){
    add('entete', { x:10, y:10, w:190, h:26, ...st({ taille:8.5 }) });
    add('logo', { x:96, y:10, w:18, h:18 });
    add('ligne', { x:10, y:40, w:190, ...st({ taille:1.5, couleur:BLEU }) });
    add('texte', { texte:'CERTIFICAT DE SCOLARITÉ', x:10, y:54, w:190, h:12,
      ...st({ gras:true, alignement:'centre', taille:18, couleur:BLEU, souligne:true }) });
    add('texte', { texte:'Année scolaire {annee.libelle}', x:10, y:67, w:190, h:6,
      ...st({ alignement:'centre', taille:10.5, italique:true, couleur:GRIS }) });
    add('texte', { texte:'Je soussigné(e), chef de l\'établissement {etab.nom}, certifie que l\'élève :', x:20, y:86, w:170, h:8,
      ...st({ taille:12 }) });
    add('champ', { champ:'eleve.nomComplet', x:20, y:97, w:170, h:9, ...st({ gras:true, alignement:'centre', taille:15, couleur:BLEU }) });
    add('texte', { texte:'matricule {eleve.matricule}, né(e) le {eleve.naissanceDate} à {eleve.naissanceLieu},\n\n'
      + 'est régulièrement inscrit(e) dans notre établissement en classe de {eleve.classe} ({eleve.niveau}) '
      + 'pour l\'année scolaire {annee.libelle}, sous le régime {eleve.regime}.\n\n'
      + 'En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.',
      x:20, y:110, w:170, h:70, ...st({ taille:12, alignement:'justifie' }) });
    add('texte', { texte:'Fait à {lieu.edition}, le {date.texte}', x:100, y:196, w:90, h:6,
      ...st({ alignement:'droite', taille:11, italique:true }) });
    add('signatures', { x:10, y:206, w:190, h:40, ...st({ taille:11, gras:true }),
      options:{ gauche:'', droite:'{etab.signataire}' } });
  } else if (t.id === 'carte' || t.id === 'badge'){
    const carte = t.id === 'carte';
    const W = carte ? 85 : 75, H = carte ? 55 : 45;
    page.marges = { h:0, b:0, g:0, d:0 };
    const ph = carte ? { w:19, h:24 } : { w:16, h:20 };
    const qr = carte ? 16 : 14;
    add('texte', { texte:'{etab.nom}', x:0, y:0, w:W, h:carte ? 7 : 6,
      ...st({ gras:true, alignement:'centre', taille:carte ? 7.5 : 7, couleur:'#ffffff', fond:BLEU }) });
    add('texte', { texte:(carte ? 'CARTE SCOLAIRE' : 'BADGE ÉLÈVE') + ' — {annee.libelle}', x:0, y:carte ? 7 : 6, w:W, h:4.5,
      ...st({ gras:true, alignement:'centre', taille:6, couleur:'#c08a26' }) });
    add('photo', { x:3, y:carte ? 13 : 11.5, w:ph.w, h:ph.h });
    add('champ', { champ:'eleve.nomComplet', x:ph.w + 5, y:carte ? 13 : 11.5, w:W - ph.w - qr - 9, h:carte ? 9 : 8,
      ...st({ gras:true, taille:7.5, couleur:BLEU }) });
    add('texte', { texte:'Matricule : {eleve.matricule}\nClasse : {eleve.classe}\nNé(e) le {eleve.naissanceDate}',
      x:ph.w + 5, y:carte ? 23 : 20.5, w:W - ph.w - qr - 9, h:carte ? 14 : 12, ...st({ taille:6.5 }) });
    add('qr', { x:W - qr - 3, y:carte ? 13 : 11.5, w:qr, h:qr });
    add('texte', { texte:'Tuteur : {eleve.telephone}', x:0, y:H - 6, w:W, h:6,
      ...st({ alignement:'centre', taille:6, couleur:'#ffffff', fond:BLEU }) });
  }
  return m;
}


/* ---------- Normalisation / validation (import, sauvegarde) ---------- */
function hexCouleur(v){
  if (typeof v !== 'string') return '';
  v = v.trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '';
}
function nombre(v, min, max, def){
  const n = Number(v);
  if (isNaN(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}
export function normalizeModele(m){
  if (!m || typeof m !== 'object') throw new Error('modèle invalide (objet attendu)');
  const t = typeDocOf(m.typeDoc);
  if (!t) throw new Error('type de document inconnu : ' + String(m.typeDoc));
  const nom = String(m.nom || '').trim();
  if (!nom) throw new Error('Le nom du modèle est requis.');
  if (nom.length > 80) throw new Error('Le nom du modèle est trop long (80 caractères maximum).');
  let periode = 'tous';
  if (t.periodes){
    periode = ['sequence','trimestre','annee','tous'].includes(m.periode) ? m.periode : 'tous';
  }
  const pageSrc = (m.page && typeof m.page === 'object') ? m.page : {};
  const format = t.formats.includes(pageSrc.format) ? pageSrc.format : t.formats[0];
  const orientation = t.orient && pageSrc.orientation === 'paysage' ? 'paysage' : 'portrait';
  const mg = (pageSrc.marges && typeof pageSrc.marges === 'object') ? pageSrc.marges : {};
  const page = { format, orientation, fond:hexCouleur(pageSrc.fond),
    marges:{ h:nombre(mg.h, 0, 30, 8), b:nombre(mg.b, 0, 30, 8), g:nombre(mg.g, 0, 30, 8), d:nombre(mg.d, 0, 30, 8) } };
  if (!Array.isArray(m.blocs)) throw new Error('liste des blocs manquante');
  if (m.blocs.length > 60) throw new Error('trop de blocs (60 maximum)');
  const dims = pageOf({ format, orientation, typeDoc:t.id });
  const dispo = blocsDispo(t.id).map(b => b.id);
  const blocs = [];
  const vus = new Set();
  m.blocs.forEach((b, i) => {
    if (!b || typeof b !== 'object') return;
    if (!dispo.includes(b.type)) return;                        /* bloc non prévu pour ce document : ignoré */
    let id = String(b.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    if (!id || vus.has(id)) id = 'b' + (i + 1) + '_' + Date.now().toString(36);
    vus.add(id);
    const st = (b.style && typeof b.style === 'object') ? b.style : {};
    const style = {
      police: POLICES.includes(st.police) ? st.police : 'Tahoma',
      taille: nombre(st.taille, 4, 72, 10),
      gras: st.gras === true, italique: st.italique === true, souligne: st.souligne === true,
      alignement: ['gauche','centre','droite','justifie'].includes(st.alignement) ? st.alignement : 'gauche',
      couleur: hexCouleur(st.couleur), fond: hexCouleur(st.fond), bordure: st.bordure === true
    };
    const opts = (b.options && typeof b.options === 'object') ? b.options : {};
    const options = {};
    Object.keys(opts).forEach(k => {
      const v = opts[k];
      if (typeof v === 'boolean') options[k] = v;
      else if (typeof v === 'string') options[k] = v.slice(0, 60);
      else if (typeof v === 'number') options[k] = Math.round(v);
    });
    blocs.push({
      id, type:b.type,
      x:nombre(b.x, 0, dims.w, 5), y:nombre(b.y, 0, dims.h, 5),
      w:nombre(b.w, 2, dims.w, 40), h:nombre(b.h, 1, dims.h, 10),
      texte: typeof b.texte === 'string' ? b.texte.slice(0, 900) : undefined,
      champ: typeof b.champ === 'string' ? b.champ.slice(0, 40) : undefined,
      style, options
    });
  });
  return { id: m.id || '', typeDoc:t.id, periode, nom, page, blocs };
}

/* ---------- Export / import JSON ---------- */
export function modeleVersJson(m){
  return JSON.stringify({ application:'aurel-school-siges', format:'modele-document', version:1,
    modele: normalizeModele(m) }, null, 1);
}
export function modeleDepuisJson(txt){
  let j;
  try { j = JSON.parse(String(txt)); }
  catch { throw new Error('JSON illisible — vérifiez le contenu collé.'); }
  const m = j && j.modele ? j.modele : j;
  const nm = normalizeModele(m);
  nm.id = '';                                        /* import = toujours une copie */
  if (!nm.blocs.length) throw new Error('le modèle ne contient aucun bloc utilisable');
  return nm;
}

/* ---------- Thème de couleurs ---------- */
export const PRESETS_THEME = [
  { id:'navy-or',    label:'Navy & or (par défaut)', primaire:'#2C3A63', accent:'#C08A26' },
  { id:'bleu-glacier', label:'Bleu glacier & ambre', primaire:'#1D5A8A', accent:'#C77F1E' },
  { id:'vert-foret', label:'Vert forêt & or',        primaire:'#2F5D46', accent:'#B08A2E' },
  { id:'bordeaux',   label:'Bordeaux & or',          primaire:'#7A2E3A', accent:'#A87B1E' },
  { id:'violet',     label:'Violet & ambre',         primaire:'#4A3A7A', accent:'#B08A2E' },
  { id:'charbon',    label:'Gris charbon & laiton',  primaire:'#3A3F4A', accent:'#8A6D2E' }
];
export const THEME_DEFAUT = { preset:'navy-or', primaire:'#2C3A63', accent:'#C08A26' };

function hexVersRgb(h){ return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rgbVersHex(r){ return '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function melange(hex, cible, t){
  const a = hexVersRgb(hex), b = cible === 'noir' ? [0, 0, 0] : [255, 255, 255];
  return rgbVersHex(a.map((v, i) => v + (b[i] - v) * t));
}
/* Palette dérivée : primaire + accent → variables CSS de l'application */
export function varsTheme(theme){
  const t = (theme && typeof theme === 'object') ? theme : {};
  const primaire = hexCouleur(t.primaire) || THEME_DEFAUT.primaire.toLowerCase();
  const accent = hexCouleur(t.accent) || THEME_DEFAUT.accent.toLowerCase();
  return {
    '--navy-950': melange(primaire, 'noir', .32),
    '--navy-900': melange(primaire, 'noir', .18),
    '--navy-800': primaire,
    '--navy-700': melange(primaire, 'blanc', .14),
    '--navy-600': melange(primaire, 'blanc', .30),
    '--navy-100': melange(primaire, 'blanc', .90),
    '--gold-600': accent,
    '--gold-500': melange(accent, 'blanc', .12),
    '--gold-400': melange(accent, 'blanc', .26),
    '--gold-300': melange(accent, 'blanc', .45),
    '--gold-100': melange(accent, 'blanc', .88)
  };
}
/* Applique (ou retire) le thème sur la racine du document */
export function appliquerTheme(theme){
  if (typeof document === 'undefined') return false;
  const racine = document.documentElement;
  const t = (theme && typeof theme === 'object') ? theme : null;
  const estDefaut = !t
    || (hexCouleur(t.primaire || '') === THEME_DEFAUT.primaire.toLowerCase()
      && hexCouleur(t.accent || '') === THEME_DEFAUT.accent.toLowerCase());
  Object.keys(varsTheme({ primaire:'#2C3A63', accent:'#C08A26' })).forEach(k => racine.style.removeProperty(k));
  if (t && !estDefaut) Object.entries(varsTheme(t)).forEach(([k, v]) => racine.style.setProperty(k, v));
  return !estDefaut;
}
