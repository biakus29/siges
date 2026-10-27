import React, { useState } from 'react';
import { Badge, Avatar, EmptyState, Search, Select, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, norm } from '../core/utils.js';
import { yearById, classById, eleveById, fraisById, boursesOfYear, bourseValeur } from '../core/business.js';
import { BourseFormModal } from '../components/modals/EntityForms.jsx';

export default function Bourses(){
  const { db, anneeId, can, openModal, confirm, M, toast, users } = useApp();
  const an = yearById(db, anneeId);
  const [q, setQ] = useState('');
  const [statutF, setStatutF] = useState('all');
  const canW = can('bourses', true);

  if (!an) return <EmptyState icon="calendar" title="Aucune année" text="Sélectionnez une année scolaire."/>;

  const all = boursesOfYear(db, anneeId);
  const list = all.filter(b => {
    const el = eleveById(db, b.eleveId);
    if (statutF !== 'all' && ((b.actif !== false) !== (statutF === 'actif'))) return false;
    if (q){
      const hay = el ? (el.nom + ' ' + el.prenom + ' ' + el.matricule) : '';
      if (norm(hay).indexOf(norm(q)) < 0 && norm(b.motif || '').indexOf(norm(q)) < 0) return false;
    }
    return true;
  });
  const valeurTotale = all.filter(b => b.actif !== false).reduce((s, b) => s + bourseValeur(db, b), 0);

  const del = async b => {
    if (!await confirm('Supprimer cette bourse ?', 'Motif : ' + (b.motif || b.motiv) + '. Les situations de l&apos;élève seront recalculées sans cette réduction.', 'Supprimer', true)) return;
    try { M.deleteBourse(b.id); toast('Bourse supprimée — situations recalculées.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };
  const toggle = b => {
    try { M.toggleBourse(b.id); toast('Bourse ' + (b.actif !== false ? 'suspendue' : 'réactivée') + '.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="coins"/> Bourses actives : <b>&nbsp;{fmt(all.filter(b => b.actif !== false).length)}</b></span>
        <span className="chip"><Ic name="bank"/> Valeur estimée : <b>&nbsp;{fmt(valeurTotale)} FCFA</b></span>
        <span className="chip"><Ic name="info"/> Déduites automatiquement des « nets à payer »</span>
        <span style={{ flex:1 }}/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <Search value={q} onChange={setQ} placeholder="Élève, matricule ou motif…" style={{ width:250 }}/>
        <Select value={statutF} onChange={setStatutF}
          options={[{ value:'all', label:'Tous statuts' }, { value:'actif', label:'Actives' }, { value:'suspendu', label:'Suspendues' }]}/>
        <span style={{ flex:1 }}/>
        <CsvBtn filename={'bourses_' + an.libelle + '.csv'}
          header={['Élève','Matricule','Classe','Portée','Nature','Valeur estimée (FCFA)','Motif','Statut','Date']}
          rows={list.map(b => {
            const el = eleveById(db, b.eleveId);
            const c = el ? classById(db, el.classeId) : null;
            const fr = b.fraisId ? fraisById(db, b.fraisId) : null;
            return [el ? el.nom + ' ' + el.prenom : '', el ? el.matricule : '', c ? c.libelle : '',
              fr ? fr.libelle : 'Tous les frais', b.pourcentage ? b.pourcentage + ' %' : 'Montant fixe',
              bourseValeur(db, b), b.motif || '', b.actif !== false ? 'Active' : 'Suspendue', (b.date || '').slice(0, 10)];
          })}/>
        {canW && <button className="btn btn-pri" onClick={() => openModal(<BourseFormModal/>)}><Ic name="plus"/> Accorder une bourse / réduction</button>}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th>Élève</th><th>Portée</th><th>Nature</th><th className="num">Valeur estimée (FCFA)</th><th>Motif</th><th>Statut</th><th>Par</th>
            {canW && <th></th>}
          </tr></thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={canW ? 8 : 7} className="center mut" style={{ padding:22 }}>
                Aucune bourse ou réduction {q || statutF !== 'all' ? 'pour ces critères' : 'accordée pour ' + an.libelle}.
              </td></tr>
            )}
            {list.map(b => {
              const el = eleveById(db, b.eleveId);
              const cl = el ? classById(db, el.classeId) : null;
              const f = b.fraisId ? fraisById(db, b.fraisId) : null;
              const actif = b.actif !== false;
              return (
                <tr key={b.id} style={actif ? undefined : { opacity:.55 }}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar name={el ? el.nom + ' ' + el.prenom : '?'} sm/>
                      <div>
                        <b>{el ? el.nom + ' ' + el.prenom : '— élève supprimé —'}</b>
                        <br/><span className="mut" style={{ fontSize:11 }}>{el ? el.matricule + ' • ' + (cl ? cl.libelle : '—') : ''}</span>
                      </div>
                    </div>
                  </td>
                  <td>{f ? f.libelle : <Badge cls="b-navy">Tous les frais</Badge>}</td>
                  <td>{b.pourcentage
                    ? <Badge cls="b-gold">{b.pourcentage} %</Badge>
                    : <Badge cls="b-info">{fmt(b.montant)} FCFA</Badge>}</td>
                  <td className="num bld">{actif ? fmt(bourseValeur(db, b)) : '—'}</td>
                  <td className="mut" style={{ maxWidth:220 }}>{b.motif}</td>
                  <td>{actif ? <Badge cls="b-ok">Active</Badge> : <Badge cls="b-mut">Suspendue</Badge>}</td>
                  <td className="mut nowrap">{(() => { const u = (users || []).find(x => x.username === b.createdBy); return u ? u.nom : (b.createdBy || '—'); })()}</td>
                  {canW && (
                    <td className="rowacts">
                      <button className="icon-btn" title="Modifier" onClick={() => openModal(<BourseFormModal initial={b}/>)}><Ic name="pencil"/></button>
                      <button className="icon-btn" title={actif ? 'Suspendre' : 'Réactiver'} onClick={() => toggle(b)}>
                        <Ic name={actif ? 'ban' : 'refresh'}/>
                      </button>
                      <button className="icon-btn danger" title="Supprimer" onClick={() => del(b)}><Ic name="trash"/></button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop:16 }}>
        <div className="card-h"><h3><Ic name="info"/> Fonctionnement des bourses &amp; réductions</h3></div>
        <div className="card-b" style={{ fontSize:'12.3px', color:'var(--muted)', lineHeight:1.7 }}>
          • Une bourse peut porter sur <b>tous les frais</b> ou sur un <b>frais précis</b> (ex : exonération d&apos;animation).<br/>
          • Deux natures : <b>pourcentage</b> du tarif (1 à 100 %) ou <b>montant fixe</b> en FCFA, cumulables pour un même élève (plafonnées au tarif).<br/>
          • Les montants « nets à payer », situations, agrégats et rapports tiennent automatiquement compte des bourses <b>actives</b>.
        </div>
      </div>
    </>
  );
}
