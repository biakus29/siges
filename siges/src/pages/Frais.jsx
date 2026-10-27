import React from 'react';
import { Badge, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fraisSorted, tarifEffectif, yearById, tranchesOfFrais } from '../core/business.js';
import { fmt } from '../core/utils.js';
import { FraisFormModal } from '../components/modals/EntityForms.jsx';

export default function Frais(){
  const { db, anneeId, can, openModal, confirm, M, toast } = useApp();
  const canW = can('frais', true);
  const an = yearById(db, anneeId);

  const del = async f => {
    const pa = db.paiements.filter(p => p.fraisId === f.id);
    const nBo = db.bourses.filter(b => b.fraisId === f.id).length;
    const total = pa.reduce((s3, p) => s3 + (p.statut === 'valide' ? p.montant : 0), 0);
    const msg = pa.length
      ? 'Supprimer <b>définitivement</b> le frais « ' + f.libelle + ' » ?<br/><br/>' +
        '<b>' + pa.length + ' paiement(s)</b> (' + fmt(total) + ' FCFA) enregistrés sur ce frais seront <b>supprimés</b>, ' +
        'ainsi que ' + (nBo ? nBo + ' bourse(s) et ' : '') + 'ses montants de grille tarifaire.<br/><br/>' +
        'Cette action est irréversible et ne peut être annulée.'
      : 'Supprimer le frais « ' + f.libelle + ' » ?<br/>' + (nBo ? nBo + ' bourse(s) associée(s) et ' : '') +
        'ses montants de grille tarifaire seront également supprimés.';
    if (!await confirm('Supprimer le type de frais ' + f.code + ' ?', msg, 'Supprimer définitivement', true)) return;
    try {
      const r = M.deleteFrais(f.id, true);
      toast('Type de frais ' + f.code + ' supprimé' + (r.nPa ? ' avec ' + r.nPa + ' paiement(s)' : '') + '.', 'ok');
    }
    catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="info"/> Les montants de chaque frais sont définis dans la <b>&nbsp;grille tarifaire</b>.</span>
        <span style={{ flex:1 }}/>
        <CsvBtn filename="types_de_frais.csv"
          header={['Code','Libellé','Catégorie','Périodicité','Obligatoire','Tranches (part % / échéance)']}
          rows={db.frais.slice().sort((a,b) => a.ordre - b.ordre).map(f => [f.code, f.libelle, f.categorie, f.periodicite,
            f.obligatoire ? 'Oui' : 'Non', tranchesOfFrais(db, f.id).map(t => t.label + ' : ' + t.pourcentage + ' % le ' + t.jour + '/' + t.mois).join(' | ')])}/>
        {canW && <button className="btn btn-pri" onClick={() => openModal(<FraisFormModal/>)}><Ic name="plus"/> Nouveau type de frais</button>}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th>Code</th><th>Libellé</th><th>Catégorie</th><th>Périodicité</th><th>Caractère</th>
            <th className="num">Classes tarifées ({an ? an.libelle : ''})</th>
            {canW && <th></th>}
          </tr></thead>
          <tbody>
            {fraisSorted(db).map(f => {
              let nb = 0;
              db.classes.forEach(c => { if (tarifEffectif(db, anneeId, f.id, c.id) != null) nb++; });
              return (
                <tr key={f.id}>
                  <td><Badge cls="b-navy">{f.code}</Badge></td>
                  <td className="bld">{f.libelle}</td>
                  <td><Badge cls="b-mut">{f.categorie}</Badge></td>
                  <td>{f.periodicite}</td>
                  <td>{f.obligatoire ? <Badge cls="b-bad">Obligatoire</Badge> : <Badge cls="b-info">Optionnel</Badge>}</td>
                  <td className="num">{nb} / {db.classes.length}</td>
                  {canW && (
                    <td className="rowacts">
                      <button className="icon-btn" title="Modifier" onClick={() => openModal(<FraisFormModal initial={f}/>)}><Ic name="pencil"/></button>
                      <button className="icon-btn danger" title="Supprimer" onClick={() => del(f)}><Ic name="trash"/></button>
                    </td>
                  )}
                </tr>
              );
            })}
            {db.frais.length === 0 && <tr><td colSpan={7} className="center mut" style={{ padding:22 }}>Aucun type de frais défini.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
