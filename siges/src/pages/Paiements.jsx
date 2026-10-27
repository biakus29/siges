import React, { useState } from 'react';
import { Badge, Bar, EmptyState, Search, Select, Pager, usePage, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, norm, pctTxt, MODES, ROLE_SHORT, todayISO } from '../core/utils.js';
import { yearById, classesSorted, niveauById, eleveById, fraisById, classById, userById, yearAggregates } from '../core/business.js';
import ReceiptModal from '../components/modals/ReceiptModal.jsx';
import PayModal from '../components/modals/PayModal.jsx';
import { CancelPayModal } from '../components/modals/EntityForms.jsx';
import { ReportModal, CaisseReport } from '../components/Reports.jsx';

export default function Paiements(){
  const { db, users, anneeId, can, isAdmin, openModal, toast } = useApp();
  const an = yearById(db, anneeId);
  const [tab, setTab] = useState('lst');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('all');
  const [statut, setStatut] = useState('all');
  const [periode, setPeriode] = useState('all');

  if (!an) return <EmptyState icon="calendar" title="Aucune année" text="Sélectionnez une année scolaire."/>;
  const canW = can('paiements', true);
  const ay = db.annees.find(a => a.active);
  const canPayNow = canW && ay && an.id === ay.id && ay.statut === 'ouverte';

  const list = filtered(db, anneeId, { q, mode, statut, periode }, useApp().scope.classesIds);
  const [page, setPage, rows] = usePage(list, 20);
  const totalF = list.filter(p => p.statut === 'valide').reduce((s,p) => s + p.montant, 0);

  /* impression directe du journal de caisse sur la période filtrée */
  const printJournal = () => {
    const t = todayISO();
    let from = t;
    if (periode === 'week') from = new Date(Date.now() - 7*864e5).toISOString().slice(0,10);
    else if (periode === 'month') from = t.slice(0,8) + '01';
    else if (periode === 'all') from = an.debut || t;
    openModal(<ReportModal autoPrint title={'Journal de caisse — ' + fmtD(from) + (t !== from ? ' → ' + fmtD(t) : '')}>
      <CaisseReport from={from} to={t}/></ReportModal>);
  };

  return (
    <>
      <div className="tabs" style={{ marginBottom:14 }}>
        <button className={'tab' + (tab === 'lst' ? ' on' : '')} onClick={() => setTab('lst')}><Ic name="receipt"/> Encaissements</button>
        <button className={'tab' + (tab === 'sit' ? ' on' : '')} onClick={() => setTab('sit')}><Ic name="chart"/> Situation des classes</button>
      </div>

      {tab === 'sit' ? <SituationClasses db={db} an={an}/> : (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
            <Search value={q} onChange={v => { setQ(v); setPage(0); }} placeholder="N° reçu, élève, matricule…" style={{ width:230 }}/>
            <Select value={mode} onChange={v => { setMode(v); setPage(0); }}
              options={[{ value:'all', label:'Tous les modes' }, ...Object.entries(MODES).map(([k,v]) => ({ value:k, label:v }))]}/>
            <Select value={statut} onChange={v => { setStatut(v); setPage(0); }}
              options={[{ value:'all', label:'Tous statuts' }, { value:'valide', label:'Validés' }, { value:'annule', label:'Annulés' }]}/>
            <Select value={periode} onChange={v => { setPeriode(v); setPage(0); }}
              options={[{ value:'all', label:'Toute l\u2019année' }, { value:'today', label:'Aujourd\u2019hui' }, { value:'week', label:'7 derniers jours' }, { value:'month', label:'Ce mois' }]}/>
            <span style={{ flex:1 }}/>
            <span className="chip"><Ic name="cash"/> Total filtré : <b>&nbsp;{fmt(totalF)} FCFA</b></span>
            <CsvBtn filename={'paiements_' + an.libelle + '.csv'}
              header={['N° reçu','Date','Élève','Matricule','Classe','Frais','Montant (FCFA)','Mode','Caissier','Statut']}
              rows={list.map(p => {
                const e = eleveById(db, p.eleveId), f = fraisById(db, p.fraisId);
                const cl = e ? classById(db, e.classeId) : null, u = (users || []).find(x => x.id === p.userId) || userById(db, p.userId);
                return [p.numero, p.date.slice(0,10), e ? e.nom + ' ' + e.prenom : '', e ? e.matricule : '', cl ? cl.libelle : '',
                  f ? f.libelle : '', p.montant, MODES[p.mode] || p.mode, u ? u.nom : '', p.statut === 'valide' ? 'Validé' : 'Annulé'];
              })}/>
            <button className="btn btn-ghost btn-sm" onClick={printJournal} title="Imprimer le journal de caisse de la période affichée"><Ic name="printer"/> Imprimer</button>
            {canPayNow && <button className="btn btn-gold" onClick={() => openModal(<PayModal/>)}><Ic name="plus"/> Nouveau paiement</button>}
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th>N° reçu</th><th>Date</th><th>Élève</th><th>Classe</th><th>Frais</th>
                <th className="num">Montant (FCFA)</th><th>Mode</th><th>Caissier</th><th>Statut</th><th></th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={10} className="center mut" style={{ padding:22 }}>Aucun paiement trouvé pour ces critères.</td></tr>}
                {rows.map(p => {
                  const e = eleveById(db, p.eleveId), f = fraisById(db, p.fraisId);
                  const cl = e ? classById(db, e.classeId) : null, u = (users || []).find(x => x.id === p.userId) || userById(db, p.userId);
                  return (
                    <tr key={p.id} className={p.statut === 'annule' ? 'cancel' : ''}>
                      <td className="nowrap"><b>{p.numero}</b></td>
                      <td className="nowrap mut">{fmtD(p.date)}</td>
                      <td>{e ? <>{e.nom} {e.prenom}<br/><span className="mut" style={{ fontSize:11 }}>{e.matricule}</span></> : '—'}</td>
                      <td className="mut nowrap">{cl ? cl.libelle : '—'}</td>
                      <td className="nowrap">{f ? f.libelle : '—'} <span className="mut">{f ? f.code : ''}</span></td>
                      <td className="num bld">{fmt(p.montant)}</td>
                      <td className="mut nowrap">{MODES[p.mode] || '—'}</td>
                      <td className="mut nowrap">{u ? u.nom.split(' ').slice(-1)[0] : '—'}</td>
                      <td>{p.statut === 'valide' ? <Badge cls="b-ok">Validé</Badge> : <Badge cls="b-bad">Annulé</Badge>}</td>
                      <td className="rowacts">
                        <button className="icon-btn" title="Voir le reçu" onClick={() => openModal(<ReceiptModal p={p}/>)}><Ic name="printer"/></button>
                        {isAdmin() && p.statut === 'valide' &&
                          <button className="icon-btn danger" title="Annuler le paiement" onClick={() => openModal(<CancelPayModal paiement={p}/>)}><Ic name="ban"/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pager page={page} total={list.length} per={20} onPage={setPage}/>
          </div>
        </>
      )}
    </>
  );
}

function SituationClasses({ db, an }){
  const ag = yearAggregates(db, an.id);
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>
          <th>Classe</th><th>Niveau</th><th className="num">Effectif</th><th className="num">À jour</th>
          <th className="num">Attendu (FCFA)</th><th className="num">Encaissé (FCFA)</th><th className="num">Reste (FCFA)</th><th>Taux</th>
        </tr></thead>
        <tbody>
          {classesSorted(db).map(c => {
            const a = ag.perClasse[c.id];
            if (!a) return null;
            const taux = a.attendu > 0 ? a.encaisse/a.attendu : 0;
            return (
              <tr key={c.id}>
                <td className="bld">{c.libelle}</td>
                <td className="mut">{(niveauById(db, c.niveauId) || {}).libelle || '—'}</td>
                <td className="num">{fmt(a.effectif)}</td>
                <td className="num">{fmt(a.aJour)} <span className="mut">/ {fmt(a.effectif)}</span></td>
                <td className="num">{fmt(a.attendu)}</td>
                <td className="num" style={{ color:'var(--ok)' }}>{fmt(a.encaisse)}</td>
                <td className="num" style={{ color:'var(--bad)' }}>{fmt(Math.max(0, a.attendu - a.encaisse))}</td>
                <td style={{ minWidth:120 }}>
                  <Bar pct={taux*100} cls={taux >= .75 ? 'g' : (taux >= .4 ? 'o' : 'r')}/>
                  <span style={{ fontSize:'10.5px', color:'var(--faint)' }}>{pctTxt(taux)}</span>
                </td>
              </tr>
            );
          })}
          {Object.keys(ag.perClasse).length === 0 && <tr><td colSpan={8} className="center mut" style={{ padding:22 }}>Aucun élève inscrit.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function filtered(db, anneeId, { q, mode, statut, periode }, scopeCls){
  const t = todayISO();
  const weekAgo = new Date(Date.now() - 7*864e5).toISOString().slice(0,10);
  const month = t.slice(0,7);
  const nq = norm(q);
  const eleveByIdLocal = id => db.eleves.find(e => e.id === id);
  return db.paiements.filter(p => p.anneeId === anneeId)
    .filter(p => !scopeCls || (p.classeId ? scopeCls.includes(p.classeId) : scopeCls.includes((eleveByIdLocal(p.eleveId) || {}).classeId)))
    .filter(p => mode === 'all' || p.mode === mode)
    .filter(p => statut === 'all' || p.statut === statut)
    .filter(p => {
      if (periode === 'today') return p.date.slice(0,10) === t;
      if (periode === 'week') return p.date.slice(0,10) >= weekAgo;
      if (periode === 'month') return p.date.slice(0,7) === month;
      return true;
    })
    .filter(p => {
      if (!nq) return true;
      const e = eleveById(db, p.eleveId);
      return norm(p.numero).indexOf(nq) >= 0 || (e && (norm(e.nom + ' ' + e.prenom).indexOf(nq) >= 0 || norm(e.matricule).indexOf(nq) >= 0));
    })
    .sort((a,b) => a.date < b.date ? 1 : -1);
}

function fmtD(iso){
  return new Date(String(iso).length === 10 ? iso + 'T12:00' : iso)
    .toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}
