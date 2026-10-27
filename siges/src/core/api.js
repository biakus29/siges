/* Couche API client : bascule automatique entre le serveur PHP + MySQL
   (si disponible) et le mode local (localStorage). Utilisée par AppContext. */

let available = null;   /* null = non testé, true/false sinon */
let probedAt = 0;       /* v6.9 : date de la dernière sonde — un échec n'est
                            plus mis en cache pour toute la session (serveur
                            distant lent au premier appel) : on re-sonde. */

/* Résout l'API relativement à la page : fonctionne que l'application soit
   servie à la racine (http://localhost:4000/) ou dans un sous-dossier
   (http://localhost/aurel-school-siges/). */
function api(p){
  try { return new URL('api/' + p, document.baseURI).href; }
  catch(e){ return '/api/' + p; }
}
let token = null;
let rev = null;

/* Verrou de maintenance : le serveur répond 423 quand la licence est échue.
   L'interface enregistre un gestionnaire pour afficher l'écran d'activation. */
let lockHandler = null;
export function onLocked(fn){ lockHandler = fn; }
function signalLock(ref){ try { lockHandler && lockHandler(ref); } catch(e){} }
export async function activerLicence(code){
  try {
    const r = await fetch(api('licence/activer'), {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ code }) });
    const j = await r.json().catch(() => null);
    if (j && j.ok) return { ok:true };
    return { ok:false, msg:(j && j.msg) || 'Code refusé par le serveur.' };
  } catch(e){ return { ok:false, msg:'Serveur injoignable. Réessayez dans un instant.' }; }
}

export function isAvailable(){ return available === true; }
export function getRev(){ return rev; }
/* Liste publique des établissements actifs (page de connexion — serveur) */
export async function fetchEtabs(){
  try {
    const r = await fetch(api('etablissements'), { cache:'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch(e){ return null; }
}

function authHeaders(){
  /* v7.0 : jeton envoyé DEUX fois — Authorization (standard) ET X-Aurel-Token
     (passe toujours sur les hébergements CGI/FastCGI qui filtrent
     Authorization). Le serveur accepte l'un ou l'autre. */
  return token ? { Authorization:'Bearer ' + token, 'X-Aurel-Token': token } : {};
}
/* v7.0 : renouvellement glissant du jeton (en-tête X-Aurel-Token des réponses) */
function renewFrom(r){
  try {
    const nt = r && r.headers && typeof r.headers.get === 'function' ? r.headers.get('X-Aurel-Token') : null;
    if (nt && nt !== token){
      token = nt;
      try {
        sessionStorage.setItem('asc_token', nt);
        if (localStorage.getItem('asc_token')) localStorage.setItem('asc_token', nt);
      } catch(e){}
    }
  } catch(e){}
}

export async function probe(force){
  if (available === true) return true;
  /* v6.9 : un échec récent est respecté (anti-marteau), puis re-sondé */
  const ago = Date.now() - probedAt;
  if (available === false && !force && ago < 10000) return false;
  if (typeof fetch !== 'function'){ available = false; probedAt = Date.now(); return false; }
  try {
    const ctl = new AbortController();
    /* v6.9 : 8 s (était 2,5 s) — le premier appel d'un serveur distant
       (PHP à froid + MySQL distant + HTTPS) peut être lent. */
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(api('health'), { signal: ctl.signal, cache:'no-store' });
    clearTimeout(t);
    if (r.ok){
      const j = await r.json();
      if (j && j.ok){ rev = j.rev; available = true; return true; }
    }
  } catch(e){ /* serveur absent */ }
  available = false;
  probedAt = Date.now();
  return false;
}

export function persistToken(remember){
  try {
    const t = sessionStorage.getItem('asc_token');
    if (remember && t) localStorage.setItem('asc_token', t);
    else localStorage.removeItem('asc_token');
  } catch(e){}
}

export function restoreToken(){
  try { token = sessionStorage.getItem('asc_token') || localStorage.getItem('asc_token'); } catch(e){}
  return !!token;
}

export async function login(username, pwd){
  const r = await fetch(api('auth/login'), {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ username, pwd })
  });
  let j = null;
  try { j = await r.json(); } catch(e){}
  if (!j) return { ok:false, msg:'Réponse serveur invalide.' };
  if (j.ok && j.token){
    token = j.token;
    try { sessionStorage.setItem('asc_token', token); } catch(e){}
  }
  if (r.status === 423 || (j && j.locked)) signalLock(j && j.ref);
  return j;
}

/* Revision courante annoncee par le serveur (null si injoignable) */
export async function healthRev(){
  try {
    const r = await fetch(api('health'), { cache:'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? j.rev : null;
  } catch(e){ return null; }
}

export async function me(){
  try {
    const r = await fetch(api('auth/me'), { headers:authHeaders(), cache:'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j.ok ? j.user : null;
  } catch(e){ return null; }
}

/* v5.7.1 : la base serveur est-elle une démonstration ? (null : mode local ou inconnu) */
let serverDemo = null;
export function serverIsDemo(){ return serverDemo; }

export async function fetchDb(){
  const r = await fetch(api('db'), { headers:authHeaders(), cache:'no-store' });
  renewFrom(r);
  if (r.status === 401) throw new Error('session');
  if (r.status === 423){
    const j = await r.json().catch(() => ({}));
    signalLock(j && j.ref);
    const e = new Error('locked'); e.locked = true; e.ref = j && j.ref; throw e;
  }
  if (!r.ok) throw new Error('server');
  const j = await r.json();
  rev = j.rev;
  if (j.demo === true) serverDemo = true;
  else if (j.demo === false) serverDemo = false;
  if (!j.db.bourses) j.db.bourses = [];
  if (!j.db.anciens) j.db.anciens = [];
  return j.db;
}

/* Envoie la base au serveur. Retourne { ok } ou { conflict, rev } si un autre
   poste a modifié la base entre-temps (le client doit alors recharger). */
/* v7.2 : encodage base64 UTF-8 sûr (accents, émoji) par morceaux. */
function b64utf8(s){
  try {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  } catch(e){ return null; }
}
/* v7.2 : transport AUREL1 — corps « AUREL1:<base64> » avec Content-Type
   text/plain. Des pare-feu applicatifs d'hébergement (WAF/ModSecurity)
   bloquent les gros POST JSON (HTTP 406) alors que le même contenu,
   illisible pour eux, passe : la base est donc envoyée encodée. Le serveur
   décode (api/index.php) et accepte toujours l'ancien format JSON. */
export function corpsPush(objet){
  const b64 = b64utf8(JSON.stringify(objet));
  return b64 ? { body:'AUREL1:' + b64, headers:{ 'Content-Type':'text/plain;charset=UTF-8' } } : null;
}
export async function pushDb(db){
  const t = corpsPush({ rev, db });
  const r = await fetch(api('db'), {
    method:'POST',
    headers: t ? { ...t.headers, ...authHeaders() } : { 'Content-Type':'application/json', ...authHeaders() },
    body: t ? t.body : JSON.stringify({ rev, db })
  });
  renewFrom(r);
  if (r.status === 409){
    const j = await r.json().catch(() => ({}));
    rev = j.rev != null ? j.rev : rev;
    return { conflict:true, rev };
  }
  if (r.status === 423){
    const j = await r.json().catch(() => ({}));
    signalLock(j && j.ref);
    const err = new Error('locked'); err.status = 423; err.locked = true; err.ref = j && j.ref;
    throw err;
  }
  /* v6.9 : le message d'erreur du serveur est transmis à l'interface —
     un refus (401, 403, 413, 500…) n'est plus affiché « Serveur
     injoignable » alors que le serveur a répondu. */
  if (!r.ok){
    let msg = null;
    try { const j = await r.json(); if (j && j.msg) msg = j.msg; } catch(e){}
    const err = new Error('save');
    err.status = r.status;
    err.serverMsg = msg;
    throw err;
  }
  const j = await r.json();
  rev = j.rev;
  return { ok:true };
}

/* v7.1 : diagnostic de connexion intégré (badge cliquable → fenêtre
   « Diagnostic de connexion »). Rejoue depuis l'application elle-même les
   appels réels — fetch natif ?, sonde (l'application renonce à 8 s),
   lecture authentifiée, envoi authentifié (enregistrement réel) — et
   rapporte pour chacun : statut HTTP, latence, extrait de réponse. */
export async function diagRun(db, onStep){
  const out = [];
  const push = r => { out.push(r); try { onStep && onStep(out.slice()); } catch(e){} };
  const natif = (typeof window !== 'undefined' && typeof window.fetch === 'function')
    ? String(window.fetch).indexOf('[native code]') !== -1 : true;
  push({ nom:'Fonction réseau fetch du navigateur', natif,
    repondu:true, status:natif ? 200 : 0, ms:0,
    extrait:natif ? 'fetch natif du navigateur — aucun intermédiaire.'
      : 'fetch est REMPLACÉ dans ce navigateur : ' + String(window.fetch).replace(/\s+/g, ' ').slice(0, 110) });
  const timed = (nom, url, opts, budget) => new Promise(resolve => {
    const start = Date.now();
    const bud = budget || 30000;
    let done = false, ctl = null;
    try { ctl = new AbortController(); } catch(e){}
    const finish = x => { if (done) return; done = true; clearTimeout(tOut); clearTimeout(tHard); resolve(x); };
    const tOut = setTimeout(() => { try { ctl && ctl.abort(); } catch(e){} }, bud);
    const tHard = setTimeout(() => finish({ nom, repondu:false, status:0, ms:Date.now() - start,
      extrait:'Aucune réponse en ' + Math.round(bud / 1000) + ' s — délai dépassé.' }), bud + 1500);
    fetch(url, ctl ? Object.assign({}, opts, { signal:ctl.signal }) : opts)
      .then(r => r.text().then(txt => { renewFrom(r);
        finish({ nom, repondu:true, status:r.status, ms:Date.now() - start, extrait:String(txt).slice(0, 160) }); }))
      .catch(e => finish({ nom, repondu:false, status:0, ms:Date.now() - start, extrait:String(e && e.message || e) }));
  });
  push(await timed('Sonde GET api/health (l\'application renonce à 8 s)', api('health'), { cache:'no-store' }, 8000));
  push(await timed('Lecture authentifiée GET api/db', api('db'), { headers:authHeaders(), cache:'no-store' }, 30000));
  const cp = corpsPush({ rev, db });
  push(await timed('Envoi authentifié POST api/db (enregistrement réel)', api('db'),
    cp ? { method:'POST', headers:Object.assign({}, cp.headers, authHeaders()), body:cp.body }
       : { method:'POST', headers:Object.assign({ 'Content-Type':'application/json' }, authHeaders()), body:JSON.stringify({ rev, db }) }, 30000));
  return out;
}

export async function resetServer(){
  try {
    const r = await fetch(api('reset'), { method:'POST', headers:authHeaders() });
    let j = null;
    try { j = await r.json(); } catch(e){}
    if (j && j.ok) return { ok:true };
    /* v5.7.1 : le serveur refuse la réinitialisation d'une base de production */
    return { ok:false, msg:(j && j.msg) ? j.msg : 'Impossible de contacter le serveur pour la réinitialisation.' };
  } catch(e){ return { ok:false, msg:'Impossible de contacter le serveur pour la réinitialisation.' }; }
}

/* Changement de son propre mot de passe (vérifié par le serveur) */
export async function changePassword(ancien, nouveau){
  try {
    const r = await fetch(api('auth/password'), {
      method:'POST', headers:{ 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify({ ancien, nouveau }) });
    renewFrom(r);
    const j = await r.json().catch(() => null);
    if (j && j.ok) return { ok:true };
    return { ok:false, msg:(j && j.msg) || 'Changement refusé par le serveur.' };
  } catch(e){ return { ok:false, msg:'Serveur injoignable. Réessayez dans un instant.' }; }
}

export async function logout(){
  try { await fetch(api('auth/logout'), { method:'POST', headers:authHeaders() }); } catch(e){}
  token = null;
  try { sessionStorage.removeItem('asc_token'); localStorage.removeItem('asc_token'); } catch(e){}
}

/* ---------- v6.4 : sauvegarde automatique (mode serveur uniquement) ---------- */
export async function backupGet(){
  const r = await fetch(api('backup'), { headers:authHeaders(), cache:'no-store' });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('Réponse serveur invalide.');
  if (!j.ok) throw new Error(j.msg || 'Sauvegardes indisponibles.');
  return j;
}
export async function backupSettings(cfg){
  const r = await fetch(api('backup/settings'), {
    method:'POST', headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body: JSON.stringify(cfg) });
  return await r.json().catch(() => ({ ok:false, msg:'Réponse serveur invalide.' }));
}
export async function backupTest(dir){
  const r = await fetch(api('backup/test'), {
    method:'POST', headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body: JSON.stringify({ dir }) });
  return await r.json().catch(() => ({ ok:false, msg:'Réponse serveur invalide.' }));
}
export async function backupNow(){
  const r = await fetch(api('backup/now'), {
    method:'POST', headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body:'{}' });
  return await r.json().catch(() => ({ ok:false, msg:'Réponse serveur invalide.' }));
}
