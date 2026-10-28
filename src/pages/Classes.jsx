import React, { useState } from 'react';
import { Badge, Bar, Search, Select, Pager, usePage, CsvBtn, CsvExportModal } from '../components/UI.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, norm, pctTxt, downloadCSV } from '../core/utils.js';
import { classesSorted, niveauxSorted, niveauById, yearAggregates, situationTotals } from '../core/business.js';
import { ClasseFormModal } from '../components/modals/EntityForms.jsx';
import { ReportModal, ClassSituationReport } from '../components/Reports.jsx';

export default function Classes(){
  const { db, users, anneeId, can, openModal, confirm, M, toast } = useApp();
  const titNom = c => { const u = c.titulaireId ? (users || []).find(x => x.id === c.titulaireId) : null; return u ? u.nom : null; };
  const canW = can('classes', true);
  const [q, setQ] = useState('');
  const [niveauF, setNiveauF] = useState('all');
  const ag = yearAggregates(db, anneeId);

  const list = classesSorted(db).filter(c => {
    if (niveauF !== 'all' && c.niveauId !== niveauF) return false;
    if (q && norm(c.libelle).indexOf(norm(q)) < 0) return false;
    return true;
  });
  const [page, setPage, rows] = usePage(list, 15);

  const del = async c => {
    const elv = db.eleves.filter(e => e.classeId === c.id);
    const pa = db.paiements.filter(p => elv.some(e => e.id === p.eleveId));
    const total = pa.reduce((s, p) => s + (p.statut === 'valide' ? p.montant : 0), 0);
    const msg = elv.length
      ? 'Supprimer <b>définitivement</b> la classe ' + c.libelle + ' ?<br/><br/>Seront également supprimés : <b>' + elv.length + ' élève(s)</b> et <b>' + pa.length + ' paiement(s)</b> (' + fmt(total) + ' FCFA), ainsi que les tarifs de la classe.<br/><br/>Cette action est irréversible.'
      : 'Supprimer la classe ' + c.libelle + ' ?<br/>Ses tarifs seront également supprimés.';
    if (!await confirm('Supprimer la classe ' + c.libelle + ' ?', msg, 'Supprimer définitivement', true)) return;
    try { const r = M.deleteClasse(c.id, true); toast('Classe supprimée' + (r.nEl ? ' avec ' + r.nEl + ' élève(s)' : '') + '.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <Search value={q} onChange={v => { setQ(v); setPage(0); }} placeholder="Rechercher une classe…" style={{ width:240 }}/>
        <Select value={niveauF} onChange={v => { setNiveauF(v); setPage(0); }}
          options={[{ value:'all', label:'Tous les niveaux' }, ...niveauxSorted(db).map(nv => ({ value:nv.id, label:nv.libelle }))]}/>
        <span style={{ flex:1 }}/>
<PrintListeBtn titre="Classes de l'établissement"
          colonnes={['Classe','Niveau','Titulaire','Effectif actif','Capacité']}
          lignes={classesSorted(db).map(c => [c.libelle, (niveauById(db, c.niveauId) || {}).libelle || '', titNom(c) || '—',
            db.eleves.filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut === 'actif').length,
            c.capacite])}/>
        <CsvBtn filename="classes.csv"
          header={['Classe','Niveau','Capacité','Effectif actif','Effectif total','Titulaire']}
          rows={classesSorted(db).map(c => [c.libelle, (niveauById(db, c.niveauId) || {}).libelle || '', c.capacite,
            db.eleves.filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut === 'actif').length,
            db.eleves.filter(e => e.anneeId === anneeId && e.classeId === c.id).length,
            titNom(c) || ''])}/>
                {canW && <button className="btn btn-pri" onClick={() => openModal(<ClasseFormModal/>)}><Ic name="plus"/> Nouvelle classe</button>}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th>Classe</th><th>Niveau</th><th>Titulaire</th><th className="num">Inscrits</th><th className="num">Capacité</th><th>Remplissage</th>
            {canW && <th></th>}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="center mut" style={{ padding:22 }}>Aucune classe trouvée.</td></tr>}
            {rows.map(c => {
              const a = ag.perClasse[c.id] || { effectif:0 };
              const fill = c.capacite ? Math.min(100, a.effectif/c.capacite*100) : 0;
              return (
                <tr key={c.id}>
                  <td className="bld">{c.libelle}</td>
                  <td>{(niveauById(db, c.niveauId) || {}).libelle || '—'}</td>
                  <td>{titNom(c) || <span className="mut">—</span>}</td>
                  <td className="num">{fmt(a.effectif)}</td>
                  <td className="num mut">{fmt(c.capacite)}</td>
                  <td style={{ minWidth:130 }}>
                    <Bar pct={fill} cls={fill > 95 ? 'r' : ''}/>
                    <span style={{ fontSize:'10.5px', color:'var(--faint)' }}>{pctTxt(fill)} de remplissage</span>
                  </td>
                  {canW && (
                    <td className="rowacts">
                      <button className="icon-btn" title="Situation des frais (imprimable)" onClick={() => openModal(<ReportModal title={'Situation de classe — ' + c.libelle}><ClassSituationReport classId={c.id}/></ReportModal>)}><Ic name="printer"/></button>
                      <button className="icon-btn" title="Exporter cette classe en CSV" onClick={() => openModal(<CsvExportModal filename={'classe_' + c.libelle + '.csv'}
                        header={['Matricule','Nom','Prénom','Sexe','Tuteur','Téléphone','Statut','Net à payer (FCFA)','Payé (FCFA)','Solde (FCFA)']}
                        rows={db.eleves.filter(e => e.anneeId === anneeId && e.classeId === c.id).map(e => {
                          const t = situationTotals(db, e);
                          return [e.matricule, e.nom, e.prenom, e.sexe, e.tuteur || '', e.tel || '', e.statut, t.net, t.paye, t.solde];
                        })}/>)}><Ic name="download"/></button>
                      <button className="icon-btn" title="Modifier" onClick={() => openModal(<ClasseFormModal initial={c}/>)}><Ic name="pencil"/></button>
                      <button className="icon-btn danger" title="Supprimer" onClick={() => del(c)}><Ic name="trash"/></button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager page={page} total={list.length} per={15} onPage={setPage}/>
      </div>
    </>
  );
}
