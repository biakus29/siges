# Aurel School SIGES

Application de gestion scolaire : élèves, inscriptions, finances, notes,
bulletins, absences, discipline et rapports. Le projet associe une interface
React/Vite à une API PHP qui utilise MySQL.

## Contenu du dépôt

- `siges/` : projet de développement principal (sources React, API PHP,
  configuration Vite, tests et scripts).
- `siges/src/` : interface React.
- `siges/api/` : API PHP.
- `siges/docs/` : guides utilisateur et d'installation.
- `install.php` et les scripts `DEMARRER-*` : installation et démarrage selon
  l'environnement.
- `LISEZ-MOI.txt` : informations détaillées sur l'application et ses versions.

Les fichiers `index.html` et `assets/` présents à la racine sont également
utilisés pour la distribution de l'application. Pour développer l'interface,
travaillez dans `siges/`.

## Prérequis

- Node.js et npm pour développer et compiler l'interface.
- PHP pour exécuter l'API.
- MySQL pour stocker les données de l'application.

Les paramètres de connexion MySQL sont créés par l'installateur dans
`config.php`. Ne publiez jamais ce fichier : il peut contenir un secret de
session et des identifiants de base de données.

## Développement local

Dans un premier terminal, démarrez l'API PHP depuis le dossier `siges/` :

```powershell
cd siges
php -S 127.0.0.1:4000 router.php
```

Dans un second terminal, installez les dépendances et démarrez Vite :

```powershell
cd siges
npm install
npm run dev
```

Ouvrez l'adresse locale affichée par Vite, généralement `http://localhost:5173`.
Le serveur Vite relaie les appels `/api` vers l'API PHP sur le port `4000`.

Commandes disponibles dans `siges/` :

| Commande | Utilité |
| --- | --- |
| `npm run dev` | Démarre le serveur de développement Vite. |
| `npm test` | Lance les tests du projet. |
| `npm run build` | Compile l'interface dans `siges/dist/`. |
| `npm run build:php` | Compile puis copie l'interface compilée dans les fichiers servis par PHP. |

Après compilation, `npm run build:php` met à jour des fichiers de distribution.
Vérifiez les changements avec `git status` et `git diff` avant de les valider.

## Utiliser Git avec ce projet

Git enregistre l'historique des modifications. GitHub (ou un autre hébergeur)
peut ensuite héberger le dépôt distant et faciliter le travail en équipe.

### Vérifier Git et le dépôt

```powershell
git --version
git status
git remote -v
```

`git status` indique la branche courante et les fichiers modifiés.
`git remote -v` affiche les dépôts distants configurés. Vérifiez l'adresse avant
d'envoyer du code ; ne remplacez pas une adresse distante sans connaître le
dépôt attendu.

Si vous récupérez le projet depuis un dépôt distant :

```powershell
git clone <URL_DU_DEPOT>
cd <DOSSIER_DU_DEPOT>
```

Si vous partez d'un nouveau dossier qui ne contient pas déjà `.git`, vous pouvez
créer un dépôt local avec `git init`. Ne lancez pas cette commande dans un dépôt
existant : elle ne remplace ni ne répare un dépôt déjà présent.

### Enregistrer une modification

Créez une branche pour votre changement, puis vérifiez et sélectionnez les
fichiers à enregistrer :

```powershell
git switch -c docs/guide-git
git status
git add README.md .gitignore
git diff --cached
git commit -m "docs: ajouter le guide du dépôt"
```

Remplacez le nom de branche et le message de commit par des noms décrivant votre
propre travail. `git diff --cached` permet de vérifier exactement le contenu
qui sera enregistré. Préférez ajouter les fichiers explicitement plutôt que
d'utiliser `git add .`, surtout avant d'avoir vérifié les configurations,
journaux et exports locaux.

### Synchroniser avec un dépôt distant

Après avoir vérifié `git remote -v` et le nom de votre branche :

```powershell
git pull --rebase
git push -u origin <NOM_DE_BRANCHE>
```

`git pull --rebase` récupère les changements distants et replace vos commits
locaux au-dessus de ceux-ci. Si des conflits sont signalés, ouvrez chaque
fichier concerné, choisissez le contenu correct, puis :

```powershell
git add <FICHIER_CORRIGE>
git rebase --continue
```

Ne forcez pas un `push` (`--force`) pour contourner un refus sans avoir vérifié
l'historique partagé : cela peut effacer le travail d'autres personnes.

## Fichiers à ne pas publier

Le `.gitignore` à la racine exclut les configurations locales, les dumps SQL,
les journaux, les dépendances et les fichiers de compilation. Un `.gitignore`
n'enlève toutefois pas un fichier déjà suivi par Git. Avant chaque commit,
contrôlez le résultat de `git status` et de `git diff --cached` ; ne publiez pas
de mots de passe, jetons, données personnelles d'élèves ou sauvegardes de base.

Si un secret a déjà été envoyé vers un dépôt distant, l'ajout au `.gitignore`
ne suffit pas : révoquez ou renouvelez ce secret, puis suivez la procédure de
nettoyage de l'historique du dépôt avec les personnes qui y contribuent.

## Documentation et tests

Consultez `LISEZ-MOI.txt` et les documents de `siges/docs/` pour les procédures
d'installation et d'utilisation. Avant une contribution, lancez `npm test`
depuis `siges/` et, pour une modification de l'interface, vérifiez également
`npm run build`.
