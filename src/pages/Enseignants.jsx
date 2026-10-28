import React, { useState } from 'react';
import { Badge, Avatar, EmptyState, Search, Select, Pager, usePage, Kpi , CsvBtn, ImportBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';
import { classesSorted } from '../core/business.js';
import { EnseignantFormModal, EnseignementsDeModal } from '../components/modals/EntityForms.jsx';

/* ---------- Page Enseignants (Pédagogie) — corps enseignant ---------- */
export default function Enseignants(){
  const { db, can, M, openModal, toast, confirm } = useApp();
  const canW = can('enseignants', true);
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('');

  const ens = (db.enseignants || []).slice().sort((a,b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : (a.prenom < b.prenom ? -1 : 1)));
  const classes = classesSorted(db);
  const clsOf = id => classes.find(c => c.id === id);

  const filtres = ens.filter(t => {
    if (statut && t.statut !== statut) return false;
    if (!q) return true;
    const hay = [t.matricule, t.nom, t.prenom, t.specialite, t.telephone, t.email, t.grade, t.diplome]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const [page, setPage, pageRows] = usePage(filtres, 14);

  const nbEnseignements = id => (db.plan || []).filter(e => e.enseignantId === id).length;
  const nbClasses = id => new Set((db.plan || []).filter(e => e.enseignantId === id).map(e => e.classeId)).size;
  const nbHeures = id => (db.plan || []).filter(e => e.enseignantId === id).reduce((t, e) => t + (e.coefficient || 0), 0);

  const supprimer = async t => {
    const n = nbEnseignements(t.id);
    const ok = await confirm(`Supprimer la fiche de ${t.nom} ${t.prenom} ?`,
      n ? `Ses ${n} enseignement(s) seront retirés du plan.` : 'Cette action est définitive.', 'Supprimer', true);
    if (!ok) return;
    try { M.deleteEnseignant(t.id); toast('Fiche supprimée.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };

  const actifs = ens.filter(t => t.statut !== 'inactif').length;

  return (
    <>
      <div className="kpis">
        <Kpi icon="user" val={String(ens.length)} label="Enseignants" sub="Corps enseignant enregistré" color="var(--navy-700)"/>
        <Kpi icon="check" val={String(actifs)} label="En activité" sub="Fiches actives" color="var(--ok)" bg="var(--ok-bg)"/>
        <Kpi icon="grid" val={String((db.plan || []).length)} label="Enseignements" sub="Toutes classes (plan)" color="var(--gold-600)" bg="var(--gold-100)"/>
        <Kpi icon="classroom" val={String(new Set((db.plan || []).filter(e => e.enseignantId).map(e => e.classeId)).size)} label="Classes couvertes" sub="Ayant un enseignant affecté" color="var(--bad)" bg="var(--bad-bg)"/>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h">
          <h3>Enseignants de l'établissement</h3>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <PrintListeBtn titre="Enseignants de l'établissement" sous={ens.length + ' enseignant(s)'}
              colonnes={['Matricule','Nom','Prénom','Spécialité','Téléphone','Statut']}
              lignes={ens.map(t => [t.matricule || '—', t.nom, t.prenom, t.specialite || '—', t.telephone || '—', t.statut === 'inactif' ? 'Inactif' : 'Actif'])}/>
            <CsvBtn filename="enseignants.csv" header={['Matricule','Nom','Prénom','Spécialité','Téléphone','Statut']}
              rows={ens.map(t => [t.matricule || '—', t.nom, t.prenom, t.specialite || '—', t.telephone || '—', t.statut === 'inactif' ? 'Inactif' : 'Actif'])}/>
            {canW && <ImportBtn label="Importer" onRows={(h, rows) => {
              const ix = n => h.findIndex(x => x.toLowerCase().includes(n));
              const iN = ix('nom'), iP = ix('prénom') >= 0 ? ix('prénom') : ix('prenom');
              let ok = 0, ko = 0;
              rows.forEach(r => {
                try {
                  if (iN < 0 || iP < 0 || !r[iN] || !r[iP]) throw new Error('colonnes « nom » et « prénom » requises');
                  M.saveEnseignant({ nom:r[iN], prenom:r[iP],
                    telephone:(ix('tél') >= 0 ? r[ix('tél')] : '') || (ix('tel') >= 0 ? r[ix('tel')] : ''),
                    email:ix('mail') >= 0 ? r[ix('mail')] : '',
                    specialite:ix('spéc') >= 0 ? r[ix('spéc')] : (ix('spec') >= 0 ? r[ix('spec')] : '') });
                  ok++;
                } catch(e){ ko++; }
              });
              return { ok, ko };
            }}/>}
            {canW && <button className="btn btn-pri btn-sm" onClick={() => openModal(<EnseignantFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouvel enseignant</button>}
          </div>
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
            <Search value={q} onChange={setQ} placeholder="Rechercher : nom, matricule, spécialité, téléphone…"/>
            <Select value={statut} onChange={setStatut} options={[
              { value:'', label:'Tous les statuts' },
              { value:'actif', label:'En activité' },
              { value:'inactif', label:'Inactifs' } ]}/>
          </div>

          {filtres.length ? (
            <>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>
                    <th style={{ width:56 }}></th>
                    <th>Nom et prénom</th>
                    <th style={{ width:105 }}>Matricule</th>
                    <th>Spécialité</th>
                    <th>Contact</th>
                    <th className="num">Enseignements</th>
                    <th className="num">Classes</th>
                    <th className="num">Coef. total</th>
                    <th style={{ width:130 }}></th>
                  </tr></thead>
                  <tbody>
                    {pageRows.map(t => (
                      <tr key={t.id} className={t.statut === 'inactif' ? 'cancel' : ''}>
                        <td><Avatar name={(t.prenom || '') + ' ' + (t.nom || '')}/></td>
                        <td>
                          <b>{t.nom} {t.prenom}</b>
                          {t.statut === 'inactif' && <Badge cls="b-mut">inactif</Badge>}
                          <div className="mut" style={{ fontSize:10.5 }}>{t.grade || '—'} · {t.diplome || '—'}</div>
                        </td>
                        <td>{t.matricule || <span className="mut">—</span>}</td>
                        <td>{t.specialite || <span className="mut">—</span>}</td>
                        <td>
                          <div>{t.telephone || '—'}</div>
                          <div className="mut" style={{ fontSize:10.5 }}>{t.email || ''}</div>
                        </td>
                        <td className="num">{nbEnseignements(t.id) || <span className="mut">—</span>}</td>
                        <td className="num">{nbClasses(t.id) || <span className="mut">—</span>}</td>
                        <td className="num">{nbHeures(t.id) ? 'coef. ' + nbHeures(t.id) : <span className="mut">—</span>}</td>
                        <td className="acts">
                          <button className="icon-btn" title="Enseignements dispensés"
                            onClick={() => openModal(<EnseignementsDeModal enseignant={t} onClose={() => {}}/>)}><Ic name="book"/></button>
                          {canW && <>
                            <button className="icon-btn" title="Modifier" onClick={() => openModal(<EnseignantFormModal initial={t} onClose={() => {}}/>)}><Ic name="pencil"/></button>
                            <button className="icon-btn" title="Supprimer" onClick={() => supprimer(t)}><Ic name="trash"/></button>
                          </>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} total={filtres.length} per={14} onPage={setPage}/>
            </>
          ) : (
            <EmptyState icon="user" title="Aucun enseignant"
              text={canW ? 'Enregistrez le corps enseignant pour ensuite bâtir le plan des enseignements.' : 'Aucune fiche ne correspond à la recherche.'}>
              {canW && <button className="btn btn-pri" onClick={() => openModal(<EnseignantFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouvel enseignant</button>}
            </EmptyState>
          )}
        </div>
      </div>
    </>
  );
}
