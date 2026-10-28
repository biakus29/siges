/* Installe l'interface compilée (dist/) dans le dossier servi par PHP :
   remplace index.html et ajoute les fichiers de dist/assets/ dans assets/.
   Les anciens bundles ne sont PAS supprimés (index-B1afvTyI.js contient la
   seule copie compilée de la v8.0, dont les sources manquent dans src/). */
import { cpSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))){
  console.error('dist/index.html introuvable — lancez d\'abord « npm run build ».');
  process.exit(1);
}

const assets = join(root, 'assets');
cpSync(join(dist, 'assets'), assets, { recursive: true });
copyFileSync(join(dist, 'index.html'), join(root, 'index.html'));
console.log('Interface installée : index.html + assets/ (' + readdirSync(assets).length + ' fichiers).');
