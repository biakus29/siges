/* ============================================================
   Test du noyau métier (sans navigateur) — business.js + seed.js
   Exécution : node tests/core.test.mjs
   ============================================================ */
import { buildSeed } from '../src/core/seed.js';
import {
  situationRows, situationTotals, solvabiliteEleve, nextReceipt, tarifEffectif,
  boursesOfEleve, reductionFor, elevesOfYear, verifyLogin, settingsOf,
  classesOf, niveauxSorted, tranchesOfFrais,
  scopeClassesIds, scopeMatieresIds, canClasse, moyenneMatiere, moyenneGenerale,
  faitsDe, DISCIPLINE_CATS,
  trimestreOfDate, absencesDe, sanctionAbsencesFor, sanctionsAbsOf, defaultSanctionsAbs,
  bulletinQrData, verifieQrTexte, bulletinOf, censeursOf, scanNotesManquantes, scanNotesManquantesAnnee,
  ensureBase, emptyBase, devoirsDe, devoirsValides, devoirsDetail, noteSequentielle, aDevoirs,
  mergeDb,
} from '../src/core/business.js';
import { TYPES_DOCS, catalogueChamps, defaultModele, normalizeModele, modeleVersJson, modeleDepuisJson,
  interpoler, resolveChamp, varsTheme, pageOf, appliquerTheme, newBloc, PRESETS_THEME, THEME_DEFAUT } from '../src/core/modeles.js';
import { qrEncode } from '../src/core/qrcode.js';

let fails = 0;
const ok = (cond, label) => { console.log((cond ? '✓' : '✗'), label); if (!cond) fails++; };

const root = buildSeed();
const db = root.bases.find(b => b.id === 'etab-001');   /* base du Collège Bonneau */
const dbLyc = root.bases.find(b => b.id === 'etab-002'); /* base du Lycée Classique de Mbalmayo */
const maintenant = new Date();
const aujourdhui = maintenant.toISOString().slice(0, 10);
const maintenantHM = maintenant.toISOString().slice(0, 16);

ok(db.annees.length === 3 && db.annees.filter(a => a.statut === 'ouverte').length === 1, 'années : 3 dont 1 ouverte');
ok(root.users.length >= 6, 'comptes utilisateurs présents (' + root.users.length + ')');
ok(root.etablissements.length === 2 && root.bases.length === 2, 'multi-établissements : ' + root.etablissements.length + ' établissements, bases ' + root.bases.map(b => b.id).join(' + '));
ok(verifyLogin(root, 'superadmin', 'super2026').ok === true, 'superadministrateur : superadmin/super2026');
ok(verifyLogin(root, 'admin-lycee', 'lycee2026').ok === true, 'compte du second établissement : admin-lycee/lycee2026');
ok(dbLyc.eleves.length === 24 && dbLyc.classes.length === 3, 'second établissement : ' + dbLyc.eleves.length + ' élèves, ' + dbLyc.classes.length + ' classes');
ok(root.users.filter(u => u.role !== 'superadmin').every(u => u.etablissementId), 'comptes rattachés à un établissement');
ok(db.eleves.length > 150 && db.classes.length === 17, 'démo : ' + db.eleves.length + ' élèves, ' + db.classes.length + ' classes');
ok(verifyLogin(root, 'admin', 'admin2026').ok === true && verifyLogin(root, 'admin', 'mauvais').ok === false, 'verifyLogin : bon/mauvais mot de passe');
ok(db.paiements.every(p => p.date.slice(0, 10) !== aujourdhui || p.date.slice(0, 16) <= maintenantHM), 'aucun paiement du jour à heure future (seedV 7)');
ok(db.paiements.every(p => /^REC-\d\d-\d+$/.test(p.numero)), 'tous les numéros de reçus au format REC-YY-N');

/* Numérotation des reçus consécutive */
const r1 = nextReceipt(db, 'an26');
db.paiements.push({ id:'t1', numero:r1, anneeId:'an26', eleveId:'x', fraisId:'y', montant:1000, mode:'caisse', date:aujourdhui + 'T10:00', encaissePar:'admin' });
const r2 = nextReceipt(db, 'an26');
ok(parseInt(r2.slice(-4), 10) === parseInt(r1.slice(-4), 10) + 1, 'nextReceipt consécutif (' + r1 + ' → ' + r2 + ')');

/* Bourses : réduction active et net répercuté */
const bActive = db.bourses.find(b => b.actif !== false);
const elB = db.eleves.find(e => e.id === bActive.eleveId);
ok(reductionFor(db, elB, null, undefined) !== 0 || boursesOfEleve(db, elB).length > 0, 'bourse active détectée pour ' + elB.matricule);
const rows = situationRows(db, elB);
const tot = situationTotals(db, elB);
ok(rows.length > 0 && tot.net > 0 && tot.solde >= 0 && typeof tot.aJour === 'boolean', 'situation : ' + rows.length + ' lignes, net = ' + tot.net + ' FCFA, solde = ' + tot.solde);

/* Solvabilité : 3 périmètres définis */
const sol = solvabiliteEleve(db, elB);
ok(sol && typeof sol === 'object', 'solvabiliteEleve calculé');

/* Tarifs : cascade classe → niveau, régime interne/externe */
const cl = db.classes.find(c => c.id === 'cl6a');
let tarifsOK = true;
db.frais.forEach(f => {
  const ti = tarifEffectif(db, 'an26', f.id, cl.id, 'interne');
  const te = tarifEffectif(db, 'an26', f.id, cl.id, 'externe');
  if (ti !== null && typeof ti !== 'number') tarifsOK = false;
  if (te !== null && typeof te !== 'number') tarifsOK = false;
});
ok(tarifsOK && tarifEffectif(db, 'an26', db.frais[0].id, 'cl6a', 'externe') !== null, 'tarifEffectif : cascade classe → niveau, régimes valide (null autorisé si non applicable)');

/* Tranches par type de frais */
ok(db.frais.every(f => (tranchesOfFrais(db, f.id) || []).length > 0), 'tranches définies pour chaque type de frais');

/* Personnalisation */
ok(settingsOf(db).nomEtablissement === 'COLLÈGE BONNEAU', 'settingsOf : ' + settingsOf(db).nomEtablissement);
ok(elevesOfYear(db, 'an26').length > 0 && niveauxSorted(db).length === 7 && classesOf(db, 'nv6').length === 2, 'helpers : ' + elevesOfYear(db, 'an26').length + ' élèves an26, ' + niveauxSorted(db).length + ' niveaux');


/* ============== v3.0 : profils, périmètres, pédagogie, discipline ============== */
ok(Array.isArray(db.matieres) && db.matieres.length >= 40, 'seed v4 : catalogue de ' + db.matieres.length + ' matières (>= 40)');
ok(db.notes.length >= 200, 'seed : notes de démonstration (' + db.notes.length + ')');
ok(db.discipline.length === 19, 'seed : 19 faits de discipline (10 faits variés + 9 absences v5.5)');
const censeur = root.users.find(u => u.username === 'censeur');
const secteur = root.users.find(u => u.username === 'surv-secteur');
const titulaire = root.users.find(u => u.username === 'titulaire');
const enseignant = root.users.find(u => u.username === 'enseignant');
const scC = scopeClassesIds(db, censeur);
ok(scC && scC.every(id => ['nv6','nv5','nv4','nv3'].includes(db.classes.find(c => c.id === id).niveauId)), 'censeur : classes de son cycle uniquement');
ok(scopeClassesIds(db, { role:'admin' }) === null, 'admin : tout l\u2019établissement');
ok(JSON.stringify(scopeClassesIds(db, secteur)) === JSON.stringify(['cl4a','cl4b','cl3a']), 'secteur : classes attribuées');
ok(canClasse(db, titulaire, 'cl6a') && !canClasse(db, titulaire, 'cl5a'), 'titulaire : sa classe seulement');
ok(JSON.stringify(scopeMatieresIds(db, enseignant)) === JSON.stringify(['m1','m14']), 'enseignant : ses matières (issues du plan : maths + physique-chimie)');
ok(scopeMatieresIds(db, censeur) === null, 'censeur : toutes les matières');
const el0 = db.eleves.find(e => db.notes.some(n => n.eleveId === e.id));
const mm = moyenneMatiere(db, 'an26', el0.id, 'm1');
ok(mm != null && mm >= 0 && mm <= 20, 'moyenne matière dans [0,20] : ' + mm);
ok(moyenneGenerale(db, 'an26', el0.id) != null, 'moyenne générale calculée');
ok(faitsDe(db, 'an26', db.discipline[0].eleveId).length >= 1, 'faitsDe par élève');
ok(Object.keys(DISCIPLINE_CATS).length === 6, '6 catégories de discipline');
ok(verifyLogin(root, 'censeur', 'censeur2026').ok && verifyLogin(root, 'enseignant', 'enseignant2026').ok
  && verifyLogin(root, 'surveillant', 'surveillant2026').ok && verifyLogin(root, 'titulaire', 'titulaire2026').ok
  && verifyLogin(root, 'operateur', 'operateur2026').ok && verifyLogin(root, 'surv-secteur', 'secteur2026').ok, 'connexion des 6 nouveaux profils');

/* ============== v4.0 : groupes, enseignants, plan des enseignements ============== */
import { planOf, coefOf } from '../src/core/business.js';
ok(db.groupes.length === 7 && db.groupes.every(g => g.code && g.libelle), 'seed v4 : 7 groupes (code + libellé)');
ok(db.matieres.every(m => m.code && m.libelle && !('groupeId' in m) && !('coefficient' in m)),
  'v4.1 : les matières n\u2019ont NI groupe NI coefficient (définis dans les plans)');
ok(db.enseignants.length === 12 && db.enseignants.every(t => t.nom && t.prenom && t.specialite !== undefined), 'seed v4 : 12 fiches enseignants');
ok(db.plan.length === 36 && db.plan.every(e => e.classeId && e.matiereId && e.coefficient > 0 && e.ordre >= 1
  && e.groupeId && db.groupes.some(g => g.id === e.groupeId)), 'seed v4.1 : 36 enseignements (classe × matière × coef × ordre × groupe)');
const plan6a = planOf(db, 'cl6a');
ok(plan6a.length === 10 && plan6a.every((e, i) => e.ordre === i + 1), 'plan de la 6ème A : 10 matières ordonnées');
ok(coefOf(db, 'cl6a', 'm1') === 4 && coefOf(db, 'cl5a', 'm3') === 2, 'coefOf lit le plan (m1→4, m3 en 5ème A→2)');
ok(coefOf(db, 'cl4a', 'm1') === 1, 'coefOf retombe sur 1 hors plan (plus de coefficient matière)');
ok(db.plan.filter(p => p.enseignantId === 'ens-03').length >= 4, 'plan : Robert Atangana enseigne partout (>= 4)');
ok(new Set(planOf(db, 'cl6a').map(e => e.groupeId)).size === 6, 'plan 6ème A : 6 groupes distincts représentés');
ok(db.plan.some(p => p.matiereId === 'm1' && p.enseignantId === 'ens-03'), 'plan : Atangana enseigne les maths');
const scopeEns = scopeClassesIds(db, enseignant);
ok(JSON.stringify(scopeEns) === JSON.stringify(['cl6a','cl6b','cl5a','cl5b']), 'scope enseignant issu du plan : 4 classes');
ok(enseignant.enseignantId === 'ens-03', 'compte enseignant lié à sa fiche');

/* ============== v5.0 : séquences, appréciations, périodes, statistiques ============== */
import { defaultSequences, defaultAppreciations, sequencesSorted, sequencesOfTrimestre,
  appreciationOf, statsNotes } from '../src/core/business.js';
ok(db.sequences.length === 6 && db.appreciations.length === 6, 'seed v11 : 6 séquences + 6 appréciations dans la base');
ok(JSON.stringify(defaultSequences().map(s => s.trimestre + ':' + s.poids)) === JSON.stringify(['1:40','1:60','2:40','2:60','3:40','3:60']),
  'séquences par défaut : 3 trimestres × (40 % + 60 %)');
const seqT = sequencesSorted(db).map(sq => parseInt(sq.trimestre, 10));
ok(sequencesSorted(db).map(sq => sq.id).join('') === '123456' && seqT.every((t, i) => i === 0 || t >= seqT[i - 1]), 'tri des séquences (id et trimestres croissants)');
ok(sequencesOfTrimestre(db, 1).length === 2 && sequencesOfTrimestre(db, 3).map(s => s.id).join('') === '56', 'séquencesOfTrimestre : T1 = 2, T3 = seq 5-6');
ok(appreciationOf(db, 0) === 'Insuffisant' && appreciationOf(db, 9.99) === 'Insuffisant' && appreciationOf(db, 10) === 'Passable'
  && appreciationOf(db, 13.99) === 'Assez bien' && appreciationOf(db, 14) === 'Bien' && appreciationOf(db, 17.99) === 'Très bien'
  && appreciationOf(db, 20) === 'Excellent' && appreciationOf(db, 21) === null,
  'appreciationOf : fourchettes min inclus / max exclue, hors bornes = null');
/* moyennes : élève de 6ème A, notes seed sur les séquences 1 et 2 */
const el6a = db.eleves.find(e => e.classeId === 'cl6a' && db.notes.some(n => n.eleveId === e.id && n.matiereId === 'm2' && String(n.sequence) === '1'));
const notesEl = db.notes.filter(n => n.eleveId === el6a.id && n.matiereId === 'm2');
const mT1 = moyenneMatiere(db, 'an26', el6a.id, 'm2', 'T1');
const mSeq1 = moyenneMatiere(db, 'an26', el6a.id, 'm2', '1');
const mAn = moyenneMatiere(db, 'an26', el6a.id, 'm2', null);
ok(typeof mT1 === 'number' && mT1 >= 0 && mT1 <= 20, 'moyenneMatiere(T1) numérique /20');
const s1 = sequencesOfTrimestre(db, 1).find(s => s.id === '1'), s2 = sequencesOfTrimestre(db, 1).find(s => s.id === '2');
const m1s = moyenneMatiere(db, 'an26', el6a.id, 'm2', '1'), m2s = moyenneMatiere(db, 'an26', el6a.id, 'm2', '2');
const attenduT1 = Math.round((m1s * s1.poids + m2s * s2.poids) / (s1.poids + s2.poids) * 100) / 100;
ok(mT1 === attenduT1, 'moyenne T1 = pondération 40/60 des séquences (' + mT1 + ' = ' + attenduT1 + ')');
ok(mSeq1 === m1s, 'moyenneMatiere(id séquence) = moyenne de cette séquence');
ok(mAn === Math.round(notesEl.reduce((t, n) => t + n.valeur * (n.type === 'composition' ? 2 : 1), 0)
  / notesEl.reduce((t, n) => t + (n.type === 'composition' ? 2 : 1), 0) * 100) / 100, 'moyenneMatiere(année) = toutes notes, composition ×2');
ok(moyenneMatiere(db, 'an26', el6a.id, 'm9') === null, 'moyenneMatiere hors plan = null');
const gen = moyenneGenerale(db, 'an26', el6a.id, 'T1');
ok(gen === null || (gen >= 0 && gen <= 20), 'moyenneGenerale(T1) cohérente');
const st = statsNotes(db, [8, 12, 16, 16.5]);
ok(st.n === 4 && st.moy === 13.13 && st.min === 8 && st.max === 16.5 && st.ge10 === 3 && st.pct === 75
  && st.repartition.length === 6 && st.repartition.find(r => r.libelle === 'Insuffisant').n === 1
  && st.repartition.find(r => r.libelle === 'Bien').n === 0 && st.repartition.find(r => r.libelle === 'Très bien').n === 2,
  'statsNotes : n, moyenne, min/max, ≥10, répartition');
ok(statsNotes(db, []).moy === null, 'statsNotes vide : moyenne null sans division par zéro');

/* ============== v5.1 : console réseau (superadministrateur) ============== */
import { networkStats, mergedJournal } from '../src/core/business.js';
const net = networkStats(root);
ok(net.rows.length === 2 && net.tot.etabs === 2 && net.tot.etabsActifs === 2, 'networkStats : 2 établissements actifs');
ok(net.rows[0].etab.id === 'etab-001' && net.rows[0].eleves > 0 && net.rows[0].annee === '2026-2027', 'stats Collège Bonneau non nulles (' + net.rows[0].eleves + ' élèves, ' + net.rows[0].comptes + ' comptes)');
ok(net.rows[0].comptes === 10 && net.rows[1].comptes === 1, 'comptes par établissement (10 + 1 + superadmin racine = 12)');
ok(net.tot.eleves === net.rows.reduce((t, r) => t + r.eleves, 0) && net.tot.encaisse === net.rows.reduce((t, r) => t + r.encaisse, 0), 'totaux réseau = somme des établissements');
ok(net.rows.every(r => r.recouvrement == null || (r.recouvrement >= 0 && r.recouvrement <= 100)), 'recouvrement borné 0–100');
ok(net.rows[0].notes === 380 && net.rows[1].notes === 0, 'notes par établissement (380 / 0 — une note unique par élève, matière et séquence)');
ok(net.rows[0].derniereAct != null, 'dernière activité lue dans le journal de l\u2019établissement');
root.etablissements[1].actif = false;
const net2 = networkStats(root);
ok(net2.tot.etabsActifs === 1 && net2.rows[1].actif === false, 'établissement suspendu repéré dans les stats réseau');
root.etablissements[1].actif = true;
const mj = mergedJournal(root, 500);
ok(mj.length >= 5 && mj.every(j => !!j.etabNom), 'journal fusionné : ' + mj.length + ' entrées, toutes avec établissement d\u2019origine');
ok(mj[0].date >= mj[mj.length - 1].date, 'journal fusionné trié du plus récent au plus ancien');
ok(mj.some(j => j.etabId === null && j.etabNom === 'Administration générale') && mj.some(j => j.etabId === 'etab-001') && mj.some(j => j.etabId === 'etab-002'),
  'fusion : journal global + journaux des 2 établissements');

/* ============== v5.2 : matières indispensables au classement ============== */
import { matieresObligatoires, matieresManquantes, classementClasse } from '../src/core/business.js';
const cl6a2 = db.classes.find(c => c.id === 'cl6a');
ok(matieresObligatoires(db, 'cl6a').length === 0, 'aucune matière indispensable par défaut');
cl6a2.matieresOblig = ['m1', 'm2'];
ok(matieresObligatoires(db, 'cl6a').length === 2 && matieresObligatoires(db, 'cl6a').map(m => m.id).join('') === 'm1m2',
  'matières indispensables lues depuis la classe (m1 + m2)');
const el6a2 = db.eleves.find(e => e.classeId === 'cl6a' && db.notes.some(n => n.eleveId === e.id && n.matiereId === 'm1' && String(n.sequence) === '1'));
const cls1 = classementClasse(db, 'an26', 'cl6a', '1');
ok(cls1.classes.length + cls1.nonClasses.size === db.eleves.filter(e => e.anneeId === 'an26' && e.classeId === 'cl6a' && e.statut !== 'radie').length,
  'classement : classés + non classés = effectif de la classe');
ok(cls1.classes.every((l, i) => i === 0 || cls1.classes[i - 1].moy >= l.moy), 'classés triés par moyenne décroissante');
ok([...cls1.rangs.values()].every((r, i) => r === i + 1), 'rangs consécutifs à partir de 1');
const elNC = db.eleves.find(e => e.classeId === 'cl6a' && cls1.nonClasses.has(e.id));
ok(!!elNC, 'au moins un élève non classé quand m1+m2 sont exigées (trous de saisie du seed)');
ok(matieresManquantes(db, 'an26', elNC.id, '1').length >= 1, 'matières manquantes expliquées pour le non classé');
ok(!cls1.rangs.has(elNC.id), 'règle NC : le non classé ne reçoit pas de rang');
const elC = db.eleves.find(e => e.classeId === 'cl6a' && cls1.rangs.has(e.id) && matieresManquantes(db, 'an26', e.id, '1').length === 0);
ok(!!elC && cls1.rangs.has(elC.id),
  'classé quand toutes les matières exigées sont notées');
/* v5.4 : le non-classement exige l'absence de TOUTES les notes indispensables */
const elPart = db.eleves.find(e => e.classeId === 'cl6a' && cls1.rangs.has(e.id) && matieresManquantes(db, 'an26', e.id, '1').length > 0);
ok(!!elPart && cls1.rangs.has(elPart.id),
  'v5.4 : classé même si une matière indispensable manque (une seule note suffit)');
ok(elNC && moyenneGenerale(db, 'an26', elNC.id, '1') != null,
  'v5.4 : le non classé a pourtant une moyenne (aucune note dans TOUT l\u2019ensemble des matières indispensables)');
delete cl6a2.matieresOblig;
const cls2 = classementClasse(db, 'an26', 'cl6a', '1');
ok(cls2.nonClasses.size === 0 || db.eleves.filter(e => e.anneeId === 'an26' && e.classeId === 'cl6a' && e.statut !== 'radie' && moyenneGenerale(db, 'an26', e.id, '1') == null).length === cls2.nonClasses.size,
  'sans matières exigées : non classés = élèves sans moyenne uniquement');

/* ============== v5.4 : calculs exacts — aucune erreur autorisée ============== */
import { moyenneGroupe, groupesDuPlan } from '../src/core/business.js';
/* Mini-base de contrôle : 5 élèves, 3 matières (coef 4/2/1, groupe SCI pour maths+physique),
   séquences S1-S3 (T1 = S1 40 % + S2 60 %, T2 = S3 100 %), notes choisies à la main. */
const X = (eleveId, matiereId, sequence, valeur) => ({ id:'z' + eleveId + matiereId + sequence, anneeId:'a1',
  eleveId, classeId:'c1', matiereId, sequence, type:'evaluation', valeur });
const tdb = {
  annees: [{ id:'a1', libelle:'2026-2027', active:true }],
  niveaux: [{ id:'nv1', libelle:'Test', cycle:'Test', ordre:1 }],
  classes: [{ id:'c1', libelle:'6ème T', niveauId:'nv1' }],
  matieres: [ { id:'x1', code:'MATH', libelle:'Maths' }, { id:'x2', code:'PHYS', libelle:'Physique' }, { id:'x3', code:'SPORT', libelle:'Sport' } ],
  groupes: [ { id:'gx', code:'SCI', libelle:'Sciences' } ],
  plan: [
    { id:'p1', classeId:'c1', ordre:1, matiereId:'x1', coefficient:4, groupeId:'gx', enseignantId:null },
    { id:'p2', classeId:'c1', ordre:2, matiereId:'x2', coefficient:2, groupeId:'gx', enseignantId:null },
    { id:'p3', classeId:'c1', ordre:3, matiereId:'x3', coefficient:1, groupeId:null, enseignantId:null }
  ],
  sequences: [ { id:'1', libelle:'Séquence 1', trimestre:1, poids:40 }, { id:'2', libelle:'Séquence 2', trimestre:1, poids:60 },
    { id:'3', libelle:'Séquence 3', trimestre:2, poids:100 } ],
  eleves: ['A','B','C','D','E'].map((n, i) => ({ id:'e' + (i + 1), anneeId:'a1', classeId:'c1', matricule:'T' + (i + 1),
    nom:n, prenom:'', statut:'actif', sexe:'F', dateNaissance:'2015-01-01', lieuNaissance:'X', regime:'externe', statutEleve:'nouveau' })),
  notes: [
    /* A */ X('e1','x1','1',12), X('e1','x2','1',10), X('e1','x3','1',8),
            X('e1','x1','2',14), X('e1','x2','2',16), X('e1','x3','2',20),
            X('e1','x1','3',11), X('e1','x2','3',9),  X('e1','x3','3',15),
    /* B */ X('e2','x1','1',16), X('e2','x2','1',18), X('e2','x3','1',12),
            X('e2','x1','2',10), X('e2','x2','2',8),  X('e2','x3','2',12),
            X('e2','x1','3',15), X('e2','x2','3',13), X('e2','x3','3',12),
    /* C */ X('e3','x1','1',6),  X('e3','x2','1',4),  X('e3','x3','1',2),
            /* aucune note en S2 */
            X('e3','x1','3',20), X('e3','x2','3',12), X('e3','x3','3',10),
    /* D : maths OUI (18), physique NON, sport 14 — une seule indispensable notée */
    X('e4','x1','1',18), X('e4','x3','1',14),
    /* E : sport uniquement (10) — aucune note indispensable */
    X('e5','x3','1',10)
  ],
  discipline: [], appreciations: []
};
ok(moyenneMatiere(tdb, 'a1', 'e1', 'x1', '1') === 12, 'note unique : moyenne de séquence = la note (12)');
ok(moyenneMatiere(tdb, 'a1', 'e1', 'x1', 'T1') === 13.2, 'trimestre pondéré : 12×40 % + 14×60 % = 13,2');
ok(moyenneMatiere(tdb, 'a1', 'e1', 'x1', 'T2') === 11, 'T2 = séquence 3 seule (poids 100 %) = 11');
ok(moyenneMatiere(tdb, 'a1', 'e1', 'x1', '') === 12.33, 'moyenne annuelle maths A = (12+14+11)/3 = 12,33');
ok(moyenneGenerale(tdb, 'a1', 'e1', '1') === 10.86, 'moyenne générale S1 A = (12×4+10×2+8×1)/7 = 10,86');
ok(moyenneGenerale(tdb, 'a1', 'e2', '1') === 16 && moyenneGenerale(tdb, 'a1', 'e3', '1') === 4.86,
  'moyennes générales S1 B = 16, C = 4,86');
ok(moyenneGenerale(tdb, 'a1', 'e2', '2') === 9.71, 'moyenne générale S2 B = (10×4+8×2+12×1)/7 = 9,71');
ok(moyenneGenerale(tdb, 'a1', 'e1', '') === 12.43, 'moyenne annuelle A = 12,43 (pondération coefs sur moyennes de matières)');

/* groupes et moyennes par groupe */
const gdp = groupesDuPlan(tdb, 'c1');
ok(gdp.length === 2 && gdp[0].id === 'gx' && gdp[0].grp && gdp[0].grp.code === 'SCI' && gdp[1].id === '_',
  'groupes du plan dans l\u2019ordre : SCI puis sans groupe');
const mg1 = moyenneGroupe(tdb, 'a1', 'e1', 'gx', '1');
ok(mg1 && mg1.points === 68 && mg1.coef === 6 && mg1.moy === 11.33, 'moyenne groupe SCI S1 A : 68 pts / 6 coef = 11,33');
const mg2 = moyenneGroupe(tdb, 'a1', 'e1', '_', '1');
ok(mg2 && mg2.moy === 8, 'moyenne du groupe « sans groupe » (sport) S1 A = 8');
const mgAnn = moyenneGroupe(tdb, 'a1', 'e1', 'gx', '');
ok(mgAnn && mgAnn.points === 72.66 && mgAnn.moy === 12.11, 'moyenne annuelle groupe SCI A : (12,33×4+11,67×2)/6 = 72,66 pts → 12,11');
/* invariant : Σ points des groupes / Σ coefs = moyenne générale */
const gxs = ['gx', '_'].map(g => moyenneGroupe(tdb, 'a1', 'e1', g, '1'));
const pts = gxs.reduce((t, g) => t + g.points, 0), cfs = gxs.reduce((t, g) => t + g.coef, 0);
ok(Math.round(pts / cfs * 100) / 100 === moyenneGenerale(tdb, 'a1', 'e1', '1'),
  'invariant : Σ points groupes / Σ coefs = moyenne générale (76/7 = 10,86)');
ok(moyenneGroupe(tdb, 'a1', 'e5', 'gx', '1') === null, 'aucune note dans le groupe → null');

/* classement + règle NC (v5.4) sur la mini-base */
tdb.classes[0].matieresOblig = ['x1', 'x2'];
const tc = classementClasse(tdb, 'a1', 'c1', '1');
ok(tc.classes.length === 4 && tc.nonClasses.size === 1 && tc.nonClasses.has('e5'),
  'NC = élève SANS AUCUNE note indispensable (E), malgré sa moyenne de 10');
ok(tc.classes.map(c => c.eleveId).join('') === 'e4e2e1e3', 'ordre S1 : D (17,2) > B (16) > A (10,86) > C (4,86)');
ok([...tc.rangs.entries()].every(([id, r]) => r === tc.classes.findIndex(c => c.eleveId === id) + 1) && tc.rangs.get('e4') === 1,
  'rangs consécutifs : D 1er, B 2e, A 3e, C 4e');
ok(tc.rangs.has('e4') && matieresManquantes(tdb, 'a1', 'e4', '1').map(m => m.id).join('') === 'x2',
  'D classé bien que la physique manque (maths notée) — matière manquante identifiée : PHYS');
const tc2 = classementClasse(tdb, 'a1', 'c1', '2');
ok(tc2.classes.length === 2 && tc2.nonClasses.has('e3') && tc2.rangs.get('e1') === 1 && tc2.rangs.get('e2') === 2,
  'S2 : A 1er (15,43) et B 2e (9,71) ; C, D et E sans notes');


/* ============================================================
   v5.5 — ABSENCES, SANCTIONS PAR PLAGES, INTERVALLES, QR CODE
   ============================================================ */
console.log('\n--- v5.5 : absences, sanctions, intervalles, QR ---');

ok(trimestreOfDate('2025-09-15') === 1 && trimestreOfDate('2025-12-31') === 1
  && trimestreOfDate('2026-01-10') === 2 && trimestreOfDate('2026-03-31') === 2
  && trimestreOfDate('2026-04-01') === 3 && trimestreOfDate('2026-08-15') === 3,
  'trimestre déduit de la date : sept–déc T1, janv–mars T2, avr–août T3');

const sAbs = buildSeed();
const bAbs = sAbs.bases.find(x => x.id === 'etab-001');
const elCl6a = bAbs.eleves.filter(e => e.anneeId === 'an26' && e.classeId === 'cl6a' && e.statut !== 'radie');
const a0 = absencesDe(bAbs, 'an26', elCl6a[0].id, '');
ok(a0.faits === 2 && a0.nonJust === 2 && a0.just === 1 && a0.total === 3,
  'absences 1er élève 6ème A (année) : 2 h NJ + 1 h J = 3 h sur 2 faits');
ok(JSON.stringify(absencesDe(bAbs, 'an26', elCl6a[0].id, 'T1')) === JSON.stringify({ just:1, nonJust:2, total:3, faits:2 })
  && absencesDe(bAbs, 'an26', elCl6a[0].id, 'T2').faits === 0,
  'filtre par période : ces absences sont en T1 uniquement');
/* l'élève d'index 8 cumule 6 h NJ (T2) → exclusion temporaire */
const a8 = absencesDe(bAbs, 'an26', elCl6a[8].id, '');
ok(a8.nonJust === 6, 'élève idx 8 : 6 heures non justifiées (année)');

ok(sanctionsAbsOf(bAbs).length === 4 && defaultSanctionsAbs().length === 4,
  '4 plages de sanctions par défaut (3-5, 6-9, 10-14, 15+)');
ok(sanctionAbsencesFor(bAbs, 2) === null && sanctionAbsencesFor(bAbs, 0) === null,
  'aucune sanction en dessous de 3 h NJ');
ok(sanctionAbsencesFor(bAbs, 3) === 'Avertissement écrit' && sanctionAbsencesFor(bAbs, 5) === 'Avertissement écrit'
  && sanctionAbsencesFor(bAbs, 6) === 'Blâme' && sanctionAbsencesFor(bAbs, 10) === 'Exclusion temporaire (2 jours)'
  && sanctionAbsencesFor(bAbs, 99) === 'Conseil de discipline',
  'sanctions par plage : 3-5 avertissement, 6-9 blâme, 10-14 exclusion, 15+ conseil');
const bAbs2 = JSON.parse(JSON.stringify(bAbs));
bAbs2.sanctionsAbs = [{ id:'sa1', min:2, max:2, sanction:'Avertissement' }, { id:'sa2', min:3, max:999, sanction:'Blâme' }];
ok(sanctionAbsencesFor(bAbs2, 2) === 'Avertissement' && sanctionAbsencesFor(bAbs2, 7) === 'Blâme',
  'plages personnalisées respectées');

const stI = statsNotes(bAbs, [8, 11, 13, 15, 17, 19]);
ok(stI.min === 8 && stI.max === 19 && stI.moy === 13.83 && stI.ge10 === 5 && stI.pct === 83,
  'statsNotes : min 8, max 19, moyenne 13,83, 5/6 ≥ 10 (83 %)');
const ins = stI.repartition.find(r => r.libelle === 'Insuffisant'), tb = stI.repartition.find(r => r.libelle === 'Très bien');
ok(ins.n === 1 && ins.pct === 17 && tb.n === 1 && tb.pct === 17,
  'répartition avec pourcentages : Insuffisant 1 (17 %), Très bien 1 (17 %)');
ok(stI.repartition.reduce((t, r) => t + r.n, 0) === 6, 'somme des effectifs = total');

/* censeurs par niveau */
ok(censeursOf(bAbs, sAbs.users).length === 1 && censeursOf(bAbs, sAbs.users)[0].niveauxIds.length === 4,
  'censeur de démo rattaché à 4 niveaux (collège)');

/* bulletin : sections + QR */
const bul = bulletinOf(bAbs);
ok(bul.qrCode === true && bul.codeSecurite === '' && bul.sections.bilan === true && bul.sections.synthese === true,
  'bulletin par défaut : QR activé, sans code (non imprimé), toutes sections');
const bQr = JSON.parse(JSON.stringify(bAbs));
bQr.settings.bulletin = { codeSecurite:'feedface00112233' };
const elQr = bQr.eleves.find(e => e.anneeId === 'an26' && e.classeId === 'cl6a');
const payload = bulletinQrData(bQr, { eleveId:elQr.id, periodeLabel:'Année complète', moy:12.43, rang:'3/12' });
ok(payload.startsWith('AUREL-SIGES|ETAB:') && payload.includes('|MOY:12,43/20') && payload.includes('|RANG:3/12')
  && /\\|SIG:[0-9a-f]{12}$/.test(payload) && payload.length < 272,
  'QR bulletin : payload ASCII signé (SHA-256 tronqué à 12 hex), longueur ' + payload.length + ' < 272');
const vr = verifieQrTexte(bQr, payload);
ok(vr.ok === true && vr.data.CLA === '6eme A' && vr.data.MOY === '12,43/20' && vr.data.PER === 'Annee complete',
  'vérification du QR : signature conforme, données relues');
ok(verifieQrTexte(bQr, payload.replace('MOY:12,43/20', 'MOY:19,99/20')).ok === false,
  'QR falsifié (moyenne modifiée) : signature NON conforme');
ok(verifieQrTexte(bQr, 'nimporte quoi').ok === false && verifieQrTexte(bQr, 'AUREL|SIG:zzz').ok === false,
  'textes sans signature valide refusés');

/* encodeur QR : round-trip via jsqr (si installé) */
let jsqr = null;
try { jsqr = (await import('jsqr')).default; } catch(e){ jsqr = null; }
if (jsqr){
  const decode = (mod, size) => {
    const quiet = 4, scale = 4, w = (size + quiet * 2) * scale;
    const data = new Uint8ClampedArray(w * w * 4).fill(255);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
      if (!mod[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++){
        const px = ((quiet + y) * scale + dy) * w + (quiet + x) * scale + dx;
        data[px * 4] = data[px * 4 + 1] = data[px * 4 + 2] = 0;
      }
    }
    const r = jsqr(data, w, w);
    return r ? r.data : null;
  };
  let nOk = 0;
  const cas = [payload, 'AUREL-SIGES court', 'X'.repeat(271), 'Test accents Éàü €'];
  cas.forEach(txt => {
    try {
      const q = qrEncode(txt);
      if (decode(q.modules, q.size) === txt) nOk++;
      else console.log('  (round-trip échoué pour ' + txt.length + ' car.)');
    } catch(e){ console.log('  (erreur encode : ' + e.message + ')'); }
  });
  ok(nOk === cas.length, 'QR round-trip jsqr : ' + nOk + '/' + cas.length + ' payloads décodés (versions 1-10, ECC L)');
  let tropLong = false;
  try { qrEncode('W'.repeat(272)); } catch(e){ tropLong = true; }
  ok(tropLong, 'QR : contenu > 271 octets rejeté');
} else {
  console.log('• jsqr absent : round-trip QR ignoré (npm i --no-save jsqr)');
  const q = qrEncode(payload);
  ok(q.size === q.modules.length && q.modules.every(r => r.length === q.size) && q.version >= 1 && q.version <= 10,
    'QR : matrice carrée ' + q.size + '×' + q.size + ' (v' + q.version + ') sans jsqr');
}

console.log(fails ? '\\n=== ' + fails + ' ÉCHEC(S) NOYAU ===' : '\\n=== NOYAU MÉTIER : OK ===');
/* ---------- v6.1 : scan des notes manquantes (aide de la saisie) ---------- */
{
  const cl6a = db.classes.find(c => c.libelle === '6ème A');
  const oblig = new Set(cl6a.matieresOblig || []);
  const sc1 = scanNotesManquantes(db, 'an26', cl6a.id, '1');
  ok(sc1.lignes.length === 10 && sc1.eleves.length === 12, 'scan 6ème A/Séq.1 : 10 matières, 12 élèves');
  ok(sc1.resume.vides === 7 && sc1.resume.partielles === 3 && sc1.resume.completes === 0, 'scan Séq.1 : 7 vides, 3 partielles, 0 complète');
  ok(sc1.resume.notesSaisies === 29 && sc1.resume.notesManquantes === 91, 'scan Séq.1 : 29 saisies / 91 manquantes');
  ok(sc1.lignes.every(l => l.indispensable === oblig.has(l.matiereId)), 'scan : drapeau « matière indispensable » cohérent');
  const p11 = sc1.lignes.find(l => l.saisies === 11);
  ok(p11 && p11.statut === 'partielle' && p11.manquantes === 1 && p11.elevesManquants.length === 1, 'matière 11/12 : partielle, 1 élève manquant nommé');
  ok(sc1.lignes.filter(l => l.statut === 'vide').every(l => l.saisies === 0 && l.manquantes === 12), 'matières vides : 0 saisie, 12 manquants');
  ok(sc1.lignes.every(l => l.effectif === 12) && sc1.lignes.reduce((s2, l) => s2 + l.saisies, 0) === 29, 'scan : effectifs et total des saisies cohérents');
  ok(sc1.sansAucune.length === 0, 'Séq.1 : aucun élève totalement sans note');
  const sc5 = scanNotesManquantes(db, 'an26', cl6a.id, '5');
  ok(sc5.resume.vides === 10 && sc5.resume.notesManquantes === 120 && sc5.resume.aSaisir === 10, 'scan Séq.5 : 10 vides, 120 manquantes');
  ok(sc5.sansAucune.length === 12 && sc5.sansAucune.every(e => !!e.nom && !!e.id), 'Séq.5 : les 12 élèves sans aucune note sont listés');
  const scX = scanNotesManquantes(db, 'an26', 'cl-x', '1');
  ok(scX.lignes.length === 0 && scX.resume.notesManquantes === 0 && scX.sansAucune.length === 0, 'scan classe inconnue : résultat vide sans erreur');
}

/* ---------- v6.2 : synthèse par évaluation et par classe ---------- */
{
  const cl6a = db.classes.find(c => c.libelle === '6ème A');
  const sc = scanNotesManquantesAnnee(db, 'an26', [cl6a.id]);
  ok(sc.sequences.length === 6 && sc.sequences.map(x => x.court).join(' ') === 'S1 S2 S3 S4 S5 S6', 'synthèse : 6 évaluations S1..S6 en colonnes');
  ok(sc.classes.length === 1 && sc.classes[0].matieres.length === 10 && sc.classes[0].effectif === 12, 'synthèse 6ème A : 10 matières, 12 élèves');
  ok(sc.classes[0].totauxParSequence.join('|') === '91|91|91|91|120|120' && sc.classes[0].totalManquantes === 604, 'synthèse 6ème A : 91×4 puis 120×2, total 604');
  const an = sc.classes[0].matieres.find(m => m.totalManquantes === 28);
  ok(an && an.code === 'ANGL' && an.parSequence.map(x => x.manquantes).join('|') === '1|1|1|1|12|12', 'synthèse : Anglais 11/12 → 1 manquante en S1..S4, 12 en S5/S6');
  ok(an && an.parSequence.every(x => x.statut === (x.manquantes === 12 ? 'vide' : 'partielle')), 'synthèse : statut vide/partielle par cellule');
  const cibles = db.classes.filter(c => ['6ème A','6ème B','5ème A','5ème B'].includes(c.libelle));
  const to = scanNotesManquantesAnnee(db, 'an26', cibles.map(c => c.id));
  ok(to.classes.length === 4 && to.totalGeneral === 2164 && to.cellsTotal === 216 && to.cellsToDo === 216, 'synthèse 4 classes avec plan : 2164 manquantes, 216/216 matière-éval.');
  ok(to.totauxGlobaux.join('|') === '329|329|329|329|424|424', 'synthèse globale : 329 par séquence 1-4, 424 en 5-6');
  ok(to.classes.every(c => c.matieres.every(m => m.totalManquantes === m.parSequence.reduce((t, x) => t + x.manquantes, 0))), 'synthèse : total par matière = somme des évaluations');
  ok(to.classes.map(c => c.matieres.length).join('|') === '10|9|9|8', 'synthèse : plans 10/9/9/8 matières par classe');
  const tx = scanNotesManquantesAnnee(db, 'an26', ['cl-x']);
  ok(tx.classes.length === 0 && tx.totalGeneral === 0 && tx.sequences.length === 6, 'synthèse classe inconnue : vide sans erreur');
}

/* ---------- v6.3 : modèles de documents & thème ---------- */
{
  ok(TYPES_DOCS.length === 5 && TYPES_DOCS.map(t => t.id).join('|') === 'bulletin|honneur|certificat|carte|badge', 'modèles : 5 types de documents (bulletin, honneur, certificat, carte, badge)');
  ok(catalogueChamps('bulletin').length === 38 && catalogueChamps('carte').length === 23 && catalogueChamps('honneur').length === 9,
    'catalogue des champs : ' + catalogueChamps('bulletin').length + ' (bulletin), ' + catalogueChamps('carte').length + ' (carte), ' + catalogueChamps('honneur').length + ' (honneur)');
  const mb = normalizeModele(defaultModele('bulletin', 'Essai'));
  ok(mb.blocs.length === 16 && ['logo','photo','qr','tableau-notes','signatures'].every(t => mb.blocs.some(b => b.type === t)) && mb.page.format === 'A4' && pageOf({ ...mb.page, typeDoc:'bulletin' }).w === 210, 'modèle bulletin de départ : ' + mb.blocs.length + ' blocs (logo, photo, QR, notes, signatures), A4 portrait');
  ok(pageOf({ format:'carte' }).w === 85 && pageOf({ format:'carte' }).h === 55 && pageOf({ format:'badge' }).w === 75, 'formats : carte 85×55 mm, badge 75×45 mm');
  const mc = normalizeModele(defaultModele('carte', 'Carte'));
  ok(mc.blocs.every(b => b.x + b.w <= 85.5 && b.y + b.h <= 55.5), 'blocs du modèle carte tous dans la page 85×55');
  ok(interpoler('{eleve.nomComplet} — {notes.moyenne}/20 — {date.jour}', { eleve:{ nom:'NDENGUE', prenom:'Alice' }, moy:14.5, dateJour:'22/09/2026' }) === 'NDENGUE Alice — 14,50/20 — 22/09/2026', 'interpolation des champs dynamiques');
  ok(resolveChamp('inconnu.cle', {}) === '' && resolveChamp('absences.total', { absNJ:3, absJ:2 }) === '5' && resolveChamp('eleve.matricule', {}) === '—', 'resolveChamp : clé inconnue vide, absences totalée, matricule absent = —');
  let a1 = false; try { normalizeModele({ typeDoc:'xyz', nom:'x', blocs:[] }); } catch(e){ a1 = /type de document/.test(e.message); }
  ok(a1, 'normalisation : type de document inconnu rejeté');
  let a2 = false; try { normalizeModele({ typeDoc:'bulletin', nom:'  ', blocs:[] }); } catch(e){ a2 = /nom du modèle/i.test(e.message); }
  ok(a2, 'normalisation : nom requis');
  const brute = normalizeModele({ typeDoc:'bulletin', nom:'Nettoyage', blocs:[
    { id:'b1', type:'texte', texte:'Ok', x:-40, y:9, w:5000, h:0.2, style:{ police:'Comic Sans MS', taille:200, alignement:'diag', couleur:'#ZZZZZZ' } },
    { id:'b2', type:'liste', texte:'hors sujet' } ] });
  ok(brute.blocs.length === 1 && brute.blocs[0].x === 0 && brute.blocs[0].w <= 210 && brute.blocs[0].h >= 1
    && brute.blocs[0].style.police === 'Tahoma' && brute.blocs[0].style.taille <= 72 && brute.blocs[0].style.alignement === 'gauche'
    && brute.blocs[0].style.couleur === '', 'normalisation : bornes, police, taille, alignement, couleur nettoyés ; bloc hors type ignoré');
  const j = modeleVersJson(mb);
  const rt = modeleDepuisJson(j);
  ok(rt.id === '' && rt.nom === 'Essai' && rt.blocs.length === mb.blocs.length, 'export/import JSON : copie intégrale sans identifiant');
  let a3 = false; try { modeleDepuisJson('ceci n\u2019est pas du json'); } catch(e){ a3 = /JSON illisible/.test(e.message); }
  ok(a3, 'import JSON illisible rejeté proprement');
  const v = varsTheme({ primaire:'#7A2E3A', accent:'#C9A227' });
  ok(v['--navy-800'] === '#7a2e3a' && v['--navy-950'] !== v['--navy-800'] && v['--navy-100'] !== v['--navy-800']
    && v['--gold-600'] === '#c9a227', 'thème : nuances primaire/accent calculées');
  const vd = varsTheme(null);
  ok(vd['--navy-800'] === '#2c3a63' && vd['--gold-600'] === '#c08a26', 'thème par défaut = palette actuelle de l\u2019application (aucun changement visuel)');
  ok(PRESETS_THEME.length >= 5 && PRESETS_THEME[0].id === 'navy-or', 'thème : ' + PRESETS_THEME.length + ' palettes proposées');
  ok(appliquerTheme(null) === false, 'appliquerTheme sans document (Node) : sans erreur');
  const eb = ensureBase(emptyBase());
  ok(Array.isArray(eb.modelesDocs) && eb.modelesDocs.length === 0, 'ensureBase : collection modelesDocs créée (migration silencieuse)');
  const nb = newBloc('tableau-notes', { page:{ w:210, h:297 } });
  ok(nb.options.appreciation === true && nb.style.taille === 8.5, 'newBloc : options par défaut du tableau de notes');
}

/* ================= v6.5 : DEVOIRS PONDÉRÉS PAR SÉQUENCE ================= */
{
  /* copie jetable de la base démo (on y définit des devoirs) */
  const base = JSON.parse(JSON.stringify(db));
  const an = base.annees.find(a => a.active) || base.annees[0];
  const seq = base.sequences[0];
  const el = base.eleves.find(e => e.anneeId === an.id && base.plan.some(p => p.classeId === e.classeId));
  const mat = (base.matieres || []).find(m => base.plan.some(p => p.classeId === el.classeId && p.matiereId === m.id));
  const avant = moyenneMatiere(base, an.id, el.id, mat.id, seq.id);

  /* validation des configurations */
  ok(devoirsValides([]).ok === true, 'devoirsValides : liste vide admise (saisie directe)');
  ok(devoirsValides([{ libelle:'Devoir 1', pourcentage:60 }, { libelle:'Devoir 2', pourcentage:40 }]).ok === true,
    'devoirsValides : 2 devoirs totalisant 100 %');
  ok(devoirsValides([{ libelle:'Devoir 1', pourcentage:70 }]).ok === false, 'devoirsValides : total ≠ 100 % refusé');
  ok(devoirsValides([{ libelle:'', pourcentage:100 }]).ok === false, 'devoirsValides : libellé requis');
  ok(devoirsValides([{ libelle:'D', pourcentage:0 }]).ok === false, 'devoirsValides : pourcentage > 0');
  ok(devoirsValides([{ libelle:'D', pourcentage:50 }, { libelle:'d', pourcentage:50 }]).ok === false,
    'devoirsValides : libellés dupliqués refusés');
  ok(devoirsValides([{ libelle:'D', pourcentage:50 }, { libelle:'D2', pourcentage:50 }, { libelle:'D3', pourcentage:0.5 }]).ok === false,
    'devoirsValides : pourcentage < 1 refusé');

  /* la séquence prend 2 devoirs : 40 % + 60 % */
  seq.devoirs = [{ id:'dv1', libelle:'Interrogation', pourcentage:40 }, { id:'dv2', libelle:'Devoir', pourcentage:60 }];
  ok(aDevoirs(base, seq) === true && devoirsDe(base, seq.id).length === 2, 'devoirsDe : séquence avec 2 devoirs');
  /* les notes d'évaluation existantes sont ignorées : plus de note directe */
  ok(moyenneMatiere(base, an.id, el.id, mat.id, seq.id) === null,
    'v6.5 : séquence à devoirs sans note de devoir → note séquentielle absente (évaluations ignorées)');
  /* saisie du premier devoir uniquement → prorata */
  base.notes.push({ id:'nd1', anneeId:an.id, eleveId:el.id, classeId:el.classeId, matiereId:mat.id,
    sequence:String(seq.id), type:'devoir', devoirId:'dv1', valeur:12, date:'2026-01-01', auteurId:'admin' });
  ok(moyenneMatiere(base, an.id, el.id, mat.id, seq.id) === 12,
    'v6.5 : un seul devoir saisi → prorata (note du devoir)');
  /* saisie du second : Σ note × pct */
  base.notes.push({ id:'nd2', anneeId:an.id, eleveId:el.id, classeId:el.classeId, matiereId:mat.id,
    sequence:String(seq.id), type:'devoir', devoirId:'dv2', valeur:8, date:'2026-01-01', auteurId:'admin' });
  ok(moyenneMatiere(base, an.id, el.id, mat.id, seq.id) === 9.6,
    'v6.5 : note séquentielle = 0,4×12 + 0,6×8 = 9,6');
  ok(noteSequentielle(base, an.id, el.id, mat.id, seq.id) === 9.6, 'noteSequentielle : même calcul explicite');
  ok(devoirsDetail(base, an.id, el.id, mat.id, seq.id).map(d => d.note).join(',') === '12,8',
    'devoirsDetail : notes par devoir (12 et 8)');
  /* le trimestre pondère les notes séquentielles CALCULÉES */
  const tri = 'T' + seq.trimestre;
  const mt = moyenneMatiere(base, an.id, el.id, mat.id, tri);
  ok(mt != null && mt >= 0, 'v6.5 : trimestre calculé depuis les notes séquentielles (' + mt + ')');
  /* audit v6.5 : l'ANNÉE est la moyenne NON pondérée des notes de séquence —
     une séquence à devoirs y compte UNE fois (sa note calculée), jamais ses
     notes de devoir brutes (sinon elles pèseraient trop lourd). */
  const valsAn = sequencesSorted(base).map(sq => moyenneMatiere(base, an.id, el.id, mat.id, sq.id)).filter(v => v != null);
  const mAn = moyenneMatiere(base, an.id, el.id, mat.id, '');
  ok(mAn === Math.round(valsAn.reduce((x, v) => x + v, 0) / valsAn.length * 100) / 100,
    'v6.5 audit : année = moyenne des notes de séquence (devoirs comptés une fois : ' + mAn + ')');

  /* autre élève sans aucun devoir : non noté sur la séquence */
  const el2 = base.eleves.find(e => e.anneeId === an.id && e.classeId === el.classeId && e.id !== el.id);
  if (el2) ok(moyenneMatiere(base, an.id, el2.id, mat.id, seq.id) === null,
    'v6.5 : élève sans note de devoir → note séquentielle absente');

  /* scan : élève complet seulement quand TOUS les devoirs sont saisis */
  const scan = scanNotesManquantes(base, an.id, el.classeId, seq.id);
  const ligne = scan.lignes.find(l => l.matiereId === mat.id);
  ok(ligne && ligne.statut === 'partielle' && ligne.manquantes >= 1 && ligne.saisies < ligne.effectif,
    'v6.5 : scan — matière partielle tant que tous les devoirs ne sont pas saisis');
  ok(ligne && ligne.notesAttendues === ligne.effectif * 2, 'v6.5 : scan — attendues = effectif × 2 devoirs');
  const matAnnee = scanNotesManquantesAnnee(base, an.id, [el.classeId]);
  const cl = matAnnee.classes.find(c => c.classeId === el.classeId);
  const mrow = cl.matieres.find(m => m.matiereId === mat.id);
  const cell = mrow.parSequence.find(x => x.sequenceId === String(seq.id));
  ok(cell.statut === 'partielle' && cell.manquantes === ligne.manquantes,
    'v6.5 : synthèse matricielle — même statut que le scan détaillé');

  /* suppression des devoirs : retour à la saisie directe — M.saveDevoirs
     efface les notes de devoir, la note d'évaluation d'origine reprend le dessus */
  seq.devoirs = [];
  base.notes = base.notes.filter(n => !(n.type === 'devoir' && n.devoirId != null
    && String(n.sequence) === String(seq.id)));
  ok(aDevoirs(base, seq) === false && devoirsDe(base, seq).length === 0, 'devoirsDe : séquence sans devoir');
  ok(moyenneMatiere(base, an.id, el.id, mat.id, seq.id) === avant,
    'v6.5 : sans devoirs, la note d\u2019évaluation d\u2019origine reprend le dessus (' + avant + ')');
}

/* ---------- v7.0 : fusion à trois voies (opérateurs simultanés) ---------- */
{
  const A = { users:[{id:'u1', nom:'Un', role:'admin'},{id:'u2', nom:'Deux', role:'econome'}],
    etablissements:[{id:'e1', nom:'Ecole A', actif:true}],
    journalGlobal:[],
    bases:[{id:'e1', eleves:[{id:'x1', nom:'AAA'},{id:'x2', nom:'BBB'}], notes:[{id:'n1', valeur:10}], settings:{theme:'bleu'}, journal:[]}] };
  const L = JSON.parse(JSON.stringify(A));
  const S = JSON.parse(JSON.stringify(A));
  /* opérateur local : renomme x1 + crée x3 + change le thème */
  L.bases[0].eleves[0].nom = 'AAA-RENAME';
  L.bases[0].eleves.push({id:'x3', nom:'CCC'});
  L.bases[0].settings.theme = 'vert';
  /* opérateur distant : note n1 modifiée + crée x4 + nouveau compte */
  S.bases[0].notes[0].valeur = 15;
  S.bases[0].eleves.push({id:'x4', nom:'DDD'});
  S.users.push({id:'u9', nom:'Neuf', role:'lecteur'});
  const M = mergeDb(A, L, S);
  ok(M.bases[0].eleves.find(e => e.id === 'x1').nom === 'AAA-RENAME', 'fusion : renommage local conservé');
  ok(M.bases[0].eleves.some(e => e.id === 'x3') && M.bases[0].eleves.some(e => e.id === 'x4'), 'fusion : créations des DEUX côtés conservées');
  ok(M.bases[0].notes.find(n => n.id === 'n1').valeur === 15, 'fusion : modification distante conservée');
  ok(M.bases[0].settings.theme === 'vert', 'fusion : réglage local conservé');
  ok(M.users.some(u => u.id === 'u9'), 'fusion : compte créé à distance conservé');
  ok(M.bases[0].eleves.some(e => e.id === 'x2'), 'fusion : document intact des deux côtés');
  /* suppression distante d'un document non touché localement → respectée */
  S.bases[0].eleves = S.bases[0].eleves.filter(e => e.id !== 'x2');
  const M2 = mergeDb(A, L, S);
  ok(!M2.bases[0].eleves.some(e => e.id === 'x2'), 'fusion : suppression distante respectée (document non touché localement)');
  ok(M2.bases[0].eleves.find(e => e.id === 'x1').nom === 'AAA-RENAME', 'fusion : modification locale prioritaire sur la suppression distante du même document');
}

process.exit(fails ? 1 : 0);
