import React, { useState } from 'react';
import { Badge, EmptyState, Search, Select, CsvBtn, ImportBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/UI.jsx';
import { GroupeFormModal, MatiereFormModal, EnseignantsDeMatiereModal } from '../components/modals/EntityForms.jsx';
import { groupesOfMatiere } from '../core/business.js';
import { PrintListeBtn } from '../components/Reports.jsx';

/* ---------- Page Matières & groupes (Pédagogie) ---------- */
export default function Matieres(){
  const { db, can, M, openModal, toast, confirm, scope } = useApp();
  const canW = can('matieres', true);
  const [onglet, setOnglet] = useState('matieres');
  const [q, setQ] = useState('');

  const groupes = (db.groupes || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
  const matieres = (db.matieres || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
  /* l'enseignant ne voit que ses matières */
  const visibles = scope.matieresIds ? matieres.filter(m => scope.matieresIds.includes(m.id)) : matieres;

  const grpOf = id => (db.groupes || []).find(g => g.id === id) || null;
  const nbNotes = id => (db.notes || []).filter(n => n.matiereId === id).length;
  const nbPlan = id => (db.plan || []).filter(e => e.matiereId === id).length;

  const filtres = visibles.filter(m => {
    if (!q) return true;
    const t = (m.code + ' ' + m.libelle).toLowerCase();
    return t.includes(q.trim().toLowerCase());
  });

  const supprimerMatiere = async m => {
    const n = nbNotes(m.id), p = nbPlan(m.id);
    const ok = await confirm(`Supprimer la matière « ${m.libelle} » ?`,
      (n || p ? `Les ${n} note(s) et ${p} enseignement(s) du plan associés seront également supprimés.` : 'Cette action est définitive.'),
      'Supprimer', true);
    if (!ok) return;
    try { M.deleteMatiere(m.id); toast('Matière supprimée.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };
  const supprimerGroupe = async g => {
    const ok = await confirm(`Supprimer le groupe « ${g.libelle} » ?`,
      'Les enseignements du plan qui utilisent ce groupe devront être réaffectés au préalable.', 'Supprimer', true);
    if (!ok) return;
    try { M.deleteGroupe(g.id); toast('Groupe supprimé.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:12 }}>
        <div className="tabs" role="tablist" aria-label="Sections matières">
          <button role="tab" aria-selected={onglet === 'matieres'} className={'tab' + (onglet === 'matieres' ? ' on' : '')}
            onClick={() => setOnglet('matieres')}><Ic name="book"/> Matières <span className="mut">({visibles.length})</span></button>
          <button role="tab" aria-selected={onglet === 'groupes'} className={'tab' + (onglet === 'groupes' ? ' on' : '')}
            onClick={() => setOnglet('groupes')}><Ic name="layers"/> Groupes de matières <span className="mut">({groupes.length})</span></button>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {onglet === 'matieres' && <>
            <PrintListeBtn titre="Catalogue des matières" sous={filtres.length + ' matière(s)'}
              colonnes={['Code','Libellé']} lignes={filtres.map(m => [m.code, m.libelle])}/>
            <CsvBtn filename="matieres.csv" header={['Code','Libellé']}
              rows={filtres.map(m => [m.code, m.libelle])}/>
            {canW && <ImportBtn label="Importer" onRows={(h, rows) => {
              const iC = h.findIndex(x => /code/i.test(x)), iL = h.findIndex(x => /libell/i.test(x));
              let ok = 0, ko = 0;
              rows.forEach(r => {
                try {
                  if (iC < 0 || iL < 0 || !r[iC] || !r[iL]) throw new Error('colonnes « code » et « libellé » requises');
                  M.saveMatiere({ code:r[iC], libelle:r[iL] }); ok++;
                } catch(e){ ko++; }
              });
              return { ok, ko };
            }}/>}
          </>}
          {canW && (
            <div style={{ display:'flex', gap:8 }}>
              {onglet === 'groupes'
                ? <button className="btn btn-pri" onClick={() => openModal(<GroupeFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouveau groupe</button>
                : <button className="btn btn-pri" onClick={() => openModal(<MatiereFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouvelle matière</button>}
            </div>
          )}
        </div>
      </div>

      {onglet === 'groupes' ? (
        <div className="card">
          <div className="card-h"><h3>Groupes de matières</h3>
            <span className="mut" style={{ fontSize:11.5 }}>Familles de disciplines (littéraires, scientifiques, techniques…)</span></div>
          <div className="card-b" style={{ padding:0 }}>
            {groupes.length ? (
              <table className="tbl">
                <thead><tr>
                  <th style={{ width:100 }}>Code</th><th>Libellé</th>
                  <th className="num">Matières</th><th className="num">Coefficients cumulés (plans)</th>
                  {canW && <th style={{ width:90 }}></th>}
                </tr></thead>
                <tbody>
                  {groupes.map(g => {
                    const ms = [...new Set((db.plan || []).filter(e => e.groupeId === g.id).map(e => e.matiereId))];
                    const coefs = (db.plan || []).filter(e => e.groupeId === g.id).reduce((t, e) => t + (e.coefficient || 0), 0);
                    return (
                      <tr key={g.id}>
                        <td><b>{g.code}</b></td>
                        <td>{g.libelle}</td>
                        <td className="num">{ms.length}</td>
                        <td className="num"><Badge cls="b-gold">{coefs ? 'coef. ' + coefs : '—'}</Badge></td>
                        {canW && (
                          <td className="acts">
                            <button className="icon-btn" title="Modifier" onClick={() => openModal(<GroupeFormModal initial={g} onClose={() => {}}/>)}><Ic name="pencil"/></button>
                            <button className="icon-btn" title="Supprimer" onClick={() => supprimerGroupe(g)}><Ic name="trash"/></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="card-b"><EmptyState icon="layers" title="Aucun groupe"
                text={canW ? 'Créez les familles de matières (littéraires, scientifiques, techniques…).' : 'Aucun groupe défini.'}>
                {canW && <button className="btn btn-pri" onClick={() => openModal(<GroupeFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouveau groupe</button>}
              </EmptyState></div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
            <Search value={q} onChange={setQ} placeholder="Rechercher un code, un libellé…"/>
            <span className="mut" style={{ fontSize:11.5, alignSelf:'center' }}>
              Le groupe et le coefficient de chaque matière sont attribués par classe, dans le plan des enseignements.
            </span>
          </div>
          <div className="card">
            <div className="card-h"><h3>Catalogue des matières <span className="mut">({filtres.length}{filtres.length !== visibles.length ? ' / ' + visibles.length : ''})</span></h3></div>
            <div className="card-b" style={{ padding:0 }}>
              {filtres.length ? (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr>
                      <th style={{ width:84 }}>Code</th><th>Libellé</th><th>Groupes (plans)</th>
                      <th className="num">Enseignants</th><th className="num">Classes</th><th className="num">Notes saisies</th>
                      <th style={{ width:120 }}></th>
                    </tr></thead>
                    <tbody>
                      {filtres.map(m => (
                        <tr key={m.id}>
                          <td><b>{m.code}</b></td>
                          <td>{m.libelle}</td>
                          <td>{(() => { const gs = groupesOfMatiere(db, m.id);
                              return gs.length ? gs.map(g => <Badge key={g.id} cls="b-gold">{g.code}</Badge>) : <span className="mut">—</span>; })()}</td>
                          <td className="num">{[...new Set((db.plan || []).filter(e => e.matiereId === m.id && e.enseignantId).map(e => e.enseignantId))].length || <span className="mut">—</span>}</td>
                          <td className="num">{[...new Set((db.plan || []).filter(e => e.matiereId === m.id).map(e => e.classeId))].length || <span className="mut">—</span>}</td>
                          <td className="num">{nbNotes(m.id) || <span className="mut">—</span>}</td>
                          <td className="acts">
                            <button className="icon-btn" title="Enseignants qui dispensent cette matière"
                              onClick={() => openModal(<EnseignantsDeMatiereModal matiere={m} onClose={() => {}}/>)}><Ic name="user"/></button>
                            {canW && <>
                              <button className="icon-btn" title="Modifier" onClick={() => openModal(<MatiereFormModal initial={m} onClose={() => {}}/>)}><Ic name="pencil"/></button>
                              <button className="icon-btn" title="Supprimer" onClick={() => supprimerMatiere(m)}><Ic name="trash"/></button>
                            </>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card-b"><EmptyState icon="book" title="Aucune matière"
                  text={canW ? 'Créez les matières enseignées pour alimenter le plan et la saisie des notes.' : 'Aucune matière ne correspond.'}>
                  {canW && <button className="btn btn-pri" onClick={() => openModal(<MatiereFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouvelle matière</button>}
                </EmptyState></div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
