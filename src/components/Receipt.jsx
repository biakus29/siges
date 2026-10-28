import React from 'react';
import { Logo } from './UI.jsx';
import { fmt, fmtDT, enLettres, MODES, ROLE_SHORT } from '../core/utils.js';
import { eleveById, fraisById, classById, yearById, userById, settingsOf } from '../core/business.js';

/* Reçu officiel imprimable */
export default function Receipt({ db, p, users }){
  const e = eleveById(db, p.eleveId);
  const f = fraisById(db, p.fraisId);
  const cl = e ? classById(db, e.classeId) : null;
  const an = yearById(db, p.anneeId);
  const u = (Array.isArray(users) ? users : []).find(x => x.id === p.userId) || userById(db, p.userId);
  const st = settingsOf(db);
  const contact = [st.adresse, st.telephone, st.email].filter(Boolean).join('  •  ');
  return (
    <div className="rcp" id="print-zone">
      <div className="rcp-head">
        {st.logo
          ? <img className="rcp-logo" src={st.logo} alt={st.nomEtablissement}/>
          : <Logo size={42}/>}
        <div className="rh-t">
          <b>{st.nomEtablissement}</b>
          <span>{st.sousTitre}</span>
          <span>{st.mention}</span>
          {contact && <span className="rh-contact">{contact}</span>}
        </div>
        <div className="rh-n"><span>Reçu N°</span><b>{p.numero}</b></div>
      </div>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Élève</span><b>{e ? e.nom + ' ' + e.prenom : '—'}</b></div>
          <div><span>Matricule</span><b>{e ? e.matricule : '—'}</b></div>
          <div><span>Classe</span><b>{cl ? cl.libelle : '—'}</b></div>
          <div><span>Année scolaire</span><b>{an ? an.libelle : '—'}</b></div>
          <div><span>Date</span><b>{fmtDT(p.date)}</b></div>
          <div><span>Mode de paiement</span><b>{MODES[p.mode] || p.mode}{p.reference ? ' — réf. ' + p.reference : ''}</b></div>
        </div>
        <table className="rcp-tbl">
          <thead><tr><th>Désignation</th><th className="num">Montant</th></tr></thead>
          <tbody>
            <tr>
              <td>{f ? f.libelle : '—'} <span className="mut">({f ? f.code : ''})</span></td>
              <td className="num">{fmt(p.montant)} FCFA</td>
            </tr>
          </tbody>
          <tfoot><tr><td>TOTAL PAYÉ</td><td className="num">{fmt(p.montant)} FCFA</td></tr></tfoot>
        </table>
        <div className="rcp-lettres">
          <b>Arrêtée la présente quittance à la somme de :</b><br/>
          {enLettres(p.montant)} francs CFA
        </div>
        {p.statut === 'annule' && (
          <div className="alert-line al-bad" style={{ marginBottom:10 }}>
            <svg className="ic"><use href="#i-ban"/></svg>
            <span><b>REÇU ANNULÉ</b>{p.motifAnnulation ? ' — motif : ' + p.motifAnnulation : ''}</span>
          </div>
        )}
        <div style={{ fontSize:'11.8px', color:'var(--muted)' }}>
          Encaissé par : <b>{u ? u.nom : '—'}</b> ({u ? ROLE_SHORT[u.role] : ''})
        </div>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
          <div className="sig">Le Parent / Tuteur</div>
        </div>
      </div>
      <div className="rcp-note">
        Ce reçu est exigé pour toute réclamation — veuillez le conserver soigneusement.<br/>
        {st.piedEtat} • {an ? an.libelle : ''} • {p.numero}
      </div>
    </div>
  );
}
