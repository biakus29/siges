import React, { useMemo, useState } from 'react';
import { Badge, EmptyState, Search, Select, Pager, usePage, Modal, Kpi, CsvBtn } from '../components/UI.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { classesSorted, eleveById, classById, DISCIPLINE_CATS, GRAVITE_LABEL, absencesDe, sanctionAbsencesFor, sanctionsAbsOf, trimestreOfDate, faitsDe } from '../core/business.js';
import { todayISO } from '../core/utils.js';

/* ---------- Formulaire fait disciplinaire ---------- */
export function FaitFormModal({ initial, classeImposee }){
  const { closeModal } = useApp();   /* fermeture via le contexte — aucune prop requise */
  const { db, anneeId, M, toast, scope } = useApp();
  const classes = useMemo(() => {
    const all = classesSorted(db).filter(c => (db.eleves || []).some(e => e.anneeId === anneeId && e.classeId === c.id));
    const sc = scope.classesIds;
    return (sc ? all.filter(c => sc.includes(c.id)) : all);
  }, [db, anneeId, scope.classesIds]);
  const [f, setF] = useState(initial
    ? { classeId:initial.classeId, eleveId:initial.eleveId, categorie:initial.categorie, gravite:String(initial.gravite), description:initial.description, sanction:initial.sanction, date:initial.date, justifie:!!initial.justifie, duree:initial.duree || 1 }
    : { classeId:classeImposee || (classes[0] ? classes[0].id : ''), eleveId:'', categorie:'retard', gravite:'1', description:'', sanction:'', date:todayISO(), justifie:false, duree:1 });
  const [err, setErr] = useState('');
  const upd = (k, v) => setF(o => ({ ...o, [k]:v }));
  const eleves = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === f.classeId && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1));

  const submit = e => {
    e.preventDefault();
    try {
      M.saveFait({ ...f, id: initial ? initial.id : null, gravite:parseInt(f.gravite, 10),
        ...(f.categorie === 'absence' ? { duree:parseInt(f.duree, 10) || 1 } : {}) });
      toast('Fait disciplinaire enregistré.', 'ok');
      closeModal();
    } catch(err2){ setErr(String(err2.message || err2)); }
  };

  return (
    <Modal title={initial ? 'Modifier le fait' : 'Nouveau fait disciplinaire'} icon="shield" onClose={closeModal}>
      {err && <div className="lc-err show" style={{ marginBottom:12 }}><Ic name="alert"/><span>{err}</span></div>}
      <form onSubmit={submit}>
        <div className="inp"><label className="req" htmlFor="ff-dclasse">Classe</label>
          <div className="inp-box">
            <select id="ff-dclasse" className="sel" value={f.classeId} onChange={e => upd('classeId', e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </div></div>
        <div className="inp"><label className="req" htmlFor="ff-deleve">Élève</label>
          <div className="inp-box">
            <select id="ff-deleve" className="sel" value={f.eleveId} onChange={e => upd('eleveId', e.target.value)}>
              <option value="">— Choisir l'élève —</option>
              {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.matricule})</option>)}
            </select>
          </div></div>
        <div className="inp"><label className="req" htmlFor="ff-dcat">Catégorie</label>
          <div className="inp-box">
            <select id="ff-dcat" className="sel" value={f.categorie} onChange={e => upd('categorie', e.target.value)}>
              {Object.entries(DISCIPLINE_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div></div>
        <div className="inp"><label className="req" htmlFor="ff-dgrav">Gravité</label>
          <div className="inp-box">
            <select id="ff-dgrav" className="sel" value={f.gravite} onChange={e => upd('gravite', e.target.value)}>
              {[1,2,3].map(g => <option key={g} value={String(g)}>{GRAVITE_LABEL[g]}</option>)}
            </select>
          </div></div>
        <div className="inp"><label className="req" htmlFor="ff-ddate">Date</label>
          <div className="inp-box"><input id="ff-ddate" type="date" value={f.date} onChange={e => upd('date', e.target.value)}/></div></div>
        {f.categorie === 'absence' && (
          <>
          <div className="inp"><label htmlFor="ff-dduree">Durée (heures)</label>
            <div className="inp-box"><input id="ff-dduree" type="number" min="1" max="60" value={f.duree} onChange={e => upd('duree', e.target.value)}/></div></div>
          <div className="inp"><label htmlFor="ff-djust">Justification</label>
            <div className="inp-box">
              <label className="chk" style={{ display:'inline-flex', gap:7, cursor:'pointer', padding:'7px 0' }}>
                <input id="ff-djust" type="checkbox" checked={!!f.justifie} onChange={e => upd('justifie', e.target.checked)}/>
                <span>Absence justifiée (certificat médical, motif valable…)</span>
              </label>
            </div></div>
          </>
        )}
        <div className="inp"><label className="req" htmlFor="ff-ddesc">Description du fait</label>
          <div className="inp-box"><textarea id="ff-ddesc" className="ta" value={f.description} onChange={e => upd('description', e.target.value)} rows={3} maxLength={400} placeholder="Ex : bavardages répétés en cours de mathématiques"/></div></div>
        <div className="inp"><label htmlFor="ff-dsan">Sanction prononcée</label>
          <div className="inp-box"><input id="ff-dsan" value={f.sanction} onChange={e => upd('sanction', e.target.value)} maxLength={200} placeholder="Ex : avertissement oral, 2 h de retenue…"/></div></div>
        <div className="m-foot">
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Annuler</button>
          <button type="submit" className="btn btn-pri"><Ic name="check"/> Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Page Discipline ---------- */
import { BilanDisciplineReport, ReportModal } from '../components/Reports.jsx';

/* ---------- v5.5 : formulaire d'absence (saisie par classe et période) ---------- */
export function AbsenceFormModal({ initial = null, classeImposee = '', dateImposee = null }){
  const { db, anneeId, M, toast, closeModal, scope } = useApp();
  const classes = useMemo(() => {
    const all = classesSorted(db).filter(c => (db.eleves || []).some(e => e.anneeId === anneeId && e.classeId === c.id));
    const sc = scope.classesIds;
    return (sc ? all.filter(c => sc.includes(c.id)) : all);
  }, [db, anneeId, scope.classesIds]);
  const el0 = initial ? (db.eleves || []).find(e => e.id === initial.eleveId) : null;
  const [f, setF] = useState({
    classeId: initial ? (el0 ? el0.classeId : '') : (classeImposee || (classes[0] ? classes[0].id : '')),
    eleveId: initial ? initial.eleveId : '',
    date: initial ? initial.date : (dateImposee || todayISO()),
    duree: initial && initial.duree ? String(initial.duree) : '1',
    description: initial ? initial.description : '',
    justifie: !!(initial && initial.justifie)
  });
  const [err, setErr] = useState('');
  const upd = (k, v) => setF(o => ({ ...o, [k]:v, ...(k === 'classeId' ? { eleveId:'' } : {}) }));
  const eleves = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === f.classeId && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1));
  const periodeTxt = f.date ? 'Trimestre ' + trimestreOfDate(f.date) : '—';

  const submit = e => {
    e.preventDefault();
    try {
      M.saveFait({ id: initial ? initial.id : null, eleveId:f.eleveId, categorie:'absence',
        gravite:f.justifie ? 1 : 2, description:f.description, sanction:'', date:f.date,
        duree:parseInt(f.duree, 10) || 1, justifie:!!f.justifie });
      toast((initial ? 'Absence modifiée' : 'Absence enregistrée') + ' — ' + periodeTxt + '.', 'ok');
      closeModal();
    } catch(err2){ setErr(String(err2.message || err2)); }
  };

  return (
    <Modal title={initial ? "Modifier l'absence" : "Saisir une absence"} icon="calendar-x" onClose={closeModal}>
      {err && <div className="lc-err show" style={{ marginBottom:12 }}><Ic name="alert"/><span>{err}</span></div>}
      <form onSubmit={submit}>
        <div className="inp"><label className="req" htmlFor="ab-classe">Classe</label>
          <div className="inp-box">
            <select id="ab-classe" className="sel" value={f.classeId} onChange={e => upd('classeId', e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </div></div>
        <div className="inp"><label className="req" htmlFor="ab-eleve">Élève</label>
          <div className="inp-box">
            <select id="ab-eleve" className="sel" value={f.eleveId} onChange={e => upd('eleveId', e.target.value)}>
              <option value="">— Choisir l'élève —</option>
              {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.matricule})</option>)}
            </select>
          </div></div>
        <div className="frow">
          <div className="inp"><label className="req" htmlFor="ab-date">Date de l'absence</label>
            <div className="inp-box"><input id="ab-date" type="date" value={f.date} onChange={e => upd('date', e.target.value)}/></div>
            <span className="hint">Période déduite de la date : {periodeTxt} (T1 : sept.–déc. • T2 : janv.–mars • T3 : avr.–août).</span>
          </div>
          <div className="inp"><label className="req" htmlFor="ab-duree">Durée (heures)</label>
            <div className="inp-box"><input id="ab-duree" type="number" min="1" max="60" value={f.duree} onChange={e => upd('duree', e.target.value)}/></div>
          </div>
        </div>
        <div className="inp"><label className="req" htmlFor="ab-motif">Motif</label>
          <div className="inp-box"><textarea id="ab-motif" className="ta" rows={2} maxLength={400} value={f.description}
            onChange={e => upd('description', e.target.value)} placeholder="Ex : maladie, voyage familial, absence non motivée…"/></div></div>
        <div className="inp"><label htmlFor="ab-just">Justification</label>
          <div className="inp-box">
            <label className="chk" style={{ display:'inline-flex', gap:7, cursor:'pointer', padding:'7px 0' }}>
              <input id="ab-just" type="checkbox" checked={!!f.justifie} onChange={e => upd('justifie', e.target.checked)}/>
              <span>Absence justifiée (certificat médical, motif valable…)</span>
            </label>
          </div></div>
        <div className="m-foot">
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Annuler</button>
          <button type="submit" className="btn btn-pri"><Ic name="check"/> Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Onglet 1 : faits de discipline (contenu historique) ---------- */
function FaitsPanel(){
  const { db, anneeId, can, M, openModal, toast, confirm, scope } = useApp();
  const canW = can('discipline', true);
  const [q, setQ] = useState('');
  const [classeId, setClasseId] = useState('');
  const [cat, setCat] = useState('');
  const [grav, setGrav] = useState('');
  const sc = scope.classesIds;
  const faits = (db.discipline || []).filter(f => f.anneeId === anneeId
      && (!sc || sc.includes(f.classeId))
      && (!classeId || f.classeId === classeId)
      && (!cat || f.categorie === cat)
      && (!grav || String(f.gravite) === grav))
    .filter(f => {
      if (!q.trim()) return true;
      const el = eleveById(db, f.eleveId) || {};
      const t = ((el.nom || '') + ' ' + (el.prenom || '') + ' ' + f.description + ' ' + (f.sanction || '')).toLowerCase();
      return t.includes(q.trim().toLowerCase());
    })
    .sort((a,b) => (a.date < b.date ? 1 : -1));

  const mois = faits.filter(f => f.date.slice(0,7) === todayISO().slice(0,7));
  const graves = faits.filter(f => f.gravite === 3);
  const elevesConcernes = new Set(faits.map(f => f.eleveId)).size;
  const classes = classesSorted(db).filter(c => (db.eleves || []).some(e => e.anneeId === anneeId && e.classeId === c.id));
  const [page, setPage, pageRows] = usePage(faits, 20);

  const supprimer = async f => {
    const el = eleveById(db, f.eleveId) || {};
    const ok = await confirm(`Supprimer ce fait disciplinaire (${el.nom} ${el.prenom} — ${f.description.slice(0, 50)}…) ?`,
      'Cette entrée sera retirée de l\u2019historique de discipline.', 'Supprimer', true);
    if (!ok) return;
    try { M.deleteFait(f.id); toast('Fait supprimé.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };

  return (
    <>
      <div className="kpis">
        <Kpi icon="shield" val={String(faits.length)} label="Faits enregistrés" sub="Année en cours" bg="c-navy"/>
        <Kpi icon="alert" val={String(mois.length)} label="Ce mois-ci" bg="c-gold"/>
        <Kpi icon="flag" val={String(graves.length)} label="Faits graves" sub="Gravité 3" bg="c-bad"/>
        <Kpi icon="users" val={String(elevesConcernes)} label="Élèves concernés" bg="c-ok"/>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h">
          <h3>Faits de discipline</h3>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <PrintListeBtn titre="Faits de discipline" sous={pageRows.length + ' fait(s) affiché(s)'}
              colonnes={['Date','Élève','Catégorie','Gravité','Motif']}
              lignes={pageRows.map(f => { const el = eleveById(db, f.eleveId) || {};
                return [f.date, (el.nom || '—') + ' ' + (el.prenom || ''), DISCIPLINE_CATS[f.categorie] || f.categorie,
                  GRAVITE_LABEL['g' + f.gravite] || String(f.gravite), f.description]; })}/>
            <CsvBtn filename="faits_discipline.csv"
              header={['Date','Élève','Classe','Catégorie','Gravité','Motif','Sanction']}
              rows={faits.map(f => { const el = eleveById(db, f.eleveId) || {}; const cl2 = classById(db, f.classeId) || {};
                return [f.date, (el.nom || '—') + ' ' + (el.prenom || ''), cl2.libelle || '', DISCIPLINE_CATS[f.categorie] || f.categorie,
                  GRAVITE_LABEL['g' + f.gravite] || String(f.gravite), f.description, f.sanction || '']; })}/>
            {canW && <button className="btn btn-pri btn-sm" onClick={() => openModal(<FaitFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouveau fait</button>}
          </div>
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
            <Search value={q} onChange={setQ} placeholder="Rechercher un élève, un motif…" style={{ flex:'1 1 200px' }}/>
            <Select value={classeId} onChange={setClasseId} style={{ flex:'0 0 150px' }}
              options={[{ value:'', label:'Toutes les classes' }].concat((sc ? classes.filter(c => sc.includes(c.id)) : classes).map(c => ({ value:c.id, label:c.libelle })))}/>
            <Select value={cat} onChange={setCat} style={{ flex:'0 0 150px' }}
              options={[{ value:'', label:'Toutes catégories' }].concat(Object.entries(DISCIPLINE_CATS).map(([k, v]) => ({ value:k, label:v })))}/>
            <Select value={grav} onChange={setGrav} style={{ flex:'0 0 130px' }}
              options={[{ value:'', label:'Toute gravité' }, { value:'1', label:'Léger' }, { value:'2', label:'Moyen' }, { value:'3', label:'Grave' }]}/>
          </div>
        </div>
        <div className="card-b" style={{ padding:0 }}>
          {!faits.length ? (
            <div style={{ padding:22 }}>
              <EmptyState icon="shield" title="Aucun fait de discipline" text={canW ? 'Aucun événement ne correspond aux filtres — tout est calme.' : 'Aucun événement dans votre périmètre.'}/>
            </div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th style={{ width:90 }}>Date</th><th style={{ minWidth:150 }}>Élève</th><th>Classe</th>
                <th>Catégorie</th><th style={{ width:70, textAlign:'center' }}>Gravité</th>
                <th style={{ minWidth:200 }}>Description</th><th>Sanction</th>
                {canW && <th style={{ width:90 }}></th>}
              </tr></thead>
              <tbody>
                {pageRows.map(f => {
                  const el = eleveById(db, f.eleveId) || {};
                  const cl = classById(db, f.classeId) || {};
                  return (
                    <tr key={f.id}>
                      <td className="mut">{f.date.slice(8,10) + '/' + f.date.slice(5,7) + '/' + f.date.slice(0,4)}</td>
                      <td><b>{el.nom || '—'}</b> {el.prenom || ''}</td>
                      <td>{cl.libelle || '—'}</td>
                      <td><Badge>{DISCIPLINE_CATS[f.categorie] || f.categorie}</Badge></td>
                      <td style={{ textAlign:'center' }}>
                        <Badge cls={f.gravite === 3 ? 'bad' : (f.gravite === 2 ? 'warn' : '')}>{GRAVITE_LABEL[f.gravite] || f.gravite}</Badge>
                      </td>
                      <td>{f.description}{f.categorie === 'absence' && f.duree ? <span className="mut"> ({f.duree} h)</span> : null}</td>
                      <td className="mut">{f.sanction || '—'}</td>
                      {canW && (
                        <td className="acts">
                          <button className="icon-btn" title="Modifier" onClick={() => openModal(<FaitFormModal initial={f} onClose={() => {}}/>)}><Ic name="pencil"/></button>
                          <button className="icon-btn" title="Supprimer" onClick={() => supprimer(f)}><Ic name="trash"/></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {faits.length > 20 && <div className="card-b" style={{ paddingTop:10 }}><Pager page={page + 1} total={faits.length} per={20} onPage={p => setPage(p - 1)}/></div>}
      </div>
    </>
  );
}

/* ---------- Onglet 2 : absences par classe et par période (v5.5) ---------- */
function AbsencesPanel(){
  const { db, anneeId, can, M, openModal, toast, confirm, scope } = useApp();
  const canW = can('discipline', true);
  const classes = useMemo(() => {
    const all = classesSorted(db).filter(c => (db.eleves || []).some(e => e.anneeId === anneeId && e.classeId === c.id));
    const sc = scope.classesIds;
    return (sc ? all.filter(c => sc.includes(c.id)) : all);
  }, [db, anneeId, scope.classesIds]);
  const [classeId, setClasseId] = useState(classes[0] ? classes[0].id : '');
  const [periode, setPeriode] = useState('');
  /* v5.6 : saisie par classe (grille, comme les notes) */
  const [dateSel, setDateSel] = useState(todayISO());
  const [drafts, setDrafts] = useState({});   /* { justifie, motif } par élève, avant création */
  const cl = classes.find(c => c.id === classeId) || classes[0];
  const cid = cl ? cl.id : '';
  const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === cid && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1));
  const rows = els.map(el => {
    const a = absencesDe(db, anneeId, el.id, periode);
    return { el, ...a, sanction: sanctionAbsencesFor(db, a.nonJust) };
  });
  const totJ = rows.reduce((t, r) => t + r.just, 0);
  const totNJ = rows.reduce((t, r) => t + r.nonJust, 0);
  const absences = (db.discipline || []).filter(f => f.anneeId === anneeId && f.classeId === cid && f.categorie === 'absence'
      && (!periode || trimestreOfDate(f.date) === parseInt(periode[1], 10)))
    .sort((a,b) => (a.date < b.date ? 1 : -1));

  /* ---------- v5.6 : saisie par classe, comme la saisie des notes ---------- */
  const editable = canW && !!cid && scope.canClasse(cid);
  const absDuJour = el => (db.discipline || []).find(f => f.anneeId === anneeId && f.classeId === cid
    && f.categorie === 'absence' && f.eleveId === el.id && f.date === dateSel);
  const enregistrer = (el, abs, patch) => {
    const d = drafts[el.id] || {};
    const justifie = patch.justifie !== undefined ? patch.justifie : (abs ? !!abs.justifie : !!d.justifie);
    const description = patch.description !== undefined ? patch.description : (abs ? abs.description : (d.motif || ''));
    const duree = patch.duree !== undefined ? patch.duree : (abs ? abs.duree : 1);
    try {
      M.saveFait({ id: abs ? abs.id : null, eleveId: el.id, categorie: 'absence',
        gravite: justifie ? 1 : 2,
        description: String(description || '').trim() || (justifie ? 'Absence justifiée' : 'Absence non justifiée'),
        sanction: abs ? (abs.sanction || '') : '', date: dateSel, duree, justifie });
      return true;
    } catch(e){ toast(String(e.message || e), 'err'); return false; }
  };
  const supprimerDuJour = async el => {
    const abs = absDuJour(el);
    if (!abs) return;
    if (!await confirm('Supprimer cette absence ?', el.nom + ' ' + el.prenom + ' — ' + abs.date
      + ' (' + (abs.duree || 1) + ' heure(s)).', 'Supprimer', true)) return;
    try { M.deleteFait(abs.id); toast('Absence supprimée.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };
  /* navigation clavier : Entrée / flèches entre les durées (comme les notes) */
  const navClavier = e => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll('.abs-in')];
    const ix = inputs.indexOf(e.target);
    if (ix < 0) return;
    const cible = e.key === 'ArrowUp' ? inputs[ix - 1] : inputs[ix + 1];
    try { e.target.dispatchEvent(new Event('focusout', { bubbles:true })); } catch(_){}
    e.target.blur();
    if (cible){ cible.focus(); try { cible.select(); } catch(_){} }
  };
  const duJour = els.map(el => absDuJour(el)).filter(Boolean);
  const jourJ = duJour.filter(f => f.justifie).reduce((t, f) => t + (f.duree || 1), 0);
  const jourNJ = duJour.filter(f => !f.justifie).reduce((t, f) => t + (f.duree || 1), 0);

  const supprimer = async f => {
    const el = eleveById(db, f.eleveId) || {};
    if (!await confirm("Supprimer cette absence ?", (el.nom || '') + ' ' + (el.prenom || '') + ' — ' + f.date
      + ' (' + (f.duree || 1) + ' heure(s), ' + (f.justifie ? 'justifiée' : 'non justifiée') + ').', 'Supprimer', true)) return;
    try { M.deleteFait(f.id); toast('Absence supprimée.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };

  return (
    <>
      <div className="kpis">
        <Kpi icon="calendar-x" val={String(absences.length)} label="Absences saisies" sub={periode === '' ? 'Année complète' : 'Trimestre ' + periode[1]} bg="c-navy"/>
        <Kpi icon="check" val={String(totJ)} label="Heures justifiées" bg="c-ok"/>
        <Kpi icon="alert" val={String(totNJ)} label="Heures non justifiées" bg="c-bad"/>
        <Kpi icon="gavel" val={String(rows.filter(r => r.sanction).length)} label="Élèves sanctionnables" sub="Selon les plages d’heures NJ" bg="c-gold"/>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h">
          <h3>Saisie des absences — {cl ? cl.libelle : ''}</h3>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <span className="chip"><Ic name="calendar-x"/> {duJour.length} absent(s) ce jour</span>
            {duJour.length > 0 && <span className="chip"><b>{jourJ + jourNJ}</b> h — {jourJ} J / {jourNJ} NJ</span>}
          </div>
        </div>
        <div className="card-b">
          <div className="form-grid">
            <label>Classe
              <Select value={cid} onChange={setClasseId}
                options={classes.map(c => ({ value:c.id, label:c.libelle }))}/>
            </label>
            <label>Date de l&apos;absence
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="date" value={dateSel} onChange={e => setDateSel(e.target.value)}
                  style={{ flex:1 }} aria-label="Date de l'absence"/>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDateSel(todayISO())}>
                  <Ic name="calendar"/> Aujourd&apos;hui
                </button>
              </div>
            </label>
          </div>
          <span className="hint" style={{ display:'block', marginTop:6 }}>
            Saisie par classe, comme les notes : indiquez la durée (heures) sur la ligne de chaque élève absent —
            Entrée ou flèches pour passer d&apos;un élève à l&apos;autre. La période est déduite de la date
            (jour sélectionné : <b>Trimestre {trimestreOfDate(dateSel || todayISO())}</b>). Laissez vide un élève présent.
          </span>
        </div>
        <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
          {!els.length ? (
            <div style={{ padding:22 }}><EmptyState icon="users" title="Aucun élève" text="Choisissez une classe."/></div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th style={{ width:42, textAlign:'center' }}>N°</th><th>Élève</th><th style={{ width:86 }}>Matricule</th>
                <th style={{ width:110, textAlign:'center' }}>Durée (h)</th>
                <th style={{ width:90, textAlign:'center' }}>Justifiée</th>
                <th>Motif</th>
                <th style={{ width:130 }}>Cumul {periode ? '· T' + periode[1] : '· année'}</th>
                {editable && <th style={{ width:56 }}></th>}
              </tr></thead>
              <tbody>
                {els.map((el, i) => {
                  const abs = absDuJour(el);
                  const d = drafts[el.id] || {};
                  const cumul = absencesDe(db, anneeId, el.id, periode);
                  return (
                    <tr key={el.id} className={abs && !abs.justifie ? 'row-bad' : ''}>
                      <td style={{ textAlign:'center' }} className="mut">{i + 1}</td>
                      <td><b>{el.nom}</b> {el.prenom}</td>
                      <td className="mut">{el.matricule}</td>
                      <td style={{ textAlign:'center' }}>
                        <input className="note-in abs-in" type="number" min="1" max="60" inputMode="numeric"
                          key={el.id + '|' + dateSel + '|' + (abs ? abs.id + 'v' + (abs.duree || 1) + 'j' + (abs.justifie ? 1 : 0) + 'm' + abs.description : 'x')}
                          defaultValue={abs ? String(abs.duree || 1) : ''} disabled={!editable}
                          placeholder="—" aria-label={'Durée d’absence — ' + el.nom + ' ' + el.prenom}
                          onBlur={e => {
                            const v = parseInt(e.target.value, 10);
                            if (!(v >= 1)){ e.target.value = abs ? String(abs.duree || 1) : ''; return; }
                            if (!abs || v !== (abs.duree || 1)) enregistrer(el, abs, { duree: v });
                          }}
                          onKeyDown={navClavier}/>
                      </td>
                      <td style={{ textAlign:'center' }}>
                        <input type="checkbox" checked={abs ? !!abs.justifie : !!d.justifie} disabled={!editable}
                          aria-label={'Absence justifiée — ' + el.nom + ' ' + el.prenom}
                          onChange={e => {
                            if (abs) enregistrer(el, abs, { justifie: e.target.checked });
                            else setDrafts(o => ({ ...o, [el.id]: { ...(o[el.id] || {}), justifie: e.target.checked } }));
                          }}/>
                      </td>
                      <td>
                        <input className="cell-in" type="text" maxLength={400}
                          key={el.id + '|' + dateSel + '|m|' + (abs ? abs.id + abs.description : (d.motif || ''))}
                          defaultValue={abs ? abs.description : (d.motif || '')} disabled={!editable}
                          placeholder="Ex : maladie, voyage familial…"
                          aria-label={'Motif — ' + el.nom + ' ' + el.prenom}
                          onBlur={e => {
                            const v = e.target.value;
                            if (abs){ if (v !== abs.description) enregistrer(el, abs, { description: v }); }
                            else setDrafts(o => ({ ...o, [el.id]: { ...(o[el.id] || {}), motif: v } }));
                          }}/>
                      </td>
                      <td>{cumul.total
                        ? <span><b>{cumul.total}</b> h <span className="mut">({cumul.just} J / {cumul.nonJust} NJ)</span></span>
                        : <span className="mut">—</span>}</td>
                      {editable && (
                        <td className="acts">
                          {abs && <button className="icon-btn" title="Supprimer l'absence de ce jour"
                            onClick={() => supprimerDuJour(el)}><Ic name="trash"/></button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {duJour.length > 0 && (
                <tfoot><tr>
                  <td colSpan={3}><b>JOURNÉE DU {dateSel}</b></td>
                  <td style={{ textAlign:'center' }}><b>{jourJ + jourNJ}</b></td>
                  <td style={{ textAlign:'center' }}><b>{jourJ} / {jourNJ}</b></td>
                  <td className="mut">Trimestre {trimestreOfDate(dateSel)}</td>
                  <td><b>{duJour.length} absent(s)</b></td>
                  {editable && <td></td>}
                </tr></tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h">
          <h3>Synthèse par élève — {cl ? cl.libelle : ''}</h3>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <CsvBtn filename={'absences_' + (cl ? cl.libelle : 'classe') + '.csv'}
              header={['Élève','Justifiées (h)','Non justifiées (h)','Total (h)','Sanction']}
              rows={rows.map(r => [r.el.nom + ' ' + r.el.prenom, r.just, r.nonJust, r.total, r.sanction || ''])}/>
            {canW && <button className="btn btn-ghost btn-sm" onClick={() => openModal(<AbsenceFormModal classeImposee={cid}/>)}><Ic name="plus"/> Saisie individuelle</button>}
          </div>
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <Select value={cid} onChange={setClasseId} style={{ flex:'1 1 200px' }}
              options={classes.map(c => ({ value:c.id, label:c.libelle }))}/>
            <Select value={periode} onChange={setPeriode} style={{ flex:'0 0 190px' }}
              options={[{ value:'', label:'Année complète' }, { value:'T1', label:'Trimestre 1' }, { value:'T2', label:'Trimestre 2' }, { value:'T3', label:'Trimestre 3' }]}/>
          </div>
          <span className="hint" style={{ display:'block', marginTop:6 }}>
            Sanctions automatiques selon les plages d'absences non justifiées (Personnalisation des états → Discipline) :
            {' ' + sanctionsAbsOf(db).map(x => x.min + '–' + (x.max >= 999 ? x.max + '+' : x.max) + ' : ' + x.sanction).join(' • ')}
          </span>
        </div>
        <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
          {!rows.length ? (
            <div style={{ padding:22 }}><EmptyState icon="calendar-x" title="Aucun élève" text="Choisissez une classe."/></div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>Élève</th>
                <th style={{ textAlign:'center' }}>Justifiées (h)</th><th style={{ textAlign:'center' }}>Non justifiées (h)</th>
                <th style={{ textAlign:'center' }}>Total</th><th>Sanction applicable</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.el.id} className={r.nonJust >= 3 ? 'row-bad' : ''}>
                    <td><b>{r.el.nom}</b> {r.el.prenom}</td>
                    <td style={{ textAlign:'center' }}>{r.just || '—'}</td>
                    <td style={{ textAlign:'center' }}>{r.nonJust ? <b>{r.nonJust}</b> : '—'}</td>
                    <td style={{ textAlign:'center' }}>{r.total || '—'}</td>
                    <td>{r.sanction ? <Badge cls="b-bad">{r.sanction}</Badge> : <span className="mut">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td><b>TOTAUX</b></td>
                <td style={{ textAlign:'center' }}><b>{totJ}</b></td>
                <td style={{ textAlign:'center' }}><b>{totNJ}</b></td>
                <td style={{ textAlign:'center' }}><b>{totJ + totNJ}</b></td>
                <td></td>
              </tr></tfoot>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h"><h3>Journal des absences — {cl ? cl.libelle : ''} {periode ? '· Trimestre ' + periode[1] : '· Année'}</h3></div>
        <div className="card-b" style={{ padding:0 }}>
          {!absences.length ? (
            <div style={{ padding:22 }}><EmptyState icon="calendar" title="Aucune absence" text="Aucune absence saisie pour cette classe et cette période."/></div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th style={{ width:96 }}>Date</th><th>Élève</th><th style={{ width:90, textAlign:'center' }}>Durée</th>
                <th>Motif</th><th style={{ width:110 }}>Justifiée</th>
                {canW && <th style={{ width:90 }}></th>}
              </tr></thead>
              <tbody>
                {absences.map(f => {
                  const el = eleveById(db, f.eleveId) || {};
                  return (
                    <tr key={f.id}>
                      <td className="mut">{f.date.slice(8,10) + '/' + f.date.slice(5,7) + '/' + f.date.slice(0,4)} <span className="mut">· T{trimestreOfDate(f.date)}</span></td>
                      <td><b>{el.nom || '—'}</b> {el.prenom || ''}</td>
                      <td style={{ textAlign:'center' }}>{f.duree || 1} h</td>
                      <td>{f.description}</td>
                      <td>{f.justifie ? <Badge cls="b-ok">Justifiée</Badge> : <Badge cls="b-bad">Non justifiée</Badge>}</td>
                      {canW && (
                        <td className="acts">
                          <button className="icon-btn" title="Modifier" onClick={() => openModal(<AbsenceFormModal initial={f}/>)}><Ic name="pencil"/></button>
                          <button className="icon-btn" title="Supprimer" onClick={() => supprimer(f)}><Ic name="trash"/></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Onglet 3 : bilans disciplinaires (par élève, classe, année) ---------- */
function BilansPanel(){
  const { db, anneeId, openModal, scope } = useApp();
  const classes = useMemo(() => {
    const all = classesSorted(db).filter(c => (db.eleves || []).some(e => e.anneeId === anneeId && e.classeId === c.id));
    const sc = scope.classesIds;
    return (sc ? all.filter(c => sc.includes(c.id)) : all);
  }, [db, anneeId, scope.classesIds]);
  const [classeId, setClasseId] = useState(classes[0] ? classes[0].id : '');
  const cl = classes.find(c => c.id === classeId) || classes[0];
  const cid = cl ? cl.id : '';
  const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === cid && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1));
  const rows = els.map(el => {
    const t = [1, 2, 3].map(k => absencesDe(db, anneeId, el.id, 'T' + k));
    const annee = absencesDe(db, anneeId, el.id, '');
    return { el, t, annee, autres: faitsDe(db, anneeId, el.id).filter(f => f.categorie !== 'absence').length,
      sanction: sanctionAbsencesFor(db, annee.nonJust) };
  });

  return (
    <div className="card">
      <div className="card-h">
        <h3>Bilans disciplinaires — {cl ? cl.libelle : ''}</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => openModal(
          <ReportModal title={'Bilan disciplinaire — ' + (cl ? cl.libelle : '')}>
            <BilanDisciplineReport classeId={cid}/>
          </ReportModal>)}><Ic name="printer"/> Imprimer le bilan annuel</button>
      </div>
      <div className="card-b">
        <Select value={cid} onChange={setClasseId} style={{ flex:'0 0 220px' }}
          options={classes.map(c => ({ value:c.id, label:c.libelle }))}/>
        <span className="hint" style={{ display:'block', marginTop:6 }}>
          Synthèse par trimestre et pour l'année — absences en heures, autres faits de discipline et sanction issue des plages d'absences non justifiées.
        </span>
      </div>
      <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
        {!rows.length ? (
          <div style={{ padding:22 }}><EmptyState icon="shield" title="Aucun élève" text="Choisissez une classe."/></div>
        ) : (
          <table className="tbl">
            <thead><tr>
              <th>Élève</th>
              <th colSpan={2} style={{ textAlign:'center' }}>Trimestre 1</th>
              <th colSpan={2} style={{ textAlign:'center' }}>Trimestre 2</th>
              <th colSpan={2} style={{ textAlign:'center' }}>Trimestre 3</th>
              <th colSpan={2} style={{ textAlign:'center' }}>Année</th>
              <th style={{ textAlign:'center' }}>Autres faits</th><th>Sanction</th>
            </tr>
            <tr>
              <th></th>
              {[0, 1, 2].map(k => <React.Fragment key={'h' + k}><th style={{ textAlign:'center', fontWeight:400 }}>J</th><th style={{ textAlign:'center', fontWeight:400 }}>NJ</th></React.Fragment>)}
              <th style={{ textAlign:'center', fontWeight:400 }}>J</th><th style={{ textAlign:'center', fontWeight:400 }}>NJ</th>
              <th></th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.el.id} className={r.annee.nonJust >= 3 ? 'row-bad' : ''}>
                  <td><b>{r.el.nom}</b> {r.el.prenom}</td>
                  {r.t.map((a, k) => <React.Fragment key={k}><td style={{ textAlign:'center' }}>{a.just || '—'}</td><td style={{ textAlign:'center' }}>{a.nonJust || '—'}</td></React.Fragment>)}
                  <td style={{ textAlign:'center' }}>{r.annee.just || '—'}</td>
                  <td style={{ textAlign:'center' }}>{r.annee.nonJust ? <b>{r.annee.nonJust}</b> : '—'}</td>
                  <td style={{ textAlign:'center' }}>{r.autres || '—'}</td>
                  <td>{r.sanction ? <Badge cls="b-bad">{r.sanction}</Badge> : <span className="mut">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------- Page Discipline : 3 onglets (v5.5) ---------- */
export default function Discipline(){
  const [tab, setTab] = useState('faits');
  const tabs = [
    ['faits', 'Faits de discipline'],
    ['absences', 'Absences'],
    ['bilans', 'Bilans & sanctions']
  ];
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Sections de discipline" style={{ marginBottom:14 }}>
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')}
            onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'faits' && <FaitsPanel/>}
      {tab === 'absences' && <AbsencesPanel/>}
      {tab === 'bilans' && <BilansPanel/>}
    </>
  );
}
