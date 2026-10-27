import React, { useState } from 'react';
import FormModal from './FormModal.jsx';
import { Modal, Badge, EmptyState } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { niveauxSorted, classesOf, nextMatricule, yearById, elevesOfYear, fraisSorted, classById, tranchesOfFrais, trancheISO, planOf } from '../../core/business.js';
import { fmt, fmtD } from '../../core/utils.js';
import { DocsDocModal } from '../../pages/Bulletins.jsx';

const CATS = ['Inscription','Scolarité','Annexe','Examen','Animation','Autre'];
const PERIOS = ['Annuel','Trimestriel','Mensuel','Unique'];

/* ---------- Année scolaire ---------- */
export function AnneeFormModal({ initial=null }){
  const { db, M, toast, setAnneeId } = useApp();
  const isNew = !initial;
  const others = db.annees.slice().sort((a,b) => a.libelle < b.libelle ? 1 : -1);
  const fields = [
    { name:'libelle', label:'Libellé de l\u2019année', required:true, placeholder:'ex : 2027-2028', maxLength:12,
      hint:'Format attendu : 2027-2028', defaultValue:initial ? initial.libelle : '' },
    { name:'debut', label:'Début', type:'date', required:true, half:true, defaultValue:initial ? initial.debut : '' },
    { name:'fin', label:'Fin', type:'date', required:true, half:true, defaultValue:initial ? initial.fin : '' }
  ];
  if (isNew){
    fields.push(
      { name:'h1', type:'header', label:'Initialisation depuis une année existante' },
      { name:'source', label:'Année source', type:'select', placeholderOption:'— Aucune —',
        options: others.map(o => ({ value:o.id, label:o.libelle + ' (' + db.eleves.filter(e => e.anneeId === o.id).length + ' élèves)' })) },
      { name:'copiegrille', type:'checkbox', label:'Copier la grille tarifaire', defaultValue:true },
      { name:'copieeleves', type:'checkbox', label:'Réinscrire les élèves actifs (nouvelles matricules)', defaultValue:true },
      { name:'activer', type:'checkbox', label:'Activer cette année immédiatement', defaultValue:true }
    );
  }
  return (
    <FormModal title={isNew ? 'Nouvelle année scolaire' : 'Modifier l\u2019année scolaire'} icon="calendar"
      fields={fields} initial={initial || {}}
      submitLabel={isNew ? 'Créer l\u2019année' : 'Enregistrer'}
      onSubmit={v => {
        const res = M.saveAnnee(v);
        if (v.activer && res.annee && res.annee.active) setAnneeId(res.annee.id);
        toast(isNew
          ? 'Année ' + res.annee.libelle + ' créée' + (res.nEl ? ' avec ' + res.nEl + ' réinscription(s)' : '') + '.'
          : 'Année mise à jour.', 'ok');
      }}/>
  );
}

/* ---------- Niveau ---------- */
export function NiveauFormModal({ initial=null }){
  const { db, M, toast } = useApp();
  return (
    <FormModal title={initial ? 'Modifier le niveau' : 'Nouveau niveau'} icon="layers"
      fields={[
        { name:'code', label:'Code', required:true, placeholder:'ex : 6EME', maxLength:10, uppercase:true, half:true, defaultValue:initial ? initial.code : '' },
        { name:'libelle', label:'Libellé', required:true, placeholder:'ex : Sixième', maxLength:40, half:true, defaultValue:initial ? initial.libelle : '' },
        { name:'cycle', label:'Cycle', type:'select', required:true, half:true, options:['Collège','Lycée','Autre'].map(c => ({ value:c, label:c })), defaultValue:initial ? initial.cycle : 'Collège' },
        { name:'ordre', label:'Ordre d\u2019affichage', type:'number', required:true, half:true, defaultValue:initial ? initial.ordre : db.niveaux.length + 1 }
      ]}
      initial={initial || {}}
      onSubmit={v => { M.saveNiveau(v); toast('Niveau enregistré.', 'ok'); }}/>
  );
}

/* ---------- Classe ---------- */
export function ClasseFormModal({ initial=null }){
  const { db, users, M, toast } = useApp();
  /* v5.2 : matières indispensables au classement = matières du plan de la classe */
  const planMat = initial ? planOf(db, initial.id).map(pe => (db.matieres || []).find(m => m.id === pe.matiereId)).filter(Boolean) : [];
  return (
    <FormModal title={initial ? 'Modifier la classe' : 'Nouvelle classe'} icon="classroom"
      fields={[
        { name:'libelle', label:'Libellé de la classe', required:true, placeholder:'ex : 6ème A', maxLength:20, defaultValue:initial ? initial.libelle : '' },
        { name:'niveauId', label:'Niveau', type:'select', required:true, half:true,
          options: niveauxSorted(db).map(nv => ({ value:nv.id, label:nv.libelle + ' (' + nv.cycle + ')' })),
          defaultValue:initial ? initial.niveauId : (niveauxSorted(db)[0] || {}).id },
        { name:'capacite', label:'Capacité', type:'number', half:true, defaultValue:initial ? initial.capacite : 60 },
        /* v5.5 : titulaire de la classe — compte titulaire ou enseignant */
        { name:'titulaireId', label:'Titulaire de la classe', type:'select', half:true,
          options:[{ value:'', label:'— Aucun —' }].concat(
            (users || (db.users || [])).filter(u => u.actif !== false && ['titulaire','enseignant'].includes(u.role))
              .sort((a,b) => (a.nom < b.nom ? -1 : 1))
              .map(u => ({ value:u.id, label:u.nom + ' (' + (u.role === 'titulaire' ? 'titulaire' : 'enseignant') + ')' }))),
          defaultValue:initial ? (initial.titulaireId || '') : '',
          hint:'Pour un compte « Titulaire », la classe est ajoutée automatiquement à son périmètre.' },
        /* v6.0 : mode d'appréciation des notes de la classe — classique ou APC */
        { name:'appreciationMode', label:'Mode d\u2019appréciation des notes', type:'select', half:true,
          options:[
            { value:'classique', label:'Classique — fourchettes de notes (Insuffisant… Excellent)' },
            { value:'apc', label:'APC — niveaux de maîtrise (Non Acquis… Expert)' }
          ],
          defaultValue:initial ? (initial.appreciationMode || 'classique') : 'classique',
          hint:'Concerne les bulletins et récapitulatifs de cette classe ; les échelles (classique, APC, moyennes) s\u2019éditent dans Pédagogie → Séquences & appréciations.' },
        { name:'matieresOblig', label:'Matières indispensables au classement', type:'checklist',
          options: planMat.map(m => ({ value:m.id, label:m.code + ' — ' + m.libelle })),
          emptyText: initial ? 'Aucune matière au plan de cette classe — définissez d\u2019abord le plan des enseignements.' : 'Enregistrez la classe, définissez son plan des enseignements, puis revenez cocher les matières indispensables.',
          hint:'Règle : l\u2019élève est « non classé » (NC) pour une période uniquement s\u2019il n\u2019obtient AUCUNE note dans l\u2019ensemble de ces matières — une seule note suffit à le classer.',
          defaultValue:initial && Array.isArray(initial.matieresOblig) ? initial.matieresOblig : [] }
      ]}
      initial={initial || {}}
      onSubmit={v => { M.saveClasse(v); toast('Classe enregistrée.', 'ok'); }}/>
  );
}

/* ---------- Type de frais ---------- */
export function FraisFormModal({ initial=null }){
  const { db, M, toast } = useApp();
  return (
    <FormModal title={initial ? 'Modifier le type de frais' : 'Nouveau type de frais'} icon="cash"
      fields={[
        { name:'code', label:'Code', required:true, placeholder:'ex : SCOL1', maxLength:10, uppercase:true, half:true, defaultValue:initial ? initial.code : '' },
        { name:'libelle', label:'Libellé', required:true, placeholder:'ex : Scolarité 1er trimestre', maxLength:50, half:true, defaultValue:initial ? initial.libelle : '' },
        { name:'categorie', label:'Catégorie', type:'select', half:true, options:CATS.map(c => ({ value:c, label:c })), defaultValue:initial ? initial.categorie : 'Inscription' },
        { name:'periodicite', label:'Périodicité', type:'select', half:true, options:PERIOS.map(p => ({ value:p, label:p })), defaultValue:initial ? initial.periodicite : 'Annuel',
          hint:'La répartition en tranches et les échéances de paiement se définissent ensuite depuis la Grille tarifaire (vue « Par classe », bouton tranches).' },
        { name:'ordre', label:'Ordre d\u2019affichage', type:'number', half:true, defaultValue:initial ? initial.ordre : db.frais.length + 1 },
        { name:'obligatoire', type:'checkbox', label:'Frais obligatoire', half:true, defaultValue:initial ? initial.obligatoire : true },
        { name:'parStatut', type:'checkbox', half:true, label:'Tarifs distincts nouveaux / anciens élèves',
          hint:'Grille : ajoute une couche « Nouveaux » / « Anciens » pour ce frais (ex : inscriptions réduites pour les réinscriptions).',
          defaultValue:initial ? !!initial.parStatut : false }
      ]}
      initial={initial || {}}
      onSubmit={v => { M.saveFrais(v); toast('Type de frais enregistré.', 'ok'); }}/>
  );
}

/* ---------- Élève ---------- */
/* Après une inscription : impression immédiate des documents de l'élève */
function ApresInscriptionModal({ eleve }){
  const { db, openModal, closeModal } = useApp();
  const cl = classById(db, eleve.classeId) || {};
  const ouvrir = (type, label) => openModal(<DocsDocModal type={type} label={label} sousTitre={eleve.nom + ' ' + eleve.prenom} eleves={[eleve]}/>);
  return (
    <Modal icon="check" title="Inscription enregistrée" onClose={closeModal}
      footer={<button className="btn btn-ghost" onClick={closeModal}>Fermer</button>}>
      <p style={{ marginBottom:14 }}><b>{eleve.nom} {eleve.prenom}</b> est inscrit(e) en <b>{cl.libelle || '—'}</b> sous le matricule <b>{eleve.matricule}</b>.</p>
      <p className="mut" style={{ marginBottom:10 }}>Imprimer maintenant :</p>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-pri" onClick={() => ouvrir('certificat', 'Certificat de scolarité')}><Ic name="id"/> Certificat de scolarité</button>
        <button className="btn btn-ghost" onClick={() => ouvrir('carte', 'Carte scolaire')}><Ic name="id"/> Carte scolaire</button>
        <button className="btn btn-ghost" onClick={() => ouvrir('badge', 'Badge')}><Ic name="qr"/> Badge</button>
      </div>
    </Modal>
  );
}

export function EleveFormModal({ initial=null, prefilled=false, srcLabel='' }){
  const { db, M, toast, anneeId, openModal } = useApp();
  const an = yearById(db, anneeId);
  const groups = niveauxSorted(db).map(nv => ({
    label: nv.libelle,
    items: classesOf(db, nv.id).map(c => ({ value:c.id, label:c.libelle }))
  })).filter(g => g.items.length);
  if (groups.length) groups[0].items = [{ value:'', label:'— Choisir la classe —' }, ...groups[0].items];
  return (
    <FormModal title={initial && !prefilled ? 'Modifier l\u2019élève — fiche d\u2019inscription' : 'Fiche d\u2019inscription d\u2019un élève'} icon="users" wide
      note={prefilled ? 'Fiche préremplie depuis ' + (srcLabel || 'la liste des anciens élèves') + ' — vérifiez les informations, conservez ou ajustez le matricule repris et choisissez la classe.' : undefined}
      fields={[
        { type:'header', label:'Identité de l\u2019élève' },
        { name:'matricule', label:'Matricule', required:true, maxLength:15, half:true,
          defaultValue:initial ? initial.matricule : nextMatricule(db, anneeId),
          hint:'Inscription ' + (an ? an.libelle : '') },
        { name:'classeId', label:'Classe', type:'select', required:true, half:true, groups, defaultValue:initial ? initial.classeId : '' },
        { name:'nom', label:'Nom', required:true, maxLength:30, uppercase:true, half:true, defaultValue:initial ? initial.nom : '' },
        { name:'prenom', label:'Prénom', required:true, maxLength:30, half:true, defaultValue:initial ? initial.prenom : '' },
        { name:'sexe', label:'Sexe', type:'select', half:true, options:[{ value:'M', label:'Masculin' }, { value:'F', label:'Féminin' }], defaultValue:initial ? initial.sexe : 'M' },
        { name:'statutEleve', label:'Situation', type:'select', half:true,
          options:[{ value:'nouveau', label:'Nouvel élève' }, { value:'ancien', label:'Ancien élève (réinscrit)' }],
          hint:'Détermine les tarifs d\u2019inscription applicables (couche nouveaux / anciens).',
          defaultValue:initial ? (initial.statutEleve || 'nouveau') : 'nouveau' },
        { name:'dateNaissance', label:'Date de naissance', type:'date', half:true, defaultValue:initial ? (initial.dateNaissance || '') : '' },
        { name:'lieuNaissance', label:'Lieu de naissance', maxLength:40, half:true, placeholder:'ex : Yaoundé', defaultValue:initial ? (initial.lieuNaissance || '') : '' },
        { name:'regime', label:'Statut de scolarité', type:'select', half:true,
          options:[{ value:'externe', label:'Externe (externat)' }, { value:'interne', label:'Interne (pensionnaire)' }],
          hint:'Les tarifs varient selon ce statut (grille tarifaire)',
          defaultValue:initial ? (initial.regime || 'externe') : 'externe' },
        { type:'header', label:'Père' },
        { name:'pereNom', label:'Nom du père', maxLength:50, half:true, placeholder:'ex : M. Ndongo Jean', defaultValue:initial ? (initial.pereNom || '') : '' },
        { name:'pereProfession', label:'Profession du père', maxLength:40, half:true, placeholder:'ex : Commerçant', defaultValue:initial ? (initial.pereProfession || '') : '' },
        { name:'pereTel', label:'Téléphone du père', maxLength:20, half:true, placeholder:'ex : 6 99 12 34 56', defaultValue:initial ? (initial.pereTel || '') : '' },
        { type:'header', label:'Mère' },
        { name:'mereNom', label:'Nom de la mère', maxLength:50, half:true, placeholder:'ex : Mme Abena Estelle', defaultValue:initial ? (initial.mereNom || '') : '' },
        { name:'mereProfession', label:'Profession de la mère', maxLength:40, half:true, placeholder:'ex : Infirmière', defaultValue:initial ? (initial.mereProfession || '') : '' },
        { name:'mereTel', label:'Téléphone de la mère', maxLength:20, half:true, placeholder:'ex : 6 77 45 23 10', defaultValue:initial ? (initial.mereTel || '') : '' },
        { type:'header', label:'Scolarité & contacts' },
        { name:'ancienEtablissement', label:'Ancien établissement', maxLength:60, half:true, placeholder:'ex : CES de Nkolbisson', defaultValue:initial ? (initial.ancienEtablissement || '') : '' },
        { name:'adresse', label:'Adresse / quartier', maxLength:70, half:true, placeholder:'ex : Quartier Essos, Yaoundé', defaultValue:initial ? (initial.adresse || '') : '' },
        { name:'tuteur', label:'Tuteur / contact en cas d\u2019urgence', maxLength:50, half:true, placeholder:'ex : Mme Abena Estelle', defaultValue:initial ? initial.tuteur : '' },
        { name:'tel', label:'Téléphone du tuteur', maxLength:20, half:true, placeholder:'ex : 6 99 12 34 56', defaultValue:initial ? initial.tel : '' },
        { name:'statut', label:'Statut', type:'select', half:true, options:[{ value:'actif', label:'Actif' }, { value:'radie', label:'Radié' }], defaultValue:initial ? initial.statut : 'actif' },
        { name:'photo', label:'Photo de l\u2019élève', type:'photo', hint:'PNG ou JPG — 400 Ko maximum. Affichée dans la liste, la situation et les encaissements.' }
      ]}
      initial={initial || {}}
      submitLabel={initial ? 'Enregistrer' : 'Inscrire'}
      onSubmit={v => {
        const res = M.saveEleve(v);
        toast(initial ? 'Fiche élève mise à jour.' : 'Élève ' + res.eleve.matricule + ' inscrit avec succès.', 'ok');
        /* le formulaire se ferme après l'enregistrement : la proposition s'ouvre ensuite */
        if (!initial) setTimeout(() => openModal(<ApresInscriptionModal eleve={res.eleve}/>), 0);
      }}/>
  );
}

/* ---------- Utilisateur ---------- */
export function UserFormModal({ initial=null }){
  const { M, toast, etabs, user: cur, etabId, db, dbRoot } = useApp();
  const isNew = !initial;
  const isSuper = cur && cur.role === 'superadmin';
  const roles = [
    { value:'admin', label:'Administrateur de l\u2019établissement' },
    { value:'censeur', label:'Censeur / Préfet des études (un cycle)' },
    { value:'surveillant', label:'Surveillant général (discipline)' },
    { value:'surveillant_secteur', label:'Surveillant de secteur (classes attribuées)' },
    { value:'titulaire', label:'Titulaire de classe' },
    { value:'enseignant', label:'Enseignant (ses matières, ses notes)' },
    { value:'operateur', label:'Opérateur de saisie (notes + discipline)' },
    { value:'econome', label:'Économe (paiements)' },
    { value:'lecteur', label:'Lecteur simple' }
  ];
  /* v6.8 : création du PREMIER superadministrateur (console réseau) ouverte
     à l'administrateur tant qu'aucun n'existe — ensuite réservée aux
     superadministrateurs. */
  const tousUsers = (dbRoot && Array.isArray(dbRoot.users) && dbRoot.users.length ? dbRoot.users : (db.users || []));
  const aUnSuper = tousUsers.some(u => u.role === 'superadmin') || !!(dbRoot && dbRoot.superadminExiste);
  if (isSuper || !aUnSuper)
    roles.push({ value:'superadmin', label: isSuper ? 'Superadministrateur (tous établissements)' : 'Superadministrateur — console réseau (premier compte)' });
  const [roleSel, setRoleSel] = useState(initial ? initial.role : 'lecteur');
  const role0 = roleSel;   /* réactif : les attributions suivent le profil choisi */
  /* attributions selon le profil */
  const niveauOpts = (db.niveaux || []).slice().sort((a,b) => (a.ordre || 0) - (b.ordre || 0))
    .map(n => ({ value:n.id, label:n.libelle }));
  const classeOpts = (db.classes || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1))
    .map(c => ({ value:c.id, label:c.libelle }));
  const matiereOpts = (db.matieres || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1))
    .map(m => ({ value:m.id, label:m.libelle }));
  const fields = [
    { name:'nom', label:'Nom complet', required:true, maxLength:50, half:true, defaultValue:initial ? initial.nom : '' },
    { name:'username', label:'Identifiant', required:true, maxLength:20, half:true, defaultValue:initial ? initial.username : '' },
    { name:'role', label:'Profil', type:'select', half:true,
      options:roles,
      defaultValue:role0 },
    { name:'etablissementId', label:'Établissement', type:'select', half:true,
      options:[{ value:'', label:'— Aucun (superadministrateur) —' }].concat(etabs.filter(e => isSuper || !cur || !cur.etablissementId || e.id === cur.etablissementId).map(e => ({ value:e.id, label:e.nom + (e.ville ? ' — ' + e.ville : '') }))),
      defaultValue:initial ? (initial.etablissementId || (initial.role === 'superadmin' ? '' : etabId || '')) : (etabId || '') },
    { name:'pwd', label:'Mot de passe', type:'password', required:isNew, half:true,
      placeholder:isNew ? 'minimum 6 caractères' : 'laisser vide pour conserver', defaultValue:'' },
    { name:'actif', type:'checkbox', label:'Compte actif', defaultValue:initial ? initial.actif : true }
  ];
  if (role0 === 'censeur')
    fields.push({ name:'niveauxIds', label:'Cycle — niveaux sous responsabilité', type:'checklist', options:niveauOpts,
      defaultValue:(initial && initial.niveauxIds) || [], hint:'Le censeur accède aux classes de ces niveaux (pédagogie et suivi).' });
  if (role0 === 'surveillant_secteur' || role0 === 'titulaire')
    fields.push({ name:'classesIds', label:role0 === 'titulaire' ? 'Classe attribuée (titulariat)' : 'Classes du secteur', type:'checklist', options:classeOpts,
      defaultValue:(initial && initial.classesIds) || [],
      hint:role0 === 'titulaire' ? 'Le titulaire consulte toutes les informations de sa classe.' : 'Le surveillant de secteur gère la discipline de ces classes.' });
  if (role0 === 'enseignant'){
    const fiches = (db.enseignants || []).slice().sort((a,b) => (a.nom < b.nom ? -1 : 1))
      .map(t => ({ value:t.id, label:t.nom + ' ' + t.prenom + (t.specialite ? ' — ' + t.specialite : '') }));
    fields.push({ name:'enseignantId', label:'Fiche enseignant (recommandé)', type:'select', half:true,
      options:[{ value:'', label:'— Aucune fiche liée —' }].concat(fiches),
      defaultValue:(initial && initial.enseignantId) || '',
      hint:'Si une fiche est liée, le périmètre (matières et classes) vient automatiquement du plan des enseignements.' });
    fields.push({ name:'matieresIds', label:'Matières enseignées (si aucune fiche liée)', type:'checklist', options:matiereOpts,
      defaultValue:(initial && initial.matieresIds) || [], hint:'Utilisé uniquement quand aucune fiche enseignant n\u2019est liée.' });
  }
  return (
    <FormModal title={isNew ? 'Nouvel utilisateur' : 'Modifier l\u2019utilisateur'} icon="user"
      fields={fields}
      observe={vals => { if ((vals.role || 'lecteur') !== roleSel) setRoleSel(vals.role || 'lecteur'); }}
      initial={initial || {}}
      submitLabel={isNew ? 'Créer le compte' : 'Enregistrer'}
      onSubmit={v => { M.saveUser(v); toast('Compte enregistré.', 'ok'); }}/>
  );
}

/* ---------- Établissement (superadministrateur) ---------- */
export function EtabFormModal({ initial=null }){
  const { M, toast } = useApp();
  const isNew = !initial;
  return (
    <FormModal title={isNew ? 'Nouvel établissement' : 'Modifier l\u2019établissement'} icon="bank"
      fields={[
        { name:'nom', label:'Nom de l\u2019établissement', required:true, maxLength:70, half:true, defaultValue:initial ? initial.nom : '' },
        { name:'code', label:'Code interne', maxLength:12, half:true, placeholder:'ex : ETAB-003', defaultValue:initial ? (initial.code || '') : '' },
        { name:'ville', label:'Ville', maxLength:40, half:true, defaultValue:initial ? (initial.ville || '') : '' },
        { name:'pays', label:'Pays', maxLength:40, half:true, defaultValue:initial ? (initial.pays || 'Cameroun') : 'Cameroun' },
        { name:'adresse', label:'Adresse', maxLength:90, half:true, defaultValue:initial ? (initial.adresse || '') : '' },
        { name:'telephone', label:'Téléphone', maxLength:40, half:true, defaultValue:initial ? (initial.telephone || '') : '' },
        { name:'email', label:'Courriel', maxLength:60, half:true, defaultValue:initial ? (initial.email || '') : '' },
        { name:'actif', type:'checkbox', label:'Établissement actif (proposé à la connexion)', defaultValue:initial ? initial.actif !== false : true }
      ]}
      initial={initial || {}}
      submitLabel={isNew ? 'Créer l\u2019établissement' : 'Enregistrer'}
      note={isNew ? 'Un nouvel établissement démarre avec une base vide : années, classes, élèves et réglages lui seront propres.' : ''}
      onSubmit={v => { M.saveEtab(v); toast('Établissement enregistré.', 'ok'); }}/>
  );
}

/* ---------- Réinitialisation de mot de passe ---------- */
export function ResetPwdModal({ user }){
  const { M, toast } = useApp();
  return (
    <FormModal slim title={'Réinitialiser — ' + user.nom} icon="lock"
      fields={[{ name:'pwd', label:'Nouveau mot de passe', type:'password', required:true, placeholder:'minimum 6 caractères' }]}
      submitLabel="Définir"
      onSubmit={v => { M.resetPwd(user.id, v.pwd); toast('Nouveau mot de passe défini pour ' + user.nom + '.', 'ok'); }}/>
  );
}

/* ---------- Annulation de paiement ---------- */
export function CancelPayModal({ paiement }){
  const { M, toast } = useApp();
  return (
    <FormModal slim icon="ban" title={'Annuler le paiement ' + paiement.numero}
      fields={[
        { name:'motif', label:'Motif de l\u2019annulation', required:true, maxLength:150, placeholder:'ex : erreur de saisie, double encaissement…' }
      ]}
      submitLabel="Confirmer l'annulation"
      note={'Le paiement de ' + fmt(paiement.montant) + ' FCFA sera marqué annulé et déduit des situations.'}
      onSubmit={v => { M.cancelPaiement(paiement.id, v.motif); toast('Paiement ' + paiement.numero + ' annulé.', 'ok'); }}/>
  );
}


/* ---------- Bourse / réduction ---------- */
export function BourseFormModal({ initial=null, eleveId=null }){
  const { db, M, toast, anneeId } = useApp();
  const els = elevesOfYear(db, anneeId);
  const groups = niveauxSorted(db).map(nv => ({
    label: nv.libelle,
    items: classesOf(db, nv.id).map(c => ({ value:c.id, label:c.libelle }))
  })).filter(g => g.items.length);
  /* options élèves regroupées par classe */
  const eleveGroups = classesSortedByLibelle(db, anneeId).map(cl => ({
    label: cl.libelle,
    items: els.filter(e => e.classeId === cl.id).map(e => ({ value:e.id, label:e.nom + ' ' + e.prenom + ' (' + e.matricule + ')' }))
  })).filter(g => g.items.length);
  return (
    <FormModal title={initial ? 'Modifier la bourse / réduction' : 'Accorder une bourse / réduction'} icon="coins"
      fields={[
        { name:'eleveId', label:'Élève', type:'select', required:true, groups:eleveGroups,
          defaultValue:initial ? initial.eleveId : (eleveId || '') },
        { name:'fraisId', label:'Portée', type:'select', half:true,
          options:[{ value:'', label:'Tous les frais' }, ...fraisSorted(db).map(f => ({ value:f.id, label:f.libelle }))],
          defaultValue:initial ? (initial.fraisId || '') : '' },
        { name:'nature', label:'Nature', type:'select', half:true,
          options:[{ value:'pourcentage', label:'Pourcentage (%)' }, { value:'montant', label:'Montant fixe (FCFA)' }],
          defaultValue:initial ? (initial.pourcentage ? 'pourcentage' : 'montant') : 'pourcentage' },
        { name:'valeur', label:'Valeur', required:true, half:true, placeholder:'ex : 50',
          hint:'Pourcentage (1-100) ou montant en FCFA selon la nature choisie',
          defaultValue:initial ? String(initial.pourcentage || initial.montant || '') : '' },
        { name:'date', label:'Date d\u2019attribution', type:'date', half:true,
          defaultValue:initial ? (initial.date || '') : new Date().toISOString().slice(0,10) },
        { name:'motif', label:'Motif / justification', required:true, maxLength:120,
          placeholder:"ex : Bourse d'excellence, enfant du personnel, cas social…",
          defaultValue:initial ? (initial.motif || '') : '' },
        { name:'actif', type:'checkbox', label:'Bourse active (déduite des nets à payer)', defaultValue:initial ? initial.actif !== false : true }
      ]}
      initial={initial || {}}
      submitLabel={initial ? 'Enregistrer' : 'Accorder'}
      onSubmit={v => {
        M.saveBourse({ ...v, id:initial ? initial.id : null });
        toast(initial ? 'Bourse mise à jour — situations recalculées.' : 'Bourse accordée — situations recalculées.', 'ok');
      }}/>
  );
}

function classesSortedByLibelle(db, anneeId){
  const seen = new Set();
  const out = [];
  db.eleves.filter(e => e.anneeId === anneeId).forEach(e => {
    if (!seen.has(e.classeId)){ seen.add(e.classeId); const c = db.classes.find(x => x.id === e.classeId); if (c) out.push(c); }
  });
  return out.sort((a,b) => a.libelle < b.libelle ? -1 : 1);
}


/* ---------- Tranches & échéances d'un type de frais ---------- */
const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export function TrancheFormModal({ fraisId }){
  const { db, M, toast, closeModal, anneeId } = useApp();
  const close = closeModal;   /* fermeture via le contexte, prop onClose ignorée */
  const f = db.frais.find(x => x.id === fraisId);
  const an = db.annees.find(a => a.id === anneeId);
  const [rows, setRows] = useState(() => (f ? tranchesOfFrais(db, f.id) : [])
    .map(t => ({ ...t })));
  if (!f) return null;
  const totPct = rows.reduce((s, r) => s + (Number(r.pourcentage) || 0), 0);
  const setRow = (i, patch) => setRows(rows.map((r, k) => k === i ? { ...r, ...patch } : r));
  const submit = e => {
    e.preventDefault();
    try {
      M.saveTranches(fraisId, rows);
      toast('Tranches mises à jour — échéances et montants recalculés.', 'ok');
      close();
    } catch(err){ toast(String(err.message || err), 'err'); }
  };
  return (
    <Modal icon="layers" title={'Tranches & échéances — ' + f.libelle} onClose={close}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'52%' }}>
            <Ic name="info"/> Les parts (%) s'appliquent au tarif ; la dernière tranche absorbe les arrondis.
          </span>
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-pri" type="submit" form="tr-form"><Ic name="check"/> Enregistrer</button>
        </>
      }>
      <form id="tr-form" onSubmit={submit}>
        <div className="tr-head"><span>Libellé</span><span>Part (%)</span><span>Jour</span><span>Échéance (mois)</span><span></span></div>
        {rows.map((r, i) => (
          <div className="tr-form-row" key={i}>
            <input value={r.label || ''} maxLength={18} placeholder={'T' + (i + 1)}
              onChange={e => setRow(i, { label:e.target.value })}/>
            <input inputMode="numeric" placeholder="100" value={r.pourcentage == null ? '' : String(r.pourcentage)}
              onChange={e => setRow(i, { pourcentage:e.target.value.replace(/[^\d]/g,'').slice(0,3) })}/>
            <input inputMode="numeric" placeholder="30" value={r.jour == null ? '' : String(r.jour)}
              onChange={e => setRow(i, { jour:e.target.value.replace(/[^\d]/g,'').slice(0,2) })}/>
            <select value={r.mois || 9} onChange={e => setRow(i, { mois:Number(e.target.value) })}>
              {MOIS_FR.map((m, k) => <option key={k} value={k + 1}>{m}</option>)}
            </select>
            <button type="button" className="icon-btn danger" title="Supprimer cette tranche"
              disabled={rows.length <= 1}
              onClick={() => setRows(rows.filter((_, k) => k !== i))}>
              <Ic name="trash"/>
            </button>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10, flexWrap:'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => setRows([...rows, { label:'T' + (rows.length + 1), pourcentage:0, jour:15, mois:1 }])}>
            <Ic name="plus"/> Ajouter une tranche
          </button>
          <span style={{ flex:1 }}/>
          <Badge cls={totPct === 100 ? 'b-ok' : 'b-bad'}>Total : {totPct} %{totPct !== 100 ? ' (doit faire 100 %)' : ''}</Badge>
        </div>
        {an && (
          <p className="mut" style={{ fontSize:11.5, marginTop:12, lineHeight:1.7 }}>
            Échéances reportées sur l&apos;année {an.libelle} :
            {' ' + rows.map(r => (r.label || '?') + ' → ' + fmtD(trancheISO(an, { mois:Number(r.mois) || 9, jour:Number(r.jour) || 1 }))).join(' • ')}
            <br/>Exemple : avec un tarif de 100 000 FCFA → {' '}
            {rows.map(r => (r.label || '?') + ' ' + fmt(Math.round((Number(r.pourcentage) || 0) * 1000))).join(' / ')} FCFA pour 100 000.
          </p>
        )}
      </form>
    </Modal>
  );
}

/* ================= v4.0 : PÉDAGOGIE — groupes, matières, enseignants, plan ================= */

/* ---------- Groupe de matières ---------- */
export function GroupeFormModal({ initial=null, onClose }){
  const { M, toast } = useApp();
  return (
    <FormModal title={initial ? 'Modifier le groupe' : 'Nouveau groupe de matières'} icon="layers"
      fields={[
        { name:'code', label:'Code', required:true, maxLength:10, half:true, placeholder:'ex : SCI',
          defaultValue:initial ? initial.code : '', hint:'Raccourci affiché sur les états et le plan.' },
        { name:'libelle', label:'Libellé', required:true, maxLength:60, half:true, placeholder:'ex : Matières scientifiques',
          defaultValue:initial ? initial.libelle : '' }
      ]}
      initial={initial || {}}
      submitLabel="Enregistrer"
      onSubmit={v => { M.saveGroupe({ ...v, id: initial ? initial.id : null }); toast('Groupe enregistré.', 'ok'); }}/>
  );
}

/* ---------- Matière (v4 : groupe, code, libellé) ---------- */
export function MatiereFormModal({ initial=null, onClose }){
  const { M, toast } = useApp();
  return (
    <FormModal title={initial ? 'Modifier la matière' : 'Nouvelle matière'} icon="book"
      fields={[
        { name:'code', label:'Code', required:true, maxLength:10, half:true, placeholder:'MATH',
          defaultValue:initial ? initial.code : '' },
        { name:'libelle', label:'Libellé', required:true, maxLength:60, half:true, placeholder:'Mathématiques',
          defaultValue:initial ? initial.libelle : '',
          hint:'Ni le groupe ni le coefficient ne sont fixés ici : ils sont attribués par classe dans le plan des enseignements.' }
      ]}
      initial={initial || {}}
      submitLabel="Enregistrer"
      onSubmit={v => { M.saveMatiere({ ...v, id: initial ? initial.id : null }); toast('Matière enregistrée.', 'ok'); }}/>
  );
}

/* ---------- Enseignant (fiche complète, modèle élève) ---------- */
export function EnseignantFormModal({ initial=null, onClose }){
  const { M, toast } = useApp();
  return (
    <FormModal wide title={initial ? 'Modifier la fiche enseignant' : 'Nouvel enseignant'} icon="user"
      fields={[
        { name:'matricule', label:'Matricule', maxLength:20, half:true, placeholder:'ENS-013',
          defaultValue:initial ? initial.matricule : '', hint:'Laissez vide pour un numérotage automatique à la saisie.' },
        { name:'statut', label:'Statut', type:'select', half:true,
          options:[{ value:'actif', label:'En activité' }, { value:'inactif', label:'Inactif' }],
          defaultValue:initial ? (initial.statut || 'actif') : 'actif' },
        { name:'nom', label:'Nom', required:true, maxLength:40, half:true, placeholder:'ATANGANA',
          defaultValue:initial ? initial.nom : '' },
        { name:'prenom', label:'Prénom', required:true, maxLength:40, half:true, placeholder:'Robert',
          defaultValue:initial ? initial.prenom : '' },
        { name:'sexe', label:'Sexe', type:'select', half:true,
          options:[{ value:'M', label:'Masculin' }, { value:'F', label:'Féminin' }],
          defaultValue:initial ? initial.sexe : 'M' },
        { name:'dateNaissance', label:'Date de naissance', type:'date', half:true,
          defaultValue:initial ? initial.dateNaissance : '' },
        { name:'lieuNaissance', label:'Lieu de naissance', maxLength:50, half:true,
          defaultValue:initial ? initial.lieuNaissance : '' },
        { name:'telephone', label:'Téléphone', maxLength:20, half:true, placeholder:'6XX XX XX XX',
          defaultValue:initial ? initial.telephone : '' },
        { name:'email', label:'Adresse électronique', type:'email', maxLength:60, half:true,
          defaultValue:initial ? initial.email : '' },
        { name:'quartier', label:'Quartier / adresse', maxLength:60, half:true,
          defaultValue:initial ? initial.quartier : '' },
        { name:'specialite', label:'Spécialité (matières)', maxLength:80, half:true, placeholder:'Mathématiques / Physique',
          defaultValue:initial ? initial.specialite : '' },
        { name:'diplome', label:'Diplôme', maxLength:60, half:true, placeholder:'Master, Ingénieur…',
          defaultValue:initial ? initial.diplome : '' },
        { name:'grade', label:'Grade', type:'select', half:true,
          options:[{ value:'', label:'—' }, { value:'A1', label:'A1' }, { value:'A2', label:'A2' },
            { value:'B1', label:'B1' }, { value:'B2', label:'B2' }, { value:'Contractuel', label:'Contractuel' },
            { value:'Vacataire', label:'Vacataire' }],
          defaultValue:initial ? initial.grade : '' },
        { name:'dateEmbauche', label:'Date d\\u2019embauche', type:'date', half:true,
          defaultValue:initial ? initial.dateEmbauche : '' }
      ]}
      initial={initial || {}}
      submitLabel={initial ? 'Enregistrer' : 'Créer la fiche'}
      onSubmit={v => { M.saveEnseignant({ ...v, id: initial ? initial.id : null }); toast('Fiche enseignant enregistrée.', 'ok'); }}/>
  );
}

/* ---------- Enseignement du plan (une matière dans une classe) ---------- */
export function PlanEntryFormModal({ initial=null, classeId, ordre, onClose }){
  const { M, toast, db } = useApp();
  const classes = (db.classes || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
  const groupes = (db.groupes || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
  const dejaPrises = new Set((db.plan || []).filter(e => e.classeId === classeId && (!initial || e.id !== initial.id)).map(e => e.matiereId));
  const matieres = (db.matieres || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1))
    .map(m => ({ value:m.id, label:m.code + ' — ' + m.libelle + (dejaPrises.has(m.id) ? ' (déjà au plan)' : ''), disabled:dejaPrises.has(m.id) }));
  const ensOpts = (db.enseignants || []).filter(t => t.statut !== 'inactif')
    .slice().sort((a,b) => (a.nom < b.nom ? -1 : 1))
    .map(t => ({ value:t.id, label:t.nom + ' ' + t.prenom + (t.specialite ? ' — ' + t.specialite : '') }));
  return (
    <FormModal title={initial ? 'Modifier l\\u2019enseignement' : 'Ajouter un enseignement'} icon="grid"
      fields={[
        { name:'classeId', label:'Classe', type:'select', half:true, options:classes.map(c => ({ value:c.id, label:c.libelle })),
          defaultValue:classeId },
        { name:'matiereId', label:'Matière', type:'select', half:true, required:true, options:matieres,
          defaultValue:initial ? initial.matiereId : '' },
        { name:'enseignantId', label:'Enseignant', type:'select', half:true,
          options:[{ value:'', label:'— À affecter —' }].concat(ensOpts),
          defaultValue:initial ? (initial.enseignantId || '') : '' },
        { name:'groupeId', label:'Groupe de la matière (pour cette classe)', type:'select', half:true, required:true,
          options:[{ value:'', label:'— Choisir un groupe —' }].concat(groupes.map(g => ({ value:g.id, label:g.code + ' — ' + g.libelle }))),
          defaultValue:initial ? (initial.groupeId || '') : '',
          hint:'Le groupe est attribué ici, classe par classe.' },
        { name:'coefficient', label:'Coefficient (0,5 à 10)', type:'number', half:true, step:'0.5', min:'0.5', max:'10',
          defaultValue:initial ? String(initial.coefficient || 1) : '1' },
        { name:'ordre', label:'Ordre d\\u2019affichage au bulletin', type:'number', half:true, min:'1', max:'60',
          defaultValue:initial ? String(initial.ordre || 1) : String(ordre || 1),
          hint:'Les matières apparaissent au bulletin dans cet ordre (modifiable aussi par flèches).' }
      ]}
      initial={initial || {}}
      submitLabel="Enregistrer"
      onSubmit={v => { M.savePlanEntry({ ...v, id: initial ? initial.id : null }); toast('Enseignement enregistré.', 'ok'); }}/>
  );
}

/* ---------- Clonage du plan d'une classe vers d'autres ---------- */
export function ClonePlanModal({ fromClasseId }){
  const { M, toast, db, confirm, closeModal } = useApp();
  const classes = (db.classes || []).filter(c => c.id !== fromClasseId)
    .slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
  const src = (db.plan || []).filter(e => e.classeId === fromClasseId);
  const [sel, setSel] = useState([]);
  const srcLabel = ((db.classes || []).find(c => c.id === fromClasseId) || {}).libelle || '';
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.concat([id])));
  const go = async () => {
    if (!sel.length){ toast('Choisissez au moins une classe cible.', 'err'); return; }
    const cibles = sel.map(id => ((db.classes || []).find(c => c.id === id) || {}).libelle).join(', ');
    const ok = await confirm('Cloner le plan de ' + srcLabel + ' ?',
      'Le plan de <b>' + srcLabel + '</b> (' + src.length + ' enseignement(s)) remplacera celui de : <b>' + cibles + '</b>.', 'Cloner', true);
    if (!ok) return;
    try { const r = M.clonePlan(fromClasseId, sel); toast(r.n + ' enseignement(s) copié(s) vers ' + sel.length + ' classe(s).', 'ok'); closeModal(); }
      catch(e){ toast(String(e.message || e), 'err'); }
  };
  return (
    <Modal title="Cloner le plan des enseignements" icon="copy" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>Source : <b>{srcLabel}</b> — {src.length} enseignement(s)</span>
        <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        <button className="btn btn-pri" onClick={go}><Ic name="copy"/> Cloner vers {sel.length || ''} classe(s)</button>
      </>}>
      <p style={{ fontSize:12.4, lineHeight:1.6, color:'var(--muted)' }}>
        Cochez les classes qui recevront <b>la même grille d\\u2019enseignements</b> (matières, enseignants, coefficients
        et ordre au bulletin). Le plan actuel de chaque classe cible sera <b>remplacé</b>.
      </p>
      {classes.length ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:8, marginTop:12 }}>
          {classes.map(c => {
            const n = (db.plan || []).filter(e => e.classeId === c.id).length;
            return (
              <label key={c.id} className={'chk-chip' + (sel.includes(c.id) ? ' on' : '')} style={{ cursor:'pointer' }}>
                <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)}/> {c.libelle}
                <span className="mut" style={{ fontSize:10 }}>({n ? n + ' ens.' : 'vide'})</span>
              </label>
            );
          })}
        </div>
      ) : <EmptyState icon="classroom" title="Aucune autre classe" text="Créez d'autres classes pour y cloner ce plan."/>}
    </Modal>
  );
}


/* ---------- Clonage d'UN enseignement vers d'autres classes ---------- */
export function CloneEntryModal({ entry }){
  const { M, toast, db, confirm, closeModal } = useApp();
  const mat = (db.matieres || []).find(m => m.id === entry.matiereId) || {};
  const grp = (db.groupes || []).find(g => g.id === entry.groupeId);
  const ens = (db.enseignants || []).find(t => t.id === entry.enseignantId);
  const src = (db.classes || []).find(c => c.id === entry.classeId) || {};
  const classes = (db.classes || []).filter(c => c.id !== entry.classeId)
    .slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
  const [sel, setSel] = useState([]);
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.concat([id])));
  const go = async () => {
    if (!sel.length){ toast('Choisissez au moins une classe cible.', 'err'); return; }
    const ok = await confirm('Cloner cet enseignement ?',
      '« <b>' + (mat.libelle || '?') + ' »</b> (coef. ' + entry.coefficient + (grp ? ', groupe ' + grp.code : '') +
      ') sera ajouté au plan de : <b>' + sel.map(id => ((db.classes || []).find(c => c.id === id) || {}).libelle).join(', ') + '</b>.',
      'Cloner', false);
    if (!ok) return;
    try { const r = M.clonePlanEntry(entry.id, sel);
      toast(r.n + ' classe(s) mise(s) à jour' + (r.skips.length ? ' — ' + r.skips.length + ' ignorée(s) (matière déjà au plan)' : '') + '.', 'ok');
      closeModal(); }
    catch(e){ toast(String(e.message || e), 'err'); }
  };
  return (
    <Modal title="Cloner cet enseignement" icon="copy" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>
          {mat.libelle || '?'} · coef. {entry.coefficient}{grp ? ' · ' + grp.code : ''}{ens ? ' · ' + ens.nom : ''}
        </span>
        <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        <button className="btn btn-pri" onClick={go}><Ic name="copy"/> Cloner vers {sel.length || ''} classe(s)</button>
      </>}>
      <p style={{ fontSize:12.4, lineHeight:1.6, color:'var(--muted)' }}>
        Ajouter <b>{mat.libelle || 'cette matière'}</b> (coefficient {entry.coefficient}
        {grp ? <>, groupe <b>{grp.libelle}</b></> : null}{ens ? <>, enseigné par <b>{ens.nom} {ens.prenom}</b></> : null})
        au plan des classes cochées. Les classes qui ont déjà cette matière sont signalées et ignorées.
      </p>
      {classes.length ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:8, marginTop:12 }}>
          {classes.map(c => {
            const deja = (db.plan || []).some(e => e.classeId === c.id && e.matiereId === entry.matiereId);
            return (
              <label key={c.id} className={'chk-chip' + (sel.includes(c.id) ? ' on' : '')}
                style={{ cursor: deja ? 'not-allowed' : 'pointer', opacity: deja ? .55 : 1 }}>
                <input type="checkbox" checked={sel.includes(c.id)} disabled={deja} onChange={() => toggle(c.id)}/> {c.libelle}
                <span className="mut" style={{ fontSize:10 }}>({deja ? 'déjà au plan' : ((db.plan || []).filter(e => e.classeId === c.id).length || 'plan vide')})</span>
              </label>
            );
          })}
        </div>
      ) : <EmptyState icon="classroom" title="Aucune autre classe" text={"Source : " + (src.libelle || '')}/>}
    </Modal>
  );
}

/* ---------- Vue : enseignements dispensés par un enseignant ---------- */
export function EnseignementsDeModal({ enseignant }){
  const { db, openModal, closeModal } = useApp();
  const grpOf2 = id => (db.groupes || []).find(g => g.id === id);
  const lst = (db.plan || []).filter(e => e.enseignantId === enseignant.id);
  const clsOf = id => (db.classes || []).find(c => c.id === id);
  const matOf = id => (db.matieres || []).find(m => m.id === id);
  const byClasse = {};
  lst.forEach(e => { (byClasse[e.classeId] = byClasse[e.classeId] || []).push(e); });
  return (
    <Modal wide title={'Enseignements de ' + enseignant.nom + ' ' + enseignant.prenom} icon="book" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>
          {lst.length} enseignement(s) — coef. total {lst.reduce((t, e) => t + (e.coefficient || 0), 0)}
        </span>
        <button className="btn btn-ghost" onClick={closeModal}>Fermer</button>
      </>}>
      {enseignant.specialite ? <p className="mut" style={{ fontSize:12 }}>Spécialité : <b>{enseignant.specialite}</b></p> : null}
      {lst.length ? (
        <table className="tbl">
          <thead><tr><th>Classe</th><th>Matière</th><th>Groupe</th><th className="num">Ordre</th><th className="num">Coefficient</th></tr></thead>
          <tbody>
            {Object.keys(byClasse).sort((a,b) => {
              const A = clsOf(a), B = clsOf(b);
              return ((A && A.libelle) || '') < ((B && B.libelle) || '') ? -1 : 1;
            }).flatMap(cid => byClasse[cid].sort((a,b) => (a.ordre||99) - (b.ordre||99)).map((e, i) => (
              <tr key={e.id}>
                <td>{i === 0 ? <b>{(clsOf(cid) || {}).libelle || cid}</b> : ''}</td>
                <td>{(matOf(e.matiereId) || {}).libelle || '—'}</td>
                <td>{(grpOf2(e.groupeId) || {}).code || <span className="mut">—</span>}</td>
                <td className="num">n°{e.ordre}</td>
                <td className="num">coef. {e.coefficient || 1}</td>
              </tr>
            )))}
          </tbody>
        </table>
      ) : <EmptyState icon="grid" title="Aucun enseignement" text="Cet enseignant n'est rattaché à aucune matière dans les plans de classes."/>}
    </Modal>
  );
}

/* ---------- Vue : enseignants qui dispensent une matière ---------- */
export function EnseignantsDeMatiereModal({ matiere }){
  const { db, closeModal } = useApp();
  const lst = (db.plan || []).filter(e => e.matiereId === matiere.id);
  const clsOf = id => (db.classes || []).find(c => c.id === id);
  const ensOf = id => (db.enseignants || []).find(t => t.id === id);
  const parEns = {};
  lst.forEach(e => { (parEns[e.enseignantId || '_'] = parEns[e.enseignantId || '_'] || []).push(e); });
  return (
    <Modal title={'Enseignants de la matière « ' + matiere.libelle + ' »'} icon="users" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>
          {lst.length} enseignement(s) dans {[...new Set(lst.map(e => e.classeId))].length} classe(s)
        </span>
        <button className="btn btn-ghost" onClick={closeModal}>Fermer</button>
      </>}>
      {lst.length ? (
        <table className="tbl">
          <thead><tr><th>Enseignant</th><th>Classes</th><th className="num">Coefficients</th></tr></thead>
          <tbody>
            {Object.keys(parEns).map(k => {
              const t = ensOf(k);
              const cls = [...new Set(parEns[k].map(e => e.classeId))]
                .map(cid => (clsOf(cid) || {}).libelle || cid).sort().join(', ');
              return (
                <tr key={k}>
                  <td><b>{t ? t.nom + ' ' + t.prenom : 'À affecter'}</b>{t && t.specialite ? <div className="mut" style={{ fontSize:10.5 }}>{t.specialite}</div> : null}</td>
                  <td>{cls || '—'}</td>
                  <td className="num">{parEns[k].map(e => e.coefficient || 1).join(' · ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <EmptyState icon="user" title="Matière non enseignée" text="Aucune classe ne comporte cette matière dans son plan des enseignements."/>}
    </Modal>
  );
}
