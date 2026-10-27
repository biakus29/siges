import React from 'react';
import { Badge, CsvBtn } from '../components/UI.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt } from '../core/utils.js';
import { niveauxSorted, classesOf, yearById, yearAggregates, censeursOf } from '../core/business.js';

import { NiveauFormModal } from '../components/modals/EntityForms.jsx';

export default function Niveaux(){
  const { db, users, anneeId, can, openModal, confirm, M, toast } = useApp();
  const canW = can('niveaux', true);
  const an = yearById(db, anneeId);
  const ag = yearAggregates(db, anneeId);

  const del = async nv => {
    const cls = db.classes.filter(c => c.niveauId === nv.id);
    const elv = db.eleves.filter(e => cls.some(c => c.id === e.classeId));
    const pa = db.paiements.filter(p => elv.some(e => e.id === p.eleveId));
    const total = pa.reduce((s, p) => s + (p.statut === 'valide' ? p.montant : 0), 0);
    const msg = cls.length
      ? 'Supprimer <b>définitivement</b> le niveau ' + nv.libelle + ' ?<br/><br/>Seront également supprimés : <b>' + cls.length + ' classe(s)</b>, <b>' + elv.length + ' élève(s)</b> et <b>' + pa.length + ' paiement(s)</b> (' + fmt(total) + ' FCFA), ainsi que les grilles tarifaires associées.<br/><br/>Cette action est irréversible.'
      : 'Supprimer le niveau ' + nv.libelle + ' ?<br/>Ses tarifs (toutes années) seront également supprimés.';
    if (!await confirm('Supprimer le niveau ' + nv.libelle + ' ?', msg, 'Supprimer définitivement', true)) return;
    try { const r = M.deleteNiveau(nv.id, true); toast('Niveau supprimé' + (r.nCls ? ' avec ' + r.nCls + ' classe(s), ' + r.nEl + ' élève(s)' : '') + '.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="info"/> Un niveau regroupe plusieurs classes (ex : Sixième → 6ème A, 6ème B) et porte la grille tarifaire par défaut.</span>
        <span style={{ flex:1 }}/>
        <PrintListeBtn titre="Niveaux de l'établissement"
          colonnes={['Code','Niveau','Cycle','Classes','Censeur']}
          lignes={db.niveaux.slice().sort((a,b) => a.ordre - b.ordre).map(n => [n.code, n.libelle, n.cycle,
            db.classes.filter(c => c.niveauId === n.id).length,
            censeursOf(db, users).filter(u => (u.niveauxIds || []).includes(n.id)).map(u => u.nom).join(', ') || '—'])}/>
        <CsvBtn filename="niveaux.csv"
          header={['Code','Niveau','Cycle','Ordre','Classes','Censeur']}
          rows={db.niveaux.slice().sort((a,b) => a.ordre - b.ordre).map(n => [n.code, n.libelle, n.cycle, n.ordre, db.classes.filter(c => c.niveauId === n.id).length,
            censeursOf(db, users).filter(u => (u.niveauxIds || []).includes(n.id)).map(u => u.nom).join(', ')])}/>
        {canW && <button className="btn btn-pri" onClick={() => openModal(<NiveauFormModal/>)}><Ic name="plus"/> Nouveau niveau</button>}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th style={{ width:46, textAlign:'center' }}>N°</th><th>Code</th><th>Libellé</th><th>Cycle</th>
            <th>Censeur</th><th>Classes</th><th className="num">Nb classes</th><th className="num">Effectif {an ? an.libelle : ''}</th>
            {canW && <th></th>}
          </tr></thead>
          <tbody>
            {niveauxSorted(db).map(nv => {
              const cls = classesOf(db, nv.id);
              let effectif = 0;
              cls.forEach(c => { const a = ag.perClasse[c.id]; if (a) effectif += a.effectif; });
              return (
                <tr key={nv.id}>
                  <td className="center mut">{nv.ordre}</td>
                  <td><Badge cls="b-navy">{nv.code}</Badge></td>
                  <td className="bld">{nv.libelle}</td>
                  <td><Badge cls={nv.cycle === 'Collège' ? 'b-info' : (nv.cycle === 'Lycée' ? 'b-gold' : 'b-mut')}>{nv.cycle}</Badge></td>
                  <td>{censeursOf(db, users).filter(u => (u.niveauxIds || []).includes(nv.id)).map(u => u.nom).join(', ') || <span className="mut">—</span>}</td>
                  <td>{cls.length ? cls.map(c => c.libelle).join(' · ') : <span className="mut">—</span>}</td>
                  <td className="num">{cls.length}</td>
                  <td className="num bld">{fmt(effectif)}</td>
                  {canW && (
                    <td className="rowacts">
                      <button className="icon-btn" title="Modifier" onClick={() => openModal(<NiveauFormModal initial={nv}/>)}><Ic name="pencil"/></button>
                      <button className="icon-btn danger" title="Supprimer" onClick={() => del(nv)}><Ic name="trash"/></button>
                    </td>
                  )}
                </tr>
              );
            })}
            {db.niveaux.length === 0 && <tr><td colSpan={8} className="center mut" style={{ padding:22 }}>Aucun niveau défini.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
