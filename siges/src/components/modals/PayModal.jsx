import React, { useEffect, useState } from 'react';
import { Modal, Avatar, StatChip, MoneyInput } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt, norm, MODES } from '../../core/utils.js';
import { classById, elevesOfYear, situationRows, situationTotals, yearById } from '../../core/business.js';
import ReceiptModal from './ReceiptModal.jsx';

export default function PayModal({ initialEleveId=null }){
  const app = useApp();
  const { db, anneeId, openModal, closeModal, toast, M } = app;
  const an = yearById(db, anneeId);
  const [eleveId, setEleveId] = useState(initialEleveId);
  const [query, setQuery] = useState('');
  const [fraisId, setFraisId] = useState(null);
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const el = eleveId ? db.eleves.find(e => e.id === eleveId) : null;
  const rows = el ? situationRows(db, el) : [];
  const payable = rows.filter(r => r.applicable && r.solde > 0);
  const sel = rows.find(r => r.frais.id === fraisId) || null;
  const tot = el ? situationTotals(db, el) : null;

  /* frais par défaut dès qu'un élève est choisi */
  useEffect(() => {
    if (el && payable.length && !payable.some(r => r.frais.id === fraisId)){
      const first = payable.find(r => r.frais.obligatoire) || payable[0];
      setFraisId(first.frais.id);
      setMontant(String(first.solde));
    }
  }, [eleveId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --- Étape 1 : recherche d'élève --- */
  if (!el){
    const q = norm(query);
    const res = q
      ? elevesOfYear(db, anneeId).filter(e => norm(e.nom + ' ' + e.prenom + ' ' + e.matricule).indexOf(q) >= 0).slice(0, 8)
      : [];
    return (
      <Modal wide icon="cash" title={'Nouveau paiement — ' + (an ? an.libelle : '')} onClose={closeModal} staticBackdrop>
        <div className="field">
          <label className="req">Élève à encaisser</label>
          <div className="srch">
            <Ic name="search"/>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Nom, prénom ou matricule…"/>
          </div>
        </div>
        {!query
          ? <p className="mut" style={{ padding:'10px 2px', fontSize:'12.3px' }}>
              Commencez à taper pour rechercher parmi les {fmt(db.eleves.filter(e => e.anneeId === anneeId).length)} élèves inscrits en {an ? an.libelle : ''}.
            </p>
          : res.length
            ? <div className="pm-res">
                {res.map(e => {
                  const cl = classById(db, e.classeId);
                  return (
                    <div key={e.id} className="pm-row" onClick={() => { setEleveId(e.id); setFraisId(null); setMontant(''); }}>
                      <Ic name="user"/>
                      <div style={{ flex:1 }}>
                        <b>{e.nom} {e.prenom}</b>{' '}
                        <small>{e.matricule} • {cl ? cl.libelle : '—'}{e.statut !== 'actif' ? ' • radié' : ''}</small>
                      </div>
                      <Ic name="chev-r"/>
                    </div>
                  );
                })}
              </div>
            : <p className="mut" style={{ padding:'10px 2px' }}>Aucun élève ne correspond à « {query} ».</p>}
        <div style={{ marginTop:14, textAlign:'right' }}>
          <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        </div>
      </Modal>
    );
  }

  /* --- Étape 2 : détail de l'encaissement --- */
  const cl = classById(db, el.classeId);
  const submit = e => {
    e.preventDefault();
    try {
      const m = parseInt(montant, 10) || 0;
      if (!sel || !sel.applicable || sel.solde <= 0) throw new Error('Sélectionnez un frais présentant un solde restant.');
      if (m < 100) throw new Error('Montant trop faible (minimum 100 FCFA).');
      if (m > sel.solde) throw new Error('Le montant dépasse le solde restant (' + fmt(sel.solde) + ' FCFA).');
      if (mode !== 'especes' && !reference.trim()) throw new Error('Indiquez la référence du paiement (transaction, chèque…).');
      const { paiement } = M.addPaiement({ eleveId:el.id, fraisId:sel.frais.id, montant:m, mode, reference, note, solde:sel.solde });
      openModal(<ReceiptModal p={paiement}/>);
      toast('Paiement ' + paiement.numero + ' enregistré — ' + fmt(m) + ' FCFA.', 'ok');
    } catch(err){
      toast(String(err && err.message ? err.message : err), 'err');
    }
  };

  return (
    <Modal wide icon="cash" title={'Nouveau paiement — ' + (an ? an.libelle : '')} onClose={closeModal} staticBackdrop>
      <div className="pm-eleve">
        <Avatar name={el.nom + ' ' + el.prenom} photo={el.photo}/>
        <div className="pe-t">
          <b>{el.nom} {el.prenom}</b>
          <span>{el.matricule} • {cl ? cl.libelle : '—'} • {an ? an.libelle : ''}</span>
        </div>
        <div className="pe-solde">
          <b style={{ color: tot.solde > 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmt(tot.solde)} <small style={{ fontSize:10 }}>FCFA</small></b>
          <span>solde global</span>
        </div>
      </div>
      <div className="tbl-wrap" style={{ marginBottom:14 }}>
        <table className="tbl">
          <thead><tr><th></th><th>Frais</th><th className="num">Net à payer</th><th className="num">Payé (FCFA)</th><th className="num">Solde (FCFA)</th><th>État</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr className="sit-row" key={r.frais.id}>
                {!r.applicable
                  ? <><td colSpan={2} className="mut">{r.frais.libelle}</td><td colSpan={4}><span className="stat-chip sc-na">non applicable</span></td></>
                  : <>
                      <td style={{ width:28 }}>
                        {r.solde > 0
                          ? <input type="radio" name="frais" checked={fraisId === r.frais.id}
                              onChange={() => { setFraisId(r.frais.id); setMontant(String(r.solde)); }}/>
                          : null}
                      </td>
                      <td>{r.frais.libelle} {!r.frais.obligatoire && <span className="mut">(optionnel)</span>}
                        {r.reduction > 0 && <><br/><span className="mut" style={{ fontSize:10.5 }}>bourse : -{fmt(r.reduction)}</span></>}</td>
                      <td className="num">{r.reduction > 0 ? <><s className="mut" style={{ fontWeight:400 }}>{fmt(r.du)}</s> <b>{fmt(r.net)}</b></> : fmt(r.net)}</td>
                      <td className="num" style={{ color:'var(--ok)' }}>{fmt(r.paye)}</td>
                      <td className="num bld" style={{ color: r.solde > 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmt(r.solde)}</td>
                      <td><StatChip row={r}/></td>
                    </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payable.length > 0
        ? (
          <form onSubmit={submit} noValidate>
            <div className="frow">
              <div className="field">
                <label className="req">Montant encaissé</label>
                <MoneyInput value={montant} onChange={setMontant}/>
                {sel && sel.solde > 0
                  ? <span className="hint">Solde restant (réductions déduites) : {fmt(sel.solde)} FCFA — paiement partiel autorisé</span>
                  : <span className="hint">Sélectionnez un frais à encaisser</span>}
              </div>
              <div className="field">
                <label className="req">Mode de paiement</label>
                <select value={mode} onChange={e => setMode(e.target.value)}>
                  {Object.entries(MODES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            {mode !== 'especes' && (
              <div className="frow">
                <div className="field">
                  <label>Référence (transaction, chèque…)</label>
                  <input value={reference} onChange={e => setReference(e.target.value)} maxLength={40} placeholder="ex : MP260912.1423.A12345"/>
                </div>
                <div className="field">
                  <label>Note</label>
                  <input value={note} onChange={e => setNote(e.target.value)} maxLength={120} placeholder="Observation facultative"/>
                </div>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', gap:9, flexWrap:'wrap' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setEleveId(null); setQuery(''); }}>
                <Ic name="search"/> Changer d&apos;élève
              </button>
              <button type="submit" className="btn btn-gold"><Ic name="cash"/> Valider l&apos;encaissement</button>
            </div>
          </form>
          )
        : (
          <div className="alert-line al-ok">
            <Ic name="check-circle"/> <span>Cet élève est à jour de tous ses frais applicables.</span>
          </div>
        )}
    </Modal>
  );
}
