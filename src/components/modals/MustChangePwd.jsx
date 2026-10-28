import React, { useState } from 'react';
import { Modal } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';

/* v8.0 : premier changement de mot de passe OBLIGATOIRE.
   Le compte enseignant est créé avec login = matricule et mot de passe
   initial = matricule ; à la première connexion, cette fenêtre bloque
   l'accès à l'application jusqu'au choix d'un mot de passe personnel. */
export default function MustChangePwdModal(){
  const app = useApp();
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const u = app.user || {};
  const login = u.username || '';

  const valider = () => {
    const p = String(pwd || '').trim();
    if (p.length < 6){ setErr('Mot de passe : 6 caractères minimum.'); return; }
    if (p === login){ setErr('Le mot de passe doit être différent de votre matricule.'); return; }
    if (p !== String(pwd2 || '').trim()){ setErr('Les deux mots de passe ne correspondent pas.'); return; }
    setErr('');
    try {
      app.M.resetPwd(u.id, p);
      app.toast('Mot de passe personnel défini — bienvenue !', 'ok', 'Première connexion');
    } catch(e){
      setErr(String(e.message || e));
    }
  };

  return (
    <Modal title="Première connexion — choisissez votre mot de passe" icon="lock" staticBackdrop
      footer={
        <button className="btn btn-pri" onClick={valider}><Ic name="check"/> Définir mon mot de passe</button>
      }>
      <div id="mustchg">
        <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:10 }}>
          Bonjour <b>{u.nom || login}</b>. Votre compte a été créé avec votre matricule
          (<b>{login}</b>) comme identifiant <b>et</b> comme mot de passe initial.
          Pour la sécurité de vos données, choisissez maintenant un mot de passe personnel
          — il sera exigé à chaque connexion.
        </p>
        <div className="inp"><label className="req" htmlFor="mc-p1">Nouveau mot de passe</label>
          <div className="inp-box"><input id="mc-p1" type="password" autoComplete="new-password"
            value={pwd} onChange={e => setPwd(e.target.value)} placeholder="6 caractères minimum, différent du matricule"/></div></div>
        <div className="inp" style={{ marginTop:8 }}><label className="req" htmlFor="mc-p2">Confirmez le mot de passe</label>
          <div className="inp-box"><input id="mc-p2" type="password" autoComplete="new-password"
            value={pwd2} onChange={e => setPwd2(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') valider(); }}/></div></div>
        {err && <p id="mc-err" style={{ color:'var(--bad)', fontSize:12.5, marginTop:8 }}>{err}</p>}
      </div>
    </Modal>
  );
}
