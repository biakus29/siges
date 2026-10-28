/* Jeu de données de démonstration — Collège Bonneau (portage de la version validée) */
/* v6.8 : version de la graine — référencée par Store.load (ne plus ressabler
   une base locale à jour à chaque démarrage) ; incrémenter à chaque évolution
   du jeu de démonstration. */
export const SEED_VERSION = 15;
import { hashPwd, makeSalt } from './sha256.js';
import { mulberry32, pad2, round500, sum, todayISO } from './utils.js';
import { defaultSequences, defaultAppreciations, defaultAppreciationsApc, defaultAppreciationsMoyenne } from './business.js';

function tarifEffectifFor(db, anneeId, fraisId, classeId, regime){
  const cl = db.classes.find(c => c.id === classeId);
  if (!cl) return null;
  const rg = regime || null;
  const tcR = db.tarifs.find(x => x.anneeId===anneeId && x.fraisId===fraisId && x.cibleType==='classe' && x.cibleId===classeId && (x.regime||null)===rg);
  if (tcR) return tcR.montant;
  const tc = db.tarifs.find(x => x.anneeId===anneeId && x.fraisId===fraisId && x.cibleType==='classe' && x.cibleId===classeId && !x.regime);
  if (tc) return tc.montant;
  const tnR = db.tarifs.find(x => x.anneeId===anneeId && x.fraisId===fraisId && x.cibleType==='niveau' && x.cibleId===cl.niveauId && (x.regime||null)===rg);
  if (tnR) return tnR.montant;
  const tn = db.tarifs.find(x => x.anneeId===anneeId && x.fraisId===fraisId && x.cibleType==='niveau' && x.cibleId===cl.niveauId && !x.regime);
  return tn ? tn.montant : null;
}

export function buildSeed(){
  const R = mulberry32(20260908);
  const ri = (a,b)=> a + Math.floor(R()*(b-a+1));
  const pick = a => a[Math.floor(R()*a.length)];

  const NOMS = ['Abena','Mbarga','Nkoulou','Essomba','Biya','Fotso','Kamga','Tchoupo','Owona','Mballa','Atangana','Ndjock','Etoundi','Moukouri','Fouda','Talla','Nana','Soh','Tabi','Efoua','Onana','Ndongo','Ewane','Ntube','Belinga','Etoga','Mvondo','Nkodo','Assomo','Ndzana','Njoh','Foncham','Neba','Ayuk','Egbe','Nfor','Yonta','Mefire','Abega','Nguini'];
  const PRE_M = ['Jean','Paul','Éric','Patrick','Serge','Blaise','Christian','Cyrille','Désiré','Emmanuel','Félix','Guy','Hervé','Joseph','Landry','Marc','Narcisse','Olivier','Rodrigue','Samuel','Thierry','Wilfried','Axel','Brice','Darwin','Fabrice','Gaël','Junior','Kevin','René'];
  const PRE_F = ['Adèle','Bernadette','Chantal','Clarisse','Danielle','Dorothée','Estelle','Évangeline','Georgette','Ghislaine','Irène','Josiane','Larissa','Léonie','Lydie','Mireille','Nadège','Nicolette','Ornella','Pascaline','Perpétue','Rachelle','Raissa','Solange','Sylvie','Thérèse','Vanessa','Yvette','Aurélie','Bénédicte'];

  const DB = { version:1, seedV:6, users:[], annees:[], niveaux:[], classes:[], frais:[], tarifs:[], eleves:[], paiements:[], journal:[], modelesDocs:[] };

  /* Utilisateurs (SHA-256 + sel) */
  const mkUser = (id, username, pwd, nom, role, attr) => {
    const salt = Math.floor(R()*1e12).toString(16);
    return Object.assign({ id, username, nom, role, actif:true, salt, hash:hashPwd(salt, pwd), dernierAcces:null }, attr || {});
  };
  DB.users.push(
    mkUser('us-admin','admin','admin2026','Sœur Marie-Claire Ngo','admin'),
    mkUser('us-eco','econome','econome2026','M. Fernand Mbarga','econome'),
    mkUser('us-eco2','econome2','econome2026','Mme Alice Fotso','econome'),
    mkUser('us-lec','lecteur','lecteur2026','M. Paul Étoundi','lecteur')
  );

  /* Années scolaires */
  DB.annees.push(
    { id:'an24', libelle:'2024-2025', debut:'2024-09-16', fin:'2025-07-11', statut:'cloturee', active:false },
    { id:'an25', libelle:'2025-2026', debut:'2025-09-15', fin:'2026-07-10', statut:'cloturee', active:false },
    { id:'an26', libelle:'2026-2027', debut:'2026-09-14', fin:'2027-07-09', statut:'ouverte',  active:true }
  );

  /* Niveaux */
  DB.niveaux.push(
    { id:'nv6',  code:'6EME', libelle:'Sixième',   cycle:'Collège', ordre:1 },
    { id:'nv5',  code:'5EME', libelle:'Cinquième', cycle:'Collège', ordre:2 },
    { id:'nv4',  code:'4EME', libelle:'Quatrième', cycle:'Collège', ordre:3 },
    { id:'nv3',  code:'3EME', libelle:'Troisième', cycle:'Collège', ordre:4 },
    { id:'nv2',  code:'2NDE', libelle:'Seconde',   cycle:'Lycée',   ordre:5 },
    { id:'nv1',  code:'1ERE', libelle:'Première',  cycle:'Lycée',   ordre:6 },
    { id:'nvt',  code:'TLE',  libelle:'Terminale', cycle:'Lycée',   ordre:7 }
  );

  /* Classes */
  const CLDEFS = [
    ['cl6a','nv6','6ème A',60],['cl6b','nv6','6ème B',60],
    ['cl5a','nv5','5ème A',60],['cl5b','nv5','5ème B',60],
    ['cl4a','nv4','4ème A',55],['cl4b','nv4','4ème B',55],
    ['cl3a','nv3','3ème A',55],['cl3b','nv3','3ème B',55],
    ['cl2a','nv2','2nde A',50],['cl2c','nv2','2nde C',50],
    ['cl1a4','nv1','1ère A4',45],['cl1c','nv1','1ère C',45],['cl1d','nv1','1ère D',45],
    ['clta4','nvt','Tle A4',45],['cltb','nvt','Tle B',45],['cltc','nvt','Tle C',45],['cltd','nvt','Tle D',45]
  ];
  CLDEFS.forEach(c => DB.classes.push({ id:c[0], niveauId:c[1], libelle:c[2], capacite:c[3],
    ...(c[0] === 'cl6a' ? { titulaireId:'us-tit' } : {}) }));

  /* Types de frais — chacun porte sa répartition en tranches (part % + échéance jour/mois) */
  DB.frais.push(
    { id:'fr-inscr', code:'INSCR', libelle:"Frais d'inscription", categorie:'Inscription', periodicite:'Annuel', obligatoire:true, ordre:1, parStatut:true,
      tranches:[{ id:'t1', label:'Tranche unique', pourcentage:100, jour:5,  mois:9 }] },
    { id:'fr-scol',  code:'SCOL',  libelle:'Frais de scolarité',  categorie:'Scolarité',  periodicite:'Trimestriel', obligatoire:true, ordre:2,
      tranches:[
        { id:'t1', label:'T1', pourcentage:40, jour:30, mois:11 },
        { id:'t2', label:'T2', pourcentage:30, jour:15, mois:1 },
        { id:'t3', label:'T3', pourcentage:30, jour:15, mois:4 }
      ] },
    { id:'fr-tenue', code:'TENUE', libelle:'Tenue & insignes', categorie:'Annexe', periodicite:'Annuel', obligatoire:true, ordre:3,
      tranches:[{ id:'t1', label:'Tranche unique', pourcentage:100, jour:30,  mois:9 }] },
    { id:'fr-apc',   code:'APC',   libelle:'APC, registre & carte', categorie:'Annexe', periodicite:'Annuel', obligatoire:true, ordre:4,
      tranches:[{ id:'t1', label:'Tranche unique', pourcentage:100, jour:15,  mois:10 }] },
    { id:'fr-exam',  code:'EXAM',  libelle:"Frais d'examens officiels", categorie:'Examen', periodicite:'Annuel', obligatoire:true, ordre:5,
      tranches:[{ id:'t1', label:'Tranche unique', pourcentage:100, jour:28,  mois:2 }] },
    { id:'fr-anim',  code:'ANIM',  libelle:'Animation & coopérative', categorie:'Animation', periodicite:'Annuel', obligatoire:false, ordre:6,
      tranches:[{ id:'t1', label:'Tranche unique', pourcentage:100, jour:15,  mois:12 }] }
  );

  /* Grille tarifaire (base 2026-2027 ; années antérieures dégressives) */
  const BASE = {
    nv6: { 'fr-inscr':25000,'fr-scol':135000,'fr-tenue':12500,'fr-apc':10000,'fr-anim':5000 },
    nv5: { 'fr-inscr':25000,'fr-scol':138000,'fr-tenue':12500,'fr-apc':10000,'fr-anim':5000 },
    nv4: { 'fr-inscr':25000,'fr-scol':144000,'fr-tenue':13500,'fr-apc':10000,'fr-anim':5000 },
    nv3: { 'fr-inscr':25000,'fr-scol':150000,'fr-tenue':13500,'fr-apc':12000,'fr-exam':15000,'fr-anim':5000 },
    nv2: { 'fr-inscr':30000,'fr-scol':165000,'fr-tenue':13500,'fr-apc':12000,'fr-anim':5000 },
    nv1: { 'fr-inscr':30000,'fr-scol':180000,'fr-tenue':13500,'fr-apc':12000,'fr-anim':5000 },
    nvt: { 'fr-inscr':30000,'fr-scol':187500,'fr-tenue':13500,'fr-apc':12000,'fr-exam':30000,'fr-anim':5000 }
  };
  let tfSeq = 1;
  const addTarif = (anneeId, cibleType, cibleId, fraisId, montant, regime) => {
    if (!montant) return;
    DB.tarifs.push({ id:'tf-'+(tfSeq++), anneeId, cibleType, cibleId, fraisId, montant, ...(regime ? { regime } : {}) });
  };
  const YEARF = { an24:0.90, an25:0.95, an26:1.00 };
  Object.keys(YEARF).forEach(an => {
    const f = YEARF[an];
    DB.niveaux.forEach(nv => {
      DB.frais.forEach(fr => { if (BASE[nv.id][fr.id]) addTarif(an,'niveau',nv.id,fr.id, round500(BASE[nv.id][fr.id]*f)); });
    });
  });
  /* Statut interne : scolarité majorée pour les pensionnaires (tarifs par régime) */
  DB.niveaux.forEach(nv => {
    addTarif('an26','niveau',nv.id,'fr-scol', round500(BASE[nv.id]['fr-scol']*1.12), 'interne');
    addTarif('an25','niveau',nv.id,'fr-scol', round500(BASE[nv.id]['fr-scol']*1.12*0.95), 'interne');
  });

  /* v1.11 — frais d'inscription distincts : nouveaux vs anciens élèves (année courante).
     Nouveaux : tarif plein ; anciens (réinscriptions) : 40 %. */
  DB.niveaux.forEach(nv => {
    const b = BASE[nv.id]['fr-inscr'];
    DB.tarifs.push({ id:'tf-'+(tfSeq++), anneeId:'an26', cibleType:'niveau', cibleId:nv.id, fraisId:'fr-inscr', montant:round500(b), statutEleve:'nouveau' });
    DB.tarifs.push({ id:'tf-'+(tfSeq++), anneeId:'an26', cibleType:'niveau', cibleId:nv.id, fraisId:'fr-inscr', montant:round500(b*0.4), statutEleve:'ancien' });
  });

  /* Majorations "laboratoires" pour les séries scientifiques (tarifs spécifiques par classe) */
  ['cl2c','cl1c','cl1d','cltc','cltd'].forEach(cl => {
    ['fr-scol'].forEach(fr => {
      addTarif('an26','classe',cl,fr, round500(BASE.nvt[fr]+22500));
      addTarif('an25','classe',cl,fr, round500((BASE.nvt[fr]+22500)*0.95));
    });
  });

  /* Élèves & paiements */
  const yyOf = { an25:'25', an26:'26' };
  const isoDate = d => d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  const rdate = (d1,d2) => isoDate(new Date(d1.getTime() + R()*(d2.getTime()-d1.getTime())));
  const rmode = () => { const x = R(); return x<.55?'especes':(x<.88?'mobile':(x<.96?'virement':'cheque')); };
  /* heure de paiement plausible : jamais dans le futur par rapport à maintenant */
  const nowD = new Date();
  const nowH = nowD.getHours(), nowM = nowD.getMinutes();
  /* v5.2 — déterminisme : le générateur consomme TOUJOURS exactement deux
     tirages, quelle que soit l'heure ou la date d'exécution (la répartition
     des élèves et les montants ne doivent jamais varier d'un jour à l'autre). */
  const randHM = dISO => {
    const hR = ri(8, 16), mR = ri(0, 59);
    if (dISO === isoDate(nowD)){
      const h = nowH >= 8 ? Math.min(hR, nowH) : nowH;
      const m = h === nowH ? Math.min(mR, Math.max(0, nowM)) : mR;
      return 'T' + pad2(h) + ':' + pad2(m);
    }
    return 'T' + pad2(hR) + ':' + pad2(mR);
  };
  const today = new Date(); today.setHours(9,0,0,0);

  const paySeq = { an25:0, an26:0 };
  const addPaiement = (anneeId, eleve, fraisId, montant, dateISO) => {
    const yy = yyOf[anneeId];
    paySeq[anneeId]++;
    DB.paiements.push({
      id:'pa-'+yy+'-'+paySeq[anneeId],
      numero:'REC-'+yy+'-'+String(paySeq[anneeId]).padStart(4,'0'),
      anneeId, eleveId:eleve.id, fraisId,
      montant, mode:rmode(), reference:'',
      date:dateISO, userId: R()<.7 ? 'us-eco' : 'us-eco2',
      statut:'valide', note:'', motifAnnulation:''
    });
  };
  /* Fenêtres de paiement et couverture, PAR TRANCHE (index = ordre chronologique) */
  const W25 = {
    'fr-inscr':[[new Date('2025-08-25'), new Date('2025-10-20')]],
    'fr-scol': [[new Date('2025-09-20'), new Date('2025-12-10')],
                [new Date('2025-12-15'), new Date('2026-02-20')],
                [new Date('2026-03-20'), new Date('2026-05-30')]],
    'fr-tenue':[[new Date('2025-09-01'), new Date('2025-10-31')]],
    'fr-apc':  [[new Date('2025-09-01'), new Date('2025-11-15')]],
    'fr-exam': [[new Date('2026-02-16'), new Date('2026-04-15')]],
    'fr-anim': [[new Date('2025-09-15'), new Date('2025-12-15')]]
  };
  const P25 = { 'fr-inscr':[.94], 'fr-scol':[.92,.88,.83], 'fr-tenue':[.92], 'fr-apc':[.90], 'fr-exam':[.91], 'fr-anim':[.55] };
  const a26start = new Date('2026-08-18');
  const a26end = today < new Date('2026-08-20') ? new Date('2026-08-20') : today;
  const W26 = {}; ['fr-inscr','fr-scol','fr-tenue','fr-apc','fr-exam','fr-anim'].forEach(f => {
    const nb = f === 'fr-scol' ? 3 : 1;
    W26[f] = Array.from({ length:nb }, () => [a26start, a26end]);
  });
  const P26 = { 'fr-inscr':[.88], 'fr-scol':[.48,.04,0], 'fr-tenue':[.70], 'fr-apc':[.58], 'fr-exam':[.04], 'fr-anim':[.25] };

  const elSeq = { an25:0, an26:0 };
  [['an25',12,15],['an26',10,13]].forEach(cfg => {
    const [anId, nMin, nMax] = cfg;
    CLDEFS.forEach(cdef => {
      const n = ri(nMin, nMax);
      for (let i = 0; i < n; i++){
        const sexe = R() < .5 ? 'M' : 'F';
        const nom = pick(NOMS), pre = sexe === 'M' ? pick(PRE_M) : pick(PRE_F);
        elSeq[anId]++;
        const ANNEE_NAISS = { nv6:2015, nv5:2014, nv4:2013, nv3:2012, nv2:2011, nv1:2010, nvt:2009 };
        const LIEUX = ['Yaoundé','Douala','Bafoussam','Garoua','Bamenda','Ngaoundéré','Buéa','Ebolowa','Kribi','Foumban','Maroua','Limbé'];
        const PROFS_M = ['Commerçant','Enseignant','Cultivateur','Fonctionnaire','Chauffeur','Artisan','Comptable','Mécanicien','Ingénieur','Agent de sécurité'];
        const PROFS_F = ['Commerçante','Enseignante','Cultivatrice','Fonctionnaire','Infirmière','Ménagère','Couturière','Coiffeuse','Comptable','Vendeuse'];
        const QUARTIERS = ['Nkolbisson','Mvog-Ada','Essos','Damas','Etoudi','Biyem-Assi','Odza','Melen','Nsam','Mokolo'];
        const ECOLES = ['CES de Nkolbisson','Lycée de Biyem-Assi','CES d\u2019Etoudi','Lycée Bilingue de Yaoundé','Complexe scolaire La Grâce','École privée Sainte-Thérèse','CES de Mvan','Lycée d\u2019Afrique'];
        const mkTel = () => '6' + ri(50,99) + ' ' + ri(10,99) + ' ' + ri(10,99) + ' ' + ri(10,99);   /* 9 chiffres (Cameroun) : 655 12 34 56 */
        const el = {
          id:'el-'+yyOf[anId]+'-'+elSeq[anId],
          matricule:'BON-'+yyOf[anId]+'-'+String(elSeq[anId]).padStart(4,'0'),
          nom, prenom:pre, sexe, classeId:cdef[0], anneeId:anId,
          dateNaissance:(ANNEE_NAISS[cdef[1]] || 2012) + '-' + pad2(ri(1,12)) + '-' + pad2(ri(1,28)),
          lieuNaissance:pick(LIEUX),
          pereNom:'M. ' + pick(NOMS) + ' ' + pick(PRE_M),
          pereProfession:pick(PROFS_M),
          pereTel:mkTel(),
          mereNom:'Mme ' + pick(NOMS) + ' ' + pick(PRE_F),
          mereProfession:pick(PROFS_F),
          mereTel:mkTel(),
          ancienEtablissement:pick(ECOLES),
          adresse:'Quartier ' + pick(QUARTIERS) + ', Yaoundé',
          tuteur:(R()<.5?'M. ':'Mme ') + pick(NOMS) + ' ' + pick(sexe==='M'?PRE_F:PRE_M),
          tel:mkTel(),
          regime: R() < .24 ? 'interne' : 'externe',
          statutEleve: anId === 'an26' ? (R() < .55 ? 'ancien' : 'nouveau') : 'nouveau',
          statut: (anId === 'an25' && R() < .02) ? 'radie' : 'actif'
        };
        DB.eleves.push(el);
        const W = anId === 'an25' ? W25 : W26;
        const P = anId === 'an25' ? P25 : P26;
        DB.frais.forEach(fr => {
          const du = tarifEffectifFor(DB, anId, fr.id, el.classeId, el.regime);
          if (!du) return;
          /* montant de chaque tranche (dernière = reste) */
          let cumul = 0;
          fr.tranches.forEach((tr, ti) => {
            const m = ti === fr.tranches.length - 1 ? du - cumul : Math.round(du * tr.pourcentage / 100);
            cumul += m;
            if (m <= 0) return;
            if (R() > (P[fr.id][ti] || 0)) return;
            const partiel = R() < (anId === 'an25' ? .14 : .20);
            let montant = partiel ? round500(m*(0.4+R()*0.45)) : m;
            if (montant > m) montant = m;
            if (montant <= 0) return;
            const w = (W[fr.id] && W[fr.id][ti]) || W[fr.id][0];
            const dISO = rdate(w[0], w[1]);
            addPaiement(anId, el, fr.id, montant, dISO + randHM(dISO));
          });
        });
      }
    });
  });
  /* Quelques encaissements du jour (année active) */
  const candidats = DB.eleves.filter(e => e.anneeId === 'an26');
  for (let k = 0; k < Math.min(9, candidats.length); k++){
    const el2 = candidats[Math.floor(R()*candidats.length)];
    const du2 = tarifEffectifFor(DB,'an26','fr-inscr',el2.classeId);
    const paye = sum(DB.paiements.filter(p => p.eleveId === el2.id && p.fraisId === 'fr-inscr' && p.statut === 'valide'), p => p.montant);
    if (du2 && paye < du2 && R() < .8) addPaiement('an26', el2, 'fr-inscr', du2-paye, todayISO() + randHM(todayISO()));
  }
  DB.paiements.sort((a,b)=> a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));

  /* Bourses & réductions de démonstration */
  DB.bourses = [];
  let bsSeq = 0;
  const addBourse = (eleve, opts) => {
    bsSeq++;
    DB.bourses.push(Object.assign({ id:'bs-'+bsSeq, anneeId:eleve.anneeId, eleveId:eleve.id,
      fraisId:null, pourcentage:0, montant:0, motif:'', actif:true, date:'2026-09-02', createdBy:'admin' }, opts));
  };
  const an26els = DB.eleves.filter(e => e.anneeId === 'an26');
  const an25els = DB.eleves.filter(e => e.anneeId === 'an25');
  if (an26els.length > 130){
    addBourse(an26els[3],   { pourcentage:50,  motif:"Bourse d'excellence (1er de la classe)" });
    addBourse(an26els[17],  { pourcentage:25,  motif:'Réduction enfant du personnel' });
    addBourse(an26els[42],  { pourcentage:100, fraisId:'fr-anim', motif:'Bourse sociale — exonération animation' });
    addBourse(an26els[88],  { montant:30000,   motif:'Remise famille nombreuse (3 enfants)' });
    addBourse(an26els[130], { pourcentage:15,  motif:'Bourse diocésaine' });
  }
  if (an25els.length > 55){
    addBourse(an25els[10], { pourcentage:50, motif:"Bourse d'excellence 2025-2026", date:'2025-09-20' });
    addBourse(an25els[55], { pourcentage:30, motif:'Cas social accompagné (aumônerie)', date:'2025-10-05' });
  }

  /* Paramètres de personnalisation des états */
  DB.settings = {
    nomEtablissement: 'COLLÈGE BONNEAU',
    sousTitre: "Établissement d'enseignement secondaire catholique",
    mention: 'Intendance — Aurel School SIGES',
    adresse: 'BP 5124, Yaoundé — Cameroun',
    telephone: '(+237) 6 99 00 11 22',
    email: 'intendance@collegebonneau.cm',
    piedEtat: 'Document interne — Collège Bonneau',
    logo: ''
  };

  /* Journal */
  DB.journal.push(
    { id:'j1', date:'2026-08-18T08:12', user:'admin', action:'configuration', details:"Création de l'année scolaire 2026-2027 et copie de la grille tarifaire" },
    { id:'j2', date:'2026-08-18T08:15', user:'admin', action:'annee', details:"Année 2026-2027 activée" },
    { id:'j3', date:'2026-08-19T07:58', user:'econome', action:'connexion', details:'Connexion réussie' },
    { id:'j4', date:'2026-08-19T09:41', user:'econome', action:'paiement', details:'Encaissement REC-26-0003 — 25 000 FCFA (INSCR)' },
    { id:'j5', date:'2026-09-05T10:02', user:'lecteur', action:'connexion', details:'Connexion réussie (consultation)' },
    { id:'j6', date:'2026-09-07T16:35', user:'econome2', action:'connexion', details:'Connexion réussie' }
  );
  /* ================================================================
     v2.1 — Structure multi-établissements
     etab-001 : Collège Bonneau (démonstration complète)
     etab-002 : Lycée Classique de Mbalmayo (petite structure de démonstration)
     Comptes globaux : superadmin (tous établissements) + comptes rattachés.
     ================================================================ */
  DB.users.forEach(u => { u.etablissementId = 'etab-001'; });

  const etabBonneau = { id:'etab-001', code:'ETAB-001', nom:'Collège Bonneau', ville:'Yaoundé',
    pays:'Cameroun', adresse:'BP 5124, Yaoundé', telephone:'(+237) 6 99 00 11 22',
    email:'intendance@collegebonneau.cm', actif:true, creeLe:'2024-09-02' };
  const etabClassique = { id:'etab-002', code:'ETAB-002', nom:'Lycée Classique de Mbalmayo', ville:'Mbalmayo',
    pays:'Cameroun', adresse:'BP 210, Mbalmayo', telephone:'(+237) 6 95 22 33 44',
    email:'scolarite@lyceeclassique-mbalmayo.cm', actif:true, creeLe:'2025-09-04' };

  /* ---- base du Collège Bonneau : toutes les données générées ci-dessus ---- */
  const baseBonneau = { annees:DB.annees, niveaux:DB.niveaux, classes:DB.classes, frais:DB.frais,
    tarifs:DB.tarifs, eleves:DB.eleves, paiements:DB.paiements, bourses:DB.bourses,
    anciens:DB.anciens || [], journal:DB.journal, settings:DB.settings, modelesDocs:[] };

  /* ---- base du Lycée Classique de Mbalmayo : structure légère ---- */
  const LC = { annees:[], niveaux:[], classes:[], frais:[], tarifs:[], eleves:[], paiements:[], bourses:[],
    anciens:[], journal:[], settings:{}, modelesDocs:[] };
  LC.settings = {
    nomEtablissement:'Lycée Classique de Mbalmayo', ville:'Mbalmayo', devise:'Discipline — Travail — Réussite',
    sousTitre:'Établissement d\u2019enseignement secondaire général', mention:'Intendance — Aurel School SIGES',
    adresse:'BP 210, Mbalmayo — Cameroun', telephone:'(+237) 6 95 22 33 44',
    email:'scolarite@lyceeclassique-mbalmayo.cm', piedEtat:'Document interne — Lycée Classique de Mbalmayo', logo:''
  };
  LC.annees.push({ id:'an26', libelle:'2026-2027', debut:'2026-09-14', fin:'2027-07-09', statut:'ouverte', active:true });
  LC.niveaux.push(
    { id:'nv-2nd', code:'2ND', libelle:'Seconde', cycle:'Lycée', ordre:1 },
    { id:'nv-1re', code:'1RE', libelle:'Première', cycle:'Lycée', ordre:2 }
  );
  LC.classes.push(
    { id:'cl-2a', niveauId:'nv-2nd', libelle:'Seconde A', effectifMax:60 },
    { id:'cl-2b', niveauId:'nv-2nd', libelle:'Seconde B', effectifMax:60 },
    { id:'cl-1a', niveauId:'nv-1re', libelle:'Première A', effectifMax:55 }
  );
  LC.frais.push(
    { id:'fr-inscr', code:'INSCR', libelle:'Frais d\u2019inscription', obligatoire:true, ordre:1, parStatut:false },
    { id:'fr-scol', code:'SCOL', libelle:'Scolarité (trimestre)', obligatoire:true, ordre:2, parStatut:false },
    { id:'fr-tenue', code:'TENUE', libelle:'Tenue et sport', obligatoire:false, ordre:3, parStatut:false }
  );
  LC.tarifs.push(
    { id:'t1', anneeId:'an26', fraisId:'fr-inscr', cibleType:'niveau', cibleId:'nv-2nd', montant:15000 },
    { id:'t2', anneeId:'an26', fraisId:'fr-inscr', cibleType:'niveau', cibleId:'nv-1re', montant:15000 },
    { id:'t3', anneeId:'an26', fraisId:'fr-scol', cibleType:'classe', cibleId:'cl-2a', montant:45000 },
    { id:'t4', anneeId:'an26', fraisId:'fr-scol', cibleType:'classe', cibleId:'cl-2b', montant:45000 },
    { id:'t5', anneeId:'an26', fraisId:'fr-scol', cibleType:'classe', cibleId:'cl-1a', montant:50000 },
    { id:'t6', anneeId:'an26', fraisId:'fr-tenue', cibleType:'niveau', cibleId:'nv-2nd', montant:12000 },
    { id:'t7', anneeId:'an26', fraisId:'fr-tenue', cibleType:'niveau', cibleId:'nv-1re', montant:12000 }
  );
  const NOMS_LC = ['Ateba','Bekolo','Chedom','Nguimbous','Ekani','Mvondo','Onana','Sindjoun','Tchakoute','Zebaze','Feuzeu','Nkengafac'];
  const PRE_LC = ['Adeline','Bertrand','Clarisse','Danielle','Émile','Franck','Georgette','Hermine','Ivan','Josué','Larissa','Marcelline','Nadège','Olivier','Pélagie','Rodrigue','Sylvie','Thierry','Ursule','Véronique','Willy','Yannick','Zacharie','Bernadette'];
  let seqLC = 0;
  ['cl-2a','cl-2b','cl-1a'].forEach((clId, k) => {
    for (let i = 0; i < 8; i++){
      seqLC++;
      const el = { id:'elc-' + seqLC, matricule:'LCM-26-' + String(seqLC).padStart(3,'0'),
        nom:NOMS_LC[(seqLC*7+k) % NOMS_LC.length], prenom:PRE_LC[(seqLC*5+k*3) % PRE_LC.length],
        sexe:(seqLC + k) % 2 === 0 ? 'F' : 'M', classeId:clId, anneeId:'an26',
        tuteur:'M. ' + NOMS_LC[(seqLC*3) % NOMS_LC.length], tel:'6' + String(90000000 + seqLC*137),
        statut:'actif', regime:seqLC % 3 === 0 ? 'interne' : 'externe', statutEleve: seqLC % 4 === 0 ? 'ancien' : 'nouveau' };
      LC.eleves.push(el);
      const nPaie = 1 + (seqLC % 3);
      for (let j = 0; j < nPaie; j++){
        const fr = j === 0 ? 'fr-inscr' : (j === 1 ? 'fr-scol' : 'fr-tenue');
        LC.paiements.push({ id:'plc-' + seqLC + '-' + j, numero:'REC-26-' + String(seqLC*10 + j).padStart(4,'0'),
          anneeId:'an26', eleveId:el.id, fraisId:fr,
          montant: fr === 'fr-inscr' ? 15000 : (fr === 'fr-scol' ? 45000 : 12000),
          mode:'especes', reference:'', date:'2026-09-' + String(5 + (seqLC % 20)).padStart(2,'0') + 'T09:30',
          userId:'us-lyc', statut:'valide', note:'', motifAnnulation:'' });
      }
    }
  });
  LC.journal.push(
    { id:'jl1', date:'2026-09-04T08:20', user:'admin-lycee', action:'configuration', details:'Création de l\u2019établissement et de l\u2019année scolaire 2026-2027' },
    { id:'jl2', date:'2026-09-08T10:12', user:'admin-lycee', action:'paiement', details:'Premiers encaissements de la rentrée' }
  );

  /* v3.0 — Pédagogie : matières du collège */
  /* v4 — groupes de matières (code + libellé) */
  const GROUPES = [
    ['g1','LNG','Langues et littérature'],
    ['g2','LEV','Langues étrangères'],
    ['g3','SCI','Sciences exactes et naturelles'],
    ['g4','SHU','Sciences humaines et sociales'],
    ['g5','TEC','Sciences et techniques industrielles'],
    ['g6','ECO','Économie, gestion et services'],
    ['g7','ART','Arts et éducation physique']
  ];
  baseBonneau.groupes = GROUPES.map(g => ({ id:g[0], code:g[1], libelle:g[2] }));
  /* v4 — catalogue de 43 matières (général + technique), code + libellé + groupe.
     m1-m6 conservent leur id (notes de démonstration existantes). */
  const MATS = [
    ['m1','MATH','Mathématiques'],['m2','FRAN','Français'],['m3','ANGL','Anglais'],
    ['m4','HGEO','Histoire-Géographie'],['m5','SVT','Sciences de la Vie et de la Terre'],
    ['m6','EPS','Éducation Physique et Sportive'],
    ['m7','LITT','Littérature'],['m8','LATI','Latin'],
    ['m9','ALLE','Allemand'],['m10','ESPA','Espagnol'],['m11','ARAB','Arabe'],
    ['m12','LANA','Langues nationales'],['m13','ITAL','Italien'],
    ['m14','PC','Sciences Physiques (Physique-Chimie)'],['m15','BIO','Biologie'],
    ['m16','HIST','Histoire'],['m17','GEOG','Géographie'],
    ['m18','ECM','Éducation à la Citoyenneté et à la Morale'],['m19','PHIL','Philosophie'],
    ['m20','PSYC','Psychologie'],
    ['m21','INFO','Informatique'],['m22','TECH','Technologie'],['m23','ELEC','Électricité'],
    ['m24','ELET','Électronique'],['m25','MECA','Mécanique'],['m26','AUTO','Technologie Automobile'],
    ['m27','DESS','Dessin Technique (DAO)'],['m28','BTP','Bâtiment et Travaux Publics'],
    ['m29','TOPG','Topographie'],['m30','FROID','Froid et Climatisation'],
    ['m31','COMPT','Comptabilité'],['m32','ECON','Économie'],['m33','STAT','Statistiques'],
    ['m34','GEST','Gestion des Entreprises'],['m35','DROI','Droit'],['m36','BURE','Bureautique'],
    ['m37','COMM','Communication et Secrétariat'],['m38','MARK','Marketing et Action Commerciale'],
    ['m39','SECR','Secrétariat de Direction'],['m40','HOT','Hôtellerie et Tourisme'],
    ['m41','MUSI','Éducation Musicale'],['m42','ARTP','Arts Plastiques'],
    ['m43','THEA','Théâtre et Expression Dramatique']
  ];
  /* v4.1 : une matière n'a NI groupe NI coefficient — ils sont attribués
     par classe dans le plan des enseignements. */
  baseBonneau.matieres = MATS.map(m => ({ id:m[0], code:m[1], libelle:m[2] }));
  /* Notes de démonstration (v5.4 : UNE SEULE note par élève, matière et
     séquence) : séquences 1 à 4, classes c1-c4, les 3 premières matières.
     Le 8ème élève (ix 7) n'a aucune note en m1/m2 : avec m1+m2 définies
     comme matières indispensables, il est « non classé » (démo du NC). */
  baseBonneau.notes = [];
  const elevesActifs = baseBonneau.eleves.filter(e => e.anneeId === 'an26' && e.statut !== 'radie' && ['cl6a','cl6b','cl5a','cl5b'].includes(e.classeId));
  elevesActifs.slice(0, 40).forEach((e, ix) => {
    [1, 2, 3, 4].forEach(sq => {
      ['m1','m2','m3'].forEach((mid, mi) => {
        if (ix === 7){ if (mid !== 'm3') return; }   /* élève de démo : aucune note dans m1/m2 (NC) */
        else if ((ix + mi) % 5 === 4) return;         /* quelques absences de saisie */
        baseBonneau.notes.push({ id:'nt' + sq + mid + e.id, anneeId:'an26', eleveId:e.id, classeId:e.classeId,
          matiereId:mid, sequence:sq, type:'evaluation',
          valeur: Math.round((7 + R()*12) * 2) / 2, date:'2026-' + ['09','10','11','12'][sq - 1] + '-18T09:00', auteurId:'us-ens' });
      });
    });
  });
  /* Discipline de démonstration : faits variés sur l'année */
  const FAITS = [
    ['cl6a','retard',1,'Retards répétés le matin (3 fois cette semaine)','Rappel à l\u2019ordre'],
    ['cl6b','absence',2,'Absences non justifiées aux cours de l\u2019après-midi','Convocation des parents', false, 3],
    ['cl5a','indiscipline',3,'Insolence envers un enseignant','Exclusion de 2 jours'],
    ['cl6a','tenue',1,'Tenue non conforme (sans badge)','Avertissement oral'],
    ['cl5b','travail',2,'Devoirs non rendus à plusieurs reprises','Retenue de 2 h'],
    ['cl6b','indiscipline',2,'Bavardages persistants en classe','Devoir supplémentaire'],
    ['cl5a','retard',1,'Retard de 20 min au cours de mathématiques','Retard rattrapé'],
    ['cl5b','absence',1,'Absence justifiée (certificat médical)','—', true, 2],
    ['cl6a','autre',2,'Utilisation du téléphone en classe','Confiscation jusqu\u2019à la fin de la journée'],
    ['cl6b','indiscipline',3,'Bagarre à la récréation','Exclusion de 3 jours + convocation des parents']
  ];
  /* v5.5 — absences de démonstration par classe et période (cl6a) :
     [classe, index élève, date, duree, justifiee, motif] — réparties T1/T2/T3 */
  const ABS = [
    ['cl6a', 0, '2025-09-22', 2, false, 'Absence non motivée'],
    ['cl6a', 0, '2025-11-05', 1, true, 'Consultation médicale'],
    ['cl6a', 2, '2025-10-13', 4, false, 'Absences non justifiées (2 jours)'],
    ['cl6a', 3, '2025-12-01', 2, false, 'Absence non signalée par la famille'],
    ['cl6a', 5, '2026-01-19', 3, false, 'Séjour familial non autorisé'],
    ['cl6a', 5, '2026-02-09', 2, true, 'Certificat médical'],
    ['cl6a', 8, '2026-03-02', 6, false, 'Absences répétées non justifiées'],
    ['cl6a', 10, '2026-05-11', 2, false, 'Absence non justifiée'],
    ['cl6a', 11, '2026-06-01', 1, true, 'Convocation officielle']
  ];
  baseBonneau.discipline = FAITS.map((f, i) => {
    const els = baseBonneau.eleves.filter(e => e.anneeId === 'an26' && e.classeId === f[0] && e.statut !== 'radie');
    const el = els.length ? els[Math.floor(R() * els.length)] : null;
    return { id:'fa' + (i + 1), anneeId:'an26', eleveId:el ? el.id : 'x', classeId:f[0],
      date:'2026-' + (['09','10','11','12','01','02'][i % 6]) + '-' + String(3 + (i * 2) % 24).padStart(2,'0'),
      categorie:f[1], gravite:f[2], description:f[3], sanction:f[4], justifie:f[1] === 'absence' ? !!f[5] : false,
      ...(f[1] === 'absence' && f[6] ? { duree:f[6] } : {}),
      rapporteurId:'us-surv', creeLe:'2026-09-15T09:00' };
  }).filter(f => f.eleveId !== 'x');
  ABS.forEach((a, i) => {
    const els = baseBonneau.eleves.filter(e => e.anneeId === 'an26' && e.classeId === a[0] && e.statut !== 'radie');
    const el = els.length ? els[a[1] % els.length] : null;
    if (!el) return;
    baseBonneau.discipline.push({ id:'abs' + (i + 1), anneeId:'an26', eleveId:el.id, classeId:a[0],
      date:a[2], categorie:'absence', gravite:a[4] ? 1 : 2, description:a[5], sanction:'', justifie:a[4], duree:a[3] });
  });

  /* v4 — enseignants de l'établissement (modèle proche des élèves) */
  const ENSEIGNANTS = [
    ['ens-01','ENS-001','MBALLA','Geneviève','F','1979-03-12','Yaoundé','699 12 34 56','g.mballa@bonneau.cm','Nlongkak','Français / Littérature','Master LET modernes','A1','2005-09-01'],
    ['ens-02','ENS-002','ONDOA','Pierre','M','1974-11-02','Mbalmayo','677 45 23 10','p.ondoa@bonneau.cm','Etoudi','Histoire-Géographie / ECM','Licence Histoire','A2','2003-09-15'],
    ['ens-03','ENS-003','ATANGANA','Robert','M','1986-06-24','Obala','690 88 77 12','r.atangana@bonneau.cm','Mvog-Ada','Mathématiques','Master Mathématiques','B1','2012-09-01'],
    ['ens-04','ENS-004','NGONO','Marie-Claire','F','1983-01-18','Sangmélima','695 33 21 09','m.ngono@bonneau.cm','Biyem-Assi','Sciences de la Vie et de la Terre','Master Biologie','A1','2008-09-01'],
    ['ens-05','ENS-005','FOTSO','Hermine','F','1990-09-05','Bafoussam','691 55 44 33','h.fotso@bonneau.cm','Odza','Anglais','Master Anglais','B2','2016-09-01'],
    ['ens-06','ENS-006','TCHOUAMENI','Jean','M','1980-04-29','Douala','678 12 90 87','j.tchouameni@bonneau.cm','Nsam','Sciences Physiques','Master Physique','A2','2006-09-01'],
    ['ens-07','ENS-007','KAMGA','Blaise','M','1988-12-11','Bandjoun','694 76 65 54','b.kamga@bonneau.cm','Mokolo','Informatique','Ingénieur Systèmes','B1','2018-09-01'],
    ['ens-08','ENS-008','AWONO','Sylvie','F','1992-07-22','Kribi','697 09 18 27','s.awono@bonneau.cm','Bastos','Éducation Musicale / Arts','Licence Arts','B2','2020-09-01'],
    ['ens-09','ENS-009','EBODE','Athanase','M','1977-02-14','Ébolowa','675 34 56 78','a.ebode@bonneau.cm','Melen','Éducation Physique et Sportive','STAPS','A2','2001-09-01'],
    ['ens-10','ENS-010','TAMO','Nadège','F','1991-05-03','Garoua','698 67 89 01','n.tamo@bonneau.cm','Nkolbisson','Comptabilité / Gestion','DCG','B1','2019-09-01'],
    ['ens-11','ENS-011','MEKONGO','Éric','M','1985-08-09','Yaoundé','676 23 45 67','e.mekongo@bonneau.cm','Damas','Économie / Statistiques','Master Économie','A1','2010-09-01'],
    ['ens-12','ENS-012','BILOA','Chantal','F','1994-10-27','Buea','693 90 12 34','c.biloa@bonneau.cm','Ekounou','Droit / Communication','Master Droit','B2','2021-09-01']
  ];
  baseBonneau.enseignants = ENSEIGNANTS.map(t => ({
    id:t[0], matricule:t[1], nom:t[2], prenom:t[3], sexe:t[4], dateNaissance:t[5], lieuNaissance:t[6],
    telephone:t[7], email:t[8], quartier:t[9], specialite:t[10], diplome:t[11], grade:t[12],
    dateEmbauche:t[13], statut:'actif'
  }));

  /* v4.1 — plan des enseignements : [classe, ordre, matière, enseignant, coefficient, groupe] */
  const PLANS = [
    ['cl6a',1,'m2','ens-01',4,'g1'],['cl6a',2,'m1','ens-03',4,'g3'],['cl6a',3,'m3','ens-05',2,'g2'],
    ['cl6a',4,'m4','ens-02',2,'g4'],['cl6a',5,'m5','ens-04',2,'g3'],['cl6a',6,'m18','ens-02',1,'g4'],
    ['cl6a',7,'m21','ens-07',2,'g5'],['cl6a',8,'m41','ens-08',1,'g7'],['cl6a',9,'m42','ens-08',1,'g7'],['cl6a',10,'m6','ens-09',1,'g7'],
    ['cl6b',1,'m2','ens-01',4,'g1'],['cl6b',2,'m1','ens-03',4,'g3'],['cl6b',3,'m3','ens-05',2,'g2'],
    ['cl6b',4,'m4','ens-02',2,'g4'],['cl6b',5,'m5','ens-04',2,'g3'],['cl6b',6,'m18','ens-02',1,'g4'],
    ['cl6b',7,'m21','ens-07',2,'g5'],['cl6b',8,'m42','ens-08',1,'g7'],['cl6b',9,'m6','ens-09',1,'g7'],
    ['cl5a',1,'m2','ens-01',4,'g1'],['cl5a',2,'m1','ens-03',4,'g3'],['cl5a',3,'m3','ens-05',2,'g2'],
    ['cl5a',4,'m4','ens-02',2,'g4'],['cl5a',5,'m5','ens-04',2,'g3'],['cl5a',6,'m14','ens-06',2,'g3'],
    ['cl5a',7,'m21','ens-07',2,'g5'],['cl5a',8,'m16','ens-02',1,'g4'],['cl5a',9,'m6','ens-09',1,'g7'],
    ['cl5b',1,'m2','ens-01',4,'g1'],['cl5b',2,'m1','ens-03',4,'g3'],['cl5b',3,'m3','ens-05',2,'g2'],
    ['cl5b',4,'m4','ens-02',2,'g4'],['cl5b',5,'m5','ens-04',2,'g3'],['cl5b',6,'m14','ens-03',2,'g3'],
    ['cl5b',7,'m21','ens-07',2,'g5'],['cl5b',8,'m6','ens-09',1,'g7']
  ];
  baseBonneau.plan = PLANS.map((e, i) => ({ id:'pe' + (i + 1), classeId:e[0], ordre:e[1], matiereId:e[2], enseignantId:e[3], coefficient:e[4], groupeId:e[5] }));

  /* v5 — séquences (trimestre + poids) et appréciations (fourchettes) */
  baseBonneau.sequences = defaultSequences();
  baseBonneau.appreciations = defaultAppreciations();
  /* v6.0 : échelles APC et appréciations des moyennes */
  baseBonneau.appreciationsApc = defaultAppreciationsApc();
  baseBonneau.appreciationsMoyenne = defaultAppreciationsMoyenne();
  baseBonneau.appreciationsMoyenneApc = defaultAppreciationsApc();
  LC.sequences = defaultSequences();
  LC.appreciations = defaultAppreciations();
  LC.appreciationsApc = defaultAppreciationsApc();
  LC.appreciationsMoyenne = defaultAppreciationsMoyenne();
  LC.appreciationsMoyenneApc = defaultAppreciationsApc();

  baseBonneau.id = 'etab-001';
  LC.id = 'etab-002';
  DB.etablissements = [etabBonneau, etabClassique];
  LC.groupes = GROUPES.map(g => ({ id:g[0], code:g[1], libelle:g[2] }));
  LC.matieres = [ { id:'lm1', code:'MATH', libelle:'Mathématiques' },
    { id:'lm2', code:'FRAN', libelle:'Français' },
    { id:'lm3', code:'PHIL', libelle:'Philosophie' } ];
  LC.enseignants = [
    { id:'le1', matricule:'LYC-001', nom:'ONDUA', prenom:'Théophile', sexe:'M', dateNaissance:'1975-04-02', lieuNaissance:'Mbalmayo',
      telephone:'677 11 22 33', email:'t.ondua@lycee.cm', quartier:'Centre', specialite:'Philosophie', diplome:'Master Philosophie',
      grade:'A1', dateEmbauche:'2004-09-01', statut:'actif' },
    { id:'le2', matricule:'LYC-002', nom:'MEKUI', prenom:'Delphine', sexe:'F', dateNaissance:'1987-08-15', lieuNaissance:'Yaoundé',
      telephone:'690 44 55 66', email:'d.mekui@lycee.cm', quartier:'Quartier Haut', specialite:'Mathématiques', diplome:'Master Mathématiques',
      grade:'B1', dateEmbauche:'2013-09-01', statut:'actif' } ];
  LC.plan = (LC.classes || []).slice(0, 1).flatMap((c, ci) => [
    { id:'lp' + ci + '1', classeId:c.id, ordre:1, matiereId:'lm2', enseignantId:'le1', coefficient:4, groupeId:'g1' },
    { id:'lp' + ci + '2', classeId:c.id, ordre:2, matiereId:'lm1', enseignantId:'le2', coefficient:4, groupeId:'g3' },
    { id:'lp' + ci + '3', classeId:c.id, ordre:3, matiereId:'lm3', enseignantId:'le1', coefficient:3, groupeId:'g4' } ]);
  LC.notes = [];
  LC.discipline = [];
  DB.bases = [baseBonneau, LC];
  /* les collections vivent désormais dans les bases — rien à la racine */
  ['annees','niveaux','classes','frais','tarifs','eleves','paiements','bourses','anciens','journal','settings','matieres','notes','discipline'].forEach(c => { delete DB[c]; });

  /* comptes rattachés au second établissement + superadministrateur */
  const usLyc = mkUser('us-lyc','admin-lycee','lycee2026','M. Célestin Onana','admin');
  usLyc.etablissementId = 'etab-002';
  const sup = mkUser('us-super','superadmin','super2026','Super Administrateur SIGES','superadmin');
  sup.etablissementId = null;
  /* v3.0 — profils de l'établissement (démo) : censeur (cycle collège),
     surveillant général, surveillant de secteur, titulaire, enseignant, opérateur */
  const uCens  = mkUser('us-cens','censeur','censeur2026','Mme Odile Ngo Bell','censeur', { niveauxIds:['nv6','nv5','nv4','nv3'] });
  const uSurv  = mkUser('us-surv','surveillant','surveillant2026','M. Jean-Bosco Etoga','surveillant');
  const uSec   = mkUser('us-sec','surv-secteur','secteur2026','Mme Brigitte Koum','surveillant_secteur', { classesIds:['cl4a','cl4b','cl3a'] });
  const uTit   = mkUser('us-tit','titulaire','titulaire2026','M. Achille Tankeu','titulaire', { classesIds:['cl6a'] });
  const uEns   = mkUser('us-ens','enseignant','enseignant2026','M. Robert Atangana','enseignant', { matieresIds:['m1','m3'], enseignantId:'ens-03' });
  const uOpe   = mkUser('us-ope','operateur','operateur2026','Mme Sandrine Abena','operateur');
  [uCens, uSurv, uSec, uTit, uEns, uOpe].forEach(u => { u.etablissementId = 'etab-001'; });
  DB.users.push(usLyc, sup, uCens, uSurv, uSec, uTit, uEns, uOpe);

  /* journal global (connexions, actions d'administration générale) */
  DB.journalGlobal = [
    { id:'jg1', date:'2026-09-01T08:00', user:'superadmin', action:'configuration', details:'Initialisation de la plateforme Aurel School SIGES — 2 établissements' }
  ];

  DB.version = 1;
  DB.seedV = SEED_VERSION;
  return DB;
}
