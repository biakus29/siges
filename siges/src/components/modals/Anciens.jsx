import React, { useState } from 'react';
import { Modal, Avatar } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { nextMatricule, yearById } from '../../core/business.js';
import { norm, parseAnciensCsv, parseAnciensJson } from '../../core/utils.js';
import { EleveFormModal } from './EntityForms.jsx';

/* ================================================================
   Inscription d'un élève — étape de choix :
   • rechercher un ANCIEN élève (liste importée, ou dossier des
     années précédentes dans l'application) → fiche préremplie,
     il ne reste qu'à compléter (matricule, classe…) ;
   • ou saisir un NOUVEL élève normalement.
   ================================================================ */
export function InscriptionChooserModal(){
  const { db, anneeId, openModal, closeModal } = useApp();
  const [q, setQ] = useState('');
  const an = yearById(db, anneeId);
  const nq = norm(q.trim());

  const champs = a => {
    const l = [a.matricule, a.sexe === 'M' ? 'G' : (a.sexe === 'F' ? 'F' : null),
      a.dateNaissance, a.lieuNaissance, a.ancienEtablissement].filter(Boolean);
    return l.join(' • ');
  };
  const match = a => !nq || norm([a.nom, a.prenom, a.matricule].join(' ')).includes(nq);

  const liste = (db.anciens || []).filter(match).slice(0, 6);
  const anciensApp = db.eleves.filter(e => e.anneeId !== anneeId && match(e)).slice(0, 6);

  const prefillFrom = (a, srcLabel) => {
    /* v6.0 : l'ANCIEN MATRICULE de l'élève est repris tel quel (modifiable) —
       c'est lui qui rattache le dossier aux archives de l'établissement ;
       s'il est absent, un matricule frais est proposé. */
    const matRecupere = (a.matricule || '').trim() || nextMatricule(db, anneeId);
    openModal(
      <EleveFormModal prefilled srcLabel={a.matricule ? (srcLabel + ' — ancien matricule ' + a.matricule + ' repris') : srcLabel}
        initial={{
          matricule: matRecupere,
          classeId: '', statut: 'actif', photo: '',
          statutEleve: 'ancien',
          nom: a.nom || '', prenom: a.prenom || '', sexe: a.sexe || '',
          dateNaissance: a.dateNaissance || '', lieuNaissance: a.lieuNaissance || '',
          pereNom: a.pereNom || '', pereProfession: a.pereProfession || '', pereTel: a.pereTel || '',
          mereNom: a.mereNom || '', mereProfession: a.mereProfession || '', mereTel: a.mereTel || '',
          ancienEtablissement: a.ancienEtablissement || '', adresse: a.adresse || '',
          tuteur: a.tuteur || '', tel: a.tel || '',
          regime: a.regime === 'interne' ? 'interne' : (a.regime === 'externe' ? 'externe' : '')
        }}/>
    );
  };

  return (
    <Modal icon="users" title={'Inscrire un élève — ' + (an ? an.libelle : '')} onClose={closeModal}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'58%' }}>
            {(db.anciens || []).length} fiche(s) dans la liste des anciens élèves
          </span>
          <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
          <button className="btn btn-pri" onClick={() => openModal(<EleveFormModal/>)}>
            <Ic name="plus"/> Saisir un nouvel élève
          </button>
        </>
      }>
      <div className="field">
        <label>Ancien élève ? Recherchez sa fiche pour la préremplir</label>
        <div className="srch">
          <Ic name="search"/>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Nom, prénom ou matricule de l'ancien élève…"/>
        </div>
        <span className="hint">Si l'élève est nouveau, cliquez directement sur « Saisir un nouvel élève ».</span>
      </div>

      {q.trim() !== '' && !liste.length && !anciensApp.length
        ? <p className="mut" style={{ padding:'10px 2px' }}>Aucun ancien élève ne correspond à « {q} ».</p>
        : null}

      {liste.length > 0 && (
        <div style={{ marginTop:10 }}>
          <div className="clone-g">Liste des anciens élèves (importée)</div>
          <div className="pm-res">
            {liste.map((a, i) => (
              <div className="pm-row" key={'a' + i} onClick={() => prefillFrom(a, 'la liste des anciens élèves')}>
                <Avatar name={(a.nom || '?') + ' ' + (a.prenom || '')}/>
                <div style={{ flex:1 }}>
                  <b>{a.nom || '?'} {a.prenom || ''}</b> <small>{champs(a)}</small>
                </div>
                <span className="badge b-gold" style={{ marginRight:8 }}>liste</span>
                <Ic name="chev-r"/>
              </div>
            ))}
          </div>
        </div>
      )}

      {anciensApp.length > 0 && (
        <div style={{ marginTop:10 }}>
          <div className="clone-g">Dossiers des années précédentes (application)</div>
          <div className="pm-res">
            {anciensApp.map(a => (
              <div className="pm-row" key={a.id} onClick={() => prefillFrom(a, 'le dossier de l\u2019élève (' + (yearById(db, a.anneeId) || {}).libelle + ')')}>
                <Avatar name={a.nom + ' ' + a.prenom} sm photo={a.photo}/>
                <div style={{ flex:1 }}>
                  <b>{a.nom} {a.prenom}</b> <small>{a.matricule} • {champs(a)}</small>
                </div>
                <span className="badge b-navy" style={{ marginRight:8 }}>dossier</span>
                <Ic name="chev-r"/>
              </div>
            ))}
          </div>
        </div>
      )}

      {!(db.anciens || []).length && (
        <p className="mut" style={{ marginTop:12, fontSize:11.5, lineHeight:1.6 }}>
          La liste des anciens élèves est vide : importez-la (CSV ou JSON) depuis le bouton
          « Anciens élèves (0) » de la page Élèves — l'assistant reconnaît les colonnes
          courantes (nom, prénom, sexe, date et lieu de naissance, parents, tuteur,
          adresse, téléphone, ancien établissement…).
        </p>
      )}
    </Modal>
  );
}

/* ================================================================
   Import de la liste des anciens élèves (CSV ou JSON) — admin/économe.
   ================================================================ */
export function AnciensImportModal(){
  const { db, M, toast, confirm, closeModal } = useApp();
  const [parsing, setParsing] = useState(null);   /* { rows, colonnes, inconnues, fichier } */

  const onPick = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      let text = null;
      if (typeof file.arrayBuffer === 'function' && typeof TextDecoder === 'function'){
        const buf = await file.arrayBuffer();
        text = new TextDecoder('utf-8').decode(buf);
        if (text.includes('\uFFFD')){           /* export Excel/ISO-8859 : nouvelle tentative Windows-1252 */
          try { text = new TextDecoder('windows-1252').decode(buf); } catch(e2){}
        }
      } else if (typeof file.text === 'function'){
        text = await file.text();
      } else {
        text = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = () => rej(new Error('lecture impossible')); rd.readAsText(file); });
      }
      let r = null;
      if (/\.json$/i.test(file.name)){
        let arr = null;
        try { arr = JSON.parse(text); } catch(e2){ throw new Error('fichier JSON illisible'); }
        r = parseAnciensJson(arr);
      } else {
        r = parseAnciensCsv(text);
      }
      if (!r.rows.length) throw new Error('aucune fiche exploitable (vérifiez la ligne d\u2019en-têtes : nom, prénom…)');
      setParsing({ ...r, fichier:file.name });
    } catch(err){ toast('Import impossible : ' + (err.message || err), 'err'); }
  };

  const importer = async () => {
    if (!parsing) return;
    if ((db.anciens || []).length &&
        !await confirm('Remplacer la liste actuelle ?',
          'La liste contient déjà <b>' + (db.anciens || []).length + ' fiche(s)</b>. Elle sera remplacée par les <b>' + parsing.rows.length + ' nouvelle(s) fiche(s)</b>.', 'Remplacer', true)) return;
    try {
      M.importAnciens(parsing.rows);
      toast(parsing.rows.length + ' fiche(s) importée(s) — la recherche est active à l\u2019inscription.', 'ok');
      closeModal();
    } catch(err){ toast(String(err.message || err), 'err'); }
  };

  const vider = async () => {
    if (!await confirm('Vider la liste des anciens élèves ?', (db.anciens || []).length + ' fiche(s) seront retirées de la liste (les élèves inscrits ne sont pas touchés).', 'Vider', true)) return;
    M.viderAnciens();
    toast('Liste vidée.', 'ok');
  };

  return (
    <Modal icon="upload" title="Anciens élèves — liste de préremplissage" onClose={closeModal}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'52%' }}>
            {(db.anciens || []).length} fiche(s) en mémoire
          </span>
          {(db.anciens || []).length > 0 && <button className="btn btn-ghost" onClick={vider}><Ic name="trash"/> Vider</button>}
          <button className="btn btn-ghost" onClick={closeModal}>Fermer</button>
          {parsing && <button className="btn btn-pri" onClick={importer}><Ic name="check"/> Importer {parsing.rows.length} fiche(s)</button>}
        </>
      }>
      <p style={{ fontSize:12.4, lineHeight:1.65, color:'var(--muted)' }}>
        Importez la liste de vos anciens élèves au format <b>CSV</b> (export Excel : « Enregistrer sous → CSV」)
        ou <b>JSON</b>. Les colonnes reconnues : matricule, nom, prénom, sexe, date et lieu de naissance,
        nom / profession / téléphone des parents, tuteur, téléphone, adresse, régime, ancien établissement.
        À l'inscription, la recherche proposera ces fiches pour <b>préremplir</b> le formulaire.
      </p>
      <label className="btn btn-ghost" style={{ cursor:'pointer', marginTop:8 }}>
        <Ic name="upload"/> Choisir un fichier CSV ou JSON
        <input type="file" accept=".csv,.json,.txt" style={{ display:'none' }} onChange={onPick}/>
      </label>
      {parsing && (
        <div style={{ marginTop:14, border:'1px solid var(--line)', borderRadius:10, padding:'10px 14px', background:'#fbfcfe' }}>
          <b style={{ fontSize:12.5 }}>{parsing.fichier}</b> — {parsing.rows.length} fiche(s) détectée(s)
          <div className="mut" style={{ fontSize:11.3, marginTop:4 }}>
            Colonnes reconnues : {parsing.colonnes.join(', ') || '—'}
          </div>
          {parsing.inconnues.length > 0 && (
            <div className="mut" style={{ fontSize:11, marginTop:2, color:'#8a6d1a' }}>
              Ignorées : {parsing.inconnues.join(', ')}
            </div>
          )}
          <div style={{ marginTop:8, fontSize:11.5 }}>
            {parsing.rows.slice(0, 3).map((r, i) => (
              <div key={i} className="mut">• {r.nom || '?'} {r.prenom || ''} {r.dateNaissance ? '(' + r.dateNaissance + ')' : ''}</div>
            ))}
            {parsing.rows.length > 3 ? <div className="mut">… et {parsing.rows.length - 3} autre(s)</div> : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
