# Aurel School SIGES

Application de gestion scolaire : élèves, inscriptions, finances, notes,
bulletins, absences, discipline et rapports. Le projet associe une interface
React/Vite à une API PHP qui utilise MySQL.

## Contenu du dépôt

La racine du dépôt est directement le dossier de l'application : un clone
dans `htdocs/` s'installe tel quel.

- `index.html`, `assets/` : interface compilée, servie par PHP/Apache.
- `api/` : API PHP.
- `install.php` : assistant d'installation (crée `config.php` et la base).
- `src/` : sources React de l'interface.
- `docs/` : guides utilisateur et d'installation.
- `scripts/`, `tests/` : outils de compilation et tests.
- Scripts `DEMARRER-*` : démarrage selon l'environnement.
- `LISEZ-MOI.txt` : informations détaillées sur l'application et ses versions.

## Prérequis

- PHP et MySQL (par exemple XAMPP) pour exécuter l'application.
- Node.js et npm uniquement pour modifier et recompiler l'interface.

## Installation (XAMPP)

```powershell
cd C:\xampp\htdocs
git clone https://github.com/biakus29/siges.git
```

Démarrez Apache et MySQL, puis ouvrez `http://localhost/siges/install.php`.

`config.php` n'est **pas** dans le dépôt, c'est voulu : l'installateur le
génère avec un secret de session propre à chaque machine et les accès MySQL.
Ne publiez jamais ce fichier.

Si la base MySQL existe déjà, l'installateur reprend ses données. Après une
mise à jour (`git pull`), rechargez la page avec `Ctrl+F5` pour que le
navigateur charge la nouvelle interface.

## Hébergement sur Render

Render n'a ni PHP natif ni MySQL : l'application tourne dans un conteneur
Docker (`Dockerfile`, `render.yaml`) et la base MySQL est hébergée ailleurs,
par exemple sur Aiven (offre gratuite).

1. **Aiven** : créez un service MySQL gratuit. Notez l'hôte, le port,
   l'utilisateur (`avnadmin`) et le mot de passe, puis téléchargez le
   certificat CA (`ca.pem`).
2. **Render** : *New → Blueprint*, choisissez ce dépôt et renseignez
   `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER` et `MYSQL_PASSWORD`. Dans le
   service créé, *Environment → Secret Files* : ajoutez un fichier nommé
   `ca.pem` avec le contenu du certificat Aiven.
3. Ouvrez `https://<service>.onrender.com/install.php`, choisissez « Base vide »,
   saisissez les mêmes accès MySQL (base `aurel_school`, case « Créer la base »
   cochée) et le compte administrateur.
4. Dans Render, *Manual Deploy → Deploy latest commit*. À chaque démarrage,
   `config.php` est désormais recréé depuis les variables d'environnement
   (`SIGES_SECRET` est généré par Render). Les utilisateurs se reconnectent
   une seule fois après ce redéploiement.

Limites de l'offre gratuite : le service se met en veille après 15 minutes
sans visite (environ une minute au réveil), et le dossier `data/` (journal
d'erreurs, tentatives de connexion) est vidé à chaque déploiement. Les
données de l'école sont dans MySQL et ne sont pas touchées.

## Développement local

Dans un premier terminal, démarrez l'API PHP à la racine du dépôt :

```powershell
php -S 127.0.0.1:4000 router.php
```

Dans un second terminal, installez les dépendances et démarrez Vite :

```powershell
npm install
npm run dev
```

Ouvrez l'adresse locale affichée par Vite, généralement `http://localhost:5173`.
Le serveur Vite relaie les appels `/api` vers l'API PHP sur le port `4000`.

Commandes disponibles :

| Commande | Utilité |
| --- | --- |
| `npm run dev` | Démarre le serveur de développement Vite. |
| `npm test` | Lance les tests du projet. |
| `npm run build` | Compile l'interface dans `dist/`. |
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

Consultez `LISEZ-MOI.txt` et les documents de `docs/` pour les procédures
d'installation et d'utilisation. Avant une contribution, lancez `npm test` et,
pour une modification de l'interface, lancez `npm run build:php` puis validez
`index.html` et les nouveaux fichiers de `assets/` : sans cela, les autres
postes ne voient pas la modification.
