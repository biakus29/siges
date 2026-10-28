/* Persistance locale (localStorage) avec repli mémoire (ex. aperçu bac à sable) */
import { buildSeed, SEED_VERSION } from './seed.js';
import { migrateMultiEtab } from './business.js';

const STORE_KEY = 'aurel_school_compta_react_v1';
const memory = { db:null };

function storageOK(){
  try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; } catch(e){ return false; }
}
const HAS_LS = typeof localStorage !== 'undefined' && storageOK();

export const Store = {
  persistent: HAS_LS,
  load(){
    if (HAS_LS){
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw){
          const db = JSON.parse(raw);
          if (db && db.version === 1 && db.users && db.users.length){
            /* base locale d'une version antérieure → régénérer la graine ;
               v6.8 : comparaison à la version COURANTE de la graine (la base
               locale à jour n'est plus ressablée à chaque démarrage) */
            if (db.seedV !== SEED_VERSION){
              const seed = buildSeed();
              Store.save(seed);
              return seed;
            }
            return migrateMultiEtab(db);
          }
        }
      } catch(e){ /* base corrompue → régénérer */ }
      const seed = buildSeed();
      Store.save(seed);
      return seed;
    }
    if (!memory.db) memory.db = buildSeed();
    return memory.db;
  },
  save(db){
    if (HAS_LS){ try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch(e){} }
    else memory.db = db;
  },
  reset(){
    if (HAS_LS){ try { localStorage.removeItem(STORE_KEY); } catch(e){} }
    memory.db = null;
  }
};
