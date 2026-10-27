import React, { useState } from 'react';
import { Badge, Avatar, CsvBtn } from '../components/UI.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmtDT, ROLE_LABEL, ROLE_SHORT, ROLE_ICON, downloadFile } from '../core/utils.js';
import { UserFormModal, ResetPwdModal } from '../components/modals/EntityForms.jsx';
import { Modal } from '../components/UI.jsx';
import { makeZip, PERM } from '../core/utils.js';
import { serverIsDemo } from '../core/api.js';

const AVA_BG = {
  admin: 'linear-gradient(135deg,#14406e,#061729)',
  econome: 'linear-gradient(135deg,#a8871e,#c9a227)',
  lecteur: 'linear-gradient(135deg,#177a4c,#0e4f31)'
};

export default function Users(){
  const { db, dbRoot, etabs, user, openModal, confirm, M, toast, serverMode } = useApp();
  const isSuper = user && user.role === 'superadmin';
  const me = dbRoot.users.find(x => x.id === user.id) || user;
  const users = isSuper ? dbRoot.users : dbRoot.users.filter(u => u.role === 'superadmin' ? false : (!u.etablissementId || u.etablissementId === me.etablissementId));
  const etabName = id => (etabs.find(e => e.id === id) || {}).nom || '—';

  const toggle = async u => {
    try { M.toggleUser(u.id); toast('Compte ' + (u.actif ? 'désactivé' : 'activé') + '.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };
  const del = async u => {
    if (!await confirm('Supprimer le compte de ' + u.nom + ' ?', 'Cette action est définitive.', 'Supprimer', true)) return;
    try { M.deleteUser(u.id); toast('Compte supprimé.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };
  const exportDb = () => {
    try {
      const charge = { application:'aurel-school-siges', format:'sauvegarde-zip', version:1, date:new Date().toISOString(), db: dbRoot };
      const zip = makeZip([{ name:'aurel-base.json', data:JSON.stringify(charge) }]);
      toast(downloadFile('aurel-sauvegarde-users.zip', zip, 'application/zip') ? 'Sauvegarde ZIP générée.' : 'Téléchargement bloqué dans cet aperçu.', 'ok');
    } catch(err){ toast('Échec de l\u2019export : ' + (err.message || err), 'err'); }
  };
  const resetDemo = async () => {
    if (!await confirm('Réinitialiser les données de démonstration ?',
      'Toutes les modifications seront perdues : le jeu de données d\u2019origine sera restauré et vous serez déconnecté.', 'Réinitialiser', true)) return;
    /* v5.7.1 : le serveur refuse la réinitialisation d\u2019une base de production */
    if (await M.resetDemo()) toast('Données de démonstration réinitialisées.', 'ok');
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="shield"/> Profils : Administrateur • Censeur (cycle) • Surveillant général • Surveillant de secteur • Titulaire • Enseignant • Opérateur de saisie • Économe • Lecteur</span>
        <span style={{ flex:1 }}/>
        <PrintListeBtn titre="Utilisateurs & profils"
          colonnes={['Nom','Identifiant','Rôle','Établissement','Actif']}
          lignes={users.map(u => [u.nom, u.username, ROLE_LABEL[u.role] || u.role, u.role === 'superadmin' ? 'Tous' : etabName(u.etablissementId), u.actif ? 'Oui' : 'Non'])}/>
        <CsvBtn filename="utilisateurs.csv"
          header={['Nom','Identifiant','Rôle','Établissement','Actif','Dernier accès']}
          rows={users.map(u => [u.nom, u.username, ROLE_LABEL[u.role] || u.role, u.role === 'superadmin' ? 'Tous' : etabName(u.etablissementId), u.actif ? 'Oui' : 'Non', u.dernierAcces || ''])}/>
        <button className="btn btn-pri" onClick={() => openModal(<UserFormModal/>)}><Ic name="plus"/> Nouvel utilisateur</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Établissement</th><th>Statut</th><th>Dernier accès</th><th></th></tr></thead>
          <tbody>
            {users.map(u => {
              const self = u.id === user.id;
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar name={u.nom} sm style={{ background:AVA_BG[u.role] }}/>
                      <div>
                        <b>{u.nom}{self && <span className="mut" style={{ fontWeight:400 }}> (vous)</span>}</b>
                        <br/><span className="mut" style={{ fontSize:11 }}>@{u.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge cls={u.role === 'admin' ? 'b-navy' : (u.role === 'econome' ? 'b-gold' : (u.role === 'superadmin' ? 'b-warn' : 'b-ok'))}><Ic name={ROLE_ICON[u.role]}/> {ROLE_LABEL[u.role] || u.role}</Badge>
                    {u.perms && Object.keys(u.perms).length > 0 && <><br/><Badge cls="b-warn" title="Droits spécifiques définis par l'administrateur">personnalisés</Badge></>}
                  </td>
                  <td className="mut" style={{ fontSize:11.5 }}>{u.role === 'superadmin' ? <Badge cls="b-warn">tous</Badge> : etabName(u.etablissementId)}</td>
                  <td>{u.actif ? <Badge cls="b-ok">Actif</Badge> : <Badge cls="b-mut">Désactivé</Badge>}</td>
                  <td className="mut nowrap">{u.dernierAcces ? fmtDT(u.dernierAcces) : 'jamais'}</td>
                  <td className="rowacts">
                    <button className="icon-btn" title="Modifier" onClick={() => openModal(<UserFormModal initial={u}/>)}><Ic name="pencil"/></button>
                    {u.role !== 'admin' && u.role !== 'superadmin' && <button className="icon-btn" title="Définir les droits d'accès" onClick={() => openModal(<PermsModal user={u}/>)}><Ic name="shield"/></button>}
                    <button className="icon-btn" title="Réinitialiser le mot de passe" onClick={() => openModal(<ResetPwdModal user={u}/>)}><Ic name="lock"/></button>
                    {!self && <>
                      <button className="icon-btn" title={u.actif ? 'Désactiver' : 'Réactiver'} onClick={() => toggle(u)}>
                        <Ic name={u.actif ? 'ban' : 'refresh'}/>
                      </button>
                      <button className="icon-btn danger" title="Supprimer" onClick={() => del(u)}><Ic name="trash"/></button>
                    </>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop:16 }}>
        <div className="card-h"><h3><Ic name="wrench"/> Maintenance</h3></div>
        <div className="card-b" style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <button className="btn btn-ghost" onClick={exportDb}><Ic name="download"/> Exporter la base (ZIP)</button>
          {serverMode !== 'server' || serverIsDemo() !== false ? (
            <>
              <button className="btn btn-danger" onClick={resetDemo}><Ic name="refresh"/> Réinitialiser les données de démonstration</button>
              <span style={{ fontSize:'11.5px', color:'var(--faint)' }}>La réinitialisation restaure le jeu de données d&apos;origine (années, classes, élèves, paiements) — réservée aux bases de démonstration.</span>
            </>
          ) : (
            <span style={{ fontSize:'11.5px', color:'var(--faint)' }}>Base de production : la réinitialisation de démonstration est désactivée (données réelles). Sauvegardez régulièrement avec « Exporter la base (ZIP) ».</span>
          )}
        </div>
      </div>
    </>
  );
}


/* ---------- Droits d'accès par utilisateur (admin) ---------- */
const MODULES = [
  ['eleves', 'Élèves'], ['paiements', 'Paiements'], ['bourses', 'Bourses & réductions'],
  ['annees', 'Années scolaires'], ['niveaux', 'Niveaux'], ['classes', 'Classes'],
  ['frais', 'Types de frais'], ['grille', 'Grille tarifaire'], ['journal', 'Journal']
];

function PermsModal({ user, onClose }){
  const { M, toast, closeModal } = useApp();
  const close = onClose || closeModal;
  const [perms, setPerms] = useState(() => {
    const base = {};
    MODULES.forEach(([k]) => { base[k] = (user.perms && user.perms[k]) || ''; });
    return base;
  });
  const set = (k, v) => setPerms(p => ({ ...p, [k]:v }));

  const save = e => {
    e.preventDefault();
    const clean = {};
    Object.entries(perms).forEach(([k, v]) => { if (v) clean[k] = v; });
    try {
      M.setUserPerms(user.id, clean);
      toast('Droits de ' + user.nom + ' enregistrés — appliqués immédiatement.', 'ok');
      close();
    } catch(err){ toast(String(err.message || err), 'err'); }
  };

  const OPTION = (k, v, label) => (
    <label className={'perm-opt po-' + (v || 'herit')} style={{ cursor:'pointer' }}>
      <input type="radio" name={'pm-' + k} checked={perms[k] === v} onChange={() => set(k, v)}/>
      <span>{label}</span>
    </label>
  );

  return (
    <Modal icon="shield" title={"Droits d'accès — " + user.nom} onClose={close}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'52%' }}>
            « Hérité » suit le rôle {user.role} ; les autres choix définissent un accès spécifique.
          </span>
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-pri" type="submit" form="perms-form"><Ic name="check"/> Enregistrer</button>
        </>
      }>
      <form id="perms-form" onSubmit={save}>
        <p className="mut" style={{ fontSize:12.2, lineHeight:1.6, marginBottom:12 }}>
          Définissez précisément les modules accessibles à <b>@{user.username}</b>. Les droits s'appliquent
          à sa prochaine action — y compris s'il est déjà connecté. Un administrateur garde toujours tous les droits.
        </p>
        <div className="perm-tbl">
          <div className="perm-row perm-hd">
            <span>Module</span><span>Hérité</span><span>Aucun</span><span>Lecture</span><span>Écriture</span>
          </div>
          {MODULES.map(([k, label]) => (
            <div className="perm-row" key={k}>
              <span className="perm-mod">{label}
                <span className="mut" style={{ fontSize:10 }}>({PERM[user.role][k] === 'w' ? 'hérité : écriture' : PERM[user.role][k] === 'r' ? 'hérité : lecture' : 'hérité : aucun'})</span>
              </span>
              {OPTION(k, '', '·')}
              {OPTION(k, 'n', '·')}
              {OPTION(k, 'r', '·')}
              {OPTION(k, 'w', '·')}
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
