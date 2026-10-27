# Aurel School SIGES (React)

Application **ReactJS complète et fonctionnelle** de gestion des frais de
scolarité — **multi-établissements** : chaque établissement possède sa propre
base (années, classes, élèves, grilles tarifaires, anciens, personnalisation),
supervisée par un compte superadministrateur.
**Version 7.0.0 — React 18 + Vite 5. Application déployée : PHP 7.0+ et MySQL
exclusivement** (ce projet n'est que la chaîne de construction de l'interface).

## Démarrage (développement de l'interface)

```bash
npm install          # dépendances de construction (Vite)
npm run dev          # frontend → http://localhost:5173 (proxy /api → 4000)
```

Le backend est **PHP + MySQL** (aucun serveur Node) : lancez d'abord le
serveur PHP sur le port 4000 — `php -S 0.0.0.0:4000 router.php` dans le
dossier déployé, ou XAMPP/Laragon — puis `npm run dev`.
`npm run build` produit `dist/`, `npm run build:php` produit `dist-php/`
(l'interface compilée à copier dans le dossier PHP).

## Comptes de démonstration

| Rôle | Identifiant | Mot de passe | Accès |
|---|---|---|---|
| **Administrateur** | `admin` | `admin2026` | Total : configuration, années, utilisateurs, annulations, bourses |
| **Économe** | `econome` | `econome2026` | Encaissements, élèves, bourses, consultation de la configuration |
| **Lecteur simple** | `lecteur` | `lecteur2026` | Consultation seule |
| **Superadmin** | `superadmin` | `super2026` | TOUS les établissements : console « Administration générale » |
| Admin (démo 2ᵉ étab.) | `admin-lycee` | `lycee2026` | Administrateur du Lycée Classique de Mbalmayo (jeu de démo) |
| **Censeur** | `censeur` | `censeur2026` | Pédagogie du cycle (6ᵉ→3ᵉ) : notes, bulletins, discipline en lecture |
| **Surveillant général** | `surveillant` | `surveillant2026` | Discipline de l'établissement |
| **Surveillant de secteur** | `surv-secteur` | `secteur2026` | Discipline de ses classes attribuées |
| **Titulaire** | `titulaire` | `titulaire2026` | Consultation complète de sa classe (6ème A) |
| **Enseignant** | `enseignant` | `enseignant2026` | Saisie de ses notes (Maths, Physique-Chimie), ses bulletins |
| **Opérateur de saisie** | `operateur` | `operateur2026` | Tous les droits sur notes et discipline |

## Nouveautés v7.2 — Transport AUREL1 (contournement WAF)

- **Envoi de la base encodé en base64** (`corpsPush` dans `src/core/api.js`,
  décodage dans `api/index.php`) : les pare-feu applicatifs d'hébergement
  (WAF/ModSecurity) qui refusent les gros POST JSON (HTTP 406) ne peuvent
  plus inspecter ni bloquer l'enregistrement. L'ancien format JSON reste
  accepté pour la compatibilité. Le diagnostic intégré (`diagRun`) utilise
  le même transport que l'application.
- E2E dédié (`tests/php-e2e-sync.cjs`) : le transport AUREL1 est décodé par
  le serveur (409 propre sur révision périmée) et le JSON legacy reste
  accepté.

## Nouveautés v7.1 — Diagnostic de connexion intégré

- **Badge de synchronisation cliquable** : la fenêtre « Diagnostic de
  connexion » rejoue depuis le navigateur les appels exacts de l'application
  (fetch natif ou remplacé par une extension, sonde `api/health`, lecture et
  envoi authentifiés vers MySQL), affiche statut HTTP + latence + verdict par
  test, liste les dernières erreurs d'envoi horodatées, et propose
  « Réessayer l'envoi maintenant ».
- **Journal des échecs d'envoi** (8 derniers, horodatés) conservé en session.
- Rappel d'architecture : chaque enregistrement est écrit immédiatement dans
  MySQL ; la file d'attente locale n'intervient que si le serveur devient
  injoignable (conservation anti-perte + réessai automatique).

## Nouveautés v7.0 — Fonctionnement en ligne sur internet (flotte d'établissements)

- **Correction définitive du « Serveur injoignable » sur les hébergements
  internet** : de nombreux hébergeurs (PHP en CGI/FastCGI) ne transmettent
  pas l'en-tête `Authorization` à PHP — la connexion réussissait puis chaque
  enregistrement était refusé. Le jeton de session est désormais aussi envoyé
  dans l'en-tête `X-Aurel-Token` (toujours transmis) et le serveur accepte
  l'un ou l'autre.
- **Sessions à renouvellement glissant** : le jeton est réémis
  automatiquement pendant le travail — plus de session qui expire en pleine
  journée.
- **Utilisation simultanée par plusieurs opérateurs** : quand deux
  opérateurs enregistrent en même temps, la base locale est **fusionnée**
  avec la base du serveur (fusion à trois voies, document par document) —
  le travail de chacun est conservé.
- **Indicateur de synchronisation permanent** dans la barre supérieure
  (« Base à jour » / « Enregistrement… » / « Hors ligne — file d'attente »)
  et **garde anti-perte** à la déconnexion si des modifications n'ont pas
  été confirmées par le serveur.

## Nouveautés v6.9 — Correction « Serveur injoignable » après installation

- **Cause du défaut** : sur un serveur distant, le premier appel peut être
  lent (PHP à froid + MySQL distant). Une connexion cliquée avant la fin de
  la détection du serveur basculait par erreur en **mode local de secours**
  — les saisies restaient dans le navigateur et disparaissaient à la
  reconnexion (la base du serveur, elle, était restée vide).
- **Corrections** : la connexion **attend** la détection du serveur ; la
  sonde passe à 8 s et est **retentée** à chaque tentative ; le repli local
  est signalé par un **avertissement clair** sur l'écran de connexion ; une
  base locale de secours n'est **jamais envoyée** au serveur ; les refus du
  serveur affichent leur **vrai motif** (session expirée, erreur explicite)
  au lieu d'un trompeur « Serveur injoignable ».

## Nouveautés v6.8 — Premier superadministrateur (réseau d'établissements)

- **Réseau d'établissements** : pour piloter plusieurs écoles (groupe
  scolaire, réseau), la case « Réseau d'établissements » de l'installateur
  crée aussi le compte **superadministrateur** — identifiant, nom et mot de
  passe dédiés. Il accède à la console réseau : vue consolidée, création et
  suspension d'établissements, comptes et journal du réseau.
- **Installations existantes** : l'administrateur crée le premier
  superadministrateur depuis Utilisateurs & profils — le profil
  « Superadministrateur — console réseau (premier compte) » n'apparaît que
  tant qu'aucun n'existe ; ensuite, seuls les superadministrateurs en créent
  d'autres.
- **Correction du mode local** (sans serveur PHP) : la base locale était
  réamorcée à chaque rechargement — les saisies sont désormais conservées.

## Nouveautés v6.7 — Installation 100 % production, base MySQL distante

- **Fin du mode démonstration** : l'installateur ne propose plus aucune
  donnée de simulation. Deux choix uniquement : « Base vide prête pour la
  production » (avec le **nom de votre établissement** et l'unique compte
  administrateur) et « Se connecter à une base existante » (mise à jour
  sans perte).
- **Base MySQL distante (phpMyAdmin)** : l'assistant guide l'installation
  sur un serveur de bases **local** (XAMPP) ou **distant** — hébergement
  web, serveur dédié : aide sur l'hôte (« localhost » ou
  sql.votredomaine.com), et chaque erreur MySQL est traduite en conseil
  concret (accès distant non autorisé pour l'utilisateur, base à créer
  depuis phpMyAdmin, droit CREATE manquant, serveur injoignable…).
- **Établissement vierge** : le nom saisi à l'installation remplace
  l'ancien libellé de démonstration ; adresse, téléphone et e-mail sont
  laissés vides à compléter dans Paramètres.
- **Messages d'erreur encore plus précis** (validation champ par champ,
  saisies conservées) et **délai MySQL réduit à 10 s** : un serveur
  distant injoignable affiche un message clair au lieu de bloquer.

## Nouveautés v6.6 — Fiabilité des enregistrements, suppression multiple, journal par établissement

- **Correction du bug « noms qui disparaissent »** : deux enregistrements
  rapprochés (ou un import CSV pendant un enregistrement) pouvaient entrer
  en conflit à la synchronisation serveur — le second était rejeté et
  disparaissait de la liste. Les envois sont désormais **sérialisés** et la
  base reçue du serveur n'est plus jamais renvoyée ni appliquée par-dessus
  une modification locale.
- **Suppression multiple d'élèves** : cases à cocher dans la liste des
  élèves, « Tout cocher » par page, confirmation groupée. Les élèves ayant
  des paiements sont ignorés (sécurité comptable) ; notes, discipline et
  bourses des élèves supprimés sont purgés.
- **Journal d'activité par établissement** : le superadministrateur voit les
  actions de **tous** les établissements (+ administration générale, filtre
  par établissement) ; l'administrateur d'un établissement ne voit **que**
  les actions de son établissement (y compris les connexions de ses
  propres comptes).
- **Installateur précis** : chaque champ est validé avec un message
  explicite (identifiant administrateur, utilisateur MySQL, nom de base,
  port…), les erreurs MySQL sont traduites en conseils (serveur non démarré,
  mot de passe incorrect, base inexistante…), le formulaire **conserve les
  saisies** en cas d'erreur et la section « Identifiant administrateur »
  est visible d'office (elle était masquée alors que le mode « Base vide »
  est le choix par défaut).

## Nouveautés v6.5 — Devoirs pondérés par séquence

- **Devoirs par séquence (admin)** : pour chaque séquence, l'administrateur
  définit **0 à N devoirs**, chacun avec son **pourcentage** (total = 100 %) —
  menu Pédagogie → structure → Séquences & appréciations, bouton « Devoirs ».
- **Note séquentielle calculée** : pour une séquence qui comporte des devoirs,
  la note de chaque élève est **calculée automatiquement** :
  Σ (note de devoir × pourcentage). Une séquence sans devoir garde la saisie
  directe d'une note unique (aucun changement pour les années passées).
- **Saisie par devoir** : la saisie des notes propose une colonne par devoir
  (matière ou élève), la note séquentielle s'affiche en temps réel ;
  bordereaux et exports CSV incluent les colonnes de devoirs.
- **Bulletins intacts** : les notes de devoir **n'apparaissent pas** dans les
  bulletins — seules les notes séquentielles (calculées) et trimestrielles
  y figurent, comme auparavant.
- **Suivi de saisie** : le scan des notes manquantes compte un élève complet
  quand TOUS les devoirs de la séquence sont saisis.

## Nouveautés v6.4 — Installation sans perte, sauvegarde automatique, menus

- **Installateur repensé** : la nouvelle installation propose par défaut une
  **base vide sans aucune donnée de test** ; le mode **« Se connecter à une
  base existante »** reprend l'ancienne base MySQL **telle quelle**
  (élèves, paiements, comptes, réglages, modèles…) sans aucune perte —
  idéal pour une montée de version ou un changement de poste ; la page
  « déjà installée » rappelle la procédure de mise à jour.
- **Sauvegarde automatique** (Personnalisation → Sauvegarde auto, admin) :
  répertoire au choix **local ou réseau**, **fréquence variable** (1 h, 6 h,
  12 h, jour, semaine), nombre de copies conservées, première sauvegarde
  immédiate, test du répertoire, sauvegarde à la demande, déclenchement
  paresseux à chaque requête API, purge automatique. Restauration par
  **import ZIP ou JSON** (fichiers `aurel-sauvegarde-*.json`).
- **Menus réorganisés avec cohérence** : Scolarite → Finances (suivi puis
  paramétrage) → Pédagogie — structure → Pédagogie — notes & bilans →
  Administration ; les libellés et les droits par profil sont inchangés.

## Nouveautés v6.3 — Modèles de documents modulables & thème de couleurs

- **Concepteur de modèles intégré** (Personnalisation → Modèles de documents) :
  bulletins (séquence/trimestre/année), tableaux d'honneur, certificats de
  scolarité, badges et cartes scolaires (85 × 55 mm) deviennent **totalement
  modulables** : disposition libre des champs (canevas au millimètre, glisser /
  redimensionner), ajout / modification / suppression de blocs, styles complets
  (police, taille, gras, italique, souligné, alignement, couleurs, bordure),
  page (format, orientation, marges, fond), tableaux de notes paramétrables,
  champs dynamiques (`{eleve.nom}`, `{notes.moyenne}`…), **import / export
  JSON**, duplication et modèle par défaut par type. Le modèle standard reste
  toujours disponible. Moteur : `src/core/modeles.js` + `ModeleReport.jsx`
  (`TemplateReport`) + `ModeleDesigner.jsx`.
- **Thème de couleurs** (Personnalisation → Thème) : couleur primaire +
  accent (6 palettes ou couleurs libres), nuances calculées automatiquement,
  appliquées immédiatement à toute l'interface via variables CSS
  (`varsTheme`/`appliquerTheme`) ; retour au thème d'origine en un clic.
- Sélecteur de modèle sur les pages d'impression (Bulletins & rapports,
  tableaux d'honneur, certificats, cartes & badges).

## Nouveautés v6.2 — Synthèse des notes manquantes par évaluation

- L'onglet « Notes manquantes » s'ouvre désormais sur une **synthèse
  matricielle** : liste des matières du plan de chaque classe avec, pour
  chaque **évaluation** (S1…S6 en colonnes) et chaque **classe** (groupes),
  le **nombre de notes manquantes** — totaux par matière, par séquence,
  par classe et TOTAL GÉNÉRAL.
- Cellules cliquables (matière × séquence) ouvrant directement la grille
  de saisie ; KPI (notes manquantes, matière-évaluations à compléter,
  classes concernées) ; export CSV de la synthèse.
- La vue « Séquence donnée » (détail par évaluation : élèves sans
  note, feuille de contrôle, tri vides d'abord) reste accessible par un
  bouton. Moteur : `scanNotesManquantesAnnee()` (business.js).

## Nouveautés v6.1 — Scan des notes manquantes

- Nouvel onglet **« Notes manquantes »** dans *Saisie des notes* : pour la
  classe et la séquence (évaluation) choisies, détection **automatique** des
  matières du plan **sans note**, **partielles** ou **complètes**, avec la
  liste des élèves sans note, dépliable matière par matière.
- Indicateurs en temps réel (matières à compléter, total des notes
  manquantes, élèves sans aucune note), **badge permanent** sur l'onglet,
  tri « vides d'abord », horodatage du scan et bouton **Saisir** par
  matière (bascule directe vers la grille de saisie).
- **Feuille de contrôle** imprimable (matières à compléter, élèves
  concernés, case « saisie faite » à cocher) et **export CSV** — conçus
  pour l'agent de saisie. Moteur : `scanNotesManquantes()` (business.js).

## Nouveautés v6.0 — Bulletins modèle, APC, cartes 8,5×5,5 cm

- **Récapitulatif annuel conforme au modèle fourni** : colonnes `Moy.Cla.`
  et `Rang` par discipline, **RÉSULTATS ANNUELS** (T-Points, T-Coef, Moy,
  Rang, Min, Max — élève/classe), **MENTION(S) TRAVAIL**, **BILAN
  DISCIPLINAIRE ANNUEL** (absences J/NJ + consignes), **DÉCISION DU CONSEIL**
  (Promu/Redouble/Exclu à cocher), note bilingue ; le bulletin de séquence
  reprend le même en-tête (blocs République/établissement) et les mêmes
  colonnes. Nouveau moteur : `rangMatiere()` (moyenne de classe + rang par
  matière).
- **Deux modes d'appréciation par classe** : `classique` ou `apc`
  (Approche Par Compétences — Non Acquis, En cours d'acquisition, Acquis,
  Expert), choisi sur la fiche classe (`appreciationMode`) ; **appréciation
  des moyennes** avec sa propre échelle déclinée dans les deux modes
  (collections `appreciationsApc`, `appreciationsMoyenne`,
  `appreciationsMoyenneApc`, auto-corrées par `ensureBase`).
- **Cartes scolaires au format exact 8,5 × 5,5 cm** : en-tête bilingue
  RÉPUBLIQUE/établissement, photo, identité, matricule, classe, régime,
  année scolaire, QR — planche A4 à découper (badge : 7,5 × 4,5 cm).
- **Anciens élèves** : l'ancien matricule est repris automatiquement sur
  la fiche préremplie (à conserver ou ajuster).
- **Interface modernisée** : navigation latérale actuelle (icônes
  encadrées, pilule active dorée, séparateurs de groupes), barre
  supérieure vitrée, cartes/boutons adoucis — palette navy/or conservée.

## Nouveautés v5.7.2 — Base de données « aurel_school »

- Le nom de la base MySQL **par défaut** est désormais **`aurel_school`**
  (champ de l'installateur, repli du code, documentation) — les données
  vivent dans le MySQL/MariaDB de XAMPP, visibles dans phpMyAdmin
  (tables `entities` et `meta`).

## Nouveautés v5.7.1 — Correctifs de fiabilité

- **Installation « base vide »** : les **notes** et les **faits de discipline**
  de la démonstration sont désormais purgés comme les autres données —
  aucune donnée d'essai résiduelle en production.
- **Protection des données réelles** : `POST /api/reset` (bouton
  « Réinitialiser les données de démonstration ») est **refusé (403)** sur
  une base installée en mode production ; le bouton disparaît de la page
  Utilisateurs (il ne s'affiche que sur une base de démonstration). Un
  drapeau `demo` accompagne les réponses de `/api/auth/login` et `/api/db`.
- `Users.jsx` : le clic attend la fin de la réinitialisation (`await`) et
  n'annonce le succès que si le serveur l'a confirmée.
- Textes d'accompagnement corrigés : stockage **MySQL exclusif** (plus de
  mention SQLite), dossier d'installation `aurel-school-siges`, effectifs
  réels de la démonstration (461 élèves, 2 150 paiements), tests inclus.

## Nouveautés v5.7 — Menus, WhatsApp, imports, absences en heures

- **Absences en HEURES** : durée, synthèses J/NJ, sanctions par plages,
  bilans et bulletins exprimés en heures (plus de demi-journées).
- **WhatsApp aux parents** (`WaBtn`, `waPhone`/`waLink`) : résumé du
  bulletin (moyenne, rang, appréciation) depuis chaque ligne de la
  page Bulletins ; bilan financier (net, payé, solde) depuis la
  situation d'un élève. Numéro camerounais normalisé (9 chiffres →
  +237), message pré-rempli, aucun contact = message clair.
- **Import / export / impression à chaque niveau** :
  `ImportBtn` + `parseCsvText` (élèves en masse, matières,
  enseignants) ; exports CSV résultats/notes/plan/matières/
  enseignants/séquences/faits ; `ListeReport` + `PrintListeBtn`
  (listes A4 imprimables sur toutes les pages de listes).
- **Saisie par élève** : KPI « Moyenne annuelle / 20 » avec rang
  annuel, en temps réel à côté de la séquence courante.
- **Menus réorganisés** : Scolarité • Finances • Pédagogie •
  Administration ; « Discipline & absences » ; titres de pages
  alignés sur le menu ; aide reformulée (Personnalisation des états).
- **Bulletins à 20 cm** : `@page` marges 10 mm/5 mm → 200 mm utiles,
  aperçu `.rcp` à 756 px, ajustement automatique inchangé (fit page).
- Graine : téléphones à 9 chiffres (Cameroun), `seedV` 13.

## Nouveautés v5.6 — Saisie des absences par classe, A4, sécurité

- **Saisie des absences PAR CLASSE** (`Discipline.jsx`) : grille de la
  classe (comme la saisie des notes) — durée (½ j.), justification et
  motif par ligne, enregistrement immédiat, navigation clavier
  (Entrée/flèches), totaux du jour, suppression en ligne ; périmètre
  de l'utilisateur respecté (`scope.canClasse`).
- **Bulletin ajusté à l'A4 en largeur ET hauteur** (`ReportModal`) :
  aperçu à la largeur d'impression (`.m-b .rcp` = 718 px = 190 mm) ;
  à l'impression la zone est mesurée à cette largeur puis réduite par
  `zoom` (propriété de mise en page — le document tient réellement
  sur la page, contrairement à `transform: scale`). `fit="page"` :
  une page A4 (bulletin, récapitulatif annuel, tableaux d'honneur) ;
  `fit="width"` (défaut) : pagination naturelle des documents longs,
  avec `thead` répété et `page-break-inside: avoid`.
- **Sécurité serveur** (`api/`) :
  - `aurel_db_changes_allowed()` : contrôle des DROITS sur chaque
    POST /api/db (users/etablissements réservés aux admin ; lecteur
    en lecture seule hors journal + propre `dernierAcces`) ;
  - `hash_equals` pour les mots de passe ; throttle 5/30 s par
    IP+compte et 15/120 s par IP (fenêtre 15 min) ;
  - CSP pages + API, Permissions-Policy, plafond 24 Mo (413),
    erreurs aseptisées (`data/error.log`), `.htaccess` élargi
    (json/config), `aurel_log_error()`.
- **Sécurité client** : `richText()` remplace `dangerouslySetInnerHTML`
  dans ConfirmModal (seuls `<b>`/`<br>` interprétés) ; `Store.reset()`
  à la déconnexion en mode serveur (aucune donnée résiduelle).
- UI : grille d'absences, `.cell-in`, aperçu A4, impressions
  multi-pages propres, micro-polish (états pressés, transitions).

## Nouveautés v5.5 — Discipline, sécurité des bulletins, documents scolaires

- **Faits de discipline en 3 onglets** (`Discipline.jsx`) : Faits,
  Absences, Bilans & sanctions.
- **Absences en demi-journées** : saisie par classe/élève/date/durée
  (1–60 ½ j.), justifiée ou non, motif ; trimestre déduit de la date
  (`trimestreOfDate` : T1 sept.–déc., T2 janv.–mars, T3 avr.–août).
- **Synthèse par élève** (`absencesDe`) : J/NJ/total + sanction
  applicable (`sanctionAbsencesFor`), filtre trimestre/année ; journal
  éditable.
- **Sanctions paramétrables par plages** (`sanctionsAbsOf`,
  `defaultSanctionsAbs` : 3-5 avertissement écrit, 6-9 blâme, 10-14
  exclusion temporaire, 15+ conseil de discipline) — édition dans
  Personnalisation → Discipline, chevauchements refusés
  (`M.setSanctionsAbs`).
- **Bilans disciplinaires** : tableau élève × T1/T2/T3/année (J, NJ,
  autres faits, sanction) + impression A4 signée ; totaux d'absences
  intégrés au récapitulatif annuel.
- **Bordereaux enrichis** (`statsNotes`) : min/max/moyenne générale,
  taux de réussite ≥ 10, répartition par intervalle **avec
  pourcentages** (bordereau de classe et bordereau de matière).
- **QR code de sécurité** (`qrcode.js` : encodeur + `bulletinQrData` +
  `verifieQrTexte`) : payload `AUREL-SIGES|ETAB|AN|ELV|CLA|PER|MOY|
  RANG|EMIS|SIG` signé SHA-256 (code de l'établissement) sur chaque
  bulletin et récapitulatif ; bouton **« Vérifier un bulletin »** :
  coller le texte du QR → authentique / NON CONFORME (falsification
  détectée). Code généré dans Personnalisation → Bulletin.
- **Bulletin paramétrable + tenue A4** : sections activables une à
  une (`BULLETIN_DEFAUT.sections`), largeur ET hauteur ajustées à
  l'A4 ; QR présent sur les bulletins de séquence et le récapitulatif.
- **Documents scolaires** (`Bulletins.jsx` + `Reports.jsx`) :
  tableaux d'honneur (seuils félicitations/honneur paramétrables),
  certificats de scolarité (1 par élève), cartes scolaires et badges
  (planche à découper, photo, matricule, régime, QR de contrôle).
- **Organisation** : titulaire par classe (fiche classe + colonne +
  bulletin, périmètre `classesIds` synchronisé par `saveClasse`),
  censeur par niveau (colonne Niveaux, `censeursOf`) ; périmètre
  enseignant (ses classes uniquement) vérifié en saisie des notes.
- Encart `.lc-ok`/`.lc-err` pour les confirmations/refus (vérification
  QR) ; `data-qr` sur les SVG pour lecture/contrôle.

## Nouveautés v5.4 — Une note par séquence, récapitulatif annuel, 4 analyses

- **Une seule évaluation par séquence** : plus de devoir/composition — une
  note unique par élève × matière × séquence (`saveNote` sans type, seed :
  380 notes type `evaluation`). Moyennes, appréciations, reconduction et
  annulation adaptées.
- **Récapitulatif annuel des notes** (`RecapAnnuelReport`) : A4 portrait
  conforme au modèle fourni — en-tête 2 blocs (République / Diocèse +
  collège), identité complète, matières groupées par groupe du plan avec
  notes par séquence + Moy./Coef/Points + appréciation, totaux par groupe,
  bilan disciplinaire annuel, synthèse par groupe (moyenne générale, rang),
  « Fait à …, le … » + signature.
- **Personnalisation du bulletin** (Paramètres → Bulletin) : `BULLETIN_DEFAUT`
  (titre, lieu, signature, blocGauche, blocDroit) mergé dans la base.
- **Règle NC v5.4** : non classé **uniquement** si l'élève n'obtient **aucune**
  note dans l'**ensemble** des matières indispensables (`oblig.every(...)`),
  une seule note suffit à classer. Fiche classe : compteur, Tout
  cocher/décocher, hint.
- **Statistiques : 4 analyses séparées** (`Stats.jsx`) — par classe, par
  matière, par niveau, par cycle ; période, CSV, graphique, impression A4.
- **Bordereaux par classe** (`BordereauClasseReport`) : moyennes, rangs,
  moyennes par groupe ; **Tout l'établissement** (`ToutEtabReport`) :
  bordereaux de toutes les classes en un clic.
- **Élèves** : infos de paiement (solde, chips, échéances, wallet/Situation)
  réservées à l'économe (`voitPaiements`).
- **Plan des enseignements** : groupe de l'entrée du plan affiché dans la
  liste (bug : lu sur la matière), plus de « à attribuer ».
- `ReportModal` : l'auto-impression se re-déclenche si une autre impression
  remplace la modale ouverte.

## Nouveautés v5.0 → v5.3 (résumé)

- **v5.0** : saisie des notes (séquences libres, poids trimestriels,
  appréciations par fourchettes), bordereaux, reconduction/annulation.
- **v5.1** : console réseau du superadmin (suspension d'établissement,
  comptes, journal fusionné).
- **v5.2** : saisie par élève, navigation clavier, matières indispensables
  par classe, tableaux de bord par profil.
- **v5.3** : bulletins individuels (séquence/trimestre/année), statistiques
  v1, encaissement retiré de la barre.

## Nouveautés v4.2 — Nouvelle palette

- **Palette marine / terracotta / or / ivoire** : `#2C3A63` (barre latérale,
  boutons principaux, entêtes), `#B85A34` (accents, survols, liens),
  `#E3A73C` (élément actif, badges), `#F3F1EC` (fond). Les états imprimés
  conservent leurs en-têtes gris sobres.

## Nouveautés v4.1 — Le plan au centre de la pédagogie

- **Ni groupe ni coefficient sur les matières** : ils sont attribués **par
  classe** dans le plan des enseignements (matière × enseignant ×
  coefficient × groupe × ordre au bulletin).
- **Clonage par enseignement** : copier une matière (coefficient, groupe,
  enseignant) vers une ou plusieurs classes en un clic ; les classes où la
  matière est déjà au plan sont ignorées (pas de doublon).
- Fond ivoire `#F3F1EC` (v4.2 ; white smoke en v4.1).
- **Tests étendus** : comptes nouvellement créés (connexion + périmètres)
  et balayage automatique de tous les boutons des 19 pages.
- Correctifs : attributions réactives dans le formulaire de comptes,
  filtres des pages Saisie des notes et Discipline.

## Nouveautés v4.0 — Refonte design & pédagogie complète

- **Refonte totale du design** : palette marine / terracotta / or / ivoire (`#2C3A63` `#B85A34`
  `#E3A73C` `#F3F1EC`) — remplacée en v4.2, voir ci-dessus.
- **Groupes de matières** (code + libellé) et **catalogue de 43 matières**
  de l'enseignement général et technique (code, libellé, groupe).
- **Gestion des enseignants** : fiches complètes (matricule, état civil,
  contacts, spécialité, diplôme, grade, embauche, statut), CRUD + recherche.
- **Plan des enseignements** : par classe — matière × enseignant ×
  coefficient × groupe × ordre au bulletin ; totaux par groupe et global ;
  ajout/modification/suppression ; **clonage en un clic** vers une ou
  plusieurs classes ; vues croisées (enseignements d'un enseignant,
  enseignants d'une matière).
- **Bulletins** : matières du plan dans l'ordre du bulletin, coefficients
  affichés, moyenne générale pondérée par les coefficients du plan.
- Le périmètre de l'enseignant (matières + classes) découle désormais de
  son plan d'enseignements (fiche enseignant liée au compte).

## Nouveautés v3.0 — Profils, Pédagogie & Discipline

- **Profils par établissement** : administrateur, censeur/préfet des études
  (responsable d'un cycle = ensemble de niveaux), surveillant général,
  surveillant de secteur (classes attribuées), titulaire de classe,
  enseignant (ses matières), opérateur de saisie (notes + discipline),
  économe, lecteur — plus le superadministrateur multi-établissements.
- **Cinq grands menus** : Inscriptions, Paiements, Pédagogie, Discipline,
  Configuration — filtrés par profil, listes bornées au périmètre.
- **Tableau de bord adaptatif** : indicateurs appropriés à chaque profil.
- **Pédagogie** : matières et coefficients, saisie des notes par
  classe × matière × séquence (1-6) × évaluation (composition ×2),
  bulletins avec moyennes pondérées, rangs, impression.
- **Discipline** : faits catégorisés avec gravité et sanction, filtres,
  historique, périmètre par classes.
- **Connexion en deux volets** : diapositives de la vie scolaire à gauche,
  carte épurée à droite sur fond vert forêt ; couleurs du drapeau du
  Cameroun sur la carte (bande tricolore, bouton vert) et étoile dorée
  au centre.

## Nouveautés v2.2 — Sécurité internet & connexion épurée

- **Page de connexion épurée** (style Tailwind, sans dépendance) : une carte
  centrée, aucune indication trahissant un compte — message unique
  « Identifiants incorrects » (inconnu / mauvais mot de passe / mauvais
  établissement), plus d'identifiant d'exemple ni de mention de rôles,
  d'algorithme ou de mode serveur.
- **Réinstallation protégée** par le code secret de `config.php`.
- **En-têtes de sécurité** (nosniff, anti-cadrage, no-referrer, noindex),
  CORS ouvert supprimé, délai serveur à chaque échec de connexion.
- **Correctif OPcache** : relecture du secret sans cache.

## Nouveautés v2.1 — Multi-établissements

- **Plusieurs établissements**, chacun avec sa configuration propre — le
  superadministrateur crée, modifie, supprime (en cascade, confirmée) et
  entre dans n'importe quel établissement.
- **Sélecteur d'établissement à la connexion** (ou détection automatique
  selon le compte) ; un compte rattaché à un autre établissement est refusé.
- **Console « Administration générale »** : statistiques consolidées, comptes
  de tous les établissements, journal global.
- **Sauvegarde / restauration ZIP** de l'ensemble des établissements.
- Nom : **Aurel School SIGES** — Système Intégré de Gestion des
  Établissements Scolaires ; logo et icônes officiels ; titre de fenêtre
  « Aurel School SIGES ».

## Nouveautés v2.0 — Identité visuelle

- Page de connexion : thème **forêt équatoriale**, **drapeau du Cameroun**
  en exergue, images de la vie scolaire, design responsive (téléphones /
  tablettes) sans débordement.

## Nouveautés v1.11

- **Inscriptions : tarifs nouveaux / anciens élèves** — un frais peut
  porter des montants distincts selon le statut (nouveau = plein tarif,
  ancien = tarif réduit). Dans la grille tarifaire, une couche
  « Tous élèves / Nouveaux / Anciens » permet de saisir chaque montant ;
  le statut de l'élève (badge Nouveau/Ancien, champ en fiche) est
  déduit automatiquement : même nom + prénom une année antérieure, ou
  réinscription via le bouton d'année suivante → ancien.
- **Lisibilité & ergonomie** : en-têtes de tableaux figés au défilement,
  focus clavier visible, animations discrètes, barre de navigation dorée.
- **Page de connexion** : panneau bicolore — haut blanc, bas gris.
- **Correctif PHP/MySQL** : la (ré)installation sur une base MySQL
  existante remplace désormais réellement les données de `aurel_school`.

## Nouveautés v1.10

- **Classes & niveaux : CRUD complet** — ajout, modification et
  suppression toujours possibles ; la suppression d'un niveau/classe
  contenant des élèves demande une confirmation explicite (cascade avec
  compteurs : classes, élèves, paiements, tarifs).
- **Anciens élèves** : import de la liste (CSV Excel ou JSON, colonnes
  reconnues automatiquement) et, à l'inscription, recherche de l'élève
  ancien → fiche **préremplie** (identité, parents, tuteur, adresse…),
  il reste à compléter matricule et classe. Les dossiers des années
  précédentes sont aussi proposés. Un élève nouveau se saisit normalement.
- **Stockage MySQL exclusif** : base `aurel_school` (hôte, port, utilisateur,
  mot de passe et **nom de la base** choisis à l'installation, création
  automatique) — accessible via phpMyAdmin ou tout client MySQL.
- **Démarrage automatique** : scripts d'installation du démarrage avec
  l'ordinateur (Windows : `INSTALLER-DEMARRAGE-AUTO.bat` ; Linux :
  service systemd utilisateur).

## Nouveautés v1.9

- **Types de frais — suppression libre** : un frais utilisé par des paiements
  peut désormais être supprimé après une confirmation explicite (les
  paiements, bourses et tarifs associés sont supprimés avec lui, montants
  rappelés). Sans paiement, suppression directe.
- **Ajout de types de frais** : tout nouveau frais reçoit une tranche
  unique par défaut (100 %) — immédiatement utilisable dans la grille et
  les situations.
- **Noms des utilisateurs actualisés partout** : après modification d'un
  compte, la barre supérieure, le journal d'activité (résolution par
  identifiant) et la colonne « créée par » des bourses affichent le nom
  à jour.

## Nouveautés v1.8

- **Sauvegarde ZIP** : « Exporter la base (ZIP) » (admin) — archive complète
  (élèves, paiements, bourses, configuration, comptes, personnalisation).
- **Import ZIP** : « Importer une base (ZIP) » — remplace l'intégralité des
  données par celles de l'archive, après confirmation (validation du contenu).
- **Droits par utilisateur** : l'administrateur définit module par module
  (hérité / aucun / lecture / écriture) les accès de chaque compte —
  appliqués immédiatement, y compris aux sessions ouvertes.
- **Verrouillage de session** : déconnexion automatique après 5 minutes
  d'inactivité.
- **Actualisation automatique** : sondage de révision — toute modification
  (autre poste, autre onglet) apparaît sans rechargement.
- **En-têtes des rapports** : plus aucun fond bleu (bandeau et colonnes en
  gris clair neutre).
- Le bouton « Supprimer les données de test » (v1.7) reste dans
  Personnalisation des états.

## Déploiement — PHP + MySQL uniquement

`AurelSchoolSIGES-v4.2.zip` — l'application complète (interface React
compilée + API PHP) déployable sur n'importe quel hébergement
**PHP 7.0+ avec MySQL/MariaDB** : stockage **MySQL exclusif** (base
`aurel_school` par défaut, création automatique), assistant d'installation
(`install.php` : démo complète ou base vide + compte admin), lanceurs
`php -S`, démarrage automatique (XAMPP, WAMP, Laragon, mutualisé),
protection `.htaccess`, tests inclus dont un bout-en-bout
React ↔ PHP/MySQL (`tests/php-e2e-mysql.cjs`). Aucun Node.js requis.

## Nouveautés v1.7

- **Suppression des données de test** : dans « Personnalisation des états »
  (administrateur), carte « Données de test » avec compteurs — un bouton
  purge élèves (photos incluses), paiements, bourses et journal après
  confirmation explicite. La configuration est **conservée** : années,
  niveaux, classes, types de frais, grilles tarifaires, comptes
  utilisateurs et personnalisation. Idéal pour passer en production.

## Nouveautés v1.6

- **Annulation des réductions d'un élève** : bouton « Annuler les réductions »
  dans la situation de l'élève — suspend toutes ses bourses actives (avec
  confirmation), recalcule nets, soldes et échéances au tarif complet.
- **Clonage de grille tarifaire** : depuis la vue « Par classe » de la grille,
  bouton « Cloner vers… » — copie les tarifs spécifiques d'une classe vers
  autant de classes que souhaité (option : inclure les couches
  interne/externe), avec remplacement des tarifs spécifiques existants.
- **Photos des élèves** : import depuis la fiche d'inscription (PNG/JPG,
  400 Ko max, aperçu immédiat) — affichées dans la liste des élèves, la
  situation, les encaissements et l'état imprimable.
- **Lisibilité renforcée** : zébrage des lignes de tableaux (en préservant la
  surbrillance des insolvables), contrastes des libellés secondaires,
  espacements et badges aérés.

## Nouveautés v1.5

- **En-têtes gris clair** : les en-têtes de tableaux (application et états)
  passent du fond bleu à un gris clair neutre, plus sobre et lisible.
- **Statistiques et répartition par âge séparées** : deux états distincts —
  « Statistiques des inscrits » (genre & classes, internes/externes) et
  « Répartition par âge » (tranches d'âge par classe, âge moyen).
- **États redensifiés** : bloc d'informations encadré, en-têtes de colonnes
  sans repli, montants insécables, colonne Date · Heure fusionnée dans le
  journal de caisse, lignes de groupes (CAISSE / BANQUE) mises en évidence.
- **Logo téléversé partout** : le logo importé dans la personnalisation est
  désormais repris dans la barre latérale et sur la page de connexion, en
  plus des reçus et états.
- **Encaissements** : chronologie fiable (plus aucun paiement de démonstration
  à une heure future — le dernier encaissement apparaît toujours en tête) et
  **bouton Imprimer** sur la page des encaissements (journal de caisse de la
  période filtrée, impression automatique).
- **Correction — noms d'utilisateurs** : le nom affiché (barre supérieure)
  se met immédiatement à jour après modification d'un compte.
- **Correction — exports CSV** : chaque export ouvre une fenêtre avec
  **Télécharger**, **Copier** (pressepapiers) et aperçu du contenu —
  fonctionne même dans les aperçus sécurisés qui bloquent les téléchargements.

## Nouveautés v1.4

- **Personnalisation des états** (page Administration → Personnalisation) :
  **import du logo** de l'établissement (PNG/JPG/SVG, 400 Ko max), nom,
  sous-titre, mention, adresse/téléphone/e-mail et **pied de page** — repris
  immédiatement sur tous les reçus, rapports et états, avec aperçu en direct.
- **Statut interne / externe** des élèves : les montants des frais varient
  selon le statut — la grille tarifaire offre trois couches (Commun, Internes,
  Externes) avec priorité : tarif classe + statut > classe > niveau + statut >
  niveau. Badges Interne/Externe dans la liste des élèves et la situation.
- **Listes nominatives par classe** (imprimables) : N°, nom et prénoms, genre,
  dans l'ordre alphabétique, avec effectifs garçons/filles et interne/externe.
- **Statistiques des inscrits** (imprimables) : par **genre** et par **classe**
  (dont internes/externes), et **répartition par âge et par classe** (tranches
  d'âge, totaux croisés).
- **Page de connexion épurée** : plus aucun identifiant de démonstration
  affiché — remplacé par un avertissement d'accès réservé au personnel habilité.

## Nouveautés v1.3

- **Impression corrigée et fiabilisée** : chaque état (reçus, rapports) est cloné
  dans un hôte d'impression isolé directement sous la page — plus de page blanche,
  quel que soit le navigateur. Nouveautés imprimables : **situation des frais
  d'un élève** (fiche, frais, tranches, historique) et **situation d'une classe**
  (bouton imprimante sur chaque ligne de la page Classes).
- **États de recouvrement par frais et par tranche** : en plus de la synthèse par
  classe, recouvrement de chaque type de frais et de chaque tranche d'échéance
  (attendu, encaissé affecté aux tranches dans l'ordre, reste, taux, statut).
- **Journal de caisse sur période déterminée** : date début/fin + raccourcis
  (aujourd'hui, ce mois, cette année) — répartition **caisse** (espèces, mobile
  money) / **banque** (virement, chèque) avec sous-totaux, récapitulatif **par
  frais** et détail des reçus.
- **Signataire unique** : tous les états et rapports sont signés par
  **l'Économe** uniquement.
- **États remaniés** : tableaux à **bordures solid**, police agrandie et
  en-têtes de colonnes soulignés pour une lisibilité papier optimale.
- **Exports CSV partout** : bouton « Exporter CSV » sur toutes les pages
  (tableau de bord, élèves, paiements, bourses, années, niveaux, classes, frais,
  grille, utilisateurs, journal) + situation d'un élève et export par classe.
- **Fiche d'inscription complète** : identité (nom, prénom, sexe, date et lieu
  de naissance), père (nom, profession, téléphone), mère (nom, profession,
  téléphone), ancien établissement, adresse, tuteur/contact d'urgence —
  conforme à la fiche papier de l'établissement.
- **Design professionnel** inspiré des applications bancaires : barre latérale
  profonde à liserés or, en-têtes de tableaux clairs et soulignés, cartes à
  en-têtes délimités, KPI à liseré coloré.

## Nouveautés v1.2

- **Grille tarifaire organisée par classe** : pour chaque classe, liste des frais
  à payer, **montant total par élève** et **répartition en tranches avec
  échéances** (ex. scolarité = T1 40 % au 30/11, T2 30 % au 15/01, T3 30 % au
  15/04). Mise à jour des tarifs en place (tarif de classe prioritaire, retour
  au tarif du niveau en un clic) et éditeur de tranches (part en %, jour/mois
  d'échéance, contrôle que la somme fasse 100 %). Vue « Matrice » conservée
  pour la saisie par niveau.
- **Signalement automatique des insolvables** : dès qu'une tranche obligatoire
  est échue et non réglée, l'élève est signalé — KPI et alerte sur le tableau
  de bord (montant exigible non réglé), puce + filtre dédié et badge
  « Insolvable » sur la page Élèves, pastilles d'état par tranche
  (réglée / **en retard** / à venir) dans la situation de chaque élève.
- **Rapport « État de solvabilité d'une classe »** en trois périmètres :
  **global** (tous frais), **par frais particulier** ou **par tranche
  particulière** — exigible à ce jour, payé, reste dû, insolvables surlignés
  et chiffrés, en-tête établissement et signatures.
- Les rapports officiels sont désormais signés par **la Principale** (et non
  plus le proviseur).

## Nouveautés v1.1

- **Page de connexion professionnelle** : panneau visuel établissement
  (barre de marque, carrousel, atouts) + panneau d'authentification épuré
  (champs à icônes, badge de mode, comptes de démonstration, pied légal).
- **Bourses & réductions** : pourcentage ou montant fixe, sur tous les frais
  ou un frais précis, cumul plafonné au tarif ; déduites automatiquement des
  « nets à payer », situations, agrégats, reçus et rapports.
- **Rapports officiels imprimables** : situation d'une classe (par élève,
  nets/réductions/payé/solde), état des recouvrements de l'année (par classe,
  totaux, taux), journal de caisse du jour (répartition par mode) — en-tête
  établissement, date d'édition et blocs de signature.
- **Backend API multi-postes** : **PHP 7+ et MySQL exclusivement** (aucun
  Node en production), authentification serveur (SHA-256 + sel, jetons HMAC
  8 h, limitation des tentatives), base partagée avec **verrou de révision**
  (conflit 409 → le client se réactualise), statistiques calculées côté
  serveur, réinitialisation admin **refusée sur une base de production**
  (v5.7.1). Le frontend détecte l'API (`GET /api/health`) et affiche le mode
  (badge « API Serveur » / « Mode local »).

## Fonctionnalités (v1.0 conservées)

- Connexion sécurisée : carrousel des 3 images (Paiement, Enseignement,
  Animation), verrouillage après 5 échecs, journal des accès, session
  expirante (20 min d'inactivité).
- Tableau de bord : KPI nets, histogramme mensuel, donut, recouvrement par
  niveau, derniers encaissements, contrôles & alertes.
- Élèves : inscription (matricule auto), filtres, radiation, situation
  détaillée par frais (tarif / réduction / net / payé / solde), historique.
- Paiements : encaissement avec reçu numéroté imprimable (montant en lettres,
  paiements partiels), annulation motivée (admin), export CSV, situation par
  classe.
- Années scolaires : création avec copie de grille + réinscriptions,
  activation unique, clôture-archive, réouverture.
- Configuration : niveaux, classes, types de frais, **grille tarifaire** —
  vue par classe (frais, total, tranches, échéances) ou matrice par
  niveau/classe (tarif de classe prioritaire).
- Administration : comptes/rôles, journal d'activité, export JSON.

## API (résumé)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | état + révision (public) |
| POST | `/api/auth/login` | authentification → jeton |
| GET | `/api/auth/me` | session courante |
| GET | `/api/db` | base complète + révision |
| POST | `/api/db` | enregistrement (409 si révision périmée) |
| GET | `/api/stats/:anneeId` | agrégats calculés serveur |
| POST | `/api/reset` | réinitialisation démo (admin) |

Côté PHP : `GET /api/etablissements` (public — sélecteur de connexion).
Données : **MySQL** (tables `entities` et `meta`, base `aurel_school`).

## Architecture

```
src/
├── main.jsx / App.jsx       # entrée, layout, navigation, hôte de modales
├── styles.css               # design Tahoma / bleu marine + or (bancaire)
├── core/                    # logique pure (testée sous Node)
│   ├── sha256.js  utils.js  seed.js  business.js  store.js  api.js
├── context/AppContext.jsx   # session, DB (mutations journalisées), modales,
│                            # notifications, synchronisation serveur
├── components/              # Icons, UI, Charts, Receipt, Reports
│   └── modals/              # FormModal, PayModal, SituationModal,
│                            # ReceiptModal, ConfirmModal, EntityForms
└── pages/                   # Login, Dashboard, Eleves, Paiements, Bourses,
                             # Rapports, Annees, Niveaux, Classes, Frais,
                             # Grille, Users, Journal
api/ (dossier PHP déployé)
├── index.php                # API PHP (auth, /db, /etablissements, /reset)
└── lib.php                  # stockage MySQL exclusif (PDO) + jetons HMAC
```

## Tests

- **Noyau métier** (`tests/core.test.mjs`, Node) : SHA-256, montants en
  lettres, tarifs, bourses, agrégats, tranches & échéances, solvabilité —
  et depuis la v5.4 : moyennes pondérées séquences/trimestres/année, rangs,
  règle NC « aucune note dans l'ensemble des indispensables », totaux par
  groupe — **100/100 vérifications**.
- **Tests** (dossier `tests/`, conservés avec le projet) : noyau métier
  (14 contrôles) + régression UI consolidée v1.0→v1.6 (10 étapes) + smoke
  v1.7 (suppression des données de test) — annulation des
  réductions, clonage de grille, photos, zébrage ; rôles,
  encaissement → reçu → annulation, bourses, grille/tranches/solvabilité,
  impression (hôte isolé + impression directe), exports CSV (modale
  télécharger/copier), journal de caisse sur période, recouvrements par
  frais/tranche, fiche complète, personnalisation (logo repris partout),
  régime interne/externe, listes nominatives, statistiques séparées
  (genre/classes et âges), actualisation encaissements et noms
  d'utilisateurs, en-têtes gris.
- **E2E PHP + MySQL** (`tests/php-e2e.cjs`, `E2E_URL=…`) : parcours réel
  React ↔ PHP (jsdom) — connexion, encaissement, persistance, polling,
  déconnexion — validé sur base de test `aurel_test` réinstallée.
- **16 suites au total** : noyau 100/100, régression consolidée, smokes
  v1.7→v5.3 (connexion, rôles, encaissements, bourses, grilles, notes &
  séquences, console réseau, confort, statistiques & bulletins) — toutes
  au vert pour la v5.4.

## Notes

- Synchronisation multi-postes : modèle « dernier écrit gagne » avec détection
  de conflit (le poste retardataire est automatiquement réactualisé).
- Les mots de passe ne circulent qu'en POST (HTTPS recommandé en production) ;
  côté serveur, vérification SHA-256 + sel, jamais en clair.
