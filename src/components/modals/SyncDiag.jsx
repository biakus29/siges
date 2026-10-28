import React, { useState } from 'react';
import { Modal } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { diagRun } from '../../core/api.js';

/* v7.1 : fenêtre « Diagnostic de connexion » — ouverte par un clic sur le
   badge de synchronisation. Rejoue depuis l'application elle-même les
   appels réels (fetch natif ?, sonde, lecture et envoi authentifiés) et
   affiche la cause exacte d'un état « Hors ligne » : extension du
   navigateur, requête bloquée, lenteur, session expirée… */
export default function SyncDiag({ onClose }){
  const app = useApp();
  const [rows, setRows] = useState(null);
  const [done, setDone] = useState(false);
  const etat = app.syncState === 'offline' ? '⚠ Hors ligne — file d\u2019attente active'
    : (app.syncState === 'pending' ? '⟳ Enregistrement en cours…' : (app.syncState === 'synced' ? '✓ Base à jour' : '—'));

  async function lancer(){
    setRows([]); setDone(false);
    const res = await diagRun(app.dbRoot, setRows);
    setRows(res); setDone(true);
  }

  let conclusion = null;
  if (done && rows && rows.length >= 4){
    const health = rows[1], get = rows[2], post = rows[3];
    const ok = health && health.repondu && health.status === 200
            && get && get.repondu && get.status === 200
            && post && post.repondu && (post.status === 200 || post.status === 409);
    if (ok){
      conclusion = { ok:true, txt:'Toute la chaîne navigateur → serveur → MySQL fonctionne depuis ce poste'
        + (post.status === 409 ? ' (l\u2019envoi de test a rencontré une mise à jour d\u2019un autre poste — fusion automatique, circuit opérationnel)' : '')
        + '. Les enregistrements partent bien. Si le badge est resté « Hors ligne », cliquez sur « Réessayer l\u2019envoi maintenant ».'
        + (rows[0] && rows[0].natif === false ? ' Remarque : fetch est encapsulé dans ce navigateur (extension ou environnement technique) — les appels passent malgré tout.' : '') };
    } else {
      const ko = rows.slice(1).find(r => !r.repondu || (r.status !== 200 && r.status !== 409)) || rows[1];
      conclusion = { ok:false, txt:'Échec sur « ' + ko.nom + ' » : '
        + (ko.repondu ? ('HTTP ' + ko.status) : ('aucune réponse (' + ko.extrait + ')'))
        + '. '
        + (rows[0] && rows[0].natif === false
          ? 'ATTENTION : une extension de votre navigateur remplace la fonction réseau fetch — cause très probable du « Hors ligne ». Ouvrez l\u2019application dans une fenêtre de navigation privée (Ctrl+Maj+N) pour confirmer, puis identifiez l\u2019extension coupable en les réactivant une à une.'
          : 'Transmettez une capture de cette fenêtre pour analyse (statut HTTP et extrait ci-dessus).') };
    }
  }
  const st = r => !r ? '⏳'
    : (r.repondu && (r.status === 200 || r.status === 409 || (r.natif !== undefined && r.natif))) ? '✔' : '✘';

  return (
    <Modal title="Diagnostic de connexion" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        <button className="btn btn-ghost" onClick={() => { app.retrySync && app.retrySync(); }}>Réessayer l&rsquo;envoi maintenant</button>
        <button className="btn btn-pri" onClick={lancer}><Ic name="check"/> Lancer les tests</button>
      </>}>
      <div id="diag-modal">
        <p style={{ fontSize:12.5, color:'var(--muted)', marginBottom:10, lineHeight:1.55 }}>
          État actuel : <b>{etat}</b> — mode : {app.serverMode === 'server' ? 'serveur MySQL' : (app.serverMode === 'checking' ? 'détection…' : 'local')}.<br/>
          Ces tests rejouent depuis votre navigateur les appels exacts de l&rsquo;application, l&rsquo;un après l&rsquo;autre (jusqu&rsquo;à 1 minute).
        </p>
        {app.syncErrors && app.syncErrors.length > 0 && (
          <div style={{ fontSize:12, marginBottom:10 }}>
            <b>Dernières erreurs d&rsquo;envoi :</b>
            <ul style={{ margin:'6px 0 0 18px', padding:0 }}>
              {app.syncErrors.map((e, i) => (
                <li key={i} style={{ color:'var(--bad)', marginBottom:2 }}>{e.at} — {e.msg}</li>
              ))}
            </ul>
          </div>
        )}
        {rows && rows.map((r, i) => (
          <div key={i} className="diag-row" style={{ display:'flex', gap:8, alignItems:'baseline', fontSize:12.3, padding:'6px 0', borderBottom:'1px solid var(--line, #d5dde8)' }}>
            <b style={{ width:16, color:(st(r) === '✔' ? '#1d8a4b' : (st(r) === '✘' ? '#c0392b' : '#5a6b85')) }}>{st(r)}</b>
            <span style={{ flex:1 }}>{r.nom}<br/>
              <span style={{ color:'var(--muted)', fontSize:11, wordBreak:'break-all' }}>
                {r.repondu ? ('HTTP ' + r.status + ' — ' + r.ms + ' ms — ') : ((r.ms ? r.ms + ' ms — ' : ''))}{r.extrait}
              </span>
            </span>
          </div>
        ))}
        {done && conclusion && (
          <div id="diag-conclusion" style={{ marginTop:12, padding:'10px 12px', borderRadius:9, fontSize:12.5, lineHeight:1.55,
            border:conclusion.ok ? '1.5px solid #bfe5cf' : '1.5px solid #f3c4bd',
            background:conclusion.ok ? '#f0faf3' : '#fdf3f1' }}>
            {conclusion.ok ? '✅ ' : '❌ '}{conclusion.txt}
          </div>
        )}
      </div>
    </Modal>
  );
}
