import React, { useState } from 'react';
import { Modal } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';
import * as api from '../../core/api.js';
import { hashPwd } from '../../core/sha256.js';

/* Changement de son propre mot de passe, ouvert à tous les profils.
   En mode serveur, l'ancien mot de passe est vérifié par le serveur
   (route api/auth/password) : aucun profil n'a besoin de droits sur les comptes. */
export default function ChangePwdModal({ onClose }){
  const app = useApp();
  const u = app.user || {};
  const [ancien, setAncien] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const valider = async () => {
    if (!ancien){ setErr('Saisissez votre mot de passe actuel.'); return; }
    if (pwd.length < 8){ setErr('Le nouveau mot de passe doit comporter au moins 8 caractères.'); return; }
    if (pwd === ancien){ setErr('Le nouveau mot de passe doit être différent de l’actuel.'); return; }
    if (pwd.toLowerCase() === String(u.username || '').toLowerCase()){ setErr('Le mot de passe ne doit pas être votre identifiant.'); return; }
    if (pwd !== pwd2){ setErr('Les deux saisies du nouveau mot de passe ne correspondent pas.'); return; }
    setErr('');
    setBusy(true);
    if (app.serverMode === 'server'){
      const r = await api.changePassword(ancien, pwd);
      setBusy(false);
      if (!r.ok){ setErr(r.msg); return; }
    } else {
      const local = (app.users || []).find(x => x.id === u.id);
      if (!local || local.hash !== hashPwd(local.salt, ancien)){ setBusy(false); setErr('Mot de passe actuel incorrect.'); return; }
      try { app.M.resetPwd(u.id, pwd); } catch(e){ setBusy(false); setErr(String(e.message || e)); return; }
      setBusy(false);
    }
    app.toast('Votre mot de passe a été modifié.', 'ok', 'Sécurité');
    onClose();
  };

  return (
    <Modal title="Changer mon mot de passe" icon="lock" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-pri" onClick={valider} disabled={busy}><Ic name="check"/> {busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </>}>
      <form onSubmit={e => { e.preventDefault(); valider(); }}>
        <p className="mut" style={{ marginBottom:12 }}>Compte <b>{u.username}</b>. Choisissez au moins 8 caractères, que vous ne communiquez à personne.</p>
        <div className="field"><label>Mot de passe actuel</label>
          <input type="password" autoComplete="current-password" autoFocus value={ancien} onChange={e => setAncien(e.target.value)}/></div>
        <div className="field"><label>Nouveau mot de passe</label>
          <input type="password" autoComplete="new-password" value={pwd} onChange={e => setPwd(e.target.value)}/></div>
        <div className="field"><label>Confirmer le nouveau mot de passe</label>
          <input type="password" autoComplete="new-password" value={pwd2} onChange={e => setPwd2(e.target.value)}/></div>
        {err && <div className="gd-note gd-attention" role="alert"><Ic name="alert"/><span>{err}</span></div>}
        <button type="submit" hidden/>
      </form>
    </Modal>
  );
}
