import React from 'react';
import { Modal, Badge, Avatar, StatChip, CsvBtn, WaBtn } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt, fmtD, fcfa, MODES, ROLE_SHORT } from '../../core/utils.js';
import { classById, yearById, situationRows, situationTotals, solvabiliteEleve, boursesOfEleve } from '../../core/business.js';
import { BourseFormModal } from './EntityForms.jsx';
import ReceiptModal from './ReceiptModal.jsx';
import PayModal from './PayModal.jsx';
import { ReportModal, EleveSituationReport } from '../Reports.jsx';

export default function SituationModal({ eleve, onClose }){
  const { db, openModal, can, closeModal, confirm, toast, M } = useApp();
  const close = onClose || closeModal;
  const rows = situationRows(db, eleve);
  const tot = situationTotals(db, eleve);
  const sol = solvabiliteEleve(db, eleve);
  const nbBoursesActives = boursesOfEleve(db, eleve).filter(b => b.actif !== false).length;
  const annulerReduc = async () => {
    if (!await confirm('Annuler toutes les réductions de ' + eleve.nom + ' ' + eleve.prenom + ' ?',
      'Les <b>' + nbBoursesActives + ' bourse(s) / réduction(s) active(s)</b> seront suspendues. Les nets à payer, soldes et échéances seront recalculés au tarif complet.', 'Annuler les réductions', true)) return;
    try {
      const r = M.cancelBoursesEleve(eleve.id);
      toast(r.n + ' réduction(s) annulée(s) — situations recalculées.', 'ok');
    } catch(err){ toast(String(err.message || err), 'err'); }
  };
  const cl = classById(db, eleve.classeId);
  const an = yearById(db, eleve.anneeId);
  const ay = db.annees.find(a => a.active);
  const canPay = can('paiements', true) && ay && eleve.anneeId === ay.id && ay.statut === 'ouverte' && eleve.statut === 'actif';
  const hist = db.paiements.filter(p => p.eleveId === eleve.id)
    .sort((a,b) => a.date < b.date ? 1 : -1).slice(0, 8);

  return (
    <Modal wide icon="wallet" title={'Situation des frais — ' + eleve.nom + ' ' + eleve.prenom} onClose={close}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => openModal(<ReportModal title={'Situation des frais — ' + eleve.nom + ' ' + eleve.prenom} icon="printer"><EleveSituationReport eleve={eleve}/></ReportModal>)}>
            <Ic name="printer"/> Imprimer la situation
          </button>
          <WaBtn small={false} label="WhatsApp" title={'Envoyer le bilan financier au parent par WhatsApp — ' + (eleve.tel || 'aucun contact enregistré')}
            tel={eleve.tel}
            msg={(db.settings || {}).nomEtablissement + ' — Situation des frais de ' + eleve.nom + ' ' + eleve.prenom
              + ' (' + (cl ? cl.libelle : '') + ', ' + (an ? an.libelle : '') + ') :'
              + ' Net à payer ' + fcfa(tot.net) + ' • Payé ' + fcfa(tot.paye) + ' • Solde ' + fcfa(tot.solde)
              + (tot.reduction ? ' • Réductions accordées ' + fcfa(tot.reduction) : '')
              + ' — ' + (tot.aJour ? 'COMPTES À JOUR. Merci de votre confiance.' : 'des règlements restent attendus. Merci de passer à la comptabilité.')
              + ' Détail complet disponible à l’établissement.'}/>
          {can('bourses', true) && nbBoursesActives > 0 && (
            <button className="btn btn-ghost" style={{ color:'var(--bad)', fontWeight:700 }} onClick={annulerReduc}>
              <Ic name="x"/> Annuler les réductions ({nbBoursesActives})
            </button>
          )}
          {can('bourses', true) && (
            <button className="btn btn-ghost" onClick={() => openModal(<BourseFormModal eleveId={eleve.id}/>)}>
              <Ic name="coins"/> Bourse / réduction
            </button>
          )}
          {canPay && <button className="btn btn-gold" onClick={() => openModal(<PayModal initialEleveId={eleve.id}/>)}>
            <Ic name="cash"/> Encaisser un paiement
          </button>}
          <CsvBtn filename={'situation_' + eleve.matricule + '.csv'}
            header={['Frais','Tarif (FCFA)','Réduction (FCFA)','Net à payer (FCFA)','Payé (FCFA)','Solde (FCFA)','État']}
            rows={rows.filter(r => r.applicable).map(r => [r.frais.libelle, r.du, r.reduction, r.net, r.paye, r.solde, r.solde === 0 ? 'Soldé' : 'En cours'])}/>
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
        </>
      }>
      <div className="pm-eleve">
        <Avatar name={eleve.nom + ' ' + eleve.prenom} photo={eleve.photo}/>
        <div className="pe-t">
          <b>{eleve.nom} {eleve.prenom}</b>
          <span>{eleve.matricule} • {cl ? cl.libelle : '—'} • {eleve.regime === 'interne' ? 'Interne' : 'Externe'} • {an ? an.libelle : ''}{eleve.dateNaissance ? ' • Né(e) le ' + fmtD(eleve.dateNaissance) + (eleve.lieuNaissance ? ' à ' + eleve.lieuNaissance : '') : ''} • Tuteur : {eleve.tuteur || '—'} ({eleve.tel || '—'})</span>
        </div>
        <div className="pe-solde">
          <b style={{ color: tot.solde > 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmt(tot.solde)} <small style={{ fontSize:10 }}>FCFA</small></b>
          <span>solde restant</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <Badge cls="b-navy">Net à payer : {fmt(tot.net)} FCFA</Badge>
        <Badge cls="b-ok">Payé : {fmt(tot.paye)} FCFA</Badge>
        {tot.reduction > 0 && <Badge cls="b-gold">Réductions : -{fmt(tot.reduction)} FCFA</Badge>}
        {tot.aJour ? <Badge cls="b-ok">Élève à jour</Badge> : <Badge cls="b-warn">Solde en cours</Badge>}
        {sol.insolvable
          ? <Badge cls="b-bad">Insolvable — {fmt(sol.reste)} FCFA d'exigible non réglé</Badge>
          : (sol.exigible > 0 && <Badge cls="b-ok">Échéances exigibles réglées ({fmt(sol.exigible)} FCFA)</Badge>)}
        {eleve.statut !== 'actif' && <Badge cls="b-mut">Radié</Badge>}
      </div>
      <div className="tbl-wrap" style={{ marginBottom:16 }}>
        <table className="tbl">
          <thead><tr><th>Frais</th><th className="num">Tarif (FCFA)</th><th className="num">Réduction</th><th className="num">Net à payer</th><th className="num">Payé (FCFA)</th><th className="num">Solde (FCFA)</th><th>État</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr className="sit-row" key={r.frais.id}>
                {!r.applicable
                  ? <><td className="mut">{r.frais.libelle}</td><td colSpan={6}><span className="stat-chip sc-na">non applicable</span></td></>
                  : <>
                      <td>{r.frais.libelle} {!r.frais.obligatoire && <span className="mut">(optionnel)</span>}</td>
                      <td className="num">{fmt(r.du)}</td>
                      <td className="num" style={r.reduction ? { color:'var(--gold-600)', fontWeight:700 } : undefined}>{r.reduction ? '-' + fmt(r.reduction) : '—'}</td>
                      <td className="num"><b>{fmt(r.net)}</b></td>
                      <td className="num" style={{ color:'var(--ok)' }}>{fmt(r.paye)}</td>
                      <td className="num bld" style={{ color: r.solde > 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmt(r.solde)}</td>
                      <td><StatChip row={r}/></td>
                    </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sec-t" style={{ marginTop:0 }}>Échéances de paiement — tranches</div>
      <div className="ech-wrap">
        {sol.parFrais.map(fr => (
          <div className="ech-frais" key={fr.frais.id}>
            <div className="ech-flab"><b>{fr.frais.code}</b> — {fr.frais.libelle}{!fr.frais.obligatoire && <span className="mut"> (optionnel)</span>}</div>
            <div className="ech-chips">
              {fr.tranches.map(t => (
                <span key={t.id} className={'ech-chip ec-' + t.etat}
                  title={(t.etat === 'payee' ? 'Tranche réglée' + (t.due ? '' : ' (en avance)') : t.etat === 'retard' ? 'Échéance dépassée — non réglée' : 'Échéance à venir') + ' — ' + fmtD(t.iso)}>
                  {t.label} · {fmt(t.montant)} · éch. {fmtD(t.iso)}
                  {t.etat === 'payee' ? <Ic name="check"/> : t.etat === 'retard' ? <Ic name="alert"/> : <Ic name="clock"/>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {hist.length > 0 && (
        <>
          <div className="sec-t" style={{ marginTop:0 }}>Historique des paiements</div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Date</th><th>N°</th><th>Frais</th><th className="num">Montant</th><th>Mode</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {hist.map(p => {
                  const f = db.frais.find(x => x.id === p.fraisId);
                  return (
                    <tr key={p.id} className={p.statut === 'annule' ? 'cancel' : ''}>
                      <td className="nowrap mut">{fmtD(p.date)}</td>
                      <td><b>{p.numero}</b></td>
                      <td>{f ? f.libelle : '—'}</td>
                      <td className="num">{fmt(p.montant)}</td>
                      <td className="mut">{MODES[p.mode] || ''}</td>
                      <td>{p.statut === 'valide' ? <Badge cls="b-ok">Validé</Badge> : <Badge cls="b-bad">Annulé</Badge>}</td>
                      <td className="rowacts">
                        <button className="icon-btn" title="Reçu" onClick={() => openModal(<ReceiptModal p={p}/>)}><Ic name="printer"/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {hist.length === 0 && <p className="mut" style={{ fontSize:12 }}>Aucun paiement enregistré pour cet élève.</p>}
    </Modal>
  );
}
