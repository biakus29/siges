/* Guide d'utilisation intégré : aide par écran, premiers pas par profil,
   questions fréquentes et liste de démarrage d'un établissement.
   Les textes reprennent les libellés exacts des boutons et des menus. */
import { classesSorted, planOf } from './business.js';

/* ---------- Aide par écran (clé = identifiant de page) ---------- */
export const GUIDE_PAGES = {
  dashboard: {
    titre: 'Tableau de bord',
    resume: "Vue d'ensemble adaptée à votre profil : finances, discipline ou pédagogie, avec les alertes du moment.",
    etapes: [
      "Vérifiez en haut à droite l'année affichée : tous les chiffres portent sur cette année.",
      'Cliquez sur un indicateur ou un raccourci pour ouvrir directement l’écran concerné.',
      'Consultez « Contrôles & alertes » pour repérer ce qui demande une action.',
    ],
  },
  eleves: {
    titre: 'Élèves & inscriptions',
    resume: "Liste des élèves de l'année, fiches individuelles et situation de paiement de chacun.",
    etapes: [
      'Cliquez sur « Inscrire un élève » et remplissez l’identité, la classe et les contacts du parent.',
      'Pour un élève déjà connu, ouvrez « Anciens élèves » : la fiche est préremplie et le matricule repris.',
      'Utilisez la recherche (nom, prénom ou matricule) et les filtres pour retrouver un élève.',
      'Cliquez sur un élève pour voir sa fiche et sa situation financière détaillée.',
    ],
    astuces: [
      "L'import CSV permet d'inscrire une classe entière : vérifiez ensuite la classe de chaque élève.",
      'Préférez une photo légère (moins de 100 Ko) : elle est enregistrée dans la base.',
    ],
    attention: ['Un élève qui a des paiements ne peut pas être supprimé : passez-le au statut « Radié ».'],
  },
  discipline: {
    titre: 'Discipline & absences',
    resume: 'Faits de discipline, absences par classe, bilans et sanctions automatiques selon le barème.',
    etapes: [
      'Onglet « Absences » : choisissez la classe et la date, puis saisissez les heures d’absence ligne par ligne.',
      'Onglet « Faits de discipline » : « Nouveau fait » pour un retard, une sanction ou un incident.',
      'Onglet « Bilans & sanctions » : cumul par élève et sanction proposée par le barème.',
    ],
    astuces: ['Dans la grille des absences, la touche Entrée passe à l’élève suivant.'],
    attention: ['Après une saisie avec Entrée, vérifiez qu’aucune absence n’a été enregistrée en double.'],
  },
  paiements: {
    titre: 'Encaissements',
    resume: 'Enregistrement des paiements, reçus et suivi de la caisse.',
    etapes: [
      'Cliquez sur « Nouveau paiement », puis tapez le nom, le prénom ou le matricule de l’élève.',
      'Choisissez le frais, saisissez le montant et le mode (espèces, Mobile Money, virement, chèque).',
      'Hors espèces, renseignez la référence de la transaction.',
      'Validez : le reçu s’affiche, prêt à imprimer.',
    ],
    astuces: [
      'L’onglet « Situation des classes » montre qui est à jour et qui doit encore payer.',
      '« Imprimer » produit le journal de caisse de la période affichée.',
    ],
    attention: [
      'Un paiement ne se supprime pas : on l’annule avec un motif, et le reçu porte « REÇU ANNULÉ ».',
      'Attendez « ✓ Base à jour » en haut de l’écran avant de remettre le reçu.',
    ],
  },
  bourses: {
    titre: 'Bourses & réductions',
    resume: 'Exonérations et remises accordées aux élèves, déduites automatiquement du net à payer.',
    etapes: [
      'Cliquez sur « Accorder une bourse / réduction » et choisissez l’élève.',
      'Indiquez la portée (un frais ou tous les frais) et la valeur : pourcentage ou montant fixe.',
      'Donnez un motif : il apparaît dans le suivi et les rapports.',
    ],
    attention: ['Un montant fixe appliqué à « tous les frais » est déduit sur chaque frais : vérifiez le net obtenu.'],
  },
  rapports: {
    titre: 'Rapports financiers',
    resume: 'Documents officiels imprimables : journal de caisse, recouvrements, solvabilité, listes d’élèves.',
    etapes: [
      'Choisissez le rapport (journal de caisse, état des recouvrements, état de solvabilité, situation d’une classe…).',
      'Réglez la période ou la classe, puis cliquez sur « Générer le rapport ».',
      'Imprimez ou enregistrez en PDF depuis la fenêtre d’impression du navigateur.',
    ],
  },
  frais: {
    titre: 'Types de frais',
    resume: 'Nature des frais (inscription, scolarité, APEE…), périodicité et caractère obligatoire.',
    etapes: [
      'Cliquez sur « Nouveau type de frais », donnez un code et un libellé.',
      'Indiquez s’il est obligatoire : seuls les frais obligatoires comptent dans la solvabilité.',
      'Fixez ensuite les montants dans « Grille tarifaire ».',
    ],
    attention: ['Supprimer un type de frais efface aussi tous ses paiements, toutes années confondues. Ne supprimez jamais un frais déjà encaissé.'],
  },
  grille: {
    titre: 'Grille tarifaire',
    resume: 'Montant de chaque frais par niveau, avec exceptions par classe, tranches et échéances.',
    etapes: [
      'Saisissez le montant de chaque frais pour chaque niveau.',
      'Pour une classe au tarif différent, utilisez « Tarif spécifique à la classe ».',
      'Réglez les tranches et leurs échéances : elles servent au calcul des retards de paiement.',
    ],
    astuces: ['« Cloner vers… » recopie une grille sur d’autres niveaux.'],
  },
  annees: {
    titre: 'Années scolaires',
    resume: 'Création, activation et clôture des années scolaires.',
    etapes: [
      'Cliquez sur « Nouvelle année scolaire » (format 2026-2027).',
      'Choisissez si la grille tarifaire et les élèves actifs sont repris de l’année précédente.',
      'Cliquez sur « Activer » : une seule année est en cours à la fois.',
      'En fin d’année, « Clôturer » archive l’année.',
    ],
    attention: ['La reprise des élèves ne fait passer personne en classe supérieure : mettez à jour la classe de chaque élève.'],
  },
  niveaux: {
    titre: 'Niveaux',
    resume: 'Regroupements de classes (Sixième, Seconde…), rattachés à un cycle.',
    etapes: [
      'Cliquez sur « Nouveau niveau », donnez un libellé, un ordre et un cycle.',
      'L’ordre détermine le classement des classes dans toutes les listes.',
    ],
    attention: ['Supprimer un niveau supprime ses classes et leurs élèves. Ne le faites pas sur un niveau utilisé.'],
  },
  classes: {
    titre: 'Classes',
    resume: 'Classes de l’établissement, capacité, titulaire et mode d’appréciation.',
    etapes: [
      'Cliquez sur « Nouvelle classe », choisissez le niveau et donnez un libellé.',
      'Indiquez la capacité et, si besoin, le professeur titulaire.',
      'Choisissez le mode d’appréciation : classique (notes) ou APC (niveaux de maîtrise).',
    ],
    attention: ['Supprimer une classe efface ses élèves et leurs paiements, toutes années confondues.'],
  },
  matieres: {
    titre: 'Matières',
    resume: 'Catalogue des matières et des groupes de matières (littéraires, scientifiques…).',
    etapes: [
      'Onglet « Groupes de matières » : créez d’abord les groupes avec « Nouveau groupe ».',
      'Onglet « Matières » : « Nouvelle matière », avec un code et un libellé.',
      'Les coefficients se fixent ensuite par classe dans « Plan des enseignements ».',
    ],
    attention: ['Supprimer une matière efface toutes ses notes, y compris celles des années passées.'],
  },
  enseignants: {
    titre: 'Enseignants',
    resume: 'Fiches du corps enseignant, liées au plan et aux comptes utilisateurs.',
    etapes: [
      'Cliquez sur « Nouvel enseignant » et remplissez la fiche.',
      'Affectez-le à ses classes et matières dans « Plan des enseignements ».',
      'Créez-lui un compte « Enseignant » dans « Utilisateurs & profils » en liant sa fiche.',
    ],
    attention: ['Pour un départ, passez la fiche en « Inactif » plutôt que de la supprimer : la suppression retire ses matières du plan.'],
  },
  plan: {
    titre: 'Plan des enseignements',
    resume: 'Pour chaque classe : matières enseignées, enseignant, coefficient et groupe. Indispensable pour saisir des notes.',
    etapes: [
      'Choisissez la classe, puis « Ajouter un enseignement » pour chaque matière.',
      'Indiquez l’enseignant, le coefficient et le groupe de la matière.',
      'Pour une classe semblable, « Cloner depuis une autre classe » recopie tout le plan.',
    ],
    astuces: ['Une classe sans plan n’apparaît pas en saisie de notes : c’est la cause la plus fréquente de « Aucune matière au plan de cette classe ».'],
  },
  sequences: {
    titre: 'Séquences & appréciations',
    resume: 'Séquences et trimestres, poids des séquences, devoirs pondérés et fourchettes d’appréciation.',
    etapes: [
      'Vérifiez les six séquences et leur trimestre de rattachement.',
      'Si une séquence comporte plusieurs devoirs, « Ajouter un devoir » avec un pourcentage (total 100 %).',
      'Réglez les appréciations des notes et des moyennes (ex. 10 à 12 : Passable).',
    ],
    attention: ['Ajouter des devoirs à une séquence annule les notes déjà saisies pour cette séquence, sur toutes les années. Configurez les devoirs avant la saisie.'],
  },
  notes: {
    titre: 'Saisie des notes',
    resume: 'Saisie des évaluations par classe, matière et séquence, et suivi des notes manquantes.',
    etapes: [
      'Mode « Par matière » : choisissez la classe, la matière et la séquence.',
      'Tapez les notes sur 20 (virgule acceptée) ; Entrée ou les flèches passent à l’élève suivant.',
      'Chaque note est enregistrée dès que vous quittez la case : il n’y a pas de bouton à valider.',
      'L’onglet « Notes manquantes » liste ce qui reste à saisir, par classe et par matière.',
    ],
    astuces: [
      'Le mode « Par élève » affiche toutes ses notes, sa moyenne et son rang.',
      '« Imprimer le bordereau » produit une feuille de saisie papier.',
    ],
    attention: ['Seules les classes ayant un plan des enseignements peuvent être notées.'],
  },
  bulletins: {
    titre: 'Bulletins & rapports',
    resume: 'Moyennes, classements, bulletins, tableaux d’honneur et documents scolaires.',
    etapes: [
      'Choisissez la classe et la période : séquence, trimestre ou année.',
      'Contrôlez les moyennes et les rangs dans le tableau ; « NC » signale une matière indispensable sans note.',
      'Imprimez le bulletin d’un élève, ou le « Bordereau de résultats » de la classe.',
      '« Certificats, cartes & badges » produit les documents scolaires par classe.',
    ],
    astuces: ['« Vérifier un bulletin » contrôle l’authenticité d’un bulletin grâce à son QR code.'],
  },
  stats: {
    titre: 'Statistiques',
    resume: 'Moyennes et taux de réussite par classe, matière, niveau ou cycle.',
    etapes: [
      'Choisissez l’axe d’analyse (classe, matière, niveau, cycle) et la période.',
      'Lisez la moyenne, la meilleure note et le pourcentage de réussite.',
      'Cliquez sur « Imprimer » pour un rapport à présenter en conseil.',
    ],
  },
  users: {
    titre: 'Utilisateurs & profils',
    resume: 'Comptes, profils et droits d’accès du personnel.',
    etapes: [
      'Cliquez sur « Nouvel utilisateur », donnez un identifiant, un nom et un mot de passe provisoire.',
      'Choisissez le profil : il détermine les menus visibles (voir « Les profils » dans ce guide).',
      'Pour un enseignant, liez sa fiche enseignant ; pour un surveillant de secteur, ses classes.',
      'Pour un départ, décochez « Compte actif » : la personne ne peut plus se connecter.',
    ],
    attention: ['Communiquez le mot de passe en main propre et demandez à la personne de le garder secret.'],
  },
  parametres: {
    titre: 'Personnalisation des états',
    resume: 'Logo, en-têtes, thème de couleurs, modèles de documents, barème des absences et sauvegardes.',
    etapes: [
      '« En-tête & pied de page » : nom officiel, ministère, devise, adresse, puis « Enregistrer ».',
      '« Importer un logo… » : préférez une image de moins de 200 Ko.',
      '« Modèles de documents » : « Créer avec le concepteur » pour un bulletin ou un reçu personnalisé.',
      '« Discipline — sanctions d’absences » : plages d’heures et sanctions correspondantes.',
      '« Sauvegarde & restauration » : « Exporter la base (ZIP) » régulièrement, et activez la sauvegarde automatique.',
    ],
    attention: ['« Importer une base » remplace toutes les données actuelles. Exportez d’abord une sauvegarde.'],
  },
  journal: {
    titre: "Journal d'activité",
    resume: 'Traçabilité des connexions et des opérations (paiements, annulations, modifications).',
    etapes: ['Filtrez par type d’action, par utilisateur ou par date pour retrouver une opération.'],
    attention: ['Le journal ne conserve que les 250 dernières actions : exportez-le régulièrement si vous devez garder une trace.'],
  },
  etablissements: {
    titre: 'Console réseau',
    resume: 'Supervision de tous les établissements du réseau (superadministrateur).',
    etapes: [
      '« Nouvel établissement » crée une école avec sa propre base.',
      'Cliquez sur un établissement pour y travailler ; « Retour à l’établissement courant » pour revenir.',
      'Suspendre un établissement bloque les nouvelles connexions de ses comptes.',
    ],
  },
};

/* ---------- Premiers pas par profil ---------- */
const PAS = {
  admin: ['annees', 'niveaux', 'classes', 'frais', 'grille', 'matieres', 'enseignants', 'plan', 'users', 'parametres'],
  superadmin: ['etablissements', 'users', 'parametres'],
  econome: ['paiements', 'eleves', 'bourses', 'rapports'],
  lecteur: ['dashboard', 'eleves', 'paiements', 'rapports'],
  censeur: ['plan', 'sequences', 'notes', 'bulletins', 'stats'],
  surveillant: ['discipline', 'eleves'],
  surveillant_secteur: ['discipline', 'eleves'],
  titulaire: ['eleves', 'notes', 'bulletins', 'discipline'],
  enseignant: ['notes', 'bulletins', 'stats'],
  operateur: ['notes', 'discipline', 'bulletins'],
};
export const ROLE_INTRO = {
  admin: 'Vous gérez l’établissement : configuration, comptes, finances et pédagogie.',
  superadmin: 'Vous supervisez tous les établissements du réseau depuis la console.',
  econome: 'Vous encaissez les paiements, inscrivez les élèves et suivez les recouvrements.',
  lecteur: 'Vous consultez les données sans pouvoir les modifier.',
  censeur: 'Vous pilotez la pédagogie de votre cycle : plan, notes, bulletins.',
  surveillant: 'Vous suivez la discipline et les absences de l’établissement.',
  surveillant_secteur: 'Vous suivez la discipline et les absences de vos classes.',
  titulaire: 'Vous consultez toutes les informations de votre classe.',
  enseignant: 'Vous saisissez les notes de vos matières et imprimez vos bordereaux.',
  operateur: 'Vous saisissez les notes et la discipline pour l’établissement.',
};
export function premiersPas(role){ return PAS[role] || ['dashboard']; }

/* ---------- Questions fréquentes ---------- */
export const FAQ = [
  { q: '« Serveur injoignable » à la connexion',
    r: 'Le serveur PHP n’est pas démarré ou MySQL est arrêté. Vérifiez que XAMPP affiche MySQL en vert et que le lanceur du serveur est ouvert, patientez quelques secondes puis reconnectez-vous. Ne travaillez pas en « mode local de secours » : ces saisies restent dans le navigateur.' },
  { q: 'Le badge affiche « ⚠ Hors ligne — file d’attente »',
    r: 'Vos dernières modifications ne sont pas encore sur le serveur. Ne fermez pas l’onglet et ne vous déconnectez pas. Cliquez sur le badge pour ouvrir le diagnostic, puis « Réessayer l’envoi maintenant » une fois la connexion revenue.' },
  { q: 'Une classe n’apparaît pas dans la saisie des notes',
    r: 'La classe n’a pas de plan des enseignements. Ouvrez « Plan des enseignements », choisissez la classe et ajoutez ses matières (ou clonez le plan d’une classe semblable).' },
  { q: 'Une classe est marquée « (aucun élève) »',
    r: 'Aucun élève n’y est inscrit pour l’année affichée. Vérifiez l’année choisie en haut de l’écran, puis inscrivez les élèves dans « Élèves & inscriptions ».' },
  { q: 'Je ne vois pas un menu dont j’ai besoin',
    r: 'Les menus dépendent de votre profil. Demandez à l’administrateur de modifier votre profil ou vos droits dans « Utilisateurs & profils », puis reconnectez-vous.' },
  { q: 'Comment changer mon mot de passe ?',
    r: 'Cliquez sur votre nom en haut à droite de l’écran, saisissez votre mot de passe actuel puis le nouveau (8 caractères minimum). Tous les profils peuvent le faire.' },
  { q: 'J’ai oublié mon mot de passe',
    r: 'L’administrateur de l’établissement peut vous attribuer un nouveau mot de passe depuis « Utilisateurs & profils ».' },
  { q: 'J’ai été déconnecté pendant mon travail',
    r: 'La session se ferme après quelques minutes sans clic. Avant de quitter votre poste, attendez que le badge affiche « ✓ Base à jour ».' },
  { q: 'Je consulte une ancienne année',
    r: 'Le sélecteur « Année » en haut à droite change l’année affichée. Un bandeau le signale ; cliquez sur « Revenir à … » pour retrouver l’année en cours.' },
  { q: 'Comment annuler un paiement ?',
    r: 'Dans « Encaissements », cliquez sur l’icône « Annuler le paiement » de la ligne et indiquez un motif. Le paiement reste visible, marqué annulé.' },
  { q: 'Comment sauvegarder les données ?',
    r: 'Dans « Personnalisation des états », section « Sauvegarde & restauration » : « Exporter la base (ZIP) ». Activez aussi la sauvegarde automatique et conservez une copie hors de l’ordinateur.' },
];

/* ---------- Démarrage d'un établissement (calculé sur les données) ---------- */
export function etapesDemarrage(db, anneeId, users){
  const classes = classesSorted(db);
  const an = (db.annees || []).find(a => a.active);
  const elevesAn = (db.eleves || []).filter(e => e.anneeId === anneeId);
  const tarifsAn = (db.tarifs || []).filter(t => t.anneeId === anneeId);
  const avecPlan = classes.filter(c => planOf(db, c.id).length).length;
  return [
    { page: 'parametres', titre: 'Personnaliser l’en-tête des documents', fait: !!(db.settings && db.settings.logo),
      detail: 'Logo et nom officiel sur les reçus et les bulletins.' },
    { page: 'annees', titre: 'Créer et activer l’année scolaire', fait: !!an,
      detail: an ? 'Année en cours : ' + an.libelle + '.' : 'Aucune année active.' },
    { page: 'niveaux', titre: 'Créer les niveaux', fait: (db.niveaux || []).length > 0,
      detail: (db.niveaux || []).length + ' niveau(x).' },
    { page: 'classes', titre: 'Créer les classes', fait: classes.length > 0,
      detail: classes.length + ' classe(s).' },
    { page: 'frais', titre: 'Définir les types de frais', fait: (db.frais || []).length > 0,
      detail: (db.frais || []).length + ' type(s) de frais.' },
    { page: 'grille', titre: 'Remplir la grille tarifaire', fait: tarifsAn.length > 0,
      detail: tarifsAn.length ? 'Tarifs saisis.' : 'Aucun montant saisi.' },
    { page: 'eleves', titre: 'Inscrire les élèves', fait: elevesAn.length > 0,
      detail: elevesAn.length + ' élève(s) cette année.' },
    { page: 'matieres', titre: 'Créer les matières', fait: (db.matieres || []).length > 0,
      detail: (db.matieres || []).length + ' matière(s).' },
    { page: 'enseignants', titre: 'Enregistrer les enseignants', fait: (db.enseignants || []).length > 0,
      detail: (db.enseignants || []).length + ' enseignant(s).' },
    { page: 'plan', titre: 'Établir le plan des enseignements', fait: classes.length > 0 && avecPlan === classes.length,
      detail: avecPlan + ' classe(s) sur ' + classes.length + ' ont un plan.' },
    { page: 'users', titre: 'Créer les comptes du personnel', fait: (users || []).length > 1,
      detail: 'Un compte par personne, avec le bon profil.' },
  ];
}
