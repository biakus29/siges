import React, { useState } from 'react';
import { Badge, EmptyState, Select } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, fmtD, todayISO } from '../core/utils.js';
import { yearById, classesSorted, fraisSorted, tarifEffectif, tranchesOfFrais, trancheISO } from '../core/business.js';
import { ReportModal, ClassSituationReport, RecoveryReport, CaisseReport, SolvabiliteReport,
         EleveSituationReport, RecoveryByFraisReport, RecoveryByTrancheReport,
         ListeClasseReport, StatsGenreClassesReport, StatsAgesReport } from '../components/Reports.jsx';

export default function Rapports(){
  const { db, anneeId, openModal } = useApp();
  const an = yearById(db, anneeId);
  const [classId, setClassId] = useState('');
  const [listeClassId, setListeClassId] = useState('');
  const [solClassId, setSolClassId] = useState('');
  const [solMode, setSolMode] = useState('global');
  const [solFraisId, setSolFraisId] = useState('');
  const [solTrancheId, setSolTrancheId] = useState('');
  const [recMode, setRecMode] = useState('classe');
  const [caisseFrom, setCaisseFrom] = useState(todayISO());
  const [caisseTo, setCaisseTo] = useState(todayISO());
  const t = todayISO();
  const todayCount = db.paiements.filter(p => p.anneeId === anneeId && p.statut === 'valide' && p.date.slice(0,10) === t).length;

  if (!an) return <EmptyState icon="calendar" title="Aucune année" text="Sélectionnez une année scolaire."/>;
  const classes = classesSorted(db).filter(c => db.eleves.some(e => e.anneeId === anneeId && e.classeId === c.id));

  const open = which => {
    if (which === 'classe' && !classId) return;
    if (which === 'classe') openModal(<ReportModal title={'Situation de classe — ' + classLabel(classId)}><ClassSituationReport classId={classId}/></ReportModal>);
    else if (which === 'recouvrement'){
      if (recMode === 'frais') openModal(<ReportModal title={'Recouvrement par frais — ' + an.libelle}><RecoveryByFraisReport/></ReportModal>);
      else if (recMode === 'tranche') openModal(<ReportModal title={'Recouvrement par tranche — ' + an.libelle}><RecoveryByTrancheReport/></ReportModal>);
      else openModal(<ReportModal title={'État des recouvrements — ' + an.libelle}><RecoveryReport/></ReportModal>);
    }
    else if (which === 'solvabilite'){
      const fra = solFraisId ? fraisSorted(db).find(f => f.id === solFraisId) : null;
      const trs = fra ? tranchesOfFrais(db, fra.id) : [];
      const tr = trs.find(x => x.id === (solTrancheId || 't1')) || trs[0];
      let sub = 'global';
      if (solMode === 'frais' && fra) sub = fra.libelle;
      if (solMode === 'tranche' && fra && tr) sub = fra.code + ' ' + tr.label;
      openModal(<ReportModal title={'État de solvabilité — ' + classLabel(solClassId) + ' (' + sub + ')'}>
        <SolvabiliteReport classId={solClassId} mode={solMode} fraisId={solFraisId} trancheId={tr ? tr.id : ''}/>
      </ReportModal>);
    }
    else if (which === 'liste') openModal(<ReportModal title={'Liste nominative — ' + classLabel(listeClassId)}><ListeClasseReport classId={listeClassId}/></ReportModal>);
    else if (which === 'stats') openModal(<ReportModal title={'Statistiques des inscrits — ' + an.libelle}><StatsGenreClassesReport/></ReportModal>);
    else if (which === 'ages') openModal(<ReportModal title={'Répartition par âge — ' + an.libelle}><StatsAgesReport/></ReportModal>);
    else openModal(<ReportModal title={'Journal de caisse — ' + fmtD(caisseFrom) + (caisseTo !== caisseFrom ? ' → ' + fmtD(caisseTo) : '')}>
      <CaisseReport from={caisseFrom} to={caisseTo}/></ReportModal>);
  };
  const classLabel = id => { const c = db.classes.find(x => x.id === id); return c ? c.libelle : ''; };
  const solFraisOptions = solClassId
    ? fraisSorted(db).filter(f => tarifEffectif(db, anneeId, f.id, solClassId) != null)
        .map(f => ({ value:f.id, label:f.code + ' — ' + f.libelle }))
    : [];
  const solTrancheOptions = solFraisId
    ? tranchesOfFrais(db, solFraisId).map(tr => ({ value:tr.id, label:tr.label + ' — éch. ' + fmtD(trancheISO(an, tr)) }))
    : [];
  const solReady = solClassId && (solMode === 'global' || solFraisId) && (solMode !== 'tranche' || (solFraisId && (solTrancheId || solTrancheOptions.length)));

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="printer"/> Rapports officiels imprimables — en-tête établissement, totaux et blocs de signature</span>
      </div>

      <div className="year-grid">
        {/* Carte 1 : situation d'une classe */}
        <div className="ycard">
          <div className="yc-band"/>
          <div className="yc-b">
            <div className="yc-h"><h3>Situation d&apos;une classe</h3><Badge cls="b-navy">Par classe</Badge></div>
            <p style={{ fontSize:'12.3px', color:'var(--muted)', minHeight:56, lineHeight:1.6 }}>
              Liste des élèves avec net à payer (réductions déduites), montants payés, soldes restants et état de chaque élève.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
              <Select value={classId} onChange={setClassId} style={{ flex:1, minWidth:170 }}
                options={[{ value:'', label:'— Choisir une classe —' }, ...classes.map(c => ({ value:c.id, label:c.libelle }))]}/>
            </div>
            <div className="yc-acts">
              <button className="btn btn-pri btn-sm" disabled={!classId} onClick={() => open('classe')}>
                <Ic name="printer"/> Générer le rapport
              </button>
            </div>
          </div>
        </div>

        {/* Carte 2 : état des recouvrements */}
        <div className="ycard">
          <div className="yc-band"/>
          <div className="yc-b">
            <div className="yc-h"><h3>État des recouvrements</h3><Badge cls="b-gold">Année {an.libelle}</Badge></div>
            <p style={{ fontSize:'12.3px', color:'var(--muted)', minHeight:56, lineHeight:1.6 }}>
              Synthèse <b>par classe</b>, <b>par frais</b> ou <b>par tranche d&apos;échéance</b> : attendus, encaissés, restes à recouvrer et taux, avec totaux généraux.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
              <Select value={recMode} onChange={setRecMode} style={{ flex:1, minWidth:170 }}
                options={[{ value:'classe', label:'Par classe' }, { value:'frais', label:'Par frais' }, { value:'tranche', label:'Par tranche' }]}/>
            </div>
            <div className="yc-acts">
              <button className="btn btn-pri btn-sm" onClick={() => open('recouvrement')}>
                <Ic name="chart"/> Générer le rapport
              </button>
            </div>
          </div>
        </div>

        {/* Carte 3 : état de solvabilité d'une classe */}
        <div className="ycard">
          <div className="yc-band" style={{ background:'linear-gradient(90deg,#b3261e,#e07a56)' }}/>
          <div className="yc-b">
            <div className="yc-h"><h3>État de solvabilité</h3><Badge cls="b-bad">Insolvables</Badge></div>
            <p style={{ fontSize:'12.3px', color:'var(--muted)', minHeight:56, lineHeight:1.6 }}>
              Solvabilité d&apos;une classe <b>globalement</b>, <b>par frais particulier</b> ou <b>par tranche d&apos;échéance</b> — les insolvables sont signalés et chiffrés.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
              <Select value={solClassId} onChange={v => { setSolClassId(v); setSolFraisId(''); setSolTrancheId(''); }}
                style={{ flex:1, minWidth:150 }}
                options={[{ value:'', label:'— Choisir une classe —' }, ...classes.map(c => ({ value:c.id, label:c.libelle }))]}/>
              <Select value={solMode} onChange={setSolMode} style={{ minWidth:130 }}
                options={[{ value:'global', label:'Global' }, { value:'frais', label:'Par frais' }, { value:'tranche', label:'Par tranche' }]}/>
            </div>
            {solMode !== 'global' && solClassId && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                <Select value={solFraisId} onChange={v => { setSolFraisId(v); setSolTrancheId(''); }}
                  style={{ flex:1, minWidth:150 }}
                  options={[{ value:'', label:'— Choisir un frais —' }, ...solFraisOptions]}/>
                {solMode === 'tranche' && solFraisId && (
                  <Select value={solTrancheId || (solTrancheOptions[0] ? solTrancheOptions[0].value : '')}
                    onChange={setSolTrancheId} style={{ minWidth:150 }}
                    options={solTrancheOptions}/>
                )}
              </div>
            )}
            <div className="yc-acts">
              <button className="btn btn-pri btn-sm" disabled={!solReady} onClick={() => open('solvabilite')}>
                <Ic name="alert"/> Générer le rapport
              </button>
            </div>
          </div>
        </div>

        {/* Carte 4 : journal de caisse (période, caisse/banque, par frais) */}
        <div className="ycard">
          <div className="yc-band" style={{ background:'linear-gradient(90deg,#177a4c,#5aa17c)' }}/>
          <div className="yc-b">
            <div className="yc-h"><h3>Journal de caisse</h3><Badge cls={todayCount ? 'b-ok' : 'b-mut'}>{fmt(todayCount)} reçu(s) aujourd&apos;hui</Badge></div>
            <p style={{ fontSize:'12.3px', color:'var(--muted)', minHeight:56, lineHeight:1.6 }}>
              Encaissements sur une <b>période déterminée</b> : répartition <b>caisse</b> (espèces, mobile money) / <b>banque</b> (virement, chèque), récapitulatif <b>par frais</b> et détail des reçus.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
              <label className="chip" style={{ gap:6 }}>Du&nbsp;<input type="date" className="dt-inp" value={caisseFrom} onChange={e => setCaisseFrom(e.target.value)}/></label>
              <label className="chip" style={{ gap:6 }}>au&nbsp;<input type="date" className="dt-inp" value={caisseTo} onChange={e => setCaisseTo(e.target.value)}/></label>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {[['Aujourd\u2019hui', t, t],
                ['Ce mois-ci', t.slice(0, 8) + '01', t],
                ['Cette année', (db.annees.find(a => a.id === anneeId) || {}).debut || t, t]].map(([lbl, a, b], i) => (
                <button key={i} className="btn btn-ghost btn-sm" onClick={() => { setCaisseFrom(a); setCaisseTo(b); }}>{lbl}</button>
              ))}
            </div>
            <div className="yc-acts">
              <button className="btn btn-pri btn-sm" disabled={!caisseFrom || !caisseTo || caisseTo < caisseFrom} onClick={() => open('jour')}>
                <Ic name="receipt"/> Générer le rapport
              </button>
            </div>
          </div>
        </div>

        {/* Carte 5 : liste nominative d'une classe */}
        <div className="ycard">
          <div className="yc-band" style={{ background:'linear-gradient(90deg,#1f5fbf,#6f9bdf)' }}/>
          <div className="yc-b">
            <div className="yc-h"><h3>Listes des élèves</h3><Badge cls="b-navy">Nominative</Badge></div>
            <p style={{ fontSize:'12.3px', color:'var(--muted)', minHeight:56, lineHeight:1.6 }}>
              Liste nominative par classe : <b>N°, nom et prénoms, genre</b>, dans l&apos;ordre alphabétique — avec effectifs garçons / filles.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
              <Select value={listeClassId} onChange={setListeClassId} style={{ flex:1, minWidth:170 }}
                options={[{ value:'', label:'— Choisir une classe —' }, ...classes.map(c => ({ value:c.id, label:c.libelle }))]}/>
            </div>
            <div className="yc-acts">
              <button className="btn btn-pri btn-sm" disabled={!listeClassId} onClick={() => open('liste')}>
                <Ic name="printer"/> Générer la liste
              </button>
            </div>
          </div>
        </div>

        {/* Carte 6 : statistiques des inscrits (genre & classes) */}
        <div className="ycard">
          <div className="yc-band" style={{ background:'linear-gradient(90deg,#7c4dc4,#a98fd8)' }}/>
          <div className="yc-b">
            <div className="yc-h"><h3>Statistiques des inscrits</h3><Badge cls="b-gold">Genre & classes</Badge></div>
            <p style={{ fontSize:'12.3px', color:'var(--muted)', minHeight:56, lineHeight:1.6 }}>
              Effectifs <b>par genre</b> et <b>par classe</b> : garçons, filles, pourcentage de filles, internes et externes, avec totaux.
            </p>
            <div className="yc-acts" style={{ marginTop:12 }}>
              <button className="btn btn-pri btn-sm" onClick={() => open('stats')}>
                <Ic name="chart"/> Générer les statistiques
              </button>
            </div>
          </div>
        </div>

        {/* Carte 7 : répartition par âge */}
        <div className="ycard">
          <div className="yc-band" style={{ background:'linear-gradient(90deg,#0e8a8a,#5cb8b8)' }}/>
          <div className="yc-b">
            <div className="yc-h"><h3>Répartition par âge</h3><Badge cls="b-navy">Par classe</Badge></div>
            <p style={{ fontSize:'12.3px', color:'var(--muted)', minHeight:56, lineHeight:1.6 }}>
              <b>Tranches d&apos;âge</b> (10 ans et moins … 19 ans et plus) <b>réparties par classe</b>, âge moyen et effectifs totaux.
            </p>
            <div className="yc-acts" style={{ marginTop:12 }}>
              <button className="btn btn-pri btn-sm" onClick={() => open('ages')}>
                <Ic name="users"/> Générer la répartition
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop:16 }}>
        <div className="card-h"><h3><Ic name="info"/> À propos des rapports</h3></div>
        <div className="card-b" style={{ fontSize:'12.3px', color:'var(--muted)', lineHeight:1.7 }}>
          • Chaque rapport porte l&apos;en-tête officielle du <b>Collège Bonneau</b>, la date d&apos;édition et des blocs de signature.<br/>
          • Les montants « nets » tiennent compte des <b>bourses et réductions</b> accordées aux élèves.<br/>
          • Utilisez le bouton <b>Imprimer</b> (ou Ctrl+P) : l&apos;impression ne contient que le rapport, sans l&apos;interface.
        </div>
      </div>

    </>
  );
}
