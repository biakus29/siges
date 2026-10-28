import React, { useMemo, useState } from 'react';
import { Badge, CsvBtn, EmptyState, Kpi, Select } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { networkStats, mergedJournal } from '../core/business.js';
import { fmt, fmtDT, ROLE_LABEL, ROLE_SHORT } from '../core/utils.js';
import { EtabFormModal } from '../components/modals/EntityForms.jsx';
import { Modal } from '../components/UI.jsx';

const LBL = { connexion:'Connexion', deconnexion:'Déconnexion', echec:'Échec', paiement:'Paiement', annulation:'Annulation',
  configuration:'Configuration', annee:'Année scolaire', eleve:'Élève', utilisateur:'Utilisateur', bourse:'Bourse',
  suppression:'Suppression', import:'Import', etablissement:'Établissement', notes:'Notes', discipline:'Discipline',
  plan:'Plan', sequences:'Séquences' };
const ACT_CLS = j => j.action === 'echec' ? 'b-bad' : (j.action === 'paiement' ? 'b-ok' : (j.action === 'annulation' || j.action === 'suppression' ? 'b-warn' : (j.action === 'etablissement' ? 'b-gold' : 'b-info')));

/* ---------- Réinitialisation d'un mot de passe (console réseau) ---------- */
function NetResetPwdModal({ compte }){
  const { M, toast, closeModal } = useApp();
  const [pwd, setPwd] = useState('');
  const go = () => {
    try { M.netResetPwd(compte.id, pwd); toast('Mot de passe réinitialisé pour ' + compte.username + '.', 'ok'); closeModal(); }
    catch(e){ toast(String(e.message || e), 'err'); }
  };
  return (
    <Modal title="Réinitialiser le mot de passe" icon="lock" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>Compte <b>{compte.username}</b> — {ROLE_SHORT[compte.role] || compte.role}</span>
        <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        <button className="btn btn-pri" onClick={go}><Ic name="lock"/> Réinitialiser</button>
      </>}>
      <p style={{ fontSize:12.4, lineHeight:1.6, color:'var(--muted)', marginBottom:12 }}>
        Définissez un nouveau mot de passe pour <b>{compte.nom}</b> ({compte.username}).
        Il pourra être modifié ensuite par l'administrateur de l'établissement.
      </p>
      <div className="field">
        <label>Nouveau mot de passe (6 caractères minimum)</label>
        <input type="text" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••" autoComplete="new-password"/>
      </div>
    </Modal>
  );
}

/* =====================================================================
   Console réseau du superadministrateur :
   • Vue d'ensemble : indicateurs consolidés de tout le réseau ;
   • Établissements : pilotage (créer, modifier, suspendre, supprimer) ;
   • Comptes : tous les comptes de tous les établissements ;
   • Journal réseau : activité fusionnée de l'ensemble des établissements.
   ===================================================================== */
export default function Etablissements(){
  const { dbRoot, etabs, etabId, setEtab, user, openModal, confirm, M, toast } = useApp();
  const isSuper = user && user.role === 'superadmin';
  const [onglet, setOnglet] = useState('reseau');
  const [qCompte, setQCompte] = useState('');
  const [fEtabC, setFEtabC] = useState('all');
  const [fRoleC, setFRoleC] = useState('all');
  const [qJour, setQJour] = useState('');
  const [fEtabJ, setFEtabJ] = useState('all');
  const [fActJ, setFActJ] = useState('all');

  const net = useMemo(() => networkStats(dbRoot), [dbRoot]);
  const journal = useMemo(() => mergedJournal(dbRoot, 250), [dbRoot]);
  const etabNom = id => ((etabs.find(e => e.id === id) || {}).nom) || '—';
  const nameOf = j => {
    const u = (dbRoot.users || []).find(x => x.id === j.uid);
    return u ? u.username : (j.user || '—');
  };

  /* ---------- contrôles ---------- */
  const del = async e => {
    const row = net.rows.find(r => r.etab.id === e.id) || {};
    const msg = 'Supprimer <b>définitivement</b> l\u2019établissement « ' + e.nom + ' » ?<br/><br/>'
      + 'Seront également supprimés : <b>' + (row.eleves || 0) + ' élève(s)</b>, <b>' + (row.comptes || 0) + ' compte(s) utilisateur</b>, '
      + (row.anciens || 0) + ' fiche(s) d\u2019anciens, ' + (row.notes || 0) + ' note(s) et toute sa configuration '
      + '(années, classes, grilles tarifaires, personnalisation).<br/><br/>Cette action est irréversible.';
    if (!await confirm('Supprimer « ' + e.nom + ' » ?', msg, 'Supprimer définitivement', true)) return;
    try {
      const r = M.deleteEtab(e.id);
      toast('Établissement supprimé (' + r.eleves + ' élève(s), ' + r.users + ' compte(s) en cascade).', 'ok');
    } catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };

  const basculerEtab = async e => {
    const suspend = e.actif !== false;
    const msg = suspend
      ? 'Suspendre l\u2019établissement <b>« ' + e.nom + ' »</b> ?<br/><br/>'
        + 'Ses <b>' + ((dbRoot.users || []).filter(u => u.etablissementId === e.id).length) + ' compte(s)</b> ne pourront plus se connecter '
        + '(message « établissement suspendu ») et l\u2019établissement disparaît du sélecteur de connexion. '
        + 'Aucune donnée n\u2019est supprimée — la réactivation est immédiate.'
      : 'Réactiver l\u2019établissement <b>« ' + e.nom + ' »</b> ?<br/><br/>Ses comptes pourront à nouveau se connecter.';
    if (!await confirm(suspend ? 'Suspendre « ' + e.nom + ' » ?' : 'Réactiver « ' + e.nom + ' » ?', msg,
      suspend ? 'Suspendre' : 'Réactiver', suspend)) return;
    try {
      M.netToggleEtab(e.id);
      toast('Établissement « ' + e.nom + ' » ' + (suspend ? 'suspendu — connexions bloquées.' : 'réactivé.'), 'ok');
    } catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };

  const basculerCompte = async u => {
    const desact = !!u.actif;
    if (!await confirm((desact ? 'Désactiver' : 'Activer') + ' le compte ' + u.username + ' ?',
      (desact ? 'Le compte <b>' + u.username + '</b> (' + (ROLE_SHORT[u.role] || u.role) + ' — ' + etabNom(u.etablissementId) + ') ne pourra plus se connecter.'
        : 'Le compte <b>' + u.username + '</b> pourra à nouveau se connecter.'),
      desact ? 'Désactiver' : 'Activer', desact)) return;
    try {
      M.netToggleUser(u.id);
      toast('Compte ' + u.username + (desact ? ' désactivé.' : ' activé.'), 'ok');
    } catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };

  /* ---------- filtres ---------- */
  const comptes = useMemo(() => {
    const q = qCompte.trim().toLowerCase();
    return (dbRoot.users || [])
      .filter(u => fEtabC === 'all' || (fEtabC === 'none' ? !u.etablissementId : u.etablissementId === fEtabC))
      .filter(u => fRoleC === 'all' || u.role === fRoleC)
      .filter(u => !q || (u.username + ' ' + u.nom + ' ' + etabNom(u.etablissementId)).toLowerCase().includes(q));
  }, [dbRoot, qCompte, fEtabC, fRoleC, etabs]);

  const journees = useMemo(() => {
    const q = qJour.trim().toLowerCase();
    return journal
      .filter(j => fEtabJ === 'all' || (fEtabJ === 'global' ? j.etabId === null : j.etabId === fEtabJ))
      .filter(j => fActJ === 'all' || j.action === fActJ)
      .filter(j => !q || (nameOf(j) + ' ' + (j.details || '') + ' ' + (LBL[j.action] || j.action) + ' ' + j.etabNom).toLowerCase().includes(q));
  }, [journal, qJour, fEtabJ, fActJ, dbRoot]);

  if (!isSuper){
    return <EmptyState icon="bank" title="Accès réservé au superadministrateur"
      text="Cette console centralise la gestion et la supervision de tous les établissements."/>;
  }

  const tabBtn = (id, icone, label, nb) => (
    <button role="tab" aria-selected={onglet === id} className={'tab' + (onglet === id ? ' on' : '')}
      onClick={() => setOnglet(id)}><Ic name={icone}/> {label}{nb != null ? <span className="mut"> ({nb})</span> : null}</button>
  );

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:12 }}>
        <div className="tabs" role="tablist" aria-label="Sections de la console réseau">
          {tabBtn('reseau', 'chart', 'Vue d\u2019ensemble')}
          {tabBtn('etabs', 'bank', 'Établissements', etabs.length)}
          {tabBtn('comptes', 'users', 'Comptes', (dbRoot.users || []).length)}
          {tabBtn('journal', 'activity', 'Journal réseau', journal.length)}
        </div>
        <Badge cls="b-gold"><Ic name="bank"/> Console superadministrateur</Badge>
      </div>

      {/* ================= VUE D'ENSEMBLE ================= */}
      {onglet === 'reseau' && (
        <>
          <div className="kpis">
            <Kpi icon="bank" val={net.tot.etabsActifs + ' / ' + net.tot.etabs} label="Établissements"
              sub={net.tot.etabsActifs === net.tot.etabs ? 'tous actifs' : (net.tot.etabs - net.tot.etabsActifs) + ' suspendu(s)'}
              color="var(--navy-800)" bg="rgba(44,58,99,.07)"/>
            <Kpi icon="users" val={fmt(net.tot.eleves)} label="Élèves inscrits"
              sub="année en cours de chaque établissement" color="var(--terra-dark)" bg="var(--terra-soft)"/>
            <Kpi icon="coins" val={fmt(net.tot.encaisse) + ' FCFA'} label="Encaissements réseau"
              sub={'sur ' + fmt(net.tot.attendu) + ' FCFA attendus'} color="var(--gold-600)" bg="rgba(227,167,60,.13)"/>
            <Kpi icon="target" val={net.tot.recouvrement == null ? '—' : net.tot.recouvrement + ' %'} label="Recouvrement moyen"
              sub="encaissé / attendu (réseau)" color={net.tot.recouvrement != null && net.tot.recouvrement >= 70 ? 'var(--ok)' : 'var(--bad)'}
              bg={net.tot.recouvrement != null && net.tot.recouvrement >= 70 ? 'var(--ok-bg)' : 'var(--bad-bg)'}/>
            <Kpi icon="book" val={fmt(net.tot.enseignants)} label="Enseignants" sub={fmt(net.tot.notes) + ' notes saisies'}
              color="var(--navy-800)" bg="rgba(44,58,99,.07)"/>
            <Kpi icon="shield" val={net.tot.comptesActifs + ' / ' + net.tot.comptes} label="Comptes actifs"
              sub={net.tot.comptesActifs === net.tot.comptes ? 'tous actifs' : (net.tot.comptes - net.tot.comptesActifs) + ' désactivé(s)'}
              color={net.tot.comptesActifs === net.tot.comptes ? 'var(--ok)' : 'var(--bad)'}
              bg={net.tot.comptesActifs === net.tot.comptes ? 'var(--ok-bg)' : 'var(--bad-bg)'}/>
          </div>

          <div className="card" style={{ marginTop:14 }}>
            <div className="card-h"><h3>Établissements du réseau</h3>
              <span className="mut" style={{ fontSize:11.5 }}>Indicateurs de l'année en cours de chaque établissement</span></div>
            <div className="card-b" style={{ padding:0 }}>
              <div className="tbl-wrap" style={{ border:'none', borderRadius:0 }}>
                <table className="tbl">
                  <thead><tr>
                    <th>Établissement</th><th>Année</th>
                    <th className="num">Élèves</th><th className="num">Attendu</th><th className="num">Encaissé</th>
                    <th style={{ width:170 }}>Recouvrement</th><th className="num">Enseign.</th><th className="num">Comptes</th>
                    <th>Dernière activité</th><th style={{ width:90 }}></th>
                  </tr></thead>
                  <tbody>
                    {net.rows.map(r => (
                      <tr key={r.etab.id} className={r.actif ? '' : 'row-off'}>
                        <td><b>{r.etab.nom}</b><br/><span className="mut" style={{ fontSize:11 }}>{[r.etab.ville, r.etab.pays].filter(Boolean).join(' • ') || '—'}</span></td>
                        <td className="nowrap">{r.annee || <span className="mut">aucune</span>}</td>
                        <td className="num"><b>{fmt(r.eleves)}</b></td>
                        <td className="num">{fmt(r.attendu)}</td>
                        <td className="num"><b>{fmt(r.encaisse)}</b></td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div className="bar" style={{ flex:1 }}><i className={r.recouvrement >= 80 ? 'g' : (r.recouvrement >= 50 ? 'o' : '')}
                              style={{ width:(r.recouvrement || 0) + '%' }}/></div>
                            <b style={{ minWidth:34, textAlign:'right' }}>{r.recouvrement == null ? '—' : r.recouvrement + ' %'}</b>
                          </div>
                        </td>
                        <td className="num">{fmt(r.enseignants)}</td>
                        <td className="num">{r.comptesActifs}/{r.comptes}</td>
                        <td className="nowrap mut">{r.derniereAct ? fmtDT(r.derniereAct) : '—'}</td>
                        <td className="acts">
                          <button className="btn btn-pri btn-sm" onClick={() => setEtab(r.etab.id)}><Ic name="arrow-r"/> Ouvrir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {!net.rows.some(r => !r.actif) && null}
            {net.rows.some(r => !r.actif) && (
              <div className="card-f"><Ic name="alert"/> Établissement(s) suspendu(s) : <b>{net.rows.filter(r => !r.actif).map(r => r.etab.nom).join(', ')}</b> — comptes bloqués à la connexion.</div>
            )}
          </div>

          <div className="card" style={{ marginTop:14 }}>
            <div className="card-h"><h3>Activité récente du réseau</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOnglet('journal')}><Ic name="activity"/> Tout le journal</button></div>
            <div className="card-b" style={{ padding:0 }}>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Établissement</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
                <tbody>
                  {journal.slice(0, 8).map(j => (
                    <tr key={(j.etabId || 'g') + '-' + j.id}>
                      <td className="nowrap mut">{fmtDT(j.date)}</td>
                      <td className="nowrap"><Badge cls={j.etabId ? 'b-navy' : 'b-gold'}>{j.etabNom}</Badge></td>
                      <td className="nowrap"><b>{nameOf(j)}</b></td>
                      <td><Badge cls={ACT_CLS(j)}>{LBL[j.action] || j.action}</Badge></td>
                      <td className="mut" style={{ maxWidth:420, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.details}</td>
                    </tr>
                  ))}
                  {!journal.length && <tr><td colSpan={5} className="center mut" style={{ padding:20 }}>Aucune activité enregistrée.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================= ÉTABLISSEMENTS ================= */}
      {onglet === 'etabs' && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
            <Badge cls="b-navy"><Ic name="bank"/> {etabs.length} établissement(s)</Badge>
            <Badge cls="b-info">{fmt(net.tot.eleves)} élèves (année en cours)</Badge>
            <Badge cls="b-ok">{fmt(net.tot.encaisse)} FCFA encaissés</Badge>
            <span style={{ flex:1 }}/>
            {etabId && <button className="btn btn-ghost btn-sm" onClick={() => setEtab(null)}><Ic name="grid"/> Retour à l'établissement courant</button>}
            <button className="btn btn-pri btn-sm" onClick={() => openModal(<EtabFormModal/>)}><Ic name="plus"/> Nouvel établissement</button>
          </div>

          {etabs.length === 0 && (
            <EmptyState icon="bank" title="Aucun établissement"
              text="Créez le premier établissement pour commencer à l'utiliser."/>
          )}

          <div className="etab-grid">
            {net.rows.map(r => {
              const e = r.etab;
              return (
                <div key={e.id} className={'etab-card' + (r.actif ? '' : ' inactif') + (e.id === etabId ? ' courant' : '')}>
                  <div className="ec-head">
                    <span className="ec-logo"><Ic name="bank"/></span>
                    <div className="ec-t">
                      <b>{e.nom}</b>
                      <span>{[e.ville, e.pays].filter(Boolean).join(' • ') || '—'}</span>
                    </div>
                    {!r.actif && <Badge cls="b-warn">suspendu</Badge>}
                    {e.id === etabId && <Badge cls="b-ok">courant</Badge>}
                  </div>
                  <div className="ec-stats">
                    <div><b>{r.annee || 'aucune année'}</b><span>année scolaire</span></div>
                    <div><b>{fmt(r.eleves)}</b><span>élèves inscrits</span></div>
                    <div><b>{fmt(r.encaisse)}</b><span>FCFA encaissés</span></div>
                    <div><b>{r.comptesActifs}/{r.comptes}</b><span>comptes actifs</span></div>
                  </div>
                  <div className="ec-foot">
                    <button className="btn btn-pri btn-sm" onClick={() => setEtab(e.id)}><Ic name="arrow-r"/> Ouvrir</button>
                    <button className={'btn btn-sm ' + (r.actif ? 'btn-ghost' : 'btn-gold')} onClick={() => basculerEtab(e)}
                      title={r.actif ? "Suspendre l'établissement (bloque les connexions)" : 'Réactiver l\u2019établissement'}>
                      <Ic name={r.actif ? 'ban' : 'check'}/> {r.actif ? 'Suspendre' : 'Réactiver'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openModal(<EtabFormModal initial={e}/>)} title="Modifier"><Ic name="wrench"/> Modifier</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(e)} title="Supprimer"><Ic name="trash"/> Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop:18, padding:'14px 18px', fontSize:12.3, color:'var(--muted)', lineHeight:1.65 }}>
            <b style={{ color:'var(--navy-800)' }}><Ic name="info"/> Contrôle des établissements</b><br/>
            <b>Suspendre</b> un établissement bloque immédiatement les connexions de tous ses comptes (côté application et côté serveur)
            et le retire du sélecteur de connexion — sans supprimer aucune donnée. La <b>réactivation</b> est immédiate.
            La suppression, elle, efface définitivement l'établissement et toutes ses données (confirmation en cascade exigée).
          </div>
        </>
      )}

      {/* ================= COMPTES ================= */}
      {onglet === 'comptes' && (
        <div className="card">
          <div className="card-h"><h3>Comptes du réseau</h3>
            <span className="mut" style={{ fontSize:11.5 }}>{comptes.length} compte(s) affiché(s) — {net.tot.comptesActifs} actif(s) sur {net.tot.comptes}</span></div>
          <div className="card-b" style={{ paddingBottom:12 }}>
            <div className="form-grid" style={{ gridTemplateColumns:'minmax(200px,1fr) 220px 200px' }}>
              <label>Recherche
                <div className="srch"><Ic name="search"/><input type="text" value={qCompte} onChange={e => setQCompte(e.target.value)}
                  placeholder="Identifiant, nom, établissement…"/></div>
              </label>
              <label>Établissement
                <Select value={fEtabC} onChange={setFEtabC}
                  options={[{ value:'all', label:'Tous les établissements' }, { value:'none', label:'— Administration générale —' }]
                    .concat(etabs.map(e => ({ value:e.id, label:e.nom })))}/>
              </label>
              <label>Rôle
                <Select value={fRoleC} onChange={setFRoleC}
                  options={[{ value:'all', label:'Tous les rôles' }]
                    .concat(Object.keys(ROLE_LABEL).map(r => ({ value:r, label:ROLE_SHORT[r] || r })))}/>
              </label>
            </div>
          </div>
          <div className="card-b" style={{ padding:0 }}>
            <div className="tbl-wrap" style={{ border:'none', borderRadius:0 }}>
              <table className="tbl">
                <thead><tr>
                  <th>Compte</th><th>Établissement</th><th>Rôle</th><th>Statut</th>
                  <th>Dernier accès</th><th style={{ width:130 }}></th>
                </tr></thead>
                <tbody>
                  {comptes.map(u => {
                    const eS = (etabs.find(x => x.id === u.etablissementId) || null);
                    return (
                      <tr key={u.id} className={u.actif ? '' : 'row-off'}>
                        <td><b>{u.username}</b><br/><span className="mut" style={{ fontSize:11 }}>{u.nom}</span></td>
                        <td className="nowrap">
                          {u.role === 'superadmin' ? <Badge cls="b-gold">Administration générale</Badge>
                            : <Badge cls="b-navy">{eS ? eS.nom : '—'}</Badge>}
                          {eS && eS.actif === false && <>{' '}<Badge cls="b-warn">suspendu</Badge></>}
                        </td>
                        <td className="nowrap">{ROLE_SHORT[u.role] || u.role}</td>
                        <td>{u.actif ? <Badge cls="b-ok">actif</Badge> : <Badge cls="b-bad">désactivé</Badge>}</td>
                        <td className="nowrap mut">{u.dernierAcces ? fmtDT(u.dernierAcces) : 'jamais'}</td>
                        <td className="acts">
                          {u.role !== 'superadmin' && u.id !== user.id ? (
                            <>
                              <button className="icon-btn" title={u.actif ? 'Désactiver le compte' : 'Activer le compte'}
                                onClick={() => basculerCompte(u)}><Ic name={u.actif ? 'ban' : 'check'}/></button>
                              <button className="icon-btn" title="Réinitialiser le mot de passe"
                                onClick={() => openModal(<NetResetPwdModal compte={u} onClose={() => {}}/>)}><Ic name="lock"/></button>
                            </>
                          ) : <span className="mut" style={{ fontSize:11 }}>{u.id === user.id ? 'votre compte' : '—'}</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!comptes.length && <tr><td colSpan={6} className="center mut" style={{ padding:20 }}>Aucun compte ne correspond aux filtres.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-f">
            <Ic name="info"/> Désactiver un compte empêche toute connexion ; le mot de passe peut être réinitialisé depuis cette console.
            La création et les attributions fines se gèrent dans l'onglet Utilisateurs de chaque établissement.
          </div>
        </div>
      )}

      {/* ================= JOURNAL RÉSEAU ================= */}
      {onglet === 'journal' && (
        <div className="card">
          <div className="card-h"><h3>Journal d’activité du réseau</h3>
            <CsvBtn filename="journal_reseau.csv"
              header={['Date','Établissement','Utilisateur','Action','Détails']}
              rows={journees.map(j => [j.date, j.etabNom, nameOf(j), LBL[j.action] || j.action, j.details || ''])}/>
          </div>
          <div className="card-b" style={{ paddingBottom:12 }}>
            <div className="form-grid" style={{ gridTemplateColumns:'minmax(200px,1fr) 230px 200px' }}>
              <label>Recherche
                <div className="srch"><Ic name="search"/><input type="text" value={qJour} onChange={e => setQJour(e.target.value)}
                  placeholder="Utilisateur, détails, action…"/></div>
              </label>
              <label>Établissement
                <Select value={fEtabJ} onChange={setFEtabJ}
                  options={[{ value:'all', label:'Tout le réseau' }, { value:'global', label:'— Administration générale —' }]
                    .concat(etabs.map(e => ({ value:e.id, label:e.nom })))}/>
              </label>
              <label>Action
                <Select value={fActJ} onChange={setFActJ}
                  options={[{ value:'all', label:'Toutes les actions' }]
                    .concat(Object.entries(LBL).map(([k, v]) => ({ value:k, label:v })))}/>
              </label>
            </div>
          </div>
          <div className="card-b" style={{ padding:0 }}>
            <div className="tbl-wrap" style={{ border:'none', borderRadius:0 }}>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Établissement</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
                <tbody>
                  {journees.slice(0, 150).map(j => (
                    <tr key={(j.etabId || 'g') + '-' + j.id}>
                      <td className="nowrap mut">{fmtDT(j.date)}</td>
                      <td className="nowrap"><Badge cls={j.etabId ? 'b-navy' : 'b-gold'}>{j.etabNom}</Badge></td>
                      <td className="nowrap"><b>{nameOf(j)}</b></td>
                      <td><Badge cls={ACT_CLS(j)}>{LBL[j.action] || j.action}</Badge></td>
                      <td className="mut">{j.details}</td>
                    </tr>
                  ))}
                  {!journees.length && <tr><td colSpan={5} className="center mut" style={{ padding:20 }}>Aucun événement ne correspond aux filtres.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-f"><Ic name="activity"/> {journal.length} événement(s) fusionné(s) : journal global (administration, connexions) + journaux de chaque établissement (250 max par source).</div>
        </div>
      )}
    </>
  );
}
