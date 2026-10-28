/* Contexte applicatif : base de données, session, navigation, modales, notifications */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Store } from '../core/store.js';
import { buildSeed } from '../core/seed.js';
import { PERM, uid, nowISO, deepClone, inactiviteMs, pollMs } from '../core/utils.js';
import { normalizeModele, TYPES_DOCS, defaultModele, NOMS_MODELES_DEFAUT } from '../core/modeles.js';
import { nextReceipt, yearById, activeYear, migrateMultiEtab, etabsOf, baseOf, newEtabId, emptyBase,
  scopeClassesIds, scopeMatieresIds, canClasse, devoirsDe, devoirsValides } from '../core/business.js';
import { hashPwd, makeSalt } from '../core/sha256.js';
import * as api from '../core/api.js';
import { mergeDb } from '../core/business.js';   /* v7.0 : fusion à trois voies (opérateurs simultanés) */

const Ctx = createContext(null);
export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp hors AppProvider');
  return v;
};

export function AppProvider({ children }){
  const [db, setDbState] = useState(() => migrateMultiEtab(Store.load()));
  const [serverMode, setServerMode] = useState('checking'); /* 'checking' | 'local' | 'server' */
  /* v7.0 : état de synchronisation visible en permanence (mode serveur) —
     'synced' : tout est dans MySQL ; 'pending' : envoi en cours ;
     'offline' : serveur injoignable, file d'attente locale active. */
  const [syncState, setSyncState] = useState('idle');
  /* v7.1 : journal des échecs d'envoi — affiché dans la fenêtre
     « Diagnostic de connexion » (badge cliquable). */
  const [syncErrors, setSyncErrors] = useState([]);
  const syncErrorsRef = useRef([]);
  const recordSyncError = useCallback(msg => {
    const t = new Date();
    const at = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
    syncErrorsRef.current = [{ at, msg:String(msg).slice(0, 200) }].concat(syncErrorsRef.current).slice(0, 8);
    setSyncErrors(syncErrorsRef.current);
  }, []);
  const [etabsPub, setEtabsPub] = useState(null); /* liste publique (serveur) pour la page de connexion */
  const dbRef = useRef(db);
  const etabIdRef = useRef(null);
  const [etabId, setEtabIdState] = useState(() => {
    const t = etabsOf(db);
    const id = t.length ? t[0].id : null;
    etabIdRef.current = id;
    return id;
  });
  const [user, setUser] = useState(null);
  const [page, setPageState] = useState('dashboard');
  const curBaseOf = target => {
    const t = etabsOf(target);
    const eid = etabIdRef.current || (t.length ? t[0].id : null);
    return baseOf(target, eid) || (t.length ? baseOf(target, t[0].id) : null) || emptyBase();
  };
  const anneeOfBase = b => {
    const ay = activeYear(b);
    return ay ? ay.id : (b.annees.length ? b.annees[b.annees.length-1].id : null);
  };
  const [anneeId, setAnneeIdState] = useState(() => anneeOfBase(curBaseOf(dbRef.current)));
  const [toasts, setToasts] = useState([]);
  const [modalEl, setModalEl] = useState(null);
  const [verrou, setVerrou] = useState(null);   /* maintenance : { ref } quand l'accès est suspendu */
  const confirmResolve = useRef(null);
  const fails = useRef(0);
  const lockUntil = useRef(0);
  const lastAct = useRef(Date.now());
  const serverModeRef = useRef('checking');
  /* v6.6 : anti-perte de synchronisation — lastPulled = dernière base reçue du
     serveur (on ne la renvoie jamais), file d'envoi sérialisée : deux
     enregistrements rapprochés partent l'un APRÈS l'autre (plus de conflit
     409 qui faisait disparaître la seconde modification). */
  const lastPulledRef = useRef(null);
  const pushBusyRef = useRef(false);
  /* v6.9 : promesse de la sonde de démarrage (la connexion ATTEND la
     détection du serveur — plus de course « sonde en cours / connexion
     locale par erreur ») et mode réel de la session courante. */
  const probePromiseRef = useRef(null);
  const loginModeRef = useRef(null);   /* 'server' | 'local' */

  const setDb = useCallback(next => { dbRef.current = next; Store.save(next); setDbState(next); }, []);
  const commit = useCallback(mutator => {
    const next = migrateMultiEtab(deepClone(dbRef.current));
    const out = mutator(next) || {};
    setDb(next);
    if (serverModeRef.current === 'server') setSyncState('pending');
    return out;
  }, [setDb]);
  /* Mutation des données d'un ÉTABLISSEMENT : mutator(base, root) —
     base = collections de l'établissement courant, root = comptes + établissements. */
  const commitB = useCallback(mutator => {
    const next = migrateMultiEtab(deepClone(dbRef.current));
    const t = etabsOf(next);
    const eid = etabIdRef.current || (t.length ? t[0].id : null);
    if (!eid || !Array.isArray(next.bases) || !baseOf(next, eid)) throw new Error('Aucun établissement sélectionné.');
    const base = baseOf(next, eid);
    if (!Array.isArray(base.journal)) base.journal = [];
    const out = mutator(base, next) || {};
    setDb(next);
    if (serverModeRef.current === 'server') setSyncState('pending');
    return out;
  }, [setDb]);

  const journal = useCallback((tgt, action, details) => {
    const arr = tgt && Array.isArray(tgt.journal) ? tgt.journal
      : (tgt && Array.isArray(tgt.journalGlobal) ? tgt.journalGlobal : null);
    if (!arr) return;
    arr.unshift({ id:uid(), date:nowISO(), user: userRef.current ? userRef.current.username : 'système', uid: userRef.current ? userRef.current.id : null, action, details });
    if (arr.length > 250) arr.length = 250;
  }, []);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);
  /* l'utilisateur connecté suit la base : renommage, rôle, désactivation, suppression */
  useEffect(() => {
    if (!user) return;
    const fresh = db.users.find(u => u.id === user.id);
    if (!fresh){ setUser(null); return; }
    if (fresh.nom !== user.nom || fresh.role !== user.role || fresh.actif !== user.actif || fresh.username !== user.username){
      setUser({ ...fresh });
    }
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Notifications ---------- */
  const toast = useCallback((msg, type='ok', title) => {
    const id = uid();
    const t = title || (type === 'err' ? 'Erreur' : (type === 'info' ? 'Information' : 'Opération réussie'));
    setToasts(ts => [...ts, { id, msg, type, title:t }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4200);
  }, []);

  /* ---------- Modales ---------- */
  const openModal = useCallback(el => {
    if (confirmResolve.current){ confirmResolve.current(false); confirmResolve.current = null; }
    setModalEl(el);
  }, []);
  const closeModal = useCallback(() => {
    if (confirmResolve.current){ confirmResolve.current(false); confirmResolve.current = null; }
    setModalEl(null);
  }, []);
  const confirm = useCallback((title, msg, okLabel='Confirmer', danger=false) => {
    return new Promise(resolve => {
      confirmResolve.current = resolve;
      const onEnd = val => { confirmResolve.current = null; setModalEl(null); resolve(val); };
      setModalEl({ __confirm:true, title, msg, okLabel, danger, onEnd });
    });
  }, []);

  /* ---------- Session ---------- */
  const doLogout = useCallback(async (auto) => {
    /* v7.0 : garde anti-perte — si des modifications n'ont pas encore été
       confirmées par le serveur, la déconnexion manuelle demande une
       confirmation explicite (une perte de données ne doit jamais être
       silencieuse). */
    const enAttente = loginModeRef.current === 'server' && dbRef.current !== lastPulledRef.current;
    if (enAttente && !auto){
      const go = await confirm('Modifications non enregistrées',
        'Le serveur n\u2019a pas encore confirmé l\u2019enregistrement de vos dernières modifications. Si vous vous déconnectez maintenant, elles seront perdues. Voulez-vous vraiment vous déconnecter ?',
        'Se déconnecter quand même', true);
      if (!go) return false;
    }
    commit(next => { journal(next, 'deconnexion', auto ? 'Déconnexion automatique (inactivité)' : 'Déconnexion manuelle'); });
    /* v6.9 : on n'efface le poste que si la session s'est réellement
     déroulée CÔTÉ SERVEUR — une session locale (secours) conserve ses
     données locales, comme toujours en mode local. */
    if (loginModeRef.current === 'server'){
      api.logout();
      /* v5.6 : le poste partagé ne conserve aucune donnée après une
         déconnexion serveur (la base est re-téléchargée à la connexion) —
         sauf modifications encore en attente (conservées sur ce poste). */
      if (!enAttente) Store.reset();
    }
    try { localStorage.removeItem('asc_session'); sessionStorage.removeItem('asc_session'); } catch(e){}
    setUser(null); setPageState('dashboard'); setModalEl(null); setSyncState('idle');
    return auto;
  }, [commit, journal, confirm]);

  const login = useCallback(async (username, pwd, remember, etabChoisi) => {
    /* v6.9 : CORRECTION de la course au démarrage — la connexion ne choisit
       son camp (serveur OU local) qu'après la détection du serveur :
       • si la sonde est encore en cours, on l'attend (elle peut être lente
         au premier appel d'un serveur distant) ;
       • si elle avait échoué, on la retente (le serveur a pu démarrer).
       Avant : une connexion cliquée pendant la détection basculait par
       erreur en mode LOCAL — avec le jeu de démonstration local, dont
       admin/admin2026 — et toutes les saisies restaient dans le navigateur
       au lieu du serveur. */
    if (serverModeRef.current === 'checking' && probePromiseRef.current){
      try { await probePromiseRef.current; } catch(e){}
    } else if (serverModeRef.current === 'local'){
      const ok2 = await api.probe(true);
      if (ok2){
        serverModeRef.current = 'server';
        setServerMode('server');
        api.fetchEtabs().then(l => { if (Array.isArray(l)) setEtabsPub(l); }).catch(() => {});
      }
    }
    if (serverModeRef.current === 'server'){
      let res;
      try { res = await api.login(username, pwd); }
      catch(e){ return { ok:false, msg:'Serveur injoignable. Réessayez dans un instant.' }; }
      if (!res || !res.ok) return { ok:false, msg:(res && res.msg) || 'Identifiants refusés par le serveur.' };
      api.persistToken(!!remember);
      let freshDb = null;
      try {
        const sdb = migrateMultiEtab(await api.fetchDb());
        freshDb = sdb;
        lastPulledRef.current = sdb;
        dbRef.current = sdb; Store.save(sdb); setDbState(sdb);
      } catch(e){ /* on garde la base locale déjà chargée */ }
      const u0 = res.user;
      const u = (freshDb && freshDb.users.find(x => x.id === u0.id)) || u0;
      /* l'établissement choisi doit héberger le compte (superadmin : tous) */
      if (etabChoisi && etabChoisi !== 'auto' && u.role !== 'superadmin'
        && u.etablissementId && u.etablissementId !== etabChoisi)
        return { ok:false, msg:'Identifiants incorrects.' };
      /* v5.1 : un compte d'un établissement suspendu ne peut plus se connecter */
      if (u.role !== 'superadmin' && u.etablissementId){
        const eS = (dbRef.current.etablissements || []).find(x => x.id === u.etablissementId);
        if (eS && eS.actif === false) return { ok:false, msg:'Connexion impossible : cet établissement est momentanément suspendu par l\u2019administration générale.' };
      }
      const auto = u.role === 'superadmin' ? null : (u.etablissementId || (etabsOf(dbRef.current)[0] ? etabsOf(dbRef.current)[0].id : null));
      const eid = (etabChoisi && etabChoisi !== 'auto') ? etabChoisi : auto;
      commit(next => {
        const nu = next.users.find(x => x.id === u.id);
        if (nu) nu.dernierAcces = nowISO();
        journal(next, 'connexion', 'Connexion réussie (serveur)' + (eid ? ' — ' + ((etabsOf(next).find(e => e.id === eid) || {}).nom || eid) : ' — administration générale'));
      });
      setUser(u);
      etabIdRef.current = eid;
      setEtabIdState(eid);
      const b = eid ? baseOf(dbRef.current, eid) : null;
      setAnneeIdState(b ? anneeOfBase(b) : null);
      setPageState(eid ? 'dashboard' : 'etablissements');
      loginModeRef.current = 'server';
      setSyncState('synced');
      return { ok:true, user:u };
    }
    if (Date.now() < lockUntil.current){
      const s = Math.ceil((lockUntil.current - Date.now())/1000);
      return { ok:false, msg:'Trop de tentatives échouées. Réessayez dans ' + s + ' s.' };
    }
    const res = (function(){ /* verifyLogin */
      const u = dbRef.current.users.find(x => x.username.toLowerCase() === String(username||'').trim().toLowerCase());
      if (!u) return { ok:false, reason:'inconnu' };
      if (!u.actif) return { ok:false, reason:'inactif' };
      if (u.hash !== hashPwd(u.salt, pwd)) return { ok:false, reason:'motdepasse' };
      return { ok:true, user:u };
    })();
    if (!res.ok){
      fails.current++;
      commit(next => {
        journal(next, 'echec', 'Tentative de connexion refusée (' + String(username||'?') + ')');
      });
      if (fails.current >= 5){
        lockUntil.current = Date.now() + 30000;
        fails.current = 0;
        return { ok:false, msg:'Trop de tentatives — patientez un instant avant de réessayer.' };
      }
      return { ok:false, msg:'Identifiants incorrects.' };
    }
    fails.current = 0;
    const u = res.user;
    /* v5.1 : un compte d'un établissement suspendu ne peut plus se connecter (mode local) */
    if (u.role !== 'superadmin' && u.etablissementId){
      const eS = (dbRef.current.etablissements || []).find(x => x.id === u.etablissementId);
      if (eS && eS.actif === false) return { ok:false, msg:'Connexion impossible : cet établissement est momentanément suspendu par l\u2019administration générale.' };
    }
    if (etabChoisi && etabChoisi !== 'auto' && u.role !== 'superadmin'
      && u.etablissementId && u.etablissementId !== etabChoisi)
      return { ok:false, msg:'Identifiants incorrects.' };
    const auto = u.role === 'superadmin' ? null : (u.etablissementId || (etabsOf(dbRef.current)[0] ? etabsOf(dbRef.current)[0].id : null));
    const eid = (etabChoisi && etabChoisi !== 'auto') ? etabChoisi : auto;
    commit(next => {
      const nu = next.users.find(x => x.id === u.id);
      if (nu) nu.dernierAcces = nowISO();
      journal(next, 'connexion', 'Connexion réussie' + (eid ? ' — ' + ((etabsOf(next).find(e => e.id === eid) || {}).nom || eid) : ' — administration générale'));
    });
    try {
      const sess = JSON.stringify({ uid:u.id, etab:eid, t:Date.now() });
      if (remember) localStorage.setItem('asc_session', sess); else sessionStorage.setItem('asc_session', sess);
    } catch(e){}
    loginModeRef.current = 'local';
    setUser(u);
    etabIdRef.current = eid;
    setEtabIdState(eid);
    const b = eid ? baseOf(dbRef.current, eid) : null;
    setAnneeIdState(b ? anneeOfBase(b) : null);
    setPageState(eid ? 'dashboard' : 'etablissements');
    return { ok:true, user:u };
  }, [commit, journal]);

  /* Verrou de maintenance : le serveur (423) déclenche l'écran d'activation */
  useEffect(() => { api.onLocked(ref => setVerrou({ ref: ref || 1 })); }, []);
  const activerLicence = useCallback(async code => {
    const r = await api.activerLicence(code);
    if (r.ok){ setVerrou(null); try { window.location.reload(); } catch(e){} }
    return r;
  }, []);

  /* Détection du serveur API + restauration de session serveur */
  useEffect(() => {
    probePromiseRef.current = (async () => {
      const ok = await api.probe();
      const mode = ok ? 'server' : 'local';
      serverModeRef.current = mode;
      setServerMode(mode);
      if (ok){
        api.fetchEtabs().then(l => { if (Array.isArray(l)) setEtabsPub(l); }).catch(() => {});
      }
      if (ok && api.restoreToken()){
        const u0 = await api.me();
        if (u0){
          try {
            const sdb = migrateMultiEtab(await api.fetchDb());
            lastPulledRef.current = sdb;
            dbRef.current = sdb; Store.save(sdb); setDbState(sdb);
            const u = sdb.users.find(x => x.id === u0.id) || u0;
            setUser(u);
            loginModeRef.current = 'server';
            const eid = u.role === 'superadmin' ? null : (u.etablissementId || (etabsOf(sdb)[0] ? etabsOf(sdb)[0].id : null));
            etabIdRef.current = eid; setEtabIdState(eid);
            const b = eid ? baseOf(sdb, eid) : null;
            setAnneeIdState(b ? anneeOfBase(b) : null);
            if (!eid) setPageState('etablissements');
          } catch(e){ /* session serveur expirée : l'utilisateur se reconnectera */ }
        }
      }
    })();
  }, []);

  /* Synchronisation serveur : envoi de la base après chaque modification.
     v6.6 : les envoies sont SÉRIALISÉS — si l'utilisateur enregistre deux
     modifications rapprochées (ou importe un fichier CSV), le second envoi
     attend le premier : les deux arrivent, aucune ne disparaît. La base
     reçue du serveur (connexion, sondage, conflit) n'est jamais renvoyée. */
  const enqueuePush = useCallback(() => {
    /* v6.9 : on n'envoie JAMAIS une base qui n'a pas été reçue du serveur
       pendant cette session (sinon : envoi d'une base locale de secours
       sans jeton → refus 401 affiché « Serveur injoignable »). */
    if (!lastPulledRef.current) return;
    if (pushBusyRef.current) return;   /* un envoi est en cours : l'état le plus récent sera poussé à sa suite */
    const d = dbRef.current;
    if (!d || d === lastPulledRef.current) return;
    pushBusyRef.current = true;
    const run = cur => {
      api.pushDb(cur).then(r => {
        if (r && r.conflict){
          /* v7.0 : FUSION À TROIS VOIES — les modifications de l'autre
             opérateur ET les nôtres sont conservées (voir mergeDb), puis la
             base fusionnée est renvoyée au serveur par l'effet d'envoi. */
          const avant = dbRef.current;
          api.fetchDb().then(rdb => {
            const sdb = migrateMultiEtab(rdb);
            const localActuel = dbRef.current;
            const merged = mergeDb(lastPulledRef.current, localActuel, sdb);
            lastPulledRef.current = sdb;
            dbRef.current = merged; Store.save(merged); setDbState(merged);
            pushBusyRef.current = false;
            if (merged !== sdb){
              setSyncState('pending');   /* l'effet d'envoi relaie la base fusionnée */
              toast('Vos modifications et celles d\u2019un autre opérateur ont été fusionnées.', 'ok', 'Synchronisation');
            } else {
              setSyncState('synced');
            }
          }).catch(() => { recordSyncError('Erreur réseau pendant la fusion (relecture du serveur impossible).'); pushBusyRef.current = false; setSyncState('offline'); });
        } else {
          if (dbRef.current !== cur && dbRef.current !== lastPulledRef.current){ run(dbRef.current); return; }
          pushBusyRef.current = false;
          setSyncState('synced');
        }
      }).catch(e => {
        pushBusyRef.current = false;
        /* v6.9 : le vrai motif est affiché — un refus du serveur (session
           expirée, erreur explicite) n'est plus présenté comme une
           panne réseau. */
        if (e && e.status === 401){
          recordSyncError('Session expirée (HTTP 401) — reconnexion nécessaire.');
          setSyncState('offline');
          toast('Session serveur expirée — reconnectez-vous pour envoyer vos modifications (elles restent conservées sur ce poste).', 'info', 'Session');
          return;   /* inutile de réessayer avant la reconnexion */
        }
        /* Refus définitif (droits, données invalides) : réessayer en boucle ne
           servirait à rien et bloquerait tous les envois suivants. La
           modification refusée est abandonnée et la base du serveur rechargée. */
        if (e && (e.status === 403 || e.status === 400)){
          recordSyncError('Refus du serveur (HTTP ' + e.status + ') : ' + (e.serverMsg || 'modification refusée'));
          toast('Enregistrement refusé par le serveur : ' + (e.serverMsg || 'modification non autorisée') + ' La modification a été annulée.', 'err');
          api.fetchDb().then(rdb => {
            const sdb = migrateMultiEtab(rdb);
            lastPulledRef.current = sdb;
            dbRef.current = sdb; Store.save(sdb); setDbState(sdb);
            setSyncState('synced');
          }).catch(() => setSyncState('offline'));
          return;
        }
        if (e && e.status === 413){
          recordSyncError('Base trop volumineuse (HTTP 413) : ' + (e.serverMsg || ''));
          toast('Enregistrement impossible : la base dépasse la taille autorisée (photos trop lourdes ?). Contactez l’administrateur.', 'err');
          setSyncState('offline');
          return;
        }
        if (e && e.serverMsg){
          recordSyncError('Refus du serveur (HTTP ' + e.status + ') : ' + e.serverMsg);
          toast('Enregistrement refusé par le serveur : ' + e.serverMsg, 'err');
        } else {
          toast('Serveur injoignable : ' + (dbRef.current && lastPulledRef.current ? 'modification en attente — nouvel essai automatique.' : 'modification conservée en local.'), 'info', 'Synchronisation');
        }
        recordSyncError('Erreur réseau — ' + (e && e.message ? e.message : 'échec') + (e && e.status ? ' (HTTP ' + e.status + ')' : ''));
        setSyncState('offline');
        /* nouvelle tentative plus tard tant que l'état local n'est pas parti */
        setTimeout(() => { if (!pushBusyRef.current && lastPulledRef.current && dbRef.current !== lastPulledRef.current) enqueuePush(); }, 8000);
      });
    };
    run(d);
  }, [toast]);
  useEffect(() => {
    if (serverMode !== 'server' || !userRef.current) return;
    if (!lastPulledRef.current) return;   /* v6.9 : base non issue du serveur → jamais envoyée */
    if (db === lastPulledRef.current) return;
    enqueuePush();
  }, [db, serverMode, enqueuePush]);

  /* ---------- Actualisation automatique des donnees (mode serveur) ----------
     Sonde la revision du serveur ; si elle a change (modification faite
     depuis un autre poste, ou par le meme utilisateur dans un autre onglet),
     la base est rechargee et toute l'application se met a jour. */
  useEffect(() => {
    if (serverMode !== 'server') return;
    let stop = false;
    const check = async () => {
      if (stop || !userRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const rev = await api.healthRev();
      if (stop || rev == null || rev === api.getRev()) return;
      try {
        const avant = dbRef.current;
        const rdb = await api.fetchDb();
        /* v6.6 : une modification locale pendant le téléchargement n'est
           jamais écrasée — la file d'envoi réconciliera avec le serveur. */
        if (stop || dbRef.current !== avant) return;
        const sdb = migrateMultiEtab(rdb);
        lastPulledRef.current = sdb;
        setDb(sdb);
      } catch(e){ /* serveur momentanement indisponible */ }
    };
    const iv = setInterval(check, pollMs());
    const onFocus = () => { setTimeout(check, 400); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => { stop = true; clearInterval(iv);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus); };
  }, [serverMode]);

  /* Restauration de session + expiration automatique */
  useEffect(() => {
    let raw = null;
    try { raw = localStorage.getItem('asc_session') || sessionStorage.getItem('asc_session'); } catch(e){}
    if (raw){
      try {
        const sess = JSON.parse(raw);
        const u = dbRef.current.users.find(x => x.id === sess.uid);
        if (u && u.actif){
          setUser(u);
          const eid = u.role === 'superadmin' ? null
            : (sess.etab || u.etablissementId || (etabsOf(dbRef.current)[0] ? etabsOf(dbRef.current)[0].id : null));
          etabIdRef.current = eid; setEtabIdState(eid);
          const b = eid ? baseOf(dbRef.current, eid) : null;
          setAnneeIdState(b ? anneeOfBase(b) : null);
          if (!eid) setPageState('etablissements');
        }
      } catch(e){}
    }
  }, []);
  useEffect(() => {
    const bump = () => { lastAct.current = Date.now(); };
    ['click','keydown','input','change'].forEach(ev => document.addEventListener(ev, bump, true));
    const DELAI = inactiviteMs();
    const iv = setInterval(() => {
      if (userRef.current && Date.now() - lastAct.current > DELAI){
        doLogout(true);
        toast('Session verrouillée après ' + Math.round(DELAI/60000) + ' minutes d\u2019inactivité — reconnectez-vous.', 'info', 'Session verrouillée');
      }
    }, Math.max(1000, Math.min(30000, DELAI / 3)));
    return () => { ['click','keydown','input','change'].forEach(ev => document.removeEventListener(ev, bump, true)); clearInterval(iv); };
  }, [doLogout, toast]);

  /* ---------- Navigation & année ---------- */
  const isAdmin = useCallback(() => !!user && (user.role === 'admin' || user.role === 'superadmin'), [user]);
  const can = useCallback((mod, write) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'superadmin') return true;
    let p = (PERM[user.role] || {})[mod] || 'n';
    /* droits specifiques definis par l'administrateur (v1.8) */
    if (user.perms && user.perms[mod] && ['w','r','n'].includes(user.perms[mod])) p = user.perms[mod];
    return write ? p === 'w' : p !== 'n';
  }, [user]);
  const go = useCallback(p => {
    setPageState(prev => {
      let np = p;
      if (np === 'etablissements' && userRef.current && userRef.current.role !== 'superadmin') np = 'dashboard';
      if (!etabIdRef.current && np !== 'etablissements' && userRef.current && userRef.current.role === 'superadmin') np = 'etablissements';
      if ((np === 'users' || np === 'parametres') && userRef.current && userRef.current.role !== 'admin' && userRef.current.role !== 'superadmin') np = 'dashboard';
      if (np === 'journal' && userRef.current){
        const u = userRef.current;
        /* v6.6 : le superadministrateur accède au journal (actions de tous
           les établissements) ; l'administrateur voit son établissement. */
        if (!(u.role === 'admin' || u.role === 'superadmin' || (u.perms && u.perms.journal && u.perms.journal !== 'n'))) np = 'dashboard';
      }
      return np;
    });
    try { window.scrollTo(0,0); } catch(e){}
  }, []);
  const setAnneeId = useCallback(id => setAnneeIdState(id), []);
  const setEtab = useCallback(id => {
    etabIdRef.current = id;
    setEtabIdState(id);
    const b = id ? baseOf(dbRef.current, id) : null;
    setAnneeIdState(b ? anneeOfBase(b) : null);
    setPageState(id ? 'dashboard' : 'etablissements');
    commit(next => {
      journal(next, 'etablissement', id
        ? 'Ouverture de l\u2019établissement ' + ((etabsOf(next).find(e => e.id === id) || {}).nom || id)
        : 'Retour à l\u2019administration générale');
    });
  }, [commit, journal]);
  useEffect(() => { etabIdRef.current = etabId; }, [etabId]);

  /* ---------- Mutations ---------- */
  const M = {};

  M.saveAnnee = v => commitB((base, next) => {
    const lib = String(v.libelle||'').trim(), id = v.id || null;
    if (!/^\d{4}-\d{4}$/.test(lib)) throw new Error('Libellé invalide : format attendu 2027-2028.');
    const pp = lib.split('-');
    if (parseInt(pp[1],10) !== parseInt(pp[0],10)+1) throw new Error('Les deux années doivent être consécutives (ex : 2027-2028).');
    if (!v.debut || !v.fin || v.fin <= v.debut) throw new Error('Dates de début / de fin incohérentes.');
    if (base.annees.some(a => a.libelle === lib && a.id !== id)) throw new Error('Une année portant ce libellé existe déjà.');
    if (id){
      const a = base.annees.find(x => x.id === id);
      if (!a) throw new Error('Année introuvable.');
      Object.assign(a, { libelle:lib, debut:v.debut, fin:v.fin });
      journal(base, 'annee', 'Année ' + lib + ' modifiée');
      return { edited:true, annee:a };
    }
    const y = { id:uid(), libelle:lib, debut:v.debut, fin:v.fin, statut:'ouverte', active:false };
    base.annees.push(y);
    let nTar = 0, nEl = 0;
    if (v.source){
      if (v.copiegrille){
        base.tarifs.filter(t => t.anneeId === v.source).forEach(t => {
          base.tarifs.push({ id:uid(), anneeId:y.id, cibleType:t.cibleType, cibleId:t.cibleId, fraisId:t.fraisId, montant:t.montant });
          nTar++;
        });
      }
      if (v.copieeleves){
        const yy = lib.slice(2,4); let seq = 0;
        base.eleves.filter(e => e.anneeId === v.source && e.statut === 'actif').forEach(e => {
          seq++;
          base.eleves.push({ id:uid(), matricule:'BON-'+yy+'-'+String(seq).padStart(4,'0'), nom:e.nom, prenom:e.prenom,
            sexe:e.sexe, classeId:e.classeId, anneeId:y.id, tuteur:e.tuteur, tel:e.tel, statut:'actif',
            regime:e.regime || 'externe', statutEleve:'ancien' });
          nEl++;
        });
      }
    }
    if (v.activer){ base.annees.forEach(x => { x.active = false; }); y.active = true; }
    journal(base, 'annee', 'Création de l\u2019année ' + lib + (nTar ? ' — grille tarifaire copiée (' + nTar + ' montants)' : '') + (nEl ? ' — ' + nEl + ' réinscription(s)' : ''));
    return { annee:y, nEl, nTar };
  });

  M.activateAnnee = id => commitB((base, next) => {
    const a = base.annees.find(x => x.id === id);
    if (!a) throw new Error('Année introuvable.');
    if (a.statut === 'cloturee') throw new Error('Cette année est clôturée — réouvrez-la d\u2019abord.');
    base.annees.forEach(x => { x.active = false; });
    a.active = true;
    journal(base, 'annee', 'Année ' + a.libelle + ' activée (année en cours)');
    return { annee:a };
  });
  M.closeAnnee = id => commitB((base, next) => {
    const a = base.annees.find(x => x.id === id);
    if (!a) throw new Error('Année introuvable.');
    a.statut = 'cloturee'; a.active = false;
    journal(base, 'annee', 'Année ' + a.libelle + ' clôturée');
    return {};
  });
  M.reopenAnnee = id => commitB((base, next) => {
    const a = base.annees.find(x => x.id === id);
    if (!a) throw new Error('Année introuvable.');
    a.statut = 'ouverte';
    journal(base, 'annee', 'Année ' + a.libelle + ' réouverte');
    return {};
  });
  M.deleteAnnee = id => commitB((base, next) => {
    const a = base.annees.find(x => x.id === id);
    if (!a) throw new Error('Année introuvable.');
    const nEl = base.eleves.filter(e => e.anneeId === id).length;
    const nPa = base.paiements.filter(p => p.anneeId === id).length;
    if (nEl || nPa) throw new Error('Suppression impossible : ' + nEl + ' élève(s) et ' + nPa + ' paiement(s). Clôturez-la plutôt pour l\u2019archiver.');
    base.annees = base.annees.filter(x => x.id !== id);
    base.tarifs = base.tarifs.filter(t => t.anneeId !== id);
    journal(base, 'annee', 'Année ' + a.libelle + ' supprimée');
    return {};
  });

  M.saveNiveau = v => commitB((base, next) => {
    const code = String(v.code||'').trim().toUpperCase(), lib = String(v.libelle||'').trim();
    if (!code || !lib) throw new Error('Code et libellé requis.');
    const ordre = parseInt(v.ordre,10);
    if (!(ordre >= 1 && ordre <= 99)) throw new Error('Ordre invalide (1 à 99).');
    if (base.niveaux.some(n => n.code === code && n.id !== v.id)) throw new Error('Ce code de niveau existe déjà.');
    if (v.id){
      const nv = base.niveaux.find(n => n.id === v.id);
      Object.assign(nv, { code, libelle:lib, cycle:v.cycle, ordre });
      journal(base, 'configuration', 'Niveau ' + code + ' modifié');
    } else {
      base.niveaux.push({ id:uid(), code, libelle:lib, cycle:v.cycle, ordre });
      journal(base, 'configuration', 'Niveau ' + code + ' — ' + lib + ' créé');
    }
    return {};
  });
  M.deleteNiveau = (id, avecEnfants) => commitB((base, next) => {
    const nv = base.niveaux.find(n => n.id === id);
    if (!nv) throw new Error('Niveau introuvable.');
    const clsIds = base.classes.filter(c => c.niveauId === id).map(c => c.id);
    const elv = base.eleves.filter(e => clsIds.includes(e.classeId));
    const elIds = elv.map(e => e.id);
    const pa = base.paiements.filter(p => elIds.includes(p.eleveId));
    if ((clsIds.length || elv.length) && !avecEnfants)
      throw new Error('Ce niveau possède ' + clsIds.length + ' classe(s) et ' + elv.length + ' élève(s) — confirmez explicitement la suppression en cascade.');
    const total = pa.reduce((s2, p) => s2 + (p.statut === 'valide' ? p.montant : 0), 0);
    base.eleves = base.eleves.filter(e => !elIds.includes(e.id));
    base.paiements = base.paiements.filter(p => !elIds.includes(p.eleveId));
    base.bourses = base.bourses.filter(b => !elIds.includes(b.eleveId));
    base.classes = base.classes.filter(c => c.niveauId !== id);
    base.tarifs = base.tarifs.filter(t => !(t.cibleType === 'niveau' && t.cibleId === id)
      && !(t.cibleType === 'classe' && clsIds.includes(t.cibleId)));
    base.niveaux = base.niveaux.filter(x => x.id !== id);
    journal(base, 'suppression', 'Niveau ' + nv.libelle + ' supprimé'
      + (clsIds.length ? ' avec ' + clsIds.length + ' classe(s), ' + elv.length + ' élève(s), ' + pa.length + ' paiement(s) (' + new Intl.NumberFormat('fr-FR').format(total) + ' FCFA)' : ''));
    return { nCls:clsIds.length, nEl:elv.length, nPa:pa.length, total };
  });

  M.saveClasse = v => commitB((base, next) => {
    const lib = String(v.libelle||'').trim();
    if (!lib) throw new Error('Libellé requis.');
    if (!base.niveaux.some(n => n.id === v.niveauId)) throw new Error('Sélectionnez un niveau.');
    let cap = parseInt(v.capacite,10); if (!(cap >= 1 && cap <= 500)) cap = 60;
    if (base.classes.some(c => c.libelle.toLowerCase() === lib.toLowerCase() && c.id !== v.id)) throw new Error('Une classe porte déjà ce libellé.');
    /* v5.2 : matières indispensables au classement — nécessairement au plan de la classe */
    const oblig = Array.from(new Set((Array.isArray(v.matieresOblig) ? v.matieresOblig : []).filter(Boolean)));
    if (v.id && oblig.length){
      const planIds = (base.plan || []).filter(pe => pe.classeId === v.id).map(pe => pe.matiereId);
      const hors = oblig.filter(id => !planIds.includes(id));
      if (hors.length) throw new Error('Matières indispensables hors du plan de la classe : ' + hors.map(id => ((base.matieres || []).find(m => m.id === id) || {}).libelle || id).join(', ') + '.');
    }
    /* v5.5 : titulaire de la classe — compte (rôle titulaire ou enseignant) ;
       pour un rôle « titulaire », la classe est ajoutée à son périmètre (classesIds)
       et retirée de celui de l'ancien titulaire. */
    const titId = String(v.titulaireId || '').trim() || null;
    let titNom = '';
    if (titId){
      const ut = (next.users || []).find(x => x.id === titId && x.actif !== false);
      if (!ut) throw new Error('Compte titulaire introuvable ou désactivé.');
      if (ut.role !== 'titulaire' && ut.role !== 'enseignant') throw new Error('Le titulaire doit être un compte « Titulaire de classe » ou « Enseignant ».');
      titNom = ut.nom;
    }
    const syncTitulaires = (classeId) => {
      (next.users || []).forEach(u => {
        if (u.role !== 'titulaire' || !Array.isArray(u.classesIds)) return;
        const i = u.classesIds.indexOf(classeId);
        if (u.id === titId){ if (i < 0) u.classesIds.push(classeId); }
        else if (i >= 0) u.classesIds.splice(i, 1);
      });
    };
    const nOblig = oblig.length;
    /* v6.0 : mode d'appréciation de la classe — classique ou APC */
    const appMode = v.appreciationMode === 'apc' ? 'apc' : 'classique';
    const detailOblig = nOblig ? ' — ' + nOblig + ' matière(s) indispensable(s) au classement' : ' — classement sans matière exigée';
    const detailTit = titNom ? ' — titulaire : ' + titNom : ' — sans titulaire';
    const detailApp = appMode === 'apc' ? ' — appréciations APC' : '';
    if (v.id){
      const c = base.classes.find(x => x.id === v.id);
      Object.assign(c, { libelle:lib, niveauId:v.niveauId, capacite:cap, appreciationMode:appMode });
      if (nOblig) c.matieresOblig = oblig; else delete c.matieresOblig;
      if (titId) c.titulaireId = titId; else delete c.titulaireId;
      syncTitulaires(v.id);
      journal(base, 'configuration', 'Classe ' + lib + ' modifiée' + detailOblig + detailTit + detailApp);
    } else {
      const nc = { id:uid(), niveauId:v.niveauId, libelle:lib, capacite:cap, appreciationMode:appMode };
      if (nOblig) nc.matieresOblig = oblig;
      if (titId) nc.titulaireId = titId;
      base.classes.push(nc);
      journal(base, 'configuration', 'Classe ' + lib + ' créée' + detailOblig + detailTit + detailApp);
    }
    return {};
  });
  M.deleteClasse = (id, avecEleves) => commitB((base, next) => {
    const c = base.classes.find(x => x.id === id);
    if (!c) throw new Error('Classe introuvable.');
    const elv = base.eleves.filter(e => e.classeId === id);
    const elIds = elv.map(e => e.id);
    const pa = base.paiements.filter(p => elIds.includes(p.eleveId));
    if (elv.length && !avecEleves)
      throw new Error('Cette classe contient ' + elv.length + ' élève(s) — confirmez explicitement leur suppression.');
    const total = pa.reduce((s2, p) => s2 + (p.statut === 'valide' ? p.montant : 0), 0);
    base.eleves = base.eleves.filter(e => !elIds.includes(e.id));
    base.paiements = base.paiements.filter(p => !elIds.includes(p.eleveId));
    base.bourses = base.bourses.filter(b => !elIds.includes(b.eleveId));
    base.classes = base.classes.filter(x => x.id !== id);
    base.tarifs = base.tarifs.filter(t => !(t.cibleType === 'classe' && t.cibleId === id));
    journal(base, 'suppression', 'Classe ' + c.libelle + ' supprimée'
      + (elv.length ? ' avec ' + elv.length + ' élève(s) et ' + pa.length + ' paiement(s) (' + new Intl.NumberFormat('fr-FR').format(total) + ' FCFA)' : ''));
    return { nEl:elv.length, nPa:pa.length, total };
  });

  M.saveFrais = v => commitB((base, next) => {
    const code = String(v.code||'').trim().toUpperCase(), lib = String(v.libelle||'').trim();
    if (!code || !lib) throw new Error('Code et libellé requis.');
    if (base.frais.some(x => x.code === code && x.id !== v.id)) throw new Error('Ce code de frais existe déjà.');
    let ordre = parseInt(v.ordre,10); if (!(ordre >= 1 && ordre <= 99)) ordre = base.frais.length + 1;
    if (v.id){
      const f = base.frais.find(x => x.id === v.id);
      Object.assign(f, { code, libelle:lib, categorie:v.categorie, periodicite:v.periodicite, obligatoire:!!v.obligatoire, ordre, parStatut:!!v.parStatut });
      journal(base, 'configuration', 'Type de frais ' + code + ' modifié');
    } else {
      base.frais.push({ id:uid(), code, libelle:lib, categorie:v.categorie, periodicite:v.periodicite, obligatoire:!!v.obligatoire, ordre, parStatut:!!v.parStatut,
        tranches:[{ id:uid(), label:'Tranche unique', pourcentage:100, jour:30, mois:9 }] });
      journal(base, 'configuration', 'Type de frais ' + code + ' — ' + lib + ' créé');
    }
    return {};
  });
  M.deleteFrais = (id, avecPaiements) => commitB((base, next) => {
    const f = base.frais.find(x => x.id === id);
    if (!f) throw new Error('Frais introuvable.');
    const pa = base.paiements.filter(p => p.fraisId === id);
    const nBo = base.bourses.filter(b => b.fraisId === id).length;
    if (pa.length && !avecPaiements)
      throw new Error('Ce frais est utilisé par ' + pa.length + ' paiement(s) — confirmez explicitement leur suppression.');
    const total = pa.reduce((s2, p) => s2 + (p.statut === 'valide' ? p.montant : 0), 0);
    base.paiements = base.paiements.filter(p => p.fraisId !== id);
    base.bourses = base.bourses.filter(b => b.fraisId !== id);
    base.tarifs = base.tarifs.filter(t => t.fraisId !== id);
    base.frais = base.frais.filter(x => x.id !== id);
    journal(base, 'suppression', 'Type de frais ' + f.code + ' — ' + f.libelle + ' supprimé'
      + (pa.length ? ' avec ' + pa.length + ' paiement(s) (' + new Intl.NumberFormat('fr-FR').format(total) + ' FCFA)' : '')
      + (nBo ? ' et ' + nBo + ' bourse(s)' : ''));
    return { nPa:pa.length, nBo, total };
  });

  M.setTarif = (anneeId, cibleType, cibleId, fraisId, montant, regime, statut) => commitB((base, next) => {
    const rg = regime || null;
    const st = statut || null;
    const remove = (ct, ci) => {
      base.tarifs = base.tarifs.filter(x => !(x.anneeId===anneeId && x.fraisId===fraisId
        && x.cibleType===ct && x.cibleId===ci && (x.regime||null)===rg && (x.statutEleve||null)===st));
    };
    const upsert = (ct, ci, m) => {
      const t = base.tarifs.find(x => x.anneeId===anneeId && x.fraisId===fraisId && x.cibleType===ct && x.cibleId===ci && (x.regime||null)===rg && (x.statutEleve||null)===st);
      if (t) t.montant = m;
      else base.tarifs.push({ id:uid(), anneeId, cibleType:ct, cibleId:ci, fraisId, montant:m, ...(rg ? { regime:rg } : {}), ...(st ? { statutEleve:st } : {}) });
    };
    const baseOf = (ct, ci) => {
      const t = base.tarifs.find(x => x.anneeId===anneeId && x.fraisId===fraisId && x.cibleType===ct && x.cibleId===ci && (x.regime||null)===null);
      return t ? t.montant : null;
    };
    if (cibleType === 'niveau'){
      if (!montant || (rg && montant === baseOf('niveau', cibleId))) remove('niveau', cibleId);
      else upsert('niveau', cibleId, montant);
    } else {
      const cl = base.classes.find(c => c.id === cibleId);
      const ref = rg ? baseOf('classe', cibleId) != null ? baseOf('classe', cibleId) : (cl ? baseOf('niveau', cl.niveauId) : null)
                     : (cl ? baseOf('niveau', cl.niveauId) : null);
      if (!montant || (ref != null && montant === ref)) remove('classe', cibleId);
      else upsert('classe', cibleId, montant);
    }
    return {};
  });

  /* Personnalisation des états : logo, en-têtes, pieds de page */
  M.saveSettings = v => commitB((base, next) => {
    const cur = { ...(base.settings || {}) };
    const keys = ['nomEtablissement','sousTitre','mention','adresse','telephone','email','piedEtat','logo'];
    keys.forEach(k => { if (v[k] != null) cur[k] = String(v[k]).slice(0, k === 'logo' ? 400000 : 160); });
    /* v5.4 : personnalisation du bulletin (blocs d'en-tête, titre, lieu, signature) */
    if (v.bulletin && typeof v.bulletin === 'object'){
      const b = v.bulletin;
      cur.bulletin = {
        blocGauche: String(b.blocGauche || '').slice(0, 400),
        blocDroit: String(b.blocDroit || '').slice(0, 400),
        titre: String(b.titre || '').slice(0, 80),
        lieu: String(b.lieu || '').slice(0, 60),
        signature: String(b.signature || '').slice(0, 60),
        /* v5.5 : sections affichées, QR code de sécurité et son code */
        sections: (b.sections && typeof b.sections === 'object') ? {
          bilan: b.sections.bilan !== false, synthese: b.sections.synthese !== false,
          rang: b.sections.rang !== false, signatures: b.sections.signatures !== false,
          effectif: b.sections.effectif !== false
        } : undefined,
        qrCode: b.qrCode !== false,
        codeSecurite: /^[0-9a-f]{16}$/.test(String(b.codeSecurite || '')) ? String(b.codeSecurite) : ''
      };
    }
    /* v6.3 : thème de couleurs de l'application */
    if (v.theme !== undefined){
      if (v.theme && typeof v.theme === 'object'){
        cur.theme = {
          preset: String(v.theme.preset || 'perso').slice(0, 30),
          primaire: /^#[0-9a-fA-F]{6}$/.test(String(v.theme.primaire || '')) ? String(v.theme.primaire) : '#2C3A63',
          accent: /^#[0-9a-fA-F]{6}$/.test(String(v.theme.accent || '')) ? String(v.theme.accent) : '#C08A26'
        };
      } else delete cur.theme;
    }
    /* v6.3 : modèle de document par défaut (par type) */
    if (v.modeleDefaut !== undefined){
      const md = (v.modeleDefaut && typeof v.modeleDefaut === 'object') ? v.modeleDefaut : {};
      const actuel = { ...(cur.modeleDefaut || {}) };
      TYPES_DOCS.forEach(t => {
        if (md[t.id] !== undefined){
          if (md[t.id]) actuel[t.id] = String(md[t.id]).slice(0, 40);
          else delete actuel[t.id];
        }
      });
      if (Object.keys(actuel).length) cur.modeleDefaut = actuel; else delete cur.modeleDefaut;
    }
    if (!cur.nomEtablissement) throw new Error('Le nom de l\u2019établissement est requis.');
    base.settings = cur;
    journal(base, 'configuration', 'Personnalisation des états mise à jour (en-tête, pied de page' + (v.logo != null ? ', logo' : '') + ')');
    return {};
  });

  /* ---------- v6.3 : modèles de documents (concepteur) ---------- */
  M.saveModeleDoc = m => commitB((base, next) => {
    const nm = normalizeModele(m);                       /* validation + nettoyage stricts */
    if (!Array.isArray(base.modelesDocs)) base.modelesDocs = [];
    const list = base.modelesDocs;
    if (nm.id && list.some(x => x.id === nm.id)){
      Object.assign(list.find(x => x.id === nm.id), nm);
      journal(base, 'configuration', 'Modèle « ' + nm.nom + ' » modifié (' + nm.blocs.length + ' bloc(s))');
    } else {
      nm.id = uid();
      list.push(nm);
      journal(base, 'configuration', 'Modèle « ' + nm.nom + ' » créé (' + nm.typeDoc + ')');
    }
    return { id: nm.id };
  });
  /* Ajoute en une fois les modèles prêts à l'emploi (un par type de document)
     et les définit par défaut lorsque le type n'a pas encore de modèle par défaut. */
  M.installerModelesDefaut = () => commitB((base, next) => {
    if (!Array.isArray(base.modelesDocs)) base.modelesDocs = [];
    const st = { ...(base.settings || {}) };
    const def = { ...(st.modeleDefaut || {}) };
    let ajoutes = 0;
    TYPES_DOCS.forEach(t => {
      const nom = NOMS_MODELES_DEFAUT[t.id];
      if (base.modelesDocs.some(x => x.typeDoc === t.id && x.nom === nom)) return;
      const nm = normalizeModele(defaultModele(t.id, nom));
      nm.id = uid();
      base.modelesDocs.push(nm);
      if (!def[t.id]) def[t.id] = nm.id;
      ajoutes++;
    });
    st.modeleDefaut = def;
    base.settings = st;
    if (ajoutes) journal(base, 'configuration', ajoutes + ' modèle(s) de documents prêt(s) à l\u2019emploi ajouté(s)');
    return { ajoutes };
  });
  M.delModeleDoc = id => commitB((base, next) => {
    const list = Array.isArray(base.modelesDocs) ? base.modelesDocs : [];
    const m = list.find(x => String(x.id) === String(id));
    if (!m) throw new Error('Modèle introuvable.');
    base.modelesDocs = list.filter(x => x.id !== m.id);
    const st = { ...(base.settings || {}) };
    if (st.modeleDefaut && st.modeleDefaut[m.typeDoc]) delete st.modeleDefaut[m.typeDoc];
    base.settings = st;
    journal(base, 'configuration', 'Modèle « ' + m.nom + ' » supprimé');
    return {};
  });

  /* Tranches & échéances d'un type de frais (répartition en % du tarif) */
  M.saveTranches = (fraisId, tranches) => commitB((base, next) => {
    const f = base.frais.find(x => x.id === fraisId);
    if (!f) throw new Error('Frais introuvable.');
    if (!Array.isArray(tranches) || !tranches.length) throw new Error('Définissez au moins une tranche.');
    const clean = tranches.map((t, i) => ({
      id: 't' + (i + 1),
      label: String(t.label || '').trim() || ('T' + (i + 1)),
      pourcentage: Math.max(0, Math.round(Number(t.pourcentage) || 0)),
      jour: Math.min(31, Math.max(1, parseInt(t.jour, 10) || 1)),
      mois: Math.min(12, Math.max(1, parseInt(t.mois, 10) || 9))
    }));
    const tot = clean.reduce((s, t) => s + t.pourcentage, 0);
    if (tot !== 100) throw new Error('La somme des pourcentages doit être égale à 100 % (actuellement ' + tot + ' %).');
    if (clean.some(t => t.pourcentage <= 0)) throw new Error('Chaque tranche doit représenter au moins 1 % du tarif.');
    f.tranches = clean;
    journal(base, 'configuration', 'Tranches de « ' + f.libelle + ' » mises à jour (' + clean.length + ' tranche(s), échéances incluses)');
    return {};
  });

  M.saveEleve = v => commitB((base, next) => {
    const mat = String(v.matricule||'').trim().toUpperCase();
    if (!mat) throw new Error('Matricule requis.');
    if (!v.nom || !v.prenom) throw new Error('Nom et prénom requis.');
    if (!base.classes.some(c => c.id === v.classeId)) throw new Error('Sélectionnez une classe.');
    const cur = v.id ? base.eleves.find(e => e.id === v.id) : null;
    const anneeId = cur ? cur.anneeId : anneeIdRef.current;
    if (base.eleves.some(e => e.matricule === mat && e.anneeId === anneeId && e.id !== v.id))
      throw new Error('Ce matricule est déjà utilisé pour ' + ((yearById(base, anneeId) || {}).libelle || '') + '.');
    const fiche = {
      dateNaissance:v.dateNaissance || '', lieuNaissance:v.lieuNaissance || '',
      pereNom:v.pereNom || '', pereProfession:v.pereProfession || '', pereTel:v.pereTel || '',
      mereNom:v.mereNom || '', mereProfession:v.mereProfession || '', mereTel:v.mereTel || '',
      ancienEtablissement:v.ancienEtablissement || '', adresse:v.adresse || ''
    };
    if (cur){
      Object.assign(cur, { matricule:mat, nom:String(v.nom).toUpperCase(), prenom:v.prenom, sexe:v.sexe, classeId:v.classeId, tuteur:v.tuteur||'', tel:v.tel||'', statut:v.statut || cur.statut, regime:v.regime || cur.regime || 'externe', statutEleve:v.statutEleve || cur.statutEleve || 'nouveau', photo:v.photo || '', ...fiche });
      journal(base, 'eleve', 'Élève ' + mat + ' (' + cur.nom + ' ' + cur.prenom + ') modifié');
      return { eleve:cur };
    }
    const el = { id:uid(), matricule:mat, nom:String(v.nom).toUpperCase(), prenom:v.prenom, sexe:v.sexe,
      classeId:v.classeId, anneeId, tuteur:v.tuteur||'', tel:v.tel||'', statut:'actif', regime:v.regime || 'externe', statutEleve:v.statutEleve || 'nouveau', photo:v.photo || '', ...fiche };
    base.eleves.push(el);
    journal(base, 'eleve', 'Inscription de ' + mat + ' — ' + el.nom + ' ' + el.prenom);
    return { eleve:el };
  });
  M.toggleEleve = id => commitB((base, next) => {
    const e = base.eleves.find(x => x.id === id);
    if (!e) throw new Error('Élève introuvable.');
    e.statut = e.statut === 'actif' ? 'radie' : 'actif';
    journal(base, 'eleve', 'Élève ' + e.matricule + ' (' + e.nom + ' ' + e.prenom + ') ' + (e.statut === 'actif' ? 'réactivé' : 'radié'));
    return { eleve:e };
  });
  M.deleteEleve = id => commitB((base, next) => {
    const e = base.eleves.find(x => x.id === id);
    if (!e) throw new Error('Élève introuvable.');
    const nPa = base.paiements.filter(p => p.eleveId === id).length;
    if (nPa) throw new Error('Impossible : ' + nPa + ' paiement(s) enregistré(s) pour cet élève.');
    base.eleves = base.eleves.filter(x => x.id !== id);
    journal(base, 'eleve', 'Élève ' + e.matricule + ' supprimé');
    return {};
  });
  /* v6.6 : SUPPRESSION MULTIPLE — les élèves possédant des paiements sont
     ignorés (jamais supprimés) ; les notes, faits disciplinaires et bourses
     des élèves supprimés sont purgés avec eux. */
  M.deleteEleves = ids => commitB((base, next) => {
    const set = new Set((ids || []).map(String));
    const cibles = base.eleves.filter(e => set.has(String(e.id)));
    if (!cibles.length) throw new Error('Aucun élève sélectionné.');
    const avecPaie = cibles.filter(e => base.paiements.some(p => p.eleveId === e.id));
    const suppr = cibles.filter(e => !avecPaie.includes(e));
    if (!suppr.length)
      throw new Error('Aucune suppression possible : ' + avecPaie.length + ' élève(s) sélectionné(s) ont des paiements enregistrés.');
    const idsSup = new Set(suppr.map(e => String(e.id)));
    base.eleves = base.eleves.filter(e => !idsSup.has(String(e.id)));
    const avantNotes = (base.notes || []).length, avantDisc = (base.discipline || []).length, avantBourses = (base.bourses || []).length;
    base.notes = (base.notes || []).filter(n => !idsSup.has(String(n.eleveId)));
    base.discipline = (base.discipline || []).filter(f => !idsSup.has(String(f.eleveId)));
    base.bourses = (base.bourses || []).filter(b => !idsSup.has(String(b.eleveId)));
    const nNet = (avantNotes - base.notes.length) + (avantDisc - base.discipline.length) + (avantBourses - base.bourses.length);
    const extraits = suppr.slice(0, 6).map(e => e.matricule + ' (' + e.nom + ' ' + e.prenom + ')').join(', ');
    journal(base, 'suppression', suppr.length + ' élève(s) supprimé(s) : ' + extraits + (suppr.length > 6 ? '…' : '')
      + (nNet ? ' — ' + nNet + ' donnée(s) associée(s) purgée(s)' : '')
      + (avecPaie.length ? ' — ' + avecPaie.length + ' ignoré(s) (paiements enregistrés)' : ''));
    return { supprimes: suppr.length, ignores: avecPaie.length, purges: nNet,
      noms: suppr.map(e => e.nom + ' ' + e.prenom) };
  });

  M.addPaiement = v => commitB((base, next) => {
    const el = base.eleves.find(x => x.id === v.eleveId);
    if (!el) throw new Error('Aucun élève sélectionné.');
    const fr = base.frais.find(x => x.id === v.fraisId);
    if (!fr) throw new Error('Frais introuvable.');
    const m = parseInt(v.montant,10);
    if (!(m >= 100)) throw new Error('Montant trop faible (minimum 100 FCFA).');
    if (m > v.solde) throw new Error('Le montant dépasse le solde restant (' + new Intl.NumberFormat('fr-FR').format(v.solde) + ' FCFA).');
    const p = { id:uid(), numero:nextReceipt(base, el.anneeId), anneeId:el.anneeId, eleveId:el.id, fraisId:fr.id,
      montant:m, mode:v.mode, reference:String(v.reference||'').trim(), date:nowISO(),
      userId:userRef.current ? userRef.current.id : null, statut:'valide', note:String(v.note||'').trim(), motifAnnulation:'' };
    base.paiements.push(p);
    journal(base, 'paiement', 'Encaissement ' + p.numero + ' — ' + new Intl.NumberFormat('fr-FR').format(m) + ' FCFA (' + fr.code + ') • ' + el.nom + ' ' + el.prenom);
    return { paiement:p };
  });
  M.cancelPaiement = (id, motif) => commitB((base, next) => {
    const p = base.paiements.find(x => x.id === id);
    if (!p) throw new Error('Paiement introuvable.');
    if (!String(motif||'').trim()) throw new Error('Le motif de l\u2019annulation est obligatoire.');
    p.statut = 'annule'; p.motifAnnulation = String(motif).trim();
    p.annulePar = userRef.current ? userRef.current.username : '';
    journal(base, 'annulation', 'Paiement ' + p.numero + ' annulé — motif : ' + motif);
    return {};
  });

  /* v3.0 : attributions du profil (cycle du censeur, classes, matières) */
  const applyAttributions = (u, v, base) => {
    const ids = x => (Array.isArray(x) ? x.filter(Boolean) : []);
    delete u.niveauxIds; delete u.classesIds; delete u.matieresIds; delete u.enseignantId;
    if (v.role === 'censeur') u.niveauxIds = ids(v.niveauxIds);
    if (v.role === 'surveillant_secteur' || v.role === 'titulaire') u.classesIds = ids(v.classesIds);
    if (v.role === 'enseignant'){
      u.matieresIds = ids(v.matieresIds);   /* compat : le plan prime s'il existe */
      const fiche = String(v.enseignantId||'') || null;
      if (fiche && !(base.enseignants||[]).some(t => t.id === fiche)) throw new Error('Fiche enseignant introuvable.');
      if (fiche) u.enseignantId = fiche;
    }
  };
  M.saveUser = v => commitB((base, next) => {
    const un = String(v.username||'').trim().toLowerCase(), nom = String(v.nom||'').trim();
    const id = v.id || null;
    if (!nom) throw new Error('Nom complet requis.');
    if (un.length < 3) throw new Error('Identifiant : 3 caractères minimum.');
    const isSuper = userRef.current && userRef.current.role === 'superadmin';
    const ROLES_ETAB = ['admin','econome','lecteur','censeur','surveillant','surveillant_secteur','titulaire','enseignant','operateur'];
    /* v6.8 : l'administrateur peut créer le PREMIER superadministrateur
       (console réseau) tant qu'aucun n'existe — ensuite, seul un
       superadministrateur en crée ou en promeut d'autres. */
    const premierSuper = !next.users.some(u => u.role === 'superadmin') && !next.superadminExiste;
    if (!ROLES_ETAB.concat(isSuper || premierSuper ? ['superadmin'] : []).includes(v.role)) throw new Error('Rôle invalide.');
    if (v.role === 'superadmin' && !isSuper && !premierSuper) throw new Error('Seul le superadministrateur peut créer ou promouvoir un superadministrateur.');
    const etab = v.role === 'superadmin' ? null : (String(v.etablissementId||'') || (etabsOf(next).length === 1 ? etabsOf(next)[0].id : null));
    if (v.role !== 'superadmin' && !etab && !isSuper) throw new Error('Rattachez le compte à un établissement.');
    /* un administrateur d'établissement ne gère que les comptes de SON établissement */
    if (!isSuper && etab && userRef.current && userRef.current.etablissementId && etab !== userRef.current.etablissementId)
      throw new Error('Vous ne pouvez rattacher un compte qu’à votre établissement.');
    if (next.users.some(u => u.username === un && u.id !== id)) throw new Error('Cet identifiant est déjà utilisé.');
    const actif = !!v.actif;
    if (id){
      const u = next.users.find(x => x.id === id);
      const self = userRef.current && userRef.current.id === id;
      if (self && (u.role !== v.role || u.actif !== actif)) throw new Error('Vous ne pouvez pas modifier votre propre rôle ou statut.');
      if (u.role === 'admin' && (v.role !== 'admin' || !actif)){
        const others = next.users.filter(x => x.id !== id && x.role === 'admin' && x.actif).length;
        if (!others) throw new Error('Impossible : au moins un administrateur actif doit demeurer.');
      }
      u.nom = nom; u.username = un; u.role = v.role; u.actif = actif; u.etablissementId = etab;
      applyAttributions(u, v, base);
      if (String(v.pwd||'').length){
        if (String(v.pwd).length < 6) throw new Error('Mot de passe : 6 caractères minimum.');
        u.salt = makeSalt(); u.hash = hashPwd(u.salt, v.pwd);
      }
      journal(base, 'utilisateur', 'Compte ' + un + ' modifié (' + v.role + ')');
    } else {
      if (String(v.pwd||'').length < 6) throw new Error('Mot de passe : 6 caractères minimum.');
      const salt = makeSalt();
      const nu = { id:uid(), username:un, nom, role:v.role, actif, salt, hash:hashPwd(salt, v.pwd), dernierAcces:null, etablissementId:etab };
      applyAttributions(nu, v, base);
      next.users.push(nu);
      journal(base, 'utilisateur', 'Compte ' + un + ' créé (' + v.role + ')');
    }
    return {};
  });
  M.resetPwd = (id, pwd) => commitB((base, next) => {
    const u = next.users.find(x => x.id === id);
    if (!u) throw new Error('Utilisateur introuvable.');
    if (String(pwd||'').length < 6) throw new Error('Mot de passe : 6 caractères minimum.');
    u.salt = makeSalt(); u.hash = hashPwd(u.salt, pwd);
    journal(base, 'utilisateur', 'Mot de passe réinitialisé pour ' + u.username);
    return {};
  });
  M.toggleUser = id => commitB((base, next) => {
    const u = next.users.find(x => x.id === id);
    if (!u) throw new Error('Utilisateur introuvable.');
    if (userRef.current && userRef.current.id === id) throw new Error('Impossible de désactiver votre propre compte.');
    if (u.role === 'admin' && u.actif){
      const others = next.users.filter(x => x.id !== id && x.role === 'admin' && x.actif).length;
      if (!others) throw new Error('Impossible : au moins un administrateur actif doit demeurer.');
    }
    u.actif = !u.actif;
    journal(base, 'utilisateur', 'Compte ' + u.username + ' ' + (u.actif ? 'activé' : 'désactivé'));
    return {};
  });
  M.deleteUser = id => commitB((base, next) => {
    const u = next.users.find(x => x.id === id);
    if (!u) throw new Error('Utilisateur introuvable.');
    if (userRef.current && userRef.current.id === id) throw new Error('Impossible de supprimer votre propre compte.');
    if (u.role === 'admin'){
      const others = next.users.filter(x => x.id !== id && x.role === 'admin' && x.actif).length;
      if (!others) throw new Error('Impossible : au moins un administrateur doit demeurer.');
    }
    next.users = next.users.filter(x => x.id !== id);
    journal(base, 'utilisateur', 'Compte ' + u.username + ' supprimé');
    return {};
  });

  M.saveBourse = v => commitB((base, next) => {
    base.bourses = base.bourses || [];
    const el = base.eleves.find(x => x.id === v.eleveId);
    if (!el) throw new Error('Sélectionnez un élève.');
    const id = v.id || null;
    let pourcentage = 0, montant = 0;
    if (v.nature === 'pourcentage'){
      pourcentage = parseInt(v.valeur, 10);
      if (!(pourcentage >= 1 && pourcentage <= 100)) throw new Error('Pourcentage invalide (1 à 100).');
    } else {
      montant = parseInt(v.valeur, 10);
      if (!(montant >= 500)) throw new Error('Montant trop faible (minimum 500 FCFA).');
    }
    const motif = String(v.motif || '').trim();
    if (!motif) throw new Error('Indiquez le motif de la bourse / réduction.');
    if (v.fraisId && !base.frais.some(f => f.id === v.fraisId)) throw new Error('Frais invalide.');
    if (id){
      const b = base.bourses.find(x => x.id === id);
      if (!b) throw new Error('Bourse introuvable.');
      Object.assign(b, { eleveId:el.id, anneeId:el.anneeId, fraisId:v.fraisId || null, pourcentage, montant, motif, actif:!!v.actif });
      journal(base, 'bourse', 'Bourse modifiée — ' + el.nom + ' ' + el.prenom + ' : ' + motif);
    } else {
      base.bourses.push({ id:uid(), eleveId:el.id, anneeId:el.anneeId, fraisId:v.fraisId || null,
        pourcentage, montant, motif, actif:!!v.actif, date:nowISO().slice(0,10),
        createdBy:userRef.current ? userRef.current.username : '' });
      journal(base, 'bourse', 'Bourse accordée — ' + el.nom + ' ' + el.prenom + ' : ' + motif);
    }
    return {};
  });
  /* Annuler toutes les réductions actives d'un élève (suspension) */
  M.cancelBoursesEleve = eleveId => commitB((base, next) => {
    base.bourses = base.bourses || [];
    const actives = base.bourses.filter(b => b.eleveId === eleveId && b.actif !== false);
    if (!actives.length) throw new Error('Aucune réduction active pour cet élève.');
    actives.forEach(b => { b.actif = false; });
    const el = base.eleves.find(e => e.id === eleveId);
    journal(base, 'bourse', 'Réductions annulées pour ' + (el ? el.matricule + ' (' + el.nom + ' ' + el.prenom + ')' : 'un élève') + ' — ' + actives.length + ' bourse(s) suspendue(s)');
    return { n:actives.length };
  });

  /* Cloner la grille tarifaire spécifique d'une classe vers d'autres classes */
  M.cloneGrille = (anneeId, fromClassId, toClassIds, inclureRegimes=true) => commitB((base, next) => {
    const src = base.tarifs.filter(t => t.anneeId === anneeId && t.cibleType === 'classe'
      && t.cibleId === fromClassId && (inclureRegimes ? true : !t.regime));
    if (!src.length) throw new Error('La classe source ne possède aucun tarif spécifique à cloner.');
    const ids = (Array.isArray(toClassIds) ? toClassIds : [toClassIds]).filter(id => id && id !== fromClassId);
    if (!ids.length) throw new Error('Sélectionnez au moins une classe destination.');
    let n = 0;
    ids.forEach(cid => {
      base.tarifs = base.tarifs.filter(t => !(t.anneeId === anneeId && t.cibleType === 'classe'
        && t.cibleId === cid && (inclureRegimes ? true : !t.regime)));
      src.forEach(t => { base.tarifs.push({ ...t, id:uid(), cibleId:cid }); n++; });
    });
    const from = base.classes.find(c => c.id === fromClassId);
    journal(base, 'configuration', 'Grille tarifaire de ' + (from ? from.libelle : fromClassId) + ' clonée vers ' + ids.length + ' classe(s) — ' + n + ' tarif(s)');
    return { n };
  });

  /* Supprimer toutes les données de test — configuration, comptes et personnalisation conservés */
  M.purgerDonneesTest = () => commitB((base, next) => {
    const n = { eleves:(base.eleves || []).length, paiements:(base.paiements || []).length, bourses:(base.bourses || []).length };
    base.eleves = []; base.paiements = []; base.bourses = []; base.journal = [];
    journal(base, 'suppression', 'Données de test supprimées (' + n.eleves + ' élève(s), ' + n.paiements + ' paiement(s), ' + n.bourses + ' bourse(s)) — configuration, comptes et personnalisation conservés');
    return n;
  });

  /* ---------- Liste des anciens élèves (préremplissage des inscriptions) ---------- */
  /* ============== v3.0 : PÉDAGOGIE — matières et notes ============== */
  M.saveMatiere = v => commitB((base, next) => {
    const code = String(v.code||'').trim().toUpperCase(), lib = String(v.libelle||'').trim();
    if (!code || !lib) throw new Error('Code et libellé requis.');
    if ((base.matieres||[]).some(x => x.code === code && x.id !== v.id)) throw new Error('Ce code matière existe déjà.');
    /* v4.1 : ni groupe ni coefficient ici — ils sont définis par classe dans le plan */
    if (v.id){
      const m = base.matieres.find(x => x.id === v.id);
      if (!m) throw new Error('Matière introuvable.');
      Object.assign(m, { code, libelle:lib });
      journal(base, 'pédagogie', 'Matière ' + lib + ' modifiée');
    } else {
      base.matieres.push({ id:uid(), code, libelle:lib });
      journal(base, 'pédagogie', 'Matière ' + lib + ' créée');
    }
    return {};
  });
  M.deleteMatiere = id => commitB((base, next) => {
    const m = base.matieres.find(x => x.id === id);
    if (!m) throw new Error('Matière introuvable.');
    const nNotes = (base.notes||[]).filter(n => n.matiereId === id).length;
    const nPlan = (base.plan||[]).filter(e => e.matiereId === id).length;
    base.matieres = base.matieres.filter(x => x.id !== id);
    base.notes = (base.notes||[]).filter(n => n.matiereId !== id);
    base.plan = (base.plan||[]).filter(e => e.matiereId !== id);
    journal(base, 'pédagogie', 'Matière « ' + m.libelle + ' » supprimée (' + nNotes + ' note(s), ' + nPlan + ' enseignement(s) associés)');
    return {};
  });
  /* ============== v4.0 : GROUPES DE MATIÈRES ============== */
  M.saveGroupe = v => commitB((base, next) => {
    const code = String(v.code||'').trim().toUpperCase(), lib = String(v.libelle||'').trim();
    if (!code || !lib) throw new Error('Code et libellé requis.');
    if ((base.groupes||[]).some(g => g.code === code && g.id !== v.id)) throw new Error('Ce code groupe existe déjà.');
    if (v.id){
      const g = base.groupes.find(x => x.id === v.id);
      if (!g) throw new Error('Groupe introuvable.');
      Object.assign(g, { code, libelle:lib });
      journal(base, 'pédagogie', 'Groupe « ' + lib + ' » modifié');
    } else {
      base.groupes.push({ id:uid(), code, libelle:lib });
      journal(base, 'pédagogie', 'Groupe « ' + lib + ' » créé');
    }
    return {};
  });
  M.deleteGroupe = id => commitB((base, next) => {
    const g = (base.groupes||[]).find(x => x.id === id);
    if (!g) throw new Error('Groupe introuvable.');
    const attaches = (base.plan||[]).filter(e => e.groupeId === id).length;
    if (attaches) throw new Error('Ce groupe est utilisé par ' + attaches + ' enseignement(s) du plan : réaffectez-les d\u2019abord.');
    base.groupes = base.groupes.filter(x => x.id !== id);
    journal(base, 'pédagogie', 'Groupe « ' + g.libelle + ' » supprimé');
    return {};
  });

  /* ============== v4.0 : ENSEIGNANTS ============== */
  M.saveEnseignant = v => commitB((base, next) => {
    const nom = String(v.nom||'').trim().toUpperCase(), prenom = String(v.prenom||'').trim();
    if (!nom || !prenom) throw new Error('Nom et prénom requis.');
    const mat = String(v.matricule||'').trim().toUpperCase();
    if (mat && (base.enseignants||[]).some(t => t.matricule === mat && t.id !== v.id)) throw new Error('Ce matricule existe déjà.');
    const tel = String(v.telephone||'').trim();
    const mail = String(v.email||'').trim();
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new Error('Adresse électronique invalide.');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(v.dateNaissance||'')) ? v.dateNaissance : '';
    const emb = /^\d{4}-\d{2}-\d{2}$/.test(String(v.dateEmbauche||'')) ? v.dateEmbauche : '';
    const f = { matricule:mat, nom, prenom, sexe:(v.sexe === 'F' ? 'F' : 'M'),
      dateNaissance:date, lieuNaissance:String(v.lieuNaissance||'').trim(), telephone:tel, email:mail,
      quartier:String(v.quartier||'').trim(), specialite:String(v.specialite||'').trim(),
      diplome:String(v.diplome||'').trim(), grade:String(v.grade||'').trim(), dateEmbauche:emb,
      statut:(v.statut === 'inactif' ? 'inactif' : 'actif') };
    if (v.id){
      const t = base.enseignants.find(x => x.id === v.id);
      if (!t) throw new Error('Enseignant introuvable.');
      Object.assign(t, f);
      journal(base, 'enseignants', 'Fiche enseignant modifiée — ' + nom + ' ' + prenom);
    } else {
      base.enseignants.push({ id:uid(), ...f });
      journal(base, 'enseignants', 'Fiche enseignant créée — ' + nom + ' ' + prenom);
    }
    return {};
  });
  M.deleteEnseignant = id => commitB((base, next) => {
    const t = (base.enseignants||[]).find(x => x.id === id);
    if (!t) throw new Error('Enseignant introuvable.');
    const nPlan = (base.plan||[]).filter(e => e.enseignantId === id).length;
    base.plan = (base.plan||[]).filter(e => e.enseignantId !== id);
    next.users.forEach(u => { if (u.enseignantId === id) delete u.enseignantId; });
    base.enseignants = base.enseignants.filter(x => x.id !== id);
    journal(base, 'enseignants', 'Fiche enseignant supprimée — ' + t.nom + ' ' + t.prenom + ' (' + nPlan + ' enseignement(s) retiré(s) du plan)');
    return { nPlan };
  });

  /* ============== v4.0 : PLAN DES ENSEIGNEMENTS ============== */
  M.savePlanEntry = v => commitB((base, next) => {
    const cls = base.classes.find(c => c.id === v.classeId);
    if (!cls) throw new Error('Classe introuvable.');
    const mat = (base.matieres||[]).find(m => m.id === v.matiereId);
    if (!mat) throw new Error('Matière introuvable — créez-la d\u2019abord.');
    const ens = String(v.enseignantId||'') || null;
    if (ens && !(base.enseignants||[]).some(t => t.id === ens)) throw new Error('Enseignant introuvable.');
    const gid = String(v.groupeId||'') || null;
    if (!gid || !(base.groupes||[]).some(g => g.id === gid)) throw new Error('Attribuez le groupe de cette matière pour cette classe.');
    const coef = parseFloat(v.coefficient);
    if (!(coef > 0 && coef <= 10)) throw new Error('Coefficient invalide (0,5 à 10).');
    const ordre = parseInt(v.ordre, 10);
    const existing = (base.plan||[]).filter(e => e.classeId === cls.id && e.id !== v.id);
    const ord = (ordre >= 1 && ordre <= 60) ? ordre : existing.length + 1;
    if (existing.some(e => e.matiereId === mat.id)) throw new Error('Cette matière est déjà au plan de cette classe.');
    if (v.id){
      const e = base.plan.find(x => x.id === v.id);
      if (!e) throw new Error('Enseignement introuvable.');
      Object.assign(e, { ordre:ord, matiereId:mat.id, enseignantId:ens, coefficient:coef, groupeId:gid });
      journal(base, 'plan', 'Enseignement modifié en ' + cls.libelle + ' — ' + mat.libelle);
    } else {
      base.plan.push({ id:uid(), classeId:cls.id, ordre:ord, matiereId:mat.id, enseignantId:ens, coefficient:coef, groupeId:gid });
      journal(base, 'plan', 'Enseignement ajouté en ' + cls.libelle + ' — ' + mat.libelle);
    }
    return {};
  });
  M.deletePlanEntry = id => commitB((base, next) => {
    const e = (base.plan||[]).find(x => x.id === id);
    if (!e) throw new Error('Enseignement introuvable.');
    const cls = base.classes.find(c => c.id === e.classeId);
    const mat = (base.matieres||[]).find(m => m.id === e.matiereId);
    base.plan = base.plan.filter(x => x.id !== id);
    journal(base, 'plan', 'Enseignement retiré' + (cls ? ' de ' + cls.libelle : '') + (mat ? ' — ' + mat.libelle : ''));
    return {};
  });
  M.reorderPlan = (classeId, id, dir) => commitB((base, next) => {
    const lst = (base.plan||[]).filter(e => e.classeId === classeId).sort((a,b) => (a.ordre||99) - (b.ordre||99));
    const i = lst.findIndex(e => e.id === id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lst.length) return {};
    const tmp = lst[i].ordre; lst[i].ordre = lst[j].ordre; lst[j].ordre = tmp;
    lst.forEach((e, k) => { e.ordre = k + 1; });
    return {};
  });
  /* v4.1 : clone UN enseignement vers d'autres classes (les classes où la
     matière est déjà au plan sont ignorées) */
  M.clonePlanEntry = (id, toClasseIds) => commitB((base, next) => {
    const e = (base.plan||[]).find(x => x.id === id);
    if (!e) throw new Error('Enseignement introuvable.');
    const cibles = (toClasseIds || []).filter(cid => cid !== e.classeId);
    if (!cibles.length) throw new Error('Choisissez au moins une classe cible.');
    let n = 0; const skips = [];
    cibles.forEach(cid => {
      if ((base.plan||[]).some(x => x.classeId === cid && x.matiereId === e.matiereId)){ skips.push(cid); return; }
      const maxOrdre = (base.plan||[]).filter(x => x.classeId === cid).reduce((mx, x) => Math.max(mx, x.ordre || 0), 0);
      base.plan.push({ id:uid(), classeId:cid, ordre:maxOrdre + 1, matiereId:e.matiereId,
        enseignantId:e.enseignantId, coefficient:e.coefficient, groupeId:e.groupeId || null });
      n++;
    });
    const nom = x => (base.classes.find(c => c.id === x) || {}).libelle || x;
    const mat = (base.matieres||[]).find(m => m.id === e.matiereId);
    journal(base, 'plan', 'Enseignement « ' + (mat ? mat.libelle : '?') + ' » cloné vers ' + n + ' classe(s)'
      + (skips.length ? ' — matière déjà présente en : ' + skips.map(nom).join(', ') : ''));
    return { n, skips };
  });

  /* Clone le plan d'une classe vers d'autres classes (remplacement) */
  M.clonePlan = (fromClasseId, toClasseIds) => commitB((base, next) => {
    const src = (base.plan||[]).filter(e => e.classeId === fromClasseId);
    if (!src.length) throw new Error('La classe source n\u2019a aucun enseignement à cloner.');
    const cibles = (toClasseIds || []).filter(id => id !== fromClasseId);
    if (!cibles.length) throw new Error('Choisissez au moins une classe cible.');
    let n = 0;
    cibles.forEach(cid => {
      base.plan = base.plan.filter(e => e.classeId !== cid);
      src.forEach(e => { base.plan.push({ id:uid(), classeId:cid, ordre:e.ordre, matiereId:e.matiereId, enseignantId:e.enseignantId, coefficient:e.coefficient, groupeId:e.groupeId || null }); n++; });
    });
    journal(base, 'plan', 'Plan cloné vers ' + cibles.length + ' classe(s) — ' + n + ' enseignement(s) copié(s)');
    return { n };
  });

  /* upsert d'une note : (élève × matière × séquence × [devoir]) unique —
     v6.5 : une note DE DEVOIR est rattachée à un devoir de la séquence ;
     les notes d'évaluation restent interdites sur une séquence à devoirs
     (la note séquentielle y est calculée automatiquement). */
  M.saveNote = v => commitB((base, next) => {
    const u = userRef.current;
    if (!u) throw new Error('Session expirée.');
    const el = base.eleves.find(x => x.id === v.eleveId);
    if (!el) throw new Error('Élève introuvable.');
    if (!canClasse(base, u, el.classeId)) throw new Error('Cette classe n\u2019est pas dans votre périmètre.');
    if (u.role === 'enseignant'){
      const mi = new Set(scopeMatieresIds(base, u) || []);
      if (!mi.has(v.matiereId)) throw new Error('Cette matière n\u2019est pas dans vos enseignements.');
    }
    const mat = base.matieres.find(x => x.id === v.matiereId);
    if (!mat) throw new Error('Matière introuvable.');
    const seq = String(v.sequence == null ? '' : v.sequence).trim();
    const sq = (base.sequences || []).find(s => String(s.id) === seq);
    if (!seq || !sq) throw new Error('Séquence invalide — définissez-la dans Séquences & appréciations.');
    const dv = devoirsDe(base, sq);
    const dvId = (v.devoirId != null && String(v.devoirId) !== '') ? String(v.devoirId) : null;
    if (dvId && !dv.some(d => String(d.id) === dvId)) throw new Error('Devoir introuvable pour cette séquence.');
    if (!dvId && dv.length) throw new Error('Cette séquence est notée par devoirs — sa note est calculée automatiquement depuis les notes de devoir.');
    /* v5.4 : une SEULE note par élève, matière et séquence — l'écriture
       normalise les anciennes paires devoir/composition éventuelles.
       v6.5 : les notes de devoir (rattachées à un devoir) ne sont pas
       touchées par l'écriture d'une note d'évaluation, et réciproquement. */
    const estDevoir = n => n.type === 'devoir' && n.devoirId != null;
    const memeNote = n => n.eleveId === el.id && n.matiereId === mat.id && String(n.sequence) === seq
      && (dvId ? (n.type === 'devoir' && String(n.devoirId) === dvId) : !estDevoir(n));
    if (v.valeur === '' || v.valeur == null){
      base.notes = (base.notes||[]).filter(n => !memeNote(n));
      return {};
    }
    const val = Math.round(parseFloat(String(v.valeur).replace(',', '.')) * 100) / 100;
    if (isNaN(val) || val < 0 || val > 20) throw new Error('Note invalide (0 à 20).');
    base.notes = (base.notes||[]).filter(n => !memeNote(n));
    base.notes.push({ id:uid(), anneeId:el.anneeId, eleveId:el.id, classeId:el.classeId, matiereId:mat.id,
      sequence:seq, type: dvId ? 'devoir' : 'evaluation', devoirId: dvId, valeur:val, date:nowISO(), auteurId:u.id });
    return {};
  });
  /* ============== v5.0 : SÉQUENCES & APPRÉCIATIONS ============== */
  M.saveSequence = v => commitB((base, next) => {
    const lib = String(v.libelle||'').trim();
    if (!lib) throw new Error('Libellé requis.');
    const tri = parseInt(v.trimestre, 10);
    if (!(tri >= 1 && tri <= 3)) throw new Error('Trimestre invalide (1 à 3).');
    const poids = parseFloat(v.poids);
    if (!(poids > 0 && poids <= 100)) throw new Error('Poids invalide (1 à 100 %).');
    if (v.id){
      const sq = (base.sequences||[]).find(x => String(x.id) === String(v.id));
      if (!sq) throw new Error('Séquence introuvable.');
      Object.assign(sq, { libelle:lib, trimestre:tri, poids });
      journal(base, 'pédagogie', 'Séquence « ' + lib + ' » modifiée (T' + tri + ', poids ' + poids + ' %)');
    } else {
      base.sequences.push({ id:uid(), libelle:lib, trimestre:tri, poids });
      journal(base, 'pédagogie', 'Séquence « ' + lib + ' » créée (T' + tri + ', poids ' + poids + ' %)');
    }
    return {};
  });
  M.deleteSequence = id => commitB((base, next) => {
    const sq = (base.sequences||[]).find(x => String(x.id) === String(id));
    if (!sq) throw new Error('Séquence introuvable.');
    const nNotes = (base.notes||[]).filter(n => String(n.sequence) === String(id)).length;
    if (nNotes) throw new Error(nNotes + ' note(s) sont rattachées à cette séquence — annulez-les d\u2019abord.');
    base.sequences = base.sequences.filter(x => String(x.id) !== String(id));
    journal(base, 'pédagogie', 'Séquence « ' + sq.libelle + ' » supprimée');
    return {};
  });
  /* v6.5 : DEVOIRS d'une séquence (administrateur) — définit la liste des
     devoirs et leurs pourcentages (total = 100 %). Les notes de devoir des
     devoirs retirés sont supprimées ; les notes d'évaluation de la séquence
     sont annulées : la note séquentielle est désormais calculée. Une liste
     vide rétablit la saisie directe (et supprime les notes de devoir). */
  M.saveDevoirs = (sequenceId, liste) => commitB((base, next) => {
    const sq = (base.sequences||[]).find(x => String(x.id) === String(sequenceId));
    if (!sq) throw new Error('Séquence introuvable.');
    const Brut = Array.isArray(liste) ? liste : [];
    const v = devoirsValides(Brut);
    if (!v.ok) throw new Error(v.msg);
    const devoirs = Brut.map(d => ({
      id: (d.id != null && String(d.id).trim() !== '') ? String(d.id) : uid(),
      libelle: String(d.libelle || '').trim(),
      pourcentage: parseFloat(d.pourcentage)
    }));
    const ids = new Set(devoirs.map(d => String(d.id)));
    const avant = (base.notes||[]).length;
    base.notes = (base.notes||[]).filter(n => !(String(n.sequence) === String(sequenceId)
      && n.type === 'devoir' && n.devoirId != null && !ids.has(String(n.devoirId))));
    const orphelines = avant - (base.notes||[]).length;
    let annulees = 0;
    if (devoirs.length){
      const avant2 = (base.notes||[]).length;
      base.notes = (base.notes||[]).filter(n => !(String(n.sequence) === String(sequenceId)
        && !(n.type === 'devoir' && n.devoirId != null)));
      annulees = avant2 - (base.notes||[]).length;
    }
    sq.devoirs = devoirs;
    journal(base, 'pédagogie', 'Devoirs de « ' + sq.libelle + ' » ' + (devoirs.length
      ? 'définis : ' + devoirs.map(d => d.libelle + ' (' + d.pourcentage + ' %)').join(', ')
      : 'supprimés — saisie directe rétablie')
      + (orphelines ? ' — ' + orphelines + ' note(s) de devoir supprimée(s)' : '')
      + (annulees ? ' — ' + annulees + ' note(s) d\u2019évaluation annulée(s)' : ''));
    return { orphelines, annulees };
  });
  /* v6.0 : les 4 échelles d'appréciation partagent la même mutation —
     v.coll désigne la collection ('appreciations' par défaut) :
     notes classiques, notes APC, moyennes classiques, moyennes APC. */
  M.saveAppreciation = v => commitB((base, next) => {
    const COLLS = ['appreciations','appreciationsApc','appreciationsMoyenne','appreciationsMoyenneApc'];
    const coll = COLLS.includes(v.coll) ? v.coll : 'appreciations';
    const lib = String(v.libelle||'').trim();
    if (!lib) throw new Error('Libellé requis.');
    const min = parseFloat(v.min), max = parseFloat(v.max);
    if (isNaN(min) || isNaN(max) || min < 0 || max > 20 || min >= max)
      throw new Error('Fourchette invalide : 0 ≤ min < max ≤ 20.');
    if (!Array.isArray(base[coll])) base[coll] = [];
    const autres = (base[coll]||[]).filter(a => a.id !== v.id);
    if (autres.some(a => min < a.max && max > a.min))
      throw new Error('Cette fourchette chevauche une appréciation existante.');
    if (v.id){
      const a = base[coll].find(x => x.id === v.id);
      if (!a) throw new Error('Appréciation introuvable.');
      Object.assign(a, { min, max, libelle:lib });
      journal(base, 'pédagogie', 'Appréciation « ' + lib + ' » modifiée (' + min + ' – ' + max + ')');
    } else {
      base[coll].push({ id:uid(), min, max, libelle:lib });
      journal(base, 'pédagogie', 'Appréciation « ' + lib + ' » créée (' + min + ' – ' + max + ')');
    }
    return {};
  });
  M.deleteAppreciation = (id, coll) => commitB((base, next) => {
    const COLLS = ['appreciations','appreciationsApc','appreciationsMoyenne','appreciationsMoyenneApc'];
    const c = COLLS.includes(coll) ? coll : 'appreciations';
    if (!Array.isArray(base[c])) base[c] = [];
    const a = (base[c]||[]).find(x => x.id === id);
    if (!a) throw new Error('Appréciation introuvable.');
    base[c] = base[c].filter(x => x.id !== id);
    journal(base, 'pédagogie', 'Appréciation « ' + a.libelle + ' » supprimée');
    return {};
  });

  /* ============== v5.0 : RECONDUCTION & ANNULATION DES NOTES ============== */
  /* Reconduit les notes (évaluation ou devoir) d'une matière, d'une classe,
     d'une séquence source vers une séquence cible. v6.5 : une note de devoir
     est reconduite vers le devoir de même libellé de la séquence cible (si
     la cible ne le possède pas, la note est ignorée) ; une note d'évaluation
     n'est pas reconduite vers une séquence notée par devoirs (note calculée). */
  M.reconduireNotes = (classeId, matiereId, fromSeq, toSeq, ecrase) => commitB((base, next) => {
    if (String(fromSeq) === String(toSeq)) throw new Error('Choisissez une séquence cible différente.');
    const mat = (base.matieres||[]).find(m => m.id === matiereId);
    if (!mat) throw new Error('Matière introuvable.');
    const dvSource = devoirsDe(base, fromSeq);
    const dvCible = devoirsDe(base, toSeq);
    const src = (base.notes||[]).filter(n => n.classeId === classeId && n.matiereId === matiereId && String(n.sequence) === String(fromSeq));
    if (!src.length) throw new Error('Aucune note à reconduire sur la séquence source.');
    let n = 0, skips = 0;
    src.forEach(sn => {
      const estDev = sn.type === 'devoir' && sn.devoirId != null;
      let devoirCible = null;
      if (estDev){
        const dSrc = dvSource.find(d => String(d.id) === String(sn.devoirId)) || null;
        const lib = dSrc ? String(dSrc.libelle).trim().toLowerCase() : '';
        devoirCible = lib ? (dvCible.find(d => String(d.libelle).trim().toLowerCase() === lib) || null) : null;
        if (!devoirCible){ skips++; return; }   /* pas de devoir de même libellé à l'arrivée */
      } else if (dvCible.length){ skips++; return; }  /* évaluation → séquence à devoirs : ignorée */
      const ex = (base.notes||[]).find(x => x.eleveId === sn.eleveId && x.matiereId === matiereId
        && String(x.sequence) === String(toSeq) && x.type === sn.type
        && String(x.devoirId || '') === String(estDev ? devoirCible.id : ''));
      if (ex && !ecrase){ skips++; return; }
      if (ex) ex.valeur = sn.valeur;
      else base.notes.push({ id:uid(), anneeId:sn.anneeId, eleveId:sn.eleveId, classeId:sn.classeId,
        matiereId:sn.matiereId, sequence:String(toSeq), type:sn.type, devoirId: estDev ? devoirCible.id : (sn.devoirId || null),
        valeur:sn.valeur, date:nowISO(), auteurId:sn.auteurId });
      n++;
    });
    const sqFrom = (base.sequences||[]).find(x => String(x.id) === String(fromSeq));
    const sqTo = (base.sequences||[]).find(x => String(x.id) === String(toSeq));
    journal(base, 'notes', 'Notes reconduites — ' + mat.libelle + ' : ' + (sqFrom ? sqFrom.libelle : fromSeq) + ' → ' + (sqTo ? sqTo.libelle : toSeq) + ' (' + n + ' note(s)' + (skips ? ', ' + skips + ' ignorée(s)' : '') + ')');
    return { n, skips };
  });
  /* Annule toutes les notes d'un élève pour une matière et une séquence */
  M.annulerNotesEleve = (eleveId, matiereId, sequenceId) => commitB((base, next) => {
    const el = base.eleves.find(x => x.id === eleveId);
    if (!el) throw new Error('Élève introuvable.');
    const avant = (base.notes||[]).length;
    base.notes = (base.notes||[]).filter(n => !(n.eleveId === eleveId && n.matiereId === matiereId && String(n.sequence) === String(sequenceId)));
    const n = avant - base.notes.length;
    const mat = (base.matieres||[]).find(m => m.id === matiereId);
    const sq = (base.sequences||[]).find(x => String(x.id) === String(sequenceId));
    journal(base, 'notes', 'Notes annulées — ' + el.nom + ' ' + el.prenom + (mat ? ' (' + mat.libelle + ')' : '') + (sq ? ', ' + sq.libelle : '') + ' : ' + n + ' note(s)');
    return { n };
  });

  /* ============== v3.0 : DISCIPLINE — faits et sanctions ============== */
  M.saveFait = v => commitB((base, next) => {
    const u = userRef.current;
    if (!u) throw new Error('Session expirée.');
    const el = base.eleves.find(x => x.id === v.eleveId);
    if (!el) throw new Error('Élève introuvable.');
    if (!canClasse(base, u, el.classeId)) throw new Error('Cette classe n\u2019est pas dans votre périmètre.');
    const cats = ['retard','absence','tenue','indiscipline','travail','autre'];
    const cat = cats.includes(v.categorie) ? v.categorie : 'autre';
    const grav = [1,2,3].includes(parseInt(v.gravite,10)) ? parseInt(v.gravite,10) : 1;
    const justifie = cat === 'absence' ? !!v.justifie : false;
    const desc = String(v.description||'').trim();
    if (!desc) throw new Error('Décrivez le fait (motif).');
    /* v5.5→v5.7 : durée des absences en HEURES (1 par défaut) */
    let duree = Math.max(1, parseInt(v.duree, 10) || 1);
    if (!(duree >= 1 && duree <= 60)) duree = 1;
    const sanction = String(v.sanction||'').trim();
    const date = /^\d{4}-\d{2}-\d{2}/.test(String(v.date||'')) ? String(v.date).slice(0,10) : nowISO().slice(0,10);
    if (v.id){
      const f = (base.discipline||[]).find(x => x.id === v.id);
      if (!f) throw new Error('Fait introuvable.');
      Object.assign(f, { categorie:cat, gravite:grav, description:desc, sanction, date, justifie, duree:cat === 'absence' ? duree : undefined });
      journal(base, 'discipline', 'Fait disciplinaire modifié — ' + el.nom + ' ' + el.prenom + ' (' + desc.slice(0, 40) + ')');
    } else {
      base.discipline.push({ id:uid(), anneeId:el.anneeId, eleveId:el.id, classeId:el.classeId,
        date, categorie:cat, gravite:grav, description:desc, sanction, justifie,
        ...(cat === 'absence' ? { duree } : {}), rapporteurId:u.id, creeLe:nowISO() });
      journal(base, 'discipline', 'Fait disciplinaire enregistré — ' + el.nom + ' ' + el.prenom + ' : ' + desc.slice(0, 60));
    }
    return {};
  });
  /* v5.5 : plages de sanctions liées aux absences non justifiées (heures) */
  M.setSanctionsAbs = rows => commitB((base) => {
    const l = (Array.isArray(rows) ? rows : []).map((r, i) => ({
      id:'sa' + (i + 1),
      min:parseInt(r.min, 10),
      max:parseInt(r.max, 10),
      sanction:String(r.sanction || '').trim()
    })).filter(r => !isNaN(r.min) && !isNaN(r.max) && r.sanction && r.min >= 0 && r.max >= r.min && r.max <= 999);
    if (l.length){
      l.sort((a,b) => a.min - b.min);
      for (let i = 1; i < l.length; i++)
        if (l[i].min <= l[i - 1].max) throw new Error('Les plages se chevauchent ('
          + l[i - 1].min + '-' + l[i - 1].max + ' et ' + l[i].min + '-' + l[i].max + ').');
    }
    base.sanctionsAbs = l;
    journal(base, 'configuration', 'Sanctions d\u2019absences paramétrées — ' + l.length + ' plage(s)');
    return { n:l.length };
  });
  M.deleteFait = id => commitB((base, next) => {
    const f = (base.discipline||[]).find(x => x.id === id);
    if (!f) throw new Error('Fait introuvable.');
    const el = base.eleves.find(x => x.id === f.eleveId);
    base.discipline = (base.discipline||[]).filter(x => x.id !== id);
    journal(base, 'discipline', 'Fait disciplinaire supprimé' + (el ? ' — ' + el.nom + ' ' + el.prenom : ''));
    return {};
  });

  M.importAnciens = rows => commitB((base, next) => {
    if (!Array.isArray(rows) || !rows.length) throw new Error('Liste vide : aucune fiche exploitable.');
    base.anciens = rows;
    journal(base, 'import', 'Liste des anciens élèves importée — ' + rows.length + ' fiche(s)');
    return { n:rows.length };
  });
  M.viderAnciens = () => commitB((base, next) => {
    const n = (base.anciens || []).length;
    base.anciens = [];
    journal(base, 'suppression', 'Liste des anciens élèves vidée (' + n + ' fiche(s))');
    return { n };
  });

  /* Importer une base complete (archive ZIP exportee par l'application) */
  M.importDb = ndb => commit(next => {
    if (!ndb || !ndb.users || !ndb.users.length) throw new Error('Archive invalide : aucun utilisateur trouve.');
    const m = migrateMultiEtab(ndb);
    next.etablissements = m.etablissements;
    next.bases = m.bases;
    next.journalGlobal = m.journalGlobal;
    next.users = m.users;
    ['annees','niveaux','classes','frais','tarifs','eleves','paiements','bourses','journal','anciens'].forEach(c => { delete next[c]; });
    const comptes = {};
    const lst = Array.isArray(m.bases) ? m.bases : [];
    comptes.etablissements = (m.etablissements || []).length;
    comptes.eleves = lst.reduce((n, b) => n + ((b.eleves || []).length), 0);
    comptes.paiements = lst.reduce((n, b) => n + ((b.paiements || []).length), 0);
    comptes.users = m.users.length;
    journal(next, 'import', 'Base importee depuis une archive ZIP — ' + comptes.etablissements + ' etablissement(s), ' + comptes.eleves + ' eleve(s), ' + comptes.paiements + ' paiement(s), ' + comptes.users + ' compte(s)');
    /* trace visible dans le journal de chaque établissement importé */
    (Array.isArray(next.bases) ? next.bases : []).forEach(b => {
      if (Array.isArray(b.journal)){
        b.journal.unshift({ id:uid(), date:nowISO(), user: userRef.current ? userRef.current.username : 'système',
          uid: userRef.current ? userRef.current.id : null, action:'import',
          details:'Base importée depuis une archive ZIP — ' + comptes.etablissements + ' établissement(s), ' + comptes.eleves + ' élève(s), ' + comptes.paiements + ' paiement(s)' });
        if (b.journal.length > 250) b.journal.length = 250;
      }
    });
    return comptes;
  });

  /* Droits d'acces specifiques d'un utilisateur (admin) — null/undefined = herite du role */
  M.setUserPerms = (id, perms) => commitB((base, next) => {
    const u = next.users.find(x => x.id === id);
    if (!u) throw new Error('Utilisateur introuvable.');
    if (u.role === 'admin') throw new Error('Un administrateur possede deja tous les droits.');
    const clean = {};
    Object.entries(perms || {}).forEach(([k, v]) => { if (['w','r','n'].includes(v)) clean[k] = v; });
    u.perms = Object.keys(clean).length ? clean : null;
    journal(base, 'utilisateur', 'Droits de ' + u.username + ' redefinis (' + Object.keys(clean).length + ' module(s))');
    return { ok:true };
  });

  M.deleteBourse = id => commitB((base, next) => {
    base.bourses = base.bourses || [];
    const b = base.bourses.find(x => x.id === id);
    if (!b) throw new Error('Bourse introuvable.');
    base.bourses = base.bourses.filter(x => x.id !== id);
    journal(base, 'bourse', 'Bourse supprimée (' + b.motif + ')');
    return {};
  });
  M.toggleBourse = id => commitB((base, next) => {
    base.bourses = base.bourses || [];
    const b = base.bourses.find(x => x.id === id);
    if (!b) throw new Error('Bourse introuvable.');
    b.actif = !b.actif;
    journal(base, 'bourse', 'Bourse ' + (b.actif ? 'réactivée' : 'suspendue') + ' (' + b.motif + ')');
    return {};
  });

  /* ---------- Établissements (superadministrateur) ---------- */
  M.saveEtab = v => commit(next => {
    const nom = String(v.nom || '').trim();
    if (!nom) throw new Error('Le nom de l\u2019établissement est obligatoire.');
    const t = etabsOf(next);
    if (v.id){
      const e = t.find(x => x.id === v.id);
      if (!e) throw new Error('Établissement introuvable.');
      Object.assign(e, {
        nom, code:String(v.code || '').trim().toUpperCase(), ville:String(v.ville || '').trim(),
        pays:String(v.pays || 'Cameroun').trim(), adresse:String(v.adresse || '').trim(),
        telephone:String(v.telephone || '').trim(), email:String(v.email || '').trim(),
        actif:v.actif !== false
      });
      const b = baseOf(next, e.id);
      if (b && b.settings){ b.settings.nomEtablissement = nom; b.settings.ville = e.ville; }
      journal(next, 'etablissement', 'Établissement « ' + nom + ' » modifié');
      return { etab:e };
    }
    if (t.some(x => x.nom.toLowerCase() === nom.toLowerCase())) throw new Error('Un établissement portant ce nom existe déjà.');
    const id = newEtabId(next);
    const e = { id, code:String(v.code || '').trim().toUpperCase() || id.replace('etab-', 'ETAB-'), nom,
      ville:String(v.ville || '').trim(), pays:String(v.pays || 'Cameroun').trim(),
      adresse:String(v.adresse || '').trim(), telephone:String(v.telephone || '').trim(),
      email:String(v.email || '').trim(), actif:true, creeLe:nowISO() };
    next.etablissements.push(e);
    const nb = emptyBase();
    nb.id = id;
    nb.settings = { nomEtablissement:nom, ville:e.ville, sousTitre:'', devise:'',
      mention:'Administration — Aurel School SIGES', adresse:e.adresse, telephone:e.telephone,
      email:e.email, piedEtat:'Document interne — ' + nom, logo:'' };
    next.bases.push(nb);
    journal(next, 'etablissement', 'Établissement « ' + nom + ' » créé');
    return { etab:e };
  });

  M.deleteEtab = id => commit(next => {
    const t = etabsOf(next);
    if (t.length <= 1) throw new Error('Impossible de supprimer le dernier établissement.');
    const e = t.find(x => x.id === id);
    if (!e) throw new Error('Établissement introuvable.');
    const b = baseOf(next, id) || emptyBase();
    const nUsers = next.users.filter(u => u.etablissementId === id).length;
    const n = { eleves:(b.eleves || []).length, paiements:(b.paiements || []).length,
      anciens:(b.anciens || []).length, users:nUsers, comptes:next.users.filter(u => u.etablissementId === id).map(u => u.username) };
    next.etablissements = t.filter(x => x.id !== id);
    next.bases = next.bases.filter(b => b.id !== id);
    next.users = next.users.filter(u => u.etablissementId !== id);
    journal(next, 'etablissement', 'Établissement « ' + e.nom + ' » supprimé en cascade — ' + n.eleves + ' élève(s), ' + n.paiements + ' paiement(s), ' + n.users + ' compte(s)');
    if (etabIdRef.current === id){
      etabIdRef.current = next.etablissements[0] ? next.etablissements[0].id : null;
      setEtabIdState(etabIdRef.current);
    }
    return n;
  });

  /* Rattacher un compte à un établissement (superadministrateur) */
  M.setUserEtab = (userId, etab) => commit(next => {
    const u = next.users.find(x => x.id === userId);
    if (!u) throw new Error('Utilisateur introuvable.');
    if (u.role === 'superadmin') throw new Error('Le superadministrateur gère tous les établissements — aucun rattachement.');
    u.etablissementId = etab || null;
    journal(next, 'utilisateur', 'Compte ' + u.username + ' rattaché à ' + (etab ? '« ' + ((etabsOf(next).find(e => e.id === etab) || {}).nom || etab) + ' »' : 'aucun établissement'));
    return { ok:true };
  });

  /* ============== v5.1 : CONSOLE RÉSEAU (superadministrateur) ==============
     Mutations racine (journalisées dans le journal global) — contrôlent
     les établissements et les comptes de tout le réseau. */
  M.netToggleEtab = id => commit(next => {
    if (!userRef.current || userRef.current.role !== 'superadmin') throw new Error('Action r\u00e9serv\u00e9e au superadministrateur.');
    const e = (next.etablissements || []).find(x => x.id === id);
    if (!e) throw new Error('Établissement introuvable.');
    const suspend = e.actif !== false;
    if (suspend && (next.etablissements || []).filter(x => x.actif !== false).length <= 1)
      throw new Error('Impossible de suspendre le dernier établissement actif du réseau.');
    e.actif = suspend ? false : true;
    journal(next, 'etablissement', 'Établissement « ' + e.nom + ' » ' + (suspend ? 'suspendu' : 'réactivé') + ' depuis la console réseau — comptes de cet établissement bloqués à la connexion' + (suspend ? '' : ' (levée du blocage)'));
    return { suspend };
  });

  M.netToggleUser = id => commit(next => {
    if (!userRef.current || userRef.current.role !== 'superadmin') throw new Error('Action r\u00e9serv\u00e9e au superadministrateur.');
    const u = next.users.find(x => x.id === id);
    if (!u) throw new Error('Utilisateur introuvable.');
    if (userRef.current.id === id) throw new Error('Impossible de désactiver votre propre compte.');
    if (u.role === 'superadmin') throw new Error('Un compte superadministrateur ne se désactive pas depuis la console.');
    const desact = !!u.actif;
    if (desact && u.role === 'admin'){
      const others = next.users.filter(x => x.id !== id && x.role === 'admin' && x.actif && x.etablissementId === u.etablissementId).length;
      if (!others) throw new Error('Impossible : au moins un administrateur actif doit demeurer dans cet établissement.');
    }
    u.actif = !u.actif;
    journal(next, 'utilisateur', 'Compte ' + u.username + ' ' + (u.actif ? 'activé' : 'désactivé') + ' depuis la console réseau');
    return { actif:u.actif };
  });

  M.netResetPwd = (id, pwd) => commit(next => {
    if (!userRef.current || userRef.current.role !== 'superadmin') throw new Error('Action r\u00e9serv\u00e9e au superadministrateur.');
    const u = next.users.find(x => x.id === id);
    if (!u) throw new Error('Utilisateur introuvable.');
    if (String(pwd || '').length < 6) throw new Error('Mot de passe : 6 caractères minimum.');
    u.salt = makeSalt(); u.hash = hashPwd(u.salt, pwd);
    journal(next, 'utilisateur', 'Mot de passe réinitialisé pour ' + u.username + ' depuis la console réseau');
    return {};
  });

  M.resetDemo = async () => {
    if (serverModeRef.current === 'server'){
      const r = await api.resetServer();
      if (!r.ok){
        toast(r.msg, 'err', 'Réinitialisation refusée');
        return false;
      }
      try {
        const sdb = migrateMultiEtab(await api.fetchDb());
        lastPulledRef.current = sdb;
        setDb(sdb);
        dbRef.current = sdb;
        etabIdRef.current = etabsOf(sdb)[0] ? etabsOf(sdb)[0].id : null;
        setEtabIdState(etabIdRef.current);
        try { localStorage.removeItem('asc_session'); sessionStorage.removeItem('asc_session'); } catch(e){}
        setUser(null); setModalEl(null); setPageState('dashboard');
        return true;
      } catch(e){ /* retomber en réinitialisation locale */ }
    }
    Store.reset();
    const fresh = buildSeed();
    dbRef.current = fresh;
    etabIdRef.current = etabsOf(fresh)[0] ? etabsOf(fresh)[0].id : null;
    setDb(fresh);
    setEtabIdState(etabIdRef.current);
    try { localStorage.removeItem('asc_session'); sessionStorage.removeItem('asc_session'); } catch(e){}
    setUser(null); setModalEl(null); setPageState('dashboard');
    return true;
  };

  const anneeIdRef = useRef(anneeId);
  useEffect(() => { anneeIdRef.current = anneeId; }, [anneeId]);

  const etabs = etabsOf(db);
  const etab = etabs.find(e => e.id === etabId) || null;
  const curBase = baseOf(db, etabId) || (etabs.length ? baseOf(db, etabs[0].id) : null) || emptyBase();
  /* liste pour la page de connexion : serveur (public) ou base locale */
  const etabsForLogin = (etabsPub && etabsPub.length ? etabsPub : etabs.filter(e => e.actif !== false).map(e => ({ id:e.id, nom:e.nom, ville:e.ville || '' })));
  const value = { db: curBase, dbRoot: db, etabs, etab, etabId, setEtab, etabsForLogin, users: db.users, syncState, syncErrors, retrySync: enqueuePush,
    user, login, logout:doLogout, page, go, anneeId, setAnneeId, serverMode, verrou, activerLicence,
    toast, toasts, openModal, closeModal, confirm, modalEl, can, isAdmin, M,
    scope: {
      classesIds: user ? scopeClassesIds(curBase, user) : null,
      matieresIds: user ? scopeMatieresIds(curBase, user) : null,
      canClasse: cid => !!user && canClasse(curBase, user, cid)
    },
    persistent: Store.persistent, lastAct };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
