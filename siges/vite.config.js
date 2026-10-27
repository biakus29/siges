/* Aurel School SIGES — construction de l'interface React.
   • npm run dev       : http://localhost:5173, appels api/* relayés vers le
                         serveur PHP (php -S 127.0.0.1:4000 router.php).
   • npm run build     : interface compilée dans dist/.
   • npm run build:php : compile puis installe index.html + assets/ à la
                         racine du projet (dossier servi par PHP/Apache).
   base './' : chemins relatifs — l'application fonctionne aussi bien à la
   racine (localhost:4000) que dans un sous-dossier (localhost/siges). */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
});
