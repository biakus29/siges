import React, { useEffect, useRef } from 'react';
import { Modal, Logo, Badge } from './UI.jsx';
import { Ic } from './Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, fmtD, pctTxt, todayISO, MODES } from '../core/utils.js';
import { printZone } from '../core/print.js';
import { yearById, niveauById, classById, elevesOfYear, situationTotals, yearAggregates, classesSorted, fraisSorted, payIndexOf, solvabiliteEleve, tranchesOfFrais, trancheISO, trancheMontants, tarifEffectif, tarifFor, reductionFor, situationRows, settingsOf, statutEleveOf, planOf, coefOf, notesDe, moyenneMatiere, moyenneGenerale, appreciationOf, appreciationNoteOf, appreciationMoyenneOf, classementClasse, matieresManquantes, sequencesSorted, moyenneGroupe, groupesDuPlan, bulletinOf, statsNotes, absencesDe, faitsDe, sanctionAbsencesFor, bulletinQrData, qrFold, rangMatiere } from '../core/business.js';
import { qrEncode } from '../core/qrcode.js';

/* ---------- Modale générique de rapport (avec impression) ----------
   v5.6 — ajustement A4 fiable :
   • l'aperçu est affiché à la largeur d'impression (718 px = 190 mm) ;
   • à l'impression, la zone est mesurée à cette même largeur puis
     réduite par « zoom » (propriété de mise en page, contrairement à
     transform:scale le document tient VRAIMENT sur la page) ;
   • fit="page" : une seule page A4 (bulletins, récapitulatifs) ;
   • fit="width" (défaut) : seul le débordement en largeur est corrigé,
     les documents longs se paginent naturellement (bordereaux,
     certificats, cartes…). */
export function ReportModal({ title, icon='printer', children, onClose, autoPrint=false, fit='width' }){
  const { closeModal, toast } = useApp();
  const close = onClose || closeModal;
  const doPrint = () => {
    const doc = typeof document !== 'undefined' ? document : null;
    const z = doc ? doc.getElementById('print-zone') : null;
    if (z && fit !== 'none'){
      const AVAIL_W = 756, AVAIL_H = 1047;      /* A4 96 dpi — 20 cm utiles (marges 10 mm / 5 mm) */
      const prevW = z.style.width, prevZoom = z.style.zoom;
      z.style.width = AVAIL_W + 'px';           /* mesure au format d'impression */
      let sc = 1;
      const h = z.offsetHeight, sw = z.scrollWidth;
      if (h > 0){
        if (fit === 'page' && h > AVAIL_H) sc = Math.min(sc, AVAIL_H / h);
        if (sw > AVAIL_W + 1) sc = Math.min(sc, AVAIL_W / sw);
      }
      if (sc < 1) z.style.zoom = String(Math.round(sc * 10000) / 10000);
      const ok = printZone();
      z.style.zoom = prevZoom;
      z.style.width = prevW;
      if (!ok) toast('Impression impossible dans cet environnement.', 'err');
      return;
    }
    const ok = printZone();
    if (!ok) toast('Impression impossible dans cet environnement.', 'err');
  };
  const printed = useRef('');
  useEffect(() => {
    if (!autoPrint || printed.current === title) return;
    printed.current = title;
    const t = setTimeout(() => doPrint(), 400);
    return () => clearTimeout(t);
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal wide icon={icon} title={title} onClose={close}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'58%' }}>
            <Ic name="info"/> Document généré par Aurel School SIGES — vérifiez les montants avant diffusion.
          </span>
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button className="btn btn-pri" onClick={doPrint}><Ic name="printer"/> Imprimer</button>
        </>
      }>
      {children}
    </Modal>
  );
}

/* ---------- v5.7 : liste imprimable générique (import/export/impression
   disponibles à chaque niveau de l'application) ---------- */
export function ListeReport({ titre, sous, colonnes, lignes, note }){
  const { db, anneeId } = useApp();
  const st = settingsOf(db);
  const an = yearById(db, anneeId);
  return (
    <div className="rcp" id="print-zone">
      <Head tag="Liste" title={titre}/>
      <div className="rcp-body">
        <div className="rcp-scope" style={{ marginBottom:10 }}>
          <b>{st.nomEtablissement || 'Établissement'}</b> — {sous || (an ? an.libelle : '')} • {lignes.length} ligne(s)
        </div>
        <table className="rcp-tbl">
          <thead><tr>{colonnes.map((c, i) => <th key={i} style={i > 0 && /^\d/.test(String(lignes[0] && lignes[0][i])) ? { textAlign:'right' } : undefined}>{c}</th>)}</tr></thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i}>{l.map((c, j) => <td key={j} style={j > 0 && /^\d/.test(String(c)) ? { textAlign:'right' } : undefined}>{String(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {note && <p style={{ fontSize:10.5, color:'var(--muted)', marginTop:8 }}>{note}</p>}
        <div className="rcp-foot"><span className="sig">Le Chef d'établissement</span></div>
      </div>
      <div className="rcp-note">{st.piedEtat} • {an ? an.libelle : ''} • {titre} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* Bouton « Imprimer la liste » prêt à l'emploi pour les pages de listes */
export function PrintListeBtn({ titre, sous, colonnes, lignes, note, label='Imprimer la liste' }){
  const { openModal } = useApp();
  return <button className="btn btn-ghost btn-sm" title="Imprimer cette liste (A4)" onClick={() => openModal(
    <ReportModal title={titre}><ListeReport titre={titre} sous={sous} colonnes={colonnes} lignes={lignes} note={note}/></ReportModal>
  )}><Ic name="printer"/> {label}</button>;
}

/* ---------- v5.5 : QR code de sécurité (SVG, net à l'impression) ---------- */
export function QrCode({ text, size=76, caption }){
  let q = null;
  try { q = qrEncode(text); }
  catch(e){ return <span className="mut" style={{ fontSize:9.5 }}>QR indisponible</span>; }
  let d = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++)
    if (q.modules[y][x]) d += 'M' + x + ' ' + y + 'h1v1h-1z';
  return (
    <div style={{ textAlign:'center', lineHeight:1.25 }}>
      <svg width={size} height={size} viewBox={'0 0 ' + q.size + ' ' + q.size} shapeRendering="crispEdges"
        data-qr={text} role="img" aria-label="QR code de vérification" style={{ background:'#fff', border:'1px solid #c8cfda', display:'block', borderRadius:3 }}>
        <rect width={q.size} height={q.size} fill="#ffffff"/>
        <path d={d} fill="#1c2430"/>
      </svg>
      {caption && <div style={{ fontSize:7.5, color:'#667085', marginTop:2 }}>{caption}</div>}
    </div>
  );
}

/* Texte QR d'un bulletin (null si désactivé ou sans code de sécurité). */
function qrBulletin(db, { eleveId, periodeLabel, moy, rang }){
  const bul = bulletinOf(db);
  if (!bul.qrCode || !bul.codeSecurite) return null;
  return bulletinQrData(db, { eleveId, periodeLabel, moy, rang });
}

function Head({ tag, title }){
  const { db } = useApp();
  const st = settingsOf(db);
  const contact = [st.adresse, st.telephone, st.email].filter(Boolean).join('  •  ');
  return (
    <div className="rcp-head">
      {st.logo
        ? <img className="rcp-logo" src={st.logo} alt={st.nomEtablissement}/>
        : <Logo size={42}/>}
      <div className="rh-t">
        <b>{st.nomEtablissement}</b>
        <span>{st.sousTitre}</span>
        <span>{st.mention}</span>
        {contact && <span className="rh-contact">{contact}</span>}
      </div>
      <div className="rh-n"><span>{tag}</span><b>{title}</b></div>
    </div>
  );
}
function nowTime(){ return new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }); }

/* ---------- Rapport 1 : situation d'une classe ---------- */
export function ClassSituationReport({ classId }){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  const cl = classById(db, classId);
  const niv = cl ? niveauById(db, cl.niveauId) : null;
  if (!cl || !an) return <p className="mut">Classe introuvable.</p>;
  const els = elevesOfYear(db, anneeId).filter(e => e.classeId === classId);
  const rows = els.map((e, i) => ({ n:i+1, e, t:situationTotals(db, e) }));
  const tot = rows.reduce((a, r) => ({
    brut:a.brut + r.t.brut, reduction:a.reduction + r.t.reduction, net:a.net + r.t.net,
    paye:a.paye + r.t.paye, solde:a.solde + r.t.solde }), { brut:0, reduction:0, net:0, paye:0, solde:0 });
  const nbAJ = rows.filter(r => r.t.aJour).length;

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Rapport de classe" title={cl.libelle}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Année scolaire</span><b>{an.libelle}</b></div>
          <div><span>Niveau</span><b>{niv ? niv.libelle : '—'}</b></div>
          <div><span>Effectif</span><b>{fmt(els.length)} élève(s) — {fmt(nbAJ)} à jour</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())} à {nowTime()}</b></div>
        </div>
        <table className="rcp-tbl">
          <thead>
            <tr><th>N°</th><th>Matricule</th><th>Élève</th><th className="num">Net à payer</th>
              <th className="num">Réductions</th><th className="num">Payé</th><th className="num">Solde</th><th>État</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.e.id}>
                <td className="mut">{r.n}</td>
                <td>{r.e.matricule}</td>
                <td>{r.e.nom} {r.e.prenom}</td>
                <td className="num">{fmt(r.t.net)}</td>
                <td className="num">{r.t.reduction ? '-' + fmt(r.t.reduction) : '—'}</td>
                <td className="num">{fmt(r.t.paye)}</td>
                <td className="num" style={{ color: r.t.solde > 0 ? 'var(--bad)' : 'var(--ok)' }}><b>{fmt(r.t.solde)}</b></td>
                <td>{r.t.aJour ? 'À jour' : 'En cours'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="center mut">Aucun élève inscrit dans cette classe.</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>TOTAUX (FCFA)</td>
              <td className="num">{fmt(tot.net)}</td>
              <td className="num">-{fmt(tot.reduction)}</td>
              <td className="num">{fmt(tot.paye)}</td>
              <td className="num">{fmt(tot.solde)}</td>
              <td>{pctTxt(tot.net > 0 ? tot.paye/tot.net : 0)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Classe {cl.libelle} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- Rapport 2 : état des recouvrements de l'année ---------- */
export function RecoveryReport(){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  if (!an) return <p className="mut">Aucune année sélectionnée.</p>;
  const ag = yearAggregates(db, anneeId);
  const cls = classesSorted(db).filter(c => ag.perClasse[c.id]);
  const tot = { attendu:ag.attendu, encaisse:ag.encaisse, reste:Math.max(0, ag.attendu - ag.encaisse), reduction:ag.totalReductions };

  return (
    <div className="rcp" id="print-zone">
      <Head tag="État des recouvrements" title={an.libelle}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Effectif actif</span><b>{fmt(ag.effectif)} élève(s)</b></div>
          <div><span>Élèves à jour</span><b>{fmt(ag.aJourTotal)}</b></div>
          <div><span>Réductions accordées</span><b>{fmt(ag.totalReductions)} FCFA</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())} à {nowTime()}</b></div>
        </div>
        <table className="rcp-tbl">
          <thead>
            <tr><th>Classe</th><th>Niveau</th><th className="num">Effectif</th><th className="num">À jour</th>
              <th className="num">Attendu (FCFA)</th><th className="num">Encaissé (FCFA)</th><th className="num">Reste (FCFA)</th><th className="num">Taux</th></tr>
          </thead>
          <tbody>
            {cls.map(c => {
              const a = ag.perClasse[c.id];
              const taux = a.attendu > 0 ? a.encaisse/a.attendu : 0;
              return (
                <tr key={c.id}>
                  <td><b>{c.libelle}</b></td>
                  <td>{(niveauById(db, c.niveauId) || {}).libelle || '—'}</td>
                  <td className="num">{fmt(a.effectif)}</td>
                  <td className="num">{fmt(a.aJour)}</td>
                  <td className="num">{fmt(a.attendu)}</td>
                  <td className="num">{fmt(a.encaisse)}</td>
                  <td className="num">{fmt(Math.max(0, a.attendu - a.encaisse))}</td>
                  <td className="num"><b>{pctTxt(taux)}</b></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>TOTAUX (FCFA)</td>
              <td className="num">{fmt(ag.effectif)}</td>
              <td className="num">{fmt(ag.aJourTotal)}</td>
              <td className="num">{fmt(tot.attendu)}</td>
              <td className="num">{fmt(tot.encaisse)}</td>
              <td className="num">{fmt(tot.reste)}</td>
              <td className="num">{pctTxt(ag.taux)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-lettres" style={{ background:'#f2f6fb', borderColor:'var(--navy-100)', color:'var(--navy-800)' }}>
          <b>Récapitulatif :</b> attendu net de l&apos;année {fmt(tot.attendu)} FCFA (après {fmt(tot.reduction)} FCFA de réductions) —
          encaissé {fmt(tot.encaisse)} FCFA — reste à recouvrer {fmt(tot.reste)} FCFA, soit un taux de recouvrement de {pctTxt(ag.taux)}.
        </div>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- Rapport 3 : journal de caisse (période, caisse/banque, par frais) ---------- */
const CAISSE_MODES = ['especes', 'mobile'];
const BANQUE_MODES = ['virement', 'cheque'];

export function CaisseReport({ from, to }){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  const d1 = from || todayISO();
  const d2 = to || from || todayISO();
  const list = db.paiements
    .filter(p => p.anneeId === anneeId && p.statut === 'valide')
    .filter(p => { const d = p.date.slice(0, 10); return d >= d1 && d <= d2; })
    .sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));
  const total = list.reduce((s, p) => s + p.montant, 0);

  const parFrais = {};
  list.forEach(p => {
    const f = db.frais.find(x => x.id === p.fraisId);
    const k = f ? f.libelle : 'Autre';
    parFrais[k] = parFrais[k] || { n:0, total:0 };
    parFrais[k].n++; parFrais[k].total += p.montant;
  });
  const parMode = {}, nbMode = {};
  list.forEach(p => { parMode[p.mode] = (parMode[p.mode] || 0) + p.montant; nbMode[p.mode] = (nbMode[p.mode] || 0) + 1; });
  const groupTot = keys => keys.reduce((s, m) => s + (parMode[m] || 0), 0);
  const totCaisse = groupTot(CAISSE_MODES);
  const totBanque = groupTot(BANQUE_MODES);

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Journal de caisse" title={fmtD(d1) + (d2 !== d1 ? ' → ' + fmtD(d2) : '')}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Année scolaire</span><b>{an ? an.libelle : '—'}</b></div>
          <div><span>Période</span><b>{fmtD(d1)} → {fmtD(d2)}</b></div>
          <div><span>Encaissements</span><b>{fmt(list.length)} reçu(s)</b></div>
          <div><span>Total encaissé</span><b>{fmt(total)} FCFA</b></div>
        </div>

        <table className="rcp-tbl">
          <thead><tr><th>Répartition des encaissements</th><th>Mode de paiement</th><th className="num">Nb reçus</th><th className="num">Montant (FCFA)</th></tr></thead>
          <tbody>
            <tr className="rcp-grp"><td colSpan={4}><b>CAISSE</b> — espèces &amp; mobile money</td></tr>
            {CAISSE_MODES.map(m => (parMode[m] || 0) > 0 ? (
              <tr key={m}><td></td><td>{MODES[m] || m}</td><td className="num">{fmt(nbMode[m] || 0)}</td><td className="num">{fmt(parMode[m])}</td></tr>
            ) : null)}
            <tr className="rcp-sub"><td></td><td><b>Sous-total caisse</b></td><td className="num"></td><td className="num"><b>{fmt(totCaisse)}</b></td></tr>
            <tr className="rcp-grp"><td colSpan={4}><b>BANQUE</b> — virement &amp; chèque</td></tr>
            {BANQUE_MODES.map(m => (parMode[m] || 0) > 0 ? (
              <tr key={m}><td></td><td>{MODES[m] || m}</td><td className="num">{fmt(nbMode[m] || 0)}</td><td className="num">{fmt(parMode[m])}</td></tr>
            ) : null)}
            <tr className="rcp-sub"><td></td><td><b>Sous-total banque</b></td><td className="num"></td><td className="num"><b>{fmt(totBanque)}</b></td></tr>
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>TOTAL GÉNÉRAL (FCFA)</td><td className="num">{fmt(total)}</td></tr>
          </tfoot>
        </table>

        <table className="rcp-tbl">
          <thead><tr><th>Récapitulatif par frais</th><th className="num">Nb reçus</th><th className="num">Montant (FCFA)</th><th className="num">Part</th></tr></thead>
          <tbody>
            {Object.keys(parFrais).sort().map(k => (
              <tr key={k}><td>{k}</td><td className="num">{fmt(parFrais[k].n)}</td><td className="num">{fmt(parFrais[k].total)}</td>
                <td className="num">{total ? (Math.round(parFrais[k].total / total * 1000) / 10).toString().replace('.', ',') + ' %' : '—'}</td></tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="center mut">Aucun encaissement sur la période.</td></tr>}
          </tbody>
        </table>

        <table className="rcp-tbl">
          <thead><tr><th>Date · Heure</th><th>N° reçu</th><th>Élève</th><th>Classe</th><th>Frais</th><th>Mode</th><th className="num">Montant</th></tr></thead>
          <tbody>
            {list.map(p => {
              const e = db.eleves.find(x => x.id === p.eleveId);
              const f = db.frais.find(x => x.id === p.fraisId);
              const cl = e ? classById(db, e.classeId) : null;
              const d = new Date(p.date);
              return (
                <tr key={p.id}>
                  <td className="mut nowrap">{fmtD(p.date.slice(0, 10))} · {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}</td>
                  <td className="nowrap"><b>{p.numero}</b></td>
                  <td>{e ? e.nom + ' ' + e.prenom : '—'}</td>
                  <td>{cl ? cl.libelle : '—'}</td>
                  <td>{f ? f.libelle : '—'}</td>
                  <td>{MODES[p.mode] || p.mode}</td>
                  <td className="num">{fmt(p.montant)}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} className="center mut">Aucun encaissement sur la période.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot><tr><td colSpan={6}>TOTAL PÉRIODE (FCFA)</td><td className="num">{fmt(total)}</td></tr></tfoot>
          )}
        </table>

        <div className="rcp-lettres" style={{ background:'#f2f6fb', borderColor:'var(--navy-100)', color:'var(--navy-800)' }}>
          <b>Arrêté de caisse :</b> pour la période du {fmtD(d1)} au {fmtD(d2)}, {fmt(list.length)} encaissement(s)
          pour un total de <b>{fmt(total)} FCFA</b>, dont {fmt(totCaisse)} FCFA en caisse (espèces &amp; mobile money)
          et {fmt(totBanque)} FCFA en banque (virement &amp; chèque).
        </div>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • Journal de caisse du {fmtD(d1)} au {fmtD(d2)} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- Rapport 4 : état de solvabilité d'une classe ---------- */
const ETAT_TR = { payee:'Payée', retard:'EN RETARD', avenir:'À venir' };

export function SolvabiliteReport({ classId, mode='global', fraisId, trancheId }){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  const cl = classById(db, classId);
  const niv = cl ? niveauById(db, cl.niveauId) : null;
  if (!cl || !an) return <p className="mut">Classe introuvable.</p>;
  const els = elevesOfYear(db, anneeId).filter(e => e.classeId === classId);
  const payBy = payIndexOf(db, anneeId);
  const rows = els.map((e, i) => ({ n:i + 1, e, s:solvabiliteEleve(db, e, payBy) }));
  const frais = fraisId ? fraisSorted(db).find(f => f.id === fraisId) : null;
  const tranches = frais ? tranchesOfFrais(db, frais.id) : [];
  const tranche = tranches.find(t => t.id === trancheId) || null;
  const t = todayISO();
  const scope = mode === 'global'
    ? 'Global — tous les frais de la classe'
    : (mode === 'frais'
        ? 'Frais : ' + (frais ? frais.libelle : '—')
        : 'Tranche : ' + (frais ? frais.code + ' ' + (tranche ? tranche.label : '') + ' — échéance ' + (tranche ? fmtD(trancheISO(an, tranche)) : '—') : '—'));

  /* ----- Périmètre global ----- */
  if (mode === 'global'){
    const tot = rows.reduce((a, r) => ({ net:a.net + r.s.net, exigible:a.exigible + r.s.exigible, paye:a.paye + r.s.paye, reste:a.reste + r.s.reste }),
      { net:0, exigible:0, paye:0, reste:0 });
    const nbIns = rows.filter(r => r.s.insolvable).length;
    return (
      <div className="rcp" id="print-zone">
        <Head tag="État de solvabilité" title={cl.libelle}/>
        <div className="rcp-body">
          <div className="rcp-grid">
            <div><span>Année scolaire</span><b>{an.libelle}</b></div>
            <div><span>Niveau / effectif</span><b>{niv ? niv.libelle : '—'} — {fmt(els.length)} élève(s)</b></div>
            <div><span>Insolvables</span><b>{fmt(nbIns)} sur {fmt(els.length)}</b></div>
            <div><span>Édité le</span><b>{fmtD(t)} à {nowTime()}</b></div>
          </div>
          <div className="rcp-scope"><b>Périmètre :</b> {scope} — échéances échues au {fmtD(t)} (frais obligatoires).</div>
          <table className="rcp-tbl">
            <thead>
              <tr><th>N°</th><th>Matricule</th><th>Élève</th><th className="num">Net (FCFA)</th>
                <th className="num">Exigible à ce jour</th><th className="num">Payé</th><th className="num">Reste dû</th><th>État</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.e.id} className={r.s.insolvable ? 'rcp-rowbad' : ''}>
                  <td className="mut">{r.n}</td>
                  <td>{r.e.matricule}</td>
                  <td>{r.e.nom} {r.e.prenom}{r.e.statut !== 'actif' && <span className="mut"> (radié)</span>}</td>
                  <td className="num">{fmt(r.s.net)}</td>
                  <td className="num">{fmt(r.s.exigible)}</td>
                  <td className="num">{fmt(r.s.paye)}</td>
                  <td className="num"><b>{fmt(r.s.reste)}</b></td>
                  <td>{r.e.statut !== 'actif' ? '—' : (r.s.insolvable ? 'INSOLVABLE' : 'Solvable')}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="center mut">Aucun élève inscrit dans cette classe.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>TOTAUX (FCFA)</td>
                <td className="num">{fmt(tot.net)}</td>
                <td className="num">{fmt(tot.exigible)}</td>
                <td className="num">{fmt(tot.paye)}</td>
                <td className="num">{fmt(tot.reste)}</td>
                <td>{fmt(nbIns)}/{fmt(rows.length)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="rcp-lettres" style={{ background:'#fdf1f1', borderColor:'#f3c1bd', color:'#8c2b23' }}>
            <b>Synthèse :</b> {fmt(nbIns)} élève(s) insolvable(s) sur {fmt(rows.length)} — {fmt(tot.reste)} FCFA d&apos;exigible non réglé
            (tranches dont l&apos;échéance est dépassée au {fmtD(t)}).
          </div>
          <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
        </div>
        <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Solvabilité {cl.libelle} • Généré par Aurel School SIGES</div>
      </div>
    );
  }

  /* ----- Périmètre par frais ----- */
  if (mode === 'frais'){
    if (!frais) return <p className="mut">Frais introuvable.</p>;
    const appl = rows.some(r => r.s.parFrais.some(x => x.frais.id === frais.id));
    if (!appl) return <p className="mut">Ce frais n&apos;est pas applicable à la classe {cl.libelle}.</p>;
    const echues = tranches.filter(tr => trancheISO(an, tr) <= t).map(tr => tr.label);
    const frows = rows.map(r => ({ ...r, fr:r.s.parFrais.find(x => x.frais.id === frais.id) }));
    const tot = frows.reduce((a, r) => ({ net:a.net + r.fr.net, exigible:a.exigible + r.fr.exigible, paye:a.paye + r.fr.paye, reste:a.reste + r.fr.resteDu }),
      { net:0, exigible:0, paye:0, reste:0 });
    const nbIns = frows.filter(r => r.fr.insolvable).length;
    return (
      <div className="rcp" id="print-zone">
        <Head tag="État de solvabilité" title={cl.libelle + ' — ' + frais.libelle}/>
        <div className="rcp-body">
          <div className="rcp-grid">
            <div><span>Année scolaire</span><b>{an.libelle}</b></div>
            <div><span>Frais</span><b>{frais.code} — {frais.libelle}</b></div>
            <div><span>Insolvables (frais)</span><b>{fmt(nbIns)} sur {fmt(rows.length)}</b></div>
            <div><span>Édité le</span><b>{fmtD(t)} à {nowTime()}</b></div>
          </div>
          <div className="rcp-scope"><b>Périmètre :</b> {scope} — tranches échues : {echues.length ? echues.join(', ') : 'aucune à ce jour'}</div>
          <table className="rcp-tbl">
            <thead>
              <tr><th>N°</th><th>Matricule</th><th>Élève</th><th className="num">Net du frais</th>
                <th className="num">Exigible à ce jour</th><th className="num">Payé</th><th className="num">Reste dû</th><th>État</th></tr>
            </thead>
            <tbody>
              {frows.map(r => (
                <tr key={r.e.id} className={r.fr.insolvable ? 'rcp-rowbad' : ''}>
                  <td className="mut">{r.n}</td>
                  <td>{r.e.matricule}</td>
                  <td>{r.e.nom} {r.e.prenom}</td>
                  <td className="num">{fmt(r.fr.net)}</td>
                  <td className="num">{fmt(r.fr.exigible)}</td>
                  <td className="num">{fmt(r.fr.paye)}</td>
                  <td className="num"><b>{fmt(r.fr.resteDu)}</b></td>
                  <td>{r.e.statut !== 'actif' ? '—' : (r.fr.insolvable ? 'INSOLVABLE' : 'Solvable')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>TOTAUX (FCFA)</td>
                <td className="num">{fmt(tot.net)}</td>
                <td className="num">{fmt(tot.exigible)}</td>
                <td className="num">{fmt(tot.paye)}</td>
                <td className="num">{fmt(tot.reste)}</td>
                <td>{fmt(nbIns)}/{fmt(rows.length)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="rcp-lettres" style={{ background:'#fdf1f1', borderColor:'#f3c1bd', color:'#8c2b23' }}>
            <b>Synthèse :</b> {fmt(nbIns)} élève(s) en retard sur ce frais — {fmt(tot.reste)} FCFA d&apos;exigible non réglé.
          </div>
          <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
        </div>
        <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Solvabilité {cl.libelle} / {frais.code} • Généré par Aurel School SIGES</div>
      </div>
    );
  }

  /* ----- Périmètre par tranche ----- */
  if (!frais || !tranche) return <p className="mut">Tranche introuvable.</p>;
  const trows = rows.map(r => {
    const fr = r.s.parFrais.find(x => x.frais.id === frais.id);
    const tr = fr ? fr.tranches.find(x => x.id === tranche.id) : null;
    return { ...r, fr, tr };
  });
  const nbRetard = trows.filter(r => r.tr && r.tr.etat === 'retard').length;
  const totMt = trows.reduce((a, r) => a + (r.tr ? r.tr.montant : 0), 0);
  const totReste = trows.reduce((a, r) => a + (r.tr ? Math.max(0, r.tr.exigibleCumul - r.tr.payeCumul) : 0), 0);
  return (
    <div className="rcp" id="print-zone">
      <Head tag="État de solvabilité" title={cl.libelle + ' — ' + frais.code + ' ' + tranche.label}/>
        <div className="rcp-body">
          <div className="rcp-grid">
            <div><span>Année scolaire</span><b>{an.libelle}</b></div>
            <div><span>Frais / tranche</span><b>{frais.code} — {tranche.label} ({tranche.pourcentage} %)</b></div>
            <div><span>Échéance</span><b>{fmtD(trancheISO(an, tranche))}{trancheISO(an, tranche) <= t ? ' (échue)' : ' (à venir)'}</b></div>
            <div><span>Édité le</span><b>{fmtD(t)} à {nowTime()}</b></div>
          </div>
          <div className="rcp-scope"><b>Périmètre :</b> {scope} — contrôle du règlement de la tranche au sens des échéances.</div>
          <table className="rcp-tbl">
            <thead>
              <tr><th>N°</th><th>Matricule</th><th>Élève</th><th className="num">Montant tranche</th>
                <th className="num">Cumul exigible</th><th className="num">Payé (cumul)</th><th>État de la tranche</th></tr>
            </thead>
            <tbody>
              {trows.map(r => (
                <tr key={r.e.id} className={r.tr && r.tr.etat === 'retard' ? 'rcp-rowbad' : ''}>
                  <td className="mut">{r.n}</td>
                  <td>{r.e.matricule}</td>
                  <td>{r.e.nom} {r.e.prenom}</td>
                  <td className="num">{r.tr ? fmt(r.tr.montant) : '—'}</td>
                  <td className="num">{r.tr ? fmt(r.tr.exigibleCumul) : '—'}</td>
                  <td className="num">{r.tr ? fmt(r.tr.payeCumul) : '—'}</td>
                  <td>{r.tr ? (r.tr.etat === 'payee' ? (r.tr.due ? 'Payée' : 'Payée (avance)') : ETAT_TR[r.tr.etat]) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>TOTAUX (FCFA)</td>
                <td className="num">{fmt(totMt)}</td>
                <td colSpan={2}></td>
                <td>{fmt(nbRetard)} en retard</td>
              </tr>
            </tfoot>
          </table>
          <div className="rcp-lettres" style={{ background:'#fdf1f1', borderColor:'#f3c1bd', color:'#8c2b23' }}>
            <b>Synthèse :</b> {fmt(nbRetard)} élève(s) n&apos;ont pas réglé cette tranche à hauteur de l&apos;exigible cumulé — {fmt(totReste)} FCFA restent dus.
          </div>
          <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
        </div>
        <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Solvabilité {cl.libelle} / {frais.code}-{tranche.label} • Généré par Aurel School SIGES</div>
      </div>
  );
}


/* ---------- Rapport 5 : situation des frais d'un élève (imprimable) ---------- */
export function EleveSituationReport({ eleve }){
  const { db } = useApp();
  const cl = classById(db, eleve.classeId);
  const an = yearById(db, eleve.anneeId);
  const rows = situationRows(db, eleve).filter(r => r.applicable);
  const tot = situationTotals(db, eleve);
  const sol = solvabiliteEleve(db, eleve);
  const hist = db.paiements.filter(p => p.eleveId === eleve.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Situation des frais" title={eleve.nom + ' ' + eleve.prenom}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Matricule / Classe</span><b>{eleve.photo && <img src={eleve.photo} alt="" style={{ width:22, height:22, borderRadius:'50%', objectFit:'cover', verticalAlign:'-5px', marginRight:5 }}/>}{eleve.matricule} — {cl ? cl.libelle : '—'}</b></div>
          <div><span>Année scolaire</span><b>{an ? an.libelle : '—'}</b></div>
          <div><span>Né(e) le</span><b>{eleve.dateNaissance ? fmtD(eleve.dateNaissance) + (eleve.lieuNaissance ? ' à ' + eleve.lieuNaissance : '') : '—'}</b></div>
          <div><span>Tuteur / Contact</span><b>{eleve.tuteur || '—'} ({eleve.tel || '—'})</b></div>
        </div>
        <div className="rcp-scope">
          <b>Synthèse :</b> net à payer {fmt(tot.net)} FCFA • réductions {fmt(tot.reduction)} FCFA • payé {fmt(tot.paye)} FCFA •
          solde {fmt(tot.solde)} FCFA — exigible à ce jour {fmt(sol.exigible)} FCFA
          {sol.insolvable
            ? ' — élève INSOLVABLE (' + fmt(sol.reste) + ' FCFA d’exigible non réglé)'
            : ' — échéances exigibles réglées'}
        </div>

        <table className="rcp-tbl">
          <thead>
            <tr><th>Frais</th><th className="num">Tarif</th><th className="num">Réduction</th><th className="num">Net à payer</th>
              <th className="num">Payé</th><th className="num">Solde</th><th>État</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.frais.id}>
                <td>{r.frais.libelle}{!r.frais.obligatoire ? ' (optionnel)' : ''}</td>
                <td className="num">{fmt(r.du)}</td>
                <td className="num">{r.reduction ? '-' + fmt(r.reduction) : '—'}</td>
                <td className="num"><b>{fmt(r.net)}</b></td>
                <td className="num">{fmt(r.paye)}</td>
                <td className="num">{fmt(r.solde)}</td>
                <td>{r.solde === 0 ? 'Soldé' : 'En cours'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="center mut">Aucun frais applicable.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td>TOTAUX (FCFA)</td><td className="num">{fmt(tot.brut)}</td><td className="num">-{fmt(tot.reduction)}</td>
              <td className="num">{fmt(tot.net)}</td><td className="num">{fmt(tot.paye)}</td><td className="num">{fmt(tot.solde)}</td><td></td></tr>
          </tfoot>
        </table>

        <table className="rcp-tbl">
          <thead><tr><th>Échéances de paiement (tranches)</th><th className="num">Montant</th><th>Échéance</th><th>État</th></tr></thead>
          <tbody>
            {sol.parFrais.map(fr => fr.tranches.map((t, i) => (
              <tr key={fr.frais.id + '-' + t.id} className={t.etat === 'retard' ? 'rcp-rowbad' : ''}>
                <td>{fr.frais.code} — {fr.frais.libelle} · {t.label}</td>
                <td className="num">{fmt(t.montant)}</td>
                <td>{fmtD(t.iso)}</td>
                <td>{t.etat === 'payee' ? 'Payée' + (t.due ? '' : ' (avance)') : t.etat === 'retard' ? 'EN RETARD' : 'À venir'}</td>
              </tr>
            )))}
          </tbody>
        </table>

        {hist.length > 0 && (
          <table className="rcp-tbl">
            <thead><tr><th>Historique des paiements</th><th>N° reçu</th><th>Frais</th><th>Mode</th><th className="num">Montant</th><th>Statut</th></tr></thead>
            <tbody>
              {hist.map(p => {
                const f = db.frais.find(x => x.id === p.fraisId);
                return (
                  <tr key={p.id}>
                    <td>{fmtD(p.date.slice(0, 10))}</td>
                    <td><b>{p.numero}</b></td>
                    <td>{f ? f.libelle : '—'}</td>
                    <td>{MODES[p.mode] || p.mode}</td>
                    <td className="num">{fmt(p.montant)}</td>
                    <td>{p.statut === 'valide' ? 'Validé' : 'Annulé'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • {an ? an.libelle : ''} • {eleve.matricule} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- Rapport 6 : état des recouvrements PAR FRAIS ---------- */
export function RecoveryByFraisReport(){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  if (!an) return <p className="mut">Aucune année sélectionnée.</p>;
  const payBy = payIndexOf(db, anneeId);
  const els = db.eleves.filter(e => e.anneeId === anneeId && e.statut === 'actif');
  const rows = fraisSorted(db).map(f => {
    let effectif = 0, brut = 0, reduction = 0, net = 0, encaisse = 0;
    els.forEach(e => {
      const du = tarifEffectif(db, anneeId, f.id, e.classeId, e.regime, statutEleveOf(db, e));
      if (du == null) return;
      effectif++;
      const red = reductionFor(db, e, f.id, du);
      brut += du; reduction += red;
      const n = du - red;
      net += n;
      encaisse += Math.min((payBy[e.id] && payBy[e.id][f.id]) || 0, n);
    });
    return { f, effectif, brut, reduction, net, encaisse, tranches: tranchesOfFrais(db, f.id) };
  }).filter(r => r.effectif > 0);
  const tot = rows.reduce((a, r) => ({ brut:a.brut + r.brut, reduction:a.reduction + r.reduction, net:a.net + r.net, encaisse:a.encaisse + r.encaisse }), { brut:0, reduction:0, net:0, encaisse:0 });

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Recouvrement par frais" title={an.libelle}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Année scolaire</span><b>{an.libelle}</b></div>
          <div><span>Types de frais</span><b>{fmt(rows.length)}</b></div>
          <div><span>Élèves actifs</span><b>{fmt(els.length)}</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())} à {nowTime()}</b></div>
        </div>
        <table className="rcp-tbl">
          <thead>
            <tr><th>Frais</th><th className="num">Élèves concernés</th><th className="num">Attendu net</th>
              <th className="num">Encaissé</th><th className="num">Reste</th><th className="num">Taux</th><th>Tranches (échéances)</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.f.id}>
                <td><b>{r.f.code}</b> — {r.f.libelle}</td>
                <td className="num">{fmt(r.effectif)}</td>
                <td className="num">{fmt(r.net)}</td>
                <td className="num">{fmt(r.encaisse)}</td>
                <td className="num">{fmt(Math.max(0, r.net - r.encaisse))}</td>
                <td className="num"><b>{pctTxt(r.net > 0 ? r.encaisse / r.net : 0)}</b></td>
                <td className="mut" style={{ fontSize:10.8 }}>{r.tranches.map(t => t.label + ' ' + t.pourcentage + ' % · ' + pad2m(t.jour) + '/' + pad2m(t.mois)).join(' • ')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAUX (FCFA)</td><td></td>
              <td className="num">{fmt(tot.net)}</td>
              <td className="num">{fmt(tot.encaisse)}</td>
              <td className="num">{fmt(Math.max(0, tot.net - tot.encaisse))}</td>
              <td className="num">{pctTxt(tot.net > 0 ? tot.encaisse / tot.net : 0)}</td><td></td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-lettres" style={{ background:'#f2f6fb', borderColor:'var(--navy-100)', color:'var(--navy-800)' }}>
          <b>Récapitulatif :</b> attendu net de l&apos;année {fmt(tot.net)} FCFA (après {fmt(tot.reduction)} FCFA de réductions) —
          encaissé {fmt(tot.encaisse)} FCFA — reste à recouvrer {fmt(Math.max(0, tot.net - tot.encaisse))} FCFA.
        </div>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • Recouvrement par frais • {an.libelle} • Généré par Aurel School SIGES</div>
    </div>
  );
}
function pad2m(n){ return String(n).padStart(2, '0'); }

/* ---------- Rapport 7 : état des recouvrements PAR TRANCHE ---------- */
export function RecoveryByTrancheReport(){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  if (!an) return <p className="mut">Aucune année sélectionnée.</p>;
  const t = todayISO();
  const payBy = payIndexOf(db, anneeId);
  const els = db.eleves.filter(e => e.anneeId === anneeId && e.statut === 'actif');
  const rows = [];
  fraisSorted(db).forEach(f => {
    const trs = tranchesOfFrais(db, f.id);
    const agg = trs.map(() => ({ attendu:0, encaisse:0 }));
    let concernes = 0;
    els.forEach(e => {
      const du = tarifEffectif(db, anneeId, f.id, e.classeId, e.regime, statutEleveOf(db, e));
      if (du == null) return;
      concernes++;
      const red = reductionFor(db, e, f.id, du);
      const net = du - red;
      const paye = Math.min((payBy[e.id] && payBy[e.id][f.id]) || 0, net);
      const montants = trancheMontants(net, trs);
      let cumul = 0;
      trs.forEach((tr, i) => {
        const prev = cumul; cumul += montants[i];
        agg[i].attendu += montants[i];
        agg[i].encaisse += Math.max(0, Math.min(paye, cumul) - prev);
      });
    });
    if (!concernes) return;
    trs.forEach((tr, i) => {
      const iso = trancheISO(an, tr);
      rows.push({ f, tr, iso, echue:iso <= t, attendu:agg[i].attendu, encaisse:agg[i].encaisse });
    });
  });
  const tot = rows.reduce((a, r) => ({ attendu:a.attendu + r.attendu, encaisse:a.encaisse + r.encaisse }), { attendu:0, encaisse:0 });

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Recouvrement par tranche" title={an.libelle}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Année scolaire</span><b>{an.libelle}</b></div>
          <div><span>Tranches suivies</span><b>{fmt(rows.length)}</b></div>
          <div><span>Élèves actifs</span><b>{fmt(els.length)}</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())} à {nowTime()}</b></div>
        </div>
        <div className="rcp-scope"><b>Périmètre :</b> chaque tranche de chaque frais — les paiements sont affectés aux tranches dans l&apos;ordre des échéances.</div>
        <table className="rcp-tbl">
          <thead>
            <tr><th>Frais</th><th>Tranche</th><th className="num">Part</th><th>Échéance</th>
              <th className="num">Attendu tranche</th><th className="num">Encaissé</th><th className="num">Reste</th><th className="num">Taux</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.f.id + '-' + r.tr.id} className={r.echue && r.encaisse < r.attendu ? 'rcp-rowbad' : ''}>
                <td><b>{r.f.code}</b> — {r.f.libelle}</td>
                <td>{r.tr.label}</td>
                <td className="num">{r.tr.pourcentage} %</td>
                <td>{fmtD(r.iso)}</td>
                <td className="num">{fmt(r.attendu)}</td>
                <td className="num">{fmt(r.encaisse)}</td>
                <td className="num">{fmt(Math.max(0, r.attendu - r.encaisse))}</td>
                <td className="num"><b>{pctTxt(r.attendu > 0 ? r.encaisse / r.attendu : 0)}</b></td>
                <td>{r.echue ? (r.encaisse >= r.attendu ? 'Réglée' : 'Échue — en retard') : 'À venir'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>TOTAUX (FCFA)</td>
              <td className="num">{fmt(tot.attendu)}</td>
              <td className="num">{fmt(tot.encaisse)}</td>
              <td className="num">{fmt(Math.max(0, tot.attendu - tot.encaisse))}</td>
              <td className="num">{pctTxt(tot.attendu > 0 ? tot.encaisse / tot.attendu : 0)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-lettres" style={{ background:'#f2f6fb', borderColor:'var(--navy-100)', color:'var(--navy-800)' }}>
          <b>Récapitulatif :</b> attendu cumulé des tranches {fmt(tot.attendu)} FCFA — encaissé {fmt(tot.encaisse)} FCFA —
          reste {fmt(Math.max(0, tot.attendu - tot.encaisse))} FCFA. Les tranches échues non réglées sont surlignées.
        </div>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • Recouvrement par tranche • {an.libelle} • Généré par Aurel School SIGES</div>
    </div>
  );
}


/* ---------- Rapport 8 : liste nominative d'une classe (ordre alphabétique) ---------- */
export function ListeClasseReport({ classId }){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  const cl = classById(db, classId);
  const niv = cl ? niveauById(db, cl.niveauId) : null;
  if (!cl || !an) return <p className="mut">Classe introuvable.</p>;
  const els = elevesOfYear(db, anneeId)
    .filter(e => e.classeId === classId && e.statut === 'actif')
    .sort((a, b) => ((a.nom + ' ' + a.prenom).localeCompare(b.nom + ' ' + b.prenom, 'fr')));
  const nbG = els.filter(e => e.sexe === 'M').length;
  const nbF = els.length - nbG;
  const nbI = els.filter(e => e.regime === 'interne').length;

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Liste nominative" title={cl.libelle}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Année scolaire</span><b>{an.libelle}</b></div>
          <div><span>Niveau</span><b>{niv ? niv.libelle : '—'}</b></div>
          <div><span>Effectif</span><b>{fmt(els.length)} élève(s) — {fmt(nbG)} G / {fmt(nbF)} F</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())} à {nowTime()}</b></div>
        </div>
        <div className="rcp-scope"><b>Classement :</b> ordre alphabétique (nom, puis prénom) — {fmt(nbI)} interne(s), {fmt(els.length - nbI)} externe(s).</div>
        <table className="rcp-tbl">
          <thead>
            <tr><th style={{ width:56 }}>N°</th><th>Nom et prénoms</th><th style={{ width:90 }}>Genre</th></tr>
          </thead>
          <tbody>
            {els.map((e, i) => (
              <tr key={e.id}>
                <td className="mut">{i + 1}</td>
                <td><b>{e.nom}</b> {e.prenom}</td>
                <td>{e.sexe === 'M' ? 'M' : 'F'}</td>
              </tr>
            ))}
            {els.length === 0 && <tr><td colSpan={3} className="center mut">Aucun élève actif dans cette classe.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={2}>EFFECTIF TOTAL — {fmt(nbG)} garçons, {fmt(nbF)} filles</td><td className="num">{fmt(els.length)}</td></tr>
          </tfoot>
        </table>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Liste nominative {cl.libelle} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- Rapport 9 : statistiques des inscrits — genre & classes ---------- */
function ageAu(iso, refIso){
  if (!iso) return null;
  const d = new Date(iso), r = new Date(refIso);
  if (isNaN(d) || isNaN(r)) return null;
  let a = r.getFullYear() - d.getFullYear();
  const m = r.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < d.getDate())) a--;
  return a;
}

export function StatsGenreClassesReport(){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  if (!an) return <p className="mut">Aucune année sélectionnée.</p>;
  const els = elevesOfYear(db, anneeId).filter(e => e.statut === 'actif');
  const classes = classesSorted(db).filter(c => els.some(e => e.classeId === c.id));
  const rowsClasse = classes.map(c => {
    const list = els.filter(e => e.classeId === c.id);
    return { c, tot:list.length,
      g:list.filter(e => e.sexe === 'M').length,
      f:list.filter(e => e.sexe === 'F').length,
      internes:list.filter(e => e.regime === 'interne').length };
  });
  const totG = els.filter(e => e.sexe === 'M').length;
  const totF = els.length - totG;
  const totI = els.filter(e => e.regime === 'interne').length;

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Statistiques des inscrits" title={an.libelle + ' — genre & classes'}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Année scolaire</span><b>{an.libelle}</b></div>
          <div><span>Inscrits actifs</span><b>{fmt(els.length)}</b></div>
          <div><span>Répartition</span><b>{fmt(totG)} G ({els.length ? Math.round(totG/els.length*100) : 0} %) — {fmt(totF)} F ({els.length ? Math.round(totF/els.length*100) : 0} %)</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())} à {nowTime()}</b></div>
        </div>
        <table className="rcp-tbl">
          <thead><tr><th>Classe</th><th>Niveau</th><th className="num">Effectif</th><th className="num">Garçons</th><th className="num">Filles</th><th className="num">% filles</th><th className="num">Internes</th><th className="num">Externes</th></tr></thead>
          <tbody>
            {rowsClasse.map(r => (
              <tr key={r.c.id}>
                <td><b>{r.c.libelle}</b></td>
                <td>{(niveauById(db, r.c.niveauId) || {}).libelle || ''}</td>
                <td className="num">{fmt(r.tot)}</td>
                <td className="num">{fmt(r.g)}</td>
                <td className="num">{fmt(r.f)}</td>
                <td className="num">{r.tot ? Math.round(r.f/r.tot*100) : 0} %</td>
                <td className="num">{fmt(r.internes)}</td>
                <td className="num">{fmt(r.tot - r.internes)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>TOTAL</td>
              <td className="num">{fmt(els.length)}</td>
              <td className="num">{fmt(totG)}</td>
              <td className="num">{fmt(totF)}</td>
              <td className="num">{els.length ? Math.round(totF/els.length*100) : 0} %</td>
              <td className="num">{fmt(totI)}</td>
              <td className="num">{fmt(els.length - totI)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-lettres" style={{ background:'#f4f5f7', borderColor:'#d4d8df', color:'#2c3648' }}>
          <b>Synthèse :</b> {fmt(els.length)} élève(s) actif(s) — {fmt(totG)} garçons et {fmt(totF)} filles —
          dont {fmt(totI)} interne(s) et {fmt(els.length - totI)} externe(s).
        </div>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Statistiques des inscrits (genre & classes) • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- Rapport 10 : répartition par âge et par classe ---------- */
const BANDES_AGE = [
  { label:'10 ans et moins', min:0, max:10 },
  { label:'11 – 12 ans', min:11, max:12 },
  { label:'13 – 14 ans', min:13, max:14 },
  { label:'15 – 16 ans', min:15, max:16 },
  { label:'17 – 18 ans', min:17, max:18 },
  { label:'19 ans et plus', min:19, max:200 }
];

export function StatsAgesReport(){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  if (!an) return <p className="mut">Aucune année sélectionnée.</p>;
  const ref = todayISO();
  const els = elevesOfYear(db, anneeId).filter(e => e.statut === 'actif');
  const classes = classesSorted(db).filter(c => els.some(e => e.classeId === c.id));
  const rowsClasse = classes.map(c => {
    const list = els.filter(e => e.classeId === c.id);
    return { c, tot:list.length,
      ages:BANDES_AGE.map(b => list.filter(e => { const a = ageAu(e.dateNaissance, ref); return a != null && a >= b.min && a <= b.max; }).length),
      nd:list.filter(e => ageAu(e.dateNaissance, ref) == null).length };
  });
  const agesAvecDate = els.filter(e => ageAu(e.dateNaissance, ref) != null);
  const ageMoyen = agesAvecDate.length ? Math.round(agesAvecDate.reduce((s, e) => s + ageAu(e.dateNaissance, ref), 0) / agesAvecDate.length) : null;

  return (
    <div className="rcp" id="print-zone">
      <Head tag="Répartition par âge" title={an.libelle}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Année scolaire</span><b>{an.libelle}</b></div>
          <div><span>Âge de référence</span><b>au {fmtD(ref)}</b></div>
          <div><span>Âge moyen</span><b>{ageMoyen != null ? ageMoyen + ' ans' : '—'}</b></div>
          <div><span>Édité le</span><b>{fmtD(ref)} à {nowTime()}</b></div>
        </div>
        <div className="rcp-scope"><b>Lecture :</b> effectif de chaque classe par tranche d&apos;âge, calculé sur les dates de naissance déclarées à la fiche d&apos;inscription.</div>
        <table className="rcp-tbl">
          <thead>
            <tr><th>Classe</th>{BANDES_AGE.map(b => <th key={b.label} className="num">{b.label}</th>)}<th className="num">Non renseigné</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {rowsClasse.map(r => (
              <tr key={r.c.id}>
                <td><b>{r.c.libelle}</b></td>
                {r.ages.map((n, i) => <td key={i} className="num">{n ? fmt(n) : '—'}</td>)}
                <td className="num">{r.nd ? fmt(r.nd) : '—'}</td>
                <td className="num"><b>{fmt(r.tot)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL</td>
              {BANDES_AGE.map((b, i) => <td key={i} className="num">{fmt(rowsClasse.reduce((s, r) => s + r.ages[i], 0))}</td>)}
              <td className="num">{fmt(rowsClasse.reduce((s, r) => s + r.nd, 0))}</td>
              <td className="num">{fmt(els.length)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-lettres" style={{ background:'#f4f5f7', borderColor:'#d4d8df', color:'#2c3648' }}>
          <b>Synthèse :</b> {fmt(agesAvecDate.length)} élève(s) avec date de naissance renseignée — âge moyen {ageMoyen != null ? ageMoyen + ' ans' : 'non calculable'} au {fmtD(ref)}.
        </div>
        <div className="rcp-foot">
          <div className="sig">L&apos;Économe</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • {an.libelle} • Répartition par âge • Généré par Aurel School SIGES</div>
    </div>
  );
}


/* ================= v5.4 : BULLETINS & BORDEREAUX ================= */

/* Lignes d'un élève groupées par groupe du plan (ordre du bulletin).
   → [{ id, grp, lignes:[{ m, ens, moy, coef, points, parSeq }], tot:{points, coef, moy} }]
   v6.5 (audit) : l'énumération des groupes vient de groupesDuPlan (business.js) —
   une seule source de vérité pour l'ordre d'apparition au bulletin. */
function lignesGroupees(db, anneeId, el, periode, mats){
  const plan = planOf(db, el.classeId);
  const seqs = sequencesSorted(db);
  const groups = groupesDuPlan(db, el.classeId).map(g => ({ id:g.id, grp:g.grp, lignes:[] }));
  plan.forEach(pe => {
    const m = mats.find(x => x.id === pe.matiereId);
    if (!m) return;
    const g = groups.find(x => x.id === (pe.groupeId || '_'));
    if (!g) return;   /* ne devrait pas arriver : groupesDuPlan couvre tout le plan */
    const moy = moyenneMatiere(db, anneeId, el.id, m.id, periode);
    const coef = pe.coefficient || 1;
    const ens = pe.enseignantId ? (db.enseignants || []).find(t => t.id === pe.enseignantId) : null;
    const parSeq = seqs.map(sq => moyenneMatiere(db, anneeId, el.id, m.id, sq.id));
    /* v6.0 : moyenne de classe et rang de l'élève dans la matière (modèle du
       récapitulatif annuel — colonnes Moy.Cla. et Rang) */
    const rm = rangMatiere(db, anneeId, el.classeId, el.id, m.id, periode);
    g.lignes.push({ m, ens, moy, coef, points: moy != null ? Math.round(moy * coef * 100) / 100 : null, parSeq, moyClasse: rm.moyClasse, rangMat: rm.rang });
  });
  groups.forEach(g => {
    const lg = g.lignes.filter(l => l.moy != null);
    g.tot = { points: Math.round(lg.reduce((t, l) => t + l.points, 0) * 100) / 100, coef: lg.reduce((t, l) => t + l.coef, 0) };
    g.tot.moy = g.tot.coef > 0 ? Math.round(g.tot.points / g.tot.coef * 100) / 100 : null;
  });
  return groups.filter(g => g.lignes.length);   /* un groupe sans matière retenue n'apparaît pas */
}

const fmt2r = v => v == null ? '—' : v.toFixed(2).replace('.', ',');

/* ---------- v5.4 : bulletin individuel — SÉQUENCE ou TRIMESTRE (A4 portrait)
   Matières groupées par groupe du plan ; une seule note par matière
   et par séquence ; totaux Points / Coef / Moyenne par groupe. ---------- */
export function BulletinReport({ eleveId, periode, periodeLabel, matieres }){
  const { db, users, anneeId } = useApp();
  const el = (db.eleves || []).find(e => e.id === eleveId);
  if (!el) return <p className="mut">Élève introuvable.</p>;
  const cl = classById(db, el.classeId);
  const titulaire = cl && cl.titulaireId ? ((users || []).find(u => u.id === cl.titulaireId) || null) : null;
  const an = yearById(db, anneeId);
  const st = settingsOf(db);
  const bul = bulletinOf(db);
  const mats = (matieres && matieres.length ? matieres : (db.matieres || []));
  const groups = lignesGroupees(db, anneeId, el, periode, mats);
  const gen = moyenneGenerale(db, anneeId, el.id, periode);
  const cls = classementClasse(db, anneeId, el.classeId, periode);
  const rang = cls.rangs.get(el.id);
  const manq = matieresManquantes(db, anneeId, el.id, periode);
  const effectif = cls.classes.length + cls.nonClasses.size;
  const nbCols = 7;
  const qrTxt = qrBulletin(db, { eleveId:el.id, periodeLabel, moy:gen, rang:rang ? rang + '/' + effectif : (gen != null ? 'NC' : '-') });
  /* v6.0 : appréciations selon le mode de la classe (classique ou APC) */
  const appNote = n => appreciationNoteOf(db, cl, n);
  const appMoy = n => appreciationMoyenneOf(db, cl, n);
  return (
    <div className="rcp" id="print-zone">
      <div className="rcp-body">
        <div className="rcp-head2">
          <div className="bh">{bul.blocGauche}</div>
          {st.logo
            ? <img className="rcp-logo" src={st.logo} alt="" style={{ width:64, height:64, objectFit:'contain' }}/>
            : <Logo size={56}/>}
          <div className="bh bh-r">{bul.blocDroit}</div>
        </div>
        <div className="rcp-titre">
          <div className="an">Année Scolaire : {an ? an.libelle : '—'}</div>
          <div className="ti">BULLETIN DE NOTES — {periodeLabel}</div>
        </div>
        <div className="rcp-id">
          <b>Noms et Prénoms :</b> {el.nom} {el.prenom} &nbsp;&nbsp; <b>Matricule :</b> {el.matricule} &nbsp;&nbsp; <b>Classe :</b> {cl ? cl.libelle : '—'}{bul.sections.effectif ? <> &nbsp;&nbsp; <b>Effectif :</b> {effectif}</> : null}<br/>
          <b>Né(e) le :</b> {el.dateNaissance || '—'} &nbsp;&nbsp; <b>À :</b> {el.lieuNaissance || '—'} &nbsp;&nbsp; <b>Genre :</b> {el.sexe === 'F' ? 'Fille' : 'Garçon'} &nbsp;&nbsp; <b>Statut :</b> {el.regime === 'interne' ? 'Interne' : 'Externe'} &nbsp;&nbsp; <b>Redoublant :</b> {el.statutEleve === 'ancien' ? 'Oui' : 'Non'}
        </div>
        <table className="rcp-tbl compact">
          <thead><tr>
            <th>DISCIPLINES / ENSEIGNANTS</th>
            <th style={{ textAlign:'center' }}>{periode === '' ? 'Moy. /20' : (/^T[1-3]$/.test(periode) ? 'Moy. trim. /20' : 'Note /20')}</th>
            <th style={{ textAlign:'center' }}>Coef</th><th style={{ textAlign:'center' }}>Points</th>
            <th style={{ textAlign:'center' }}>Moy.Cla.</th><th style={{ textAlign:'center' }}>Rang</th>
            <th>Appréciation</th>
          </tr></thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.id}>
                <tr className="rcp-grp"><td colSpan={nbCols}>{g.grp ? g.grp.libelle : 'Autres matières'}</td></tr>
                {g.lignes.map(l => (
                  <tr key={l.m.id}>
                    <td>{l.m.libelle}{l.ens ? <div className="mut" style={{ fontSize:9 }}>{l.ens.nom} {l.ens.prenom}</div> : null}</td>
                    <td className="num"><b>{fmt2r(l.moy)}</b></td>
                    <td className="num">{l.coef}</td>
                    <td className="num">{l.points == null ? '—' : fmt2r(l.points)}</td>
                    <td className="num">{l.moyClasse == null ? '—' : fmt2r(l.moyClasse)}</td>
                    <td className="num">{l.rangMat == null ? '—' : l.rangMat}<sup>e</sup></td>
                    <td>{l.moy == null ? '—' : (appNote(l.moy) || '—')}</td>
                  </tr>
                ))}
                <tr className="rcp-tot">
                  <td>{g.grp ? g.grp.libelle : 'Autres'} — Total Points : {fmt2r(g.tot.points)} / Total Coef : {g.tot.coef}</td>
                  <td className="num"><b>{fmt2r(g.tot.moy)}</b></td>
                  <td className="num"><b>{g.tot.coef}</b></td>
                  <td className="num"><b>{fmt2r(g.tot.points)}</b></td>
                  <td className="num">—</td><td className="num">—</td>
                  <td>{g.tot.moy == null ? '—' : (appMoy(g.tot.moy) || '')}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
          <tfoot><tr>
            <td><b>MOYENNE GÉNÉRALE</b></td>
            <td className="num"><b>{fmt2r(gen)}</b></td>
            <td className="num"><b>{groups.reduce((t, g) => t + g.tot.coef, 0)}</b></td>
            <td className="num"><b>{fmt2r(groups.reduce((t, g) => t + g.tot.points, 0))}</b></td>
            <td className="num">{fmt2r(cls.classes.length ? cls.classes.reduce((t, c) => t + c.moy, 0) / cls.classes.length : null)}</td>
            <td className="num">{rang ? rang : (gen != null ? 'NC' : '—')}</td>
            <td><b>{gen != null ? (appMoy(gen) || '') : '—'}</b></td>
          </tr></tfoot>
        </table>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginTop:10, fontSize:12.5, color:'#1c2b45' }}>
          <div><b>Rang :</b> {rang ? rang + ' / ' + effectif : (gen != null ? 'NC — non classé' : '—')}</div>
          <div><b>Meilleure moyenne :</b> {fmt2r(cls.classes.length ? cls.classes[0].moy : null)}</div>
        </div>
        {rang == null && gen != null && manq.length > 0 && (
          <div style={{ marginTop:8, fontSize:11.5, border:'1px solid #c9d4e2', background:'#f6f9fc', borderRadius:6, padding:'7px 10px' }}>
            <b>Non classé (NC)</b> — aucune note dans l'ensemble des matières indispensables :
            <b> {manq.map(m => m.libelle).join(', ')}</b>.
          </div>
        )}
        <div className="rcp-foot" style={{ alignItems:'flex-end' }}>
          <div className="sig">Le Professeur titulaire{titulaire ? <div className="mut" style={{ fontSize:10, fontWeight:600 }}>{titulaire.nom}</div> : null}</div>
          <div className="sig">{bul.signature}</div>
          {qrTxt && <QrCode text={qrTxt} size={68} caption="Scanner pour vérifier"/>}
        </div>
      </div>
      <div className="rcp-note">{st.piedEtat} • {an ? an.libelle : ''} • Bulletin de {el.nom} {el.prenom} — {periodeLabel} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- v5.4 : RÉCAPITULATIF ANNUEL DES NOTES (exemple fourni) ----------
   En-tête personnalisable (bloc gauche / bloc droit), identité complète,
   matières groupées avec notes par séquence, moyenne, coef, points,
   totaux par groupe, bilan disciplinaire annuel (absences), synthèse
   par groupe avec moyenne générale et rang, lieu et signature. ---------- */
export function RecapAnnuelReport({ eleveId, matieres }){
  const { db, users, anneeId } = useApp();
  const el = (db.eleves || []).find(e => e.id === eleveId);
  if (!el) return <p className="mut">Élève introuvable.</p>;
  const an = yearById(db, anneeId);
  const cl = classById(db, el.classeId);
  const st = settingsOf(db);
  const bul = bulletinOf(db);
  const mats = (matieres && matieres.length ? matieres : (db.matieres || []));
  const groups = lignesGroupees(db, anneeId, el, '', mats);
  const seqs = sequencesSorted(db);
  const gen = moyenneGenerale(db, anneeId, el.id, '');
  const cls = classementClasse(db, anneeId, el.classeId, '');
  const rang = cls.rangs.get(el.id);
  const manq = matieresManquantes(db, anneeId, el.id, '');
  const effectif = cls.classes.length + cls.nonClasses.size;
  /* v5.5→v5.7 : absences comptées en HEURES (durée de chaque absence) */
  const abs = absencesDe(db, anneeId, el.id, '');
  const absJust = abs.just, absNonJust = abs.nonJust;
  const faits = faitsDe(db, anneeId, el.id);
  const consignes = faits.filter(f => f.categorie !== 'absence').length;
  const sec = bul.sections;
  const totPts = groups.reduce((t, g) => t + g.tot.points, 0);
  const totCoef = groups.reduce((t, g) => t + g.tot.coef, 0);
  const nbCols = 7 + seqs.length;
  const titulaire = cl && cl.titulaireId ? ((users || []).find(u => u.id === cl.titulaireId) || null) : null;
  const qrTxt = qrBulletin(db, { eleveId:el.id, periodeLabel:'Année complète', moy:gen, rang:rang ? rang + '/' + effectif : (gen != null ? 'NC' : '-') });
  /* v6.0 : appréciations selon le mode de la classe (classique ou APC) et
     échelle DÉDIÉE des moyennes (mention de travail, totaux de groupes) */
  const appNote = n => appreciationNoteOf(db, cl, n);
  const appMoy = n => appreciationMoyenneOf(db, cl, n);
  /* résultats annuels : moyenne / min / max de la classe */
  const moysClasse = cls.classes.map(c => c.moy);
  const moyClasseGen = moysClasse.length ? Math.round(moysClasse.reduce((t, v) => t + v, 0) / moysClasse.length * 100) / 100 : null;
  const minClasse = moysClasse.length ? Math.min(...moysClasse) : null;
  const maxClasse = moysClasse.length ? Math.max(...moysClasse) : null;
  return (
    <div className="rcp" id="print-zone">
      <div className="rcp-body">
        <div className="rcp-head2">
          <div className="bh">{bul.blocGauche}</div>
          {st.logo
            ? <img className="rcp-logo" src={st.logo} alt="" style={{ width:64, height:64, objectFit:'contain' }}/>
            : <Logo size={56}/>}
          <div className="bh bh-r">{bul.blocDroit}</div>
        </div>
        <div className="rcp-titre">
          <div className="an">Année Scolaire : {an ? an.libelle : '—'}</div>
          <div className="ti">{bul.titre}</div>
        </div>
        <div className="rcp-id">
          <b>Noms et Prénoms :</b> {el.nom} {el.prenom} &nbsp;&nbsp; <b>Matricule :</b> {el.matricule} &nbsp;&nbsp; <b>Classe :</b> {cl ? cl.libelle : '—'}{sec.effectif ? <> &nbsp;&nbsp; <b>Effectif :</b> {effectif}</> : null}<br/>
          <b>Né(e) le :</b> {el.dateNaissance || '—'} &nbsp;&nbsp; <b>À :</b> {el.lieuNaissance || '—'} &nbsp;&nbsp; <b>Genre :</b> {el.sexe === 'F' ? 'Fille' : 'Garçon'} &nbsp;&nbsp; <b>Statut :</b> {el.regime === 'interne' ? 'Interne' : 'Externe'} &nbsp;&nbsp; <b>Redoublant :</b> {el.statutEleve === 'ancien' ? 'Oui' : 'Non'}
        </div>
        <table className="rcp-tbl compact">
          <thead><tr>
            <th>DISCIPLINES / ENSEIGNANTS</th>
            {seqs.map(sq => <th key={sq.id} style={{ textAlign:'center' }}>{sq.libelle.replace(/^Séquence\s*/i, 'S')}</th>)}
            <th style={{ textAlign:'center' }}>Moy. /20</th><th style={{ textAlign:'center' }}>Coef</th>
            <th style={{ textAlign:'center' }}>Points</th><th style={{ textAlign:'center' }}>Moy.Cla.</th>
            <th style={{ textAlign:'center' }}>Rang</th><th>Appréciation</th>
          </tr></thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.id}>
                <tr className="rcp-grp"><td colSpan={nbCols}>{g.grp ? g.grp.libelle : 'Autres matières'}</td></tr>
                {g.lignes.map(l => (
                  <tr key={l.m.id}>
                    <td>{l.m.libelle}{l.ens ? <div className="mut" style={{ fontSize:9 }}>{l.ens.nom} {l.ens.prenom}</div> : null}</td>
                    {l.parSeq.map((v, i) => <td key={i} className="num">{v == null ? '—' : String(v).replace('.', ',')}</td>)}
                    <td className="num"><b>{fmt2r(l.moy)}</b></td>
                    <td className="num">{l.coef}</td>
                    <td className="num">{l.points == null ? '—' : fmt2r(l.points)}</td>
                    <td className="num">{l.moyClasse == null ? '—' : fmt2r(l.moyClasse)}</td>
                    <td className="num">{l.rangMat == null ? '—' : l.rangMat}<sup>e</sup></td>
                    <td>{l.moy == null ? '—' : (appNote(l.moy) || '—')}</td>
                  </tr>
                ))}
                <tr className="rcp-tot">
                  <td colSpan={1 + seqs.length}>{g.grp ? g.grp.libelle : 'Autres'} — Total Points : {fmt2r(g.tot.points)} / Total Coef : {g.tot.coef}</td>
                  <td className="num"><b>{fmt2r(g.tot.moy)}</b></td>
                  <td className="num"><b>{g.tot.coef}</b></td>
                  <td className="num"><b>{fmt2r(g.tot.points)}</b></td>
                  <td className="num">—</td><td className="num">—</td>
                  <td>{g.tot.moy == null ? '—' : (appMoy(g.tot.moy) || '')}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
          <tfoot><tr>
            <td colSpan={1 + seqs.length}><b>TOTAL GÉNÉRAL</b></td>
            <td className="num"><b>{fmt2r(gen)}</b></td>
            <td className="num"><b>{totCoef}</b></td>
            <td className="num"><b>{fmt2r(totPts)}</b></td>
            <td className="num">{fmt2r(moyClasseGen)}</td>
            <td className="num">{rang ? rang : (gen != null ? 'NC' : '—')}</td>
            <td><b>{gen != null ? (appMoy(gen) || '') : '—'}</b></td>
          </tr></tfoot>
        </table>

        <div className="rcp-duo">
          {sec.bilan && (
          <div className="rcp-box">
            <h5>Bilan disciplinaire annuel</h5>
            <div className="rcp-box-l">
              Total des Absences Non Justifiées : <b>{absNonJust}</b> heure(s)<br/>
              Total des Absences Justifiées : <b>{absJust}</b> heure(s)<br/>
              Total des consignes et faits : <b>{consignes}</b>
            </div>
          </div>
          )}
          {sec.synthese && (
          <div className="rcp-box">
            <h5>Résultats annuels</h5>
            <table className="rcp-tbl compact rcp-res">
              <thead><tr><th></th><th style={{ textAlign:'center' }}>ÉLÈVE</th><th style={{ textAlign:'center' }}>CLASSE</th></tr></thead>
              <tbody>
                <tr><td>T-Points</td><td className="num"><b>{fmt2r(totPts)}</b></td><td className="num">—</td></tr>
                <tr><td>T-Coef</td><td className="num"><b>{totCoef}</b></td><td className="num">—</td></tr>
                <tr><td>MOY /20</td><td className="num"><b>{fmt2r(gen)}</b></td><td className="num">{fmt2r(moyClasseGen)}</td></tr>
                {sec.rang && <tr><td>Rang</td><td className="num"><b>{rang ? rang + ' / ' + effectif : (gen != null ? 'NC' : '—')}</b></td><td className="num">—</td></tr>}
                <tr><td>Min /20</td><td className="num">—</td><td className="num">{fmt2r(minClasse)}</td></tr>
                <tr><td>Max /20</td><td className="num">—</td><td className="num">{fmt2r(maxClasse)}</td></tr>
              </tbody>
            </table>
            <div className="rcp-mention">
              <span className="m-l">Moyenne générale — Mention(s) travail :</span>
              <span className="m-v">{gen != null ? (appMoy(gen) || '—') : '—'}</span>
            </div>
          </div>
          )}
        </div>

        <div className="rcp-box rcp-conseil">
          <h5>Décision du conseil</h5>
          <div className="rcp-conseil-l">
            <span className="co"><span className="cbx"></span> Promu(e) en classe de <span className="dots"></span></span>
            <span className="co"><span className="cbx"></span> Redouble</span>
            <span className="co"><span className="cbx"></span> Exclu(e) pour <span className="dots"></span></span>
          </div>
        </div>

        {rang == null && gen != null && manq.length > 0 && (
          <div style={{ marginTop:8, fontSize:11.5, border:'1px solid #c9d4e2', background:'#f6f9fc', borderRadius:6, padding:'7px 10px' }}>
            <b>Non classé (NC)</b> — aucune note dans l'ensemble des matières indispensables : <b>{manq.map(m => m.libelle).join(', ')}</b>.
          </div>
        )}

        <p className="rcp-nb">
          <b>NB :</b> Il n'est délivré qu'un seul exemplaire de ce bulletin de notes. Le titulaire peut établir et faire
          certifier les copies conformes. <i>Only one transcript shall be delivered.</i>
        </p>

        <div className="rcp-fait" style={{ alignItems:'flex-end' }}>
          <span>Fait à {bul.lieu}, le {fmtD(todayISO())}{titulaire ? <><br/><span className="mut" style={{ fontSize:10 }}>Titulaire : {titulaire.nom}</span></> : null}</span>
          {sec.signatures && <span className="sig2">{bul.signature}</span>}
          {qrTxt && <QrCode text={qrTxt} size={74} caption="Scanner pour vérifier"/>}
        </div>
      </div>
      <div className="rcp-note">{st.piedEtat} • {an ? an.libelle : ''} • {bul.titre} — {el.nom} {el.prenom} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ---------- v5.4 : BORDEREAU DES RÉSULTATS D'UNE CLASSE ----------
   Moyennes par GROUPE de matières, moyenne générale, rang (NC compris). */
export function BordereauTable({ classeId, periode, periodeLabel }){
  const { db, anneeId } = useApp();
  const cl = classById(db, classeId);
  const an = yearById(db, anneeId);
  const plan = planOf(db, classeId);
  const grpList = [];
  plan.forEach(pe => {
    const gid = pe.groupeId || '_';
    if (!grpList.some(x => x.id === gid)) grpList.push({ id:gid, grp:(db.groupes || []).find(g => g.id === gid) || null });
  });
  const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === classeId && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1));
  const cls = classementClasse(db, anneeId, classeId, periode);
  const lignes = els.map(el => {
    const gen = moyenneGenerale(db, anneeId, el.id, periode);
    const nc = cls.nonClasses.has(el.id) && gen != null;
    return { el, gen, nc, rang:cls.rangs.get(el.id),
      parGrp: grpList.map(g => moyenneGroupe(db, anneeId, el.id, g.id, periode)) };
  });
  const moyGrp = grpList.map(g => {
    const vals = els.map(el => moyenneGroupe(db, anneeId, el.id, g.id, periode)).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((t, v) => t + v.moy, 0) / vals.length * 100) / 100 : null;
  });
  const avecMoy = lignes.filter(l => l.gen != null);
  const moyClasse = avecMoy.length ? Math.round(avecMoy.reduce((t, l) => t + l.gen, 0) / avecMoy.length * 100) / 100 : null;
  /* v5.5 : statistiques de la classe — min, max, moyenne, réussite, intervalles */
  const stG = statsNotes(db, avecMoy.map(l => l.gen));
  const nbC = 5 + grpList.length;
  return (
    <div className="rcp-print">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
        <b style={{ fontSize:13.5, color:'#0f2f57' }}>{cl ? cl.libelle : ''} — {periodeLabel}</b>
        <span className="mut" style={{ fontSize:11 }}>{an ? an.libelle : ''} • {els.length} élève(s) • {cls.classes.length} classé(s){els.length - cls.classes.length > 0 ? ' • ' + (els.length - cls.classes.length) + ' NC' : ''}</span>
      </div>
      <table className="rcp-tbl compact">
        <thead><tr>
          <th style={{ width:30 }}>N°</th><th>Nom et prénoms</th>
          {grpList.map(g => <th key={g.id} style={{ textAlign:'center' }} title={g.grp ? g.grp.libelle : ''}>{g.grp ? g.grp.code : '—'}<div style={{ fontSize:8, fontWeight:400, opacity:.75 }}>moy.</div></th>)}
          <th style={{ textAlign:'center' }}>Moy. /20</th><th style={{ textAlign:'center' }}>Rang</th><th>Appréciation</th>
        </tr></thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={l.el.id} className={l.gen != null && l.gen < 10 ? 'rcp-rowbad' : ''}>
              <td>{i + 1}</td>
              <td style={{ whiteSpace:'nowrap' }}>{l.el.nom} {l.el.prenom}</td>
              {l.parGrp.map((g, j) => <td key={j} className="num">{g == null ? '—' : fmt2r(g.moy)}</td>)}
              <td className="num"><b>{fmt2r(l.gen)}</b></td>
              <td className="num">{l.nc ? <b>NC</b> : (l.rang ? l.rang + '/' + cls.classes.length : '—')}</td>
              <td>{l.nc ? 'Non classé' : (l.gen != null ? (appreciationOf(db, l.gen) || '—') : '—')}</td>
            </tr>
          ))}
          {!lignes.length && <tr><td colSpan={nbC} className="center mut">Aucun élève inscrit.</td></tr>}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Moyenne de la classe</td>
            {moyGrp.map((m, j) => <td key={j} className="num">{m == null ? '—' : fmt2r(m)}</td>)}
            <td className="num"><b>{fmt2r(moyClasse)}</b></td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
      <div style={{ display:'flex', gap:15, flexWrap:'wrap', marginTop:8, fontSize:10.8, color:'#1c2b45' }}>
        <span><b>Moyenne min. :</b> {stG.min == null ? '—' : fmt2r(stG.min)}</span>
        <span><b>Moyenne max. :</b> {stG.max == null ? '—' : fmt2r(stG.max)}</span>
        <span><b>Moyenne générale :</b> {stG.moy == null ? '—' : fmt2r(stG.moy)}</span>
        <span><b>Taux de réussite (≥ 10/20) :</b> {stG.pct == null ? '—' : stG.pct + ' %'} ({stG.ge10}/{stG.n})</span>
      </div>
      {stG.n > 0 && (
        <div className="rcp-lettres" style={{ marginTop:7, fontSize:10.6, padding:'6px 10px' }}>
          <b>Répartition par intervalle de moyenne :</b> {stG.repartition.map(r => r.libelle + ' : ' + r.n + ' (' + r.pct + ' %)').join('  •  ')}
        </div>
      )}
    </div>
  );
}

/* État imprimable du bordereau d'UNE classe (modale). */
export function BordereauClasseReport({ classeId, periode, periodeLabel }){
  const { db } = useApp();
  const cl = classById(db, classeId);
  return (
    <ReportModal title={'Bordereau de résultats — ' + (cl ? cl.libelle : '') + ' — ' + periodeLabel}>
      <div className="rcp" id="print-zone">
        <Head tag="Bordereau de résultats" title={cl ? cl.libelle : ''}/>
        <div className="rcp-body">
          <BordereauTable classeId={classeId} periode={periode} periodeLabel={periodeLabel}/>
          <div className="rcp-foot">
            <div className="sig">Le Professeur titulaire</div>
            <div className="sig">Le Chef d&apos;établissement</div>
          </div>
        </div>
        <div className="rcp-note">{settingsOf(db).piedEtat} • Bordereau de résultats — {periodeLabel} • Généré par Aurel School SIGES</div>
      </div>
    </ReportModal>
  );
}

/* v5.4 : bordereaux de TOUT l'établissement en une seule impression —
   une page par classe (sauts de page gérés par la feuille de style). */
export function ToutEtabReport({ classes, periode, periodeLabel }){
  const { db } = useApp();
  return (
    <ReportModal title={'Bordereaux de résultats — tout l’établissement — ' + periodeLabel}>
      <div className="rcp" id="print-zone">
        <div className="rcp-body">
          <Head tag="Bordereaux de résultats" title={'Tout l’établissement — ' + periodeLabel}/>
          {classes.map(c => <BordereauTable key={c.id} classeId={c.id} periode={periode} periodeLabel={periodeLabel}/>)}
        </div>
        <div className="rcp-note">{settingsOf(db).piedEtat} • {classes.length} classe(s) • Généré par Aurel School SIGES</div>
      </div>
    </ReportModal>
  );
}

/* ---------- v5.4 : état générique de statistiques (A4, gris sobre) ----------
   colonnes = [{ label, num }], lignes = tableaux de valeurs. */
export function StatsReport({ titre, periodeLabel, colonnes, lignes, note }){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  return (
    <div className="rcp" id="print-zone">
      <Head tag="Statistiques" title={titre}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Analyse</span><b>{titre}</b></div>
          <div><span>Année scolaire</span><b>{an ? an.libelle : '—'}</b></div>
          <div><span>Période</span><b>{periodeLabel}</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())} à {nowTime()}</b></div>
        </div>
        <table className="rcp-tbl">
          <thead><tr>{colonnes.map((c, i) => <th key={i} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
          <tbody>
            {lignes.map((row, i) => (
              <tr key={i} className={String(row[0]).startsWith('ENSEMBLE') ? 'rcp-tot' : ''}>
                {row.map((c, j) => <td key={j} className={colonnes[j] && colonnes[j].num ? 'num' : ''}>{c == null ? '—' : c}</td>)}
              </tr>
            ))}
            {!lignes.length && <tr><td colSpan={colonnes.length} className="center mut">Aucune donnée pour cette période.</td></tr>}
          </tbody>
        </table>
        {note && <p style={{ fontSize:11, color:'var(--faint)', marginTop:8 }}>{note}</p>}
        <div className="rcp-foot"><div className="sig">Le Censeur / La Direction</div></div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • {an ? an.libelle : ''} • Statistiques pédagogiques • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ================================================================
   v5.5 — BILAN DISCIPLINAIRE D'UNE CLASSE (par élève, par trimestre
   et par année) : absences J/NJ en heures, autres faits,
   sanction issue des plages paramétrées (Personnalisation des états → Discipline). */
export function BilanDisciplineReport({ classeId }){
  const { db, anneeId } = useApp();
  const cl = classById(db, classeId);
  const an = yearById(db, anneeId);
  const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === classeId && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1));
  const rows = els.map(el => {
    const t = [1, 2, 3].map(k => absencesDe(db, anneeId, el.id, 'T' + k));
    const annee = absencesDe(db, anneeId, el.id, '');
    const autres = faitsDe(db, anneeId, el.id).filter(f => f.categorie !== 'absence').length;
    return { el, t, annee, autres, sanction: sanctionAbsencesFor(db, annee.nonJust) };
  });
  const tot = tIdx => rows.reduce((acc, r) => {
    acc.j += r.t[tIdx].just; acc.nj += r.t[tIdx].nonJust;
    return acc;
  }, { j:0, nj:0 });
  const totT = [0, 1, 2].map(tot);
  const totAnnee = rows.reduce((acc, r) => { acc.j += r.annee.just; acc.nj += r.annee.nonJust; return acc; }, { j:0, nj:0 });
  return (
    <div className="rcp" id="print-zone">
      <Head tag="Bilan disciplinaire" title={cl ? cl.libelle : ''}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Classe</span><b>{cl ? cl.libelle : '—'}</b></div>
          <div><span>Année scolaire</span><b>{an ? an.libelle : '—'}</b></div>
          <div><span>Effectif</span><b>{els.length} élève(s)</b></div>
          <div><span>Édité le</span><b>{fmtD(todayISO())}</b></div>
        </div>
        <table className="rcp-tbl compact">
          <thead><tr>
            <th style={{ width:28 }}>N°</th><th>Élève</th>
            <th colSpan={2} style={{ textAlign:'center' }}>Trimestre 1</th>
            <th colSpan={2} style={{ textAlign:'center' }}>Trimestre 2</th>
            <th colSpan={2} style={{ textAlign:'center' }}>Trimestre 3</th>
            <th colSpan={2} style={{ textAlign:'center' }}>Année</th>
            <th style={{ textAlign:'center' }}>Autres faits</th><th>Sanction (absences NJ)</th>
          </tr>
          <tr>
            <th></th><th></th>
            {[0, 1, 2].map(k => <React.Fragment key={k}><th style={{ textAlign:'center', fontWeight:400 }}>J</th><th style={{ textAlign:'center', fontWeight:400 }}>NJ</th></React.Fragment>)}
            <th style={{ textAlign:'center', fontWeight:400 }}>J</th><th style={{ textAlign:'center', fontWeight:400 }}>NJ</th>
            <th></th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.el.id} className={r.annee.nonJust >= 3 ? 'rcp-rowbad' : ''}>
                <td>{i + 1}</td>
                <td style={{ whiteSpace:'nowrap' }}>{r.el.nom} {r.el.prenom}</td>
                {r.t.map((a, k) => <React.Fragment key={k}><td className="num">{a.just || '—'}</td><td className="num">{a.nonJust || '—'}</td></React.Fragment>)}
                <td className="num">{r.annee.just || '—'}</td>
                <td className="num"><b>{r.annee.nonJust || '—'}</b></td>
                <td className="num">{r.autres || '—'}</td>
                <td>{r.sanction || '—'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={13} className="center mut">Aucun élève inscrit.</td></tr>}
          </tbody>
          <tfoot><tr>
            <td colSpan={2}><b>TOTAUX</b></td>
            {totT.map((t, k) => <React.Fragment key={k}><td className="num">{t.j}</td><td className="num">{t.nj}</td></React.Fragment>)}
            <td className="num">{totAnnee.j}</td>
            <td className="num"><b>{totAnnee.nj}</b></td>
            <td colSpan={2}></td>
          </tr></tfoot>
        </table>
        <p className="mut" style={{ fontSize:10.3, marginTop:7 }}>
          J = heures d'absence justifiées • NJ = non justifiées. La sanction est déterminée par les plages
          d'absences non justifiées paramétrées dans Personnalisation des états → Discipline (par défaut : 3-5 avertissement écrit,
          6-9 blâme, 10-14 exclusion temporaire, 15 et plus conseil de discipline).
        </p>
        <div className="rcp-foot">
          <div className="sig">Le Surveillant général</div>
          <div className="sig">Le Chef d&apos;établissement</div>
        </div>
      </div>
      <div className="rcp-note">{settingsOf(db).piedEtat} • Bilan disciplinaire — {cl ? cl.libelle : ''} • {an ? an.libelle : ''} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ================================================================
   v5.5 — TABLEAUX D'HONNEUR (félicitations + tableau d'honneur),
   seuils paramétrables à la génération, pour les classes visibles. */
export function HonneurReport({ classes, periode, periodeLabel, seuilF = 14, seuilH = 12 }){
  const { db, anneeId } = useApp();
  const an = yearById(db, anneeId);
  const st = settingsOf(db);
  return (
    <div className="rcp" id="print-zone">
      <Head tag="Tableaux d'honneur" title={periodeLabel}/>
      <div className="rcp-body">
        <div className="rcp-grid">
          <div><span>Établissement</span><b>{st.nomEtablissement}</b></div>
          <div><span>Année scolaire</span><b>{an ? an.libelle : '—'}</b></div>
          <div><span>Période</span><b>{periodeLabel}</b></div>
          <div><span>Seuils</span><b>Félicitations ≥ {String(seuilF).replace('.', ',')} • Honneur ≥ {String(seuilH).replace('.', ',')}</b></div>
        </div>
        {classes.map(c => {
          const cls = classementClasse(db, anneeId, c.id, periode);
          const nom = id => { const el = (db.eleves || []).find(x => x.id === id) || {}; return (el.nom || '—') + ' ' + (el.prenom || ''); };
          const fel = cls.classes.filter(x => x.moy >= seuilF);
          const hon = cls.classes.filter(x => x.moy >= seuilH && x.moy < seuilF);
          return (
            <div key={c.id} className="rcp-print" style={{ breakInside:'avoid', pageBreakInside:'avoid' }}>
              <div style={{ margin:'12px 0 5px', fontSize:13, fontWeight:800, color:'#0f2f57', borderBottom:'2px solid #8593aa', paddingBottom:3 }}>
                {c.libelle} <span className="mut" style={{ fontSize:10.5, fontWeight:400 }}>— {cls.classes.length} élève(s) classé(s)</span>
              </div>
              <table className="rcp-tbl compact">
                <thead><tr>
                  <th style={{ width:26 }}>N°</th><th>FÉLICITATIONS — moyenne ≥ {String(seuilF).replace('.', ',')}/20</th>
                  <th style={{ width:64, textAlign:'center' }}>Moyenne</th>
                </tr></thead>
                <tbody>
                  {fel.length ? fel.map((x, i) => (
                    <tr key={x.eleveId}><td>{i + 1}</td><td style={{ whiteSpace:'nowrap' }}><b>{nom(x.eleveId)}</b></td><td className="num"><b>{fmt2r(x.moy)}</b></td></tr>
                  )) : <tr><td colSpan={3} className="center mut">Aucun élève — félicitations</td></tr>}
                </tbody>
              </table>
              <table className="rcp-tbl compact" style={{ marginTop:5 }}>
                <thead><tr>
                  <th style={{ width:26 }}>N°</th><th>TABLEAU D'HONNEUR — moyenne ≥ {String(seuilH).replace('.', ',')}/20</th>
                  <th style={{ width:64, textAlign:'center' }}>Moyenne</th>
                </tr></thead>
                <tbody>
                  {hon.length ? hon.map((x, i) => (
                    <tr key={x.eleveId}><td>{i + 1}</td><td style={{ whiteSpace:'nowrap' }}><b>{nom(x.eleveId)}</b></td><td className="num"><b>{fmt2r(x.moy)}</b></td></tr>
                  )) : <tr><td colSpan={3} className="center mut">Aucun élève — tableau d'honneur</td></tr>}
                </tbody>
              </table>
            </div>
          );
        })}
        <div className="rcp-foot" style={{ marginTop:16 }}>
          <div className="sig">Le Professeur titulaire</div>
          <div className="sig">Le Chef d&apos;établissement</div>
        </div>
      </div>
      <div className="rcp-note">{st.piedEtat} • Tableaux d'honneur — {periodeLabel} • {an ? an.libelle : ''} • Généré par Aurel School SIGES</div>
    </div>
  );
}

/* ================================================================
   v5.5 — CERTIFICATS DE SCOLARITÉ (un par élève, une page A4 chacun). */
export function CertificatReport({ eleves }){
  const { db, anneeId } = useApp();
  const st = settingsOf(db);
  const bul = bulletinOf(db);
  const an = yearById(db, anneeId);
  return (
    <div className="rcp" id="print-zone">
      {eleves.map((el, i) => {
        const cl = classById(db, el.classeId) || {};
        const f = el.sexe === 'F';
        return (
          <div key={el.id} className="rcp-body" style={{ padding:'30px 44px', ...(i ? { pageBreakBefore:'always', borderLeft:'none', borderRight:'none', borderRadius:0 } : {}) }}>
            <div className="rcp-head2">
              <div className="bh">{bul.blocGauche}</div>
              {st.logo
                ? <img className="rcp-logo" src={st.logo} alt="" style={{ width:58, height:58, objectFit:'contain' }}/>
                : <Logo size={52}/>}
              <div className="bh bh-r">{bul.blocDroit}</div>
            </div>
            <div className="rcp-titre">
              <div className="an">Année Scolaire : {an ? an.libelle : '—'}</div>
              <div className="ti">CERTIFICAT DE SCOLARITÉ</div>
            </div>
            <div style={{ marginTop:26, fontSize:12.6, lineHeight:2.05, color:'#1c2b45', textAlign:'justify' }}>
              Je soussigné(e), <b>{bul.signature}</b>, responsable de l'établissement <b>{st.nomEtablissement}</b>,
              certifie que l'élève <b>{el.nom} {el.prenom}</b>, {f ? 'née' : 'né'} le <b>{el.dateNaissance || '—'}</b> à <b>{el.lieuNaissance || '—'}</b>,
              est régulièrement inscrit{f ? 'e' : ''} en classe de <b>{cl.libelle || '—'}</b>, sous le matricule <b>{el.matricule || '—'}</b>,
              pour l'année scolaire <b>{an ? an.libelle : '—'}</b>, en qualité d'élève {el.regime === 'interne' ? 'interne' : 'externe'}
              {el.statutEleve === 'ancien' ? ' (ancien élève)' : ''}.
              <br/>
              En foi de quoi, le présent certificat est délivré à l'intéressé{f ? 'e' : ''} pour servir et valoir ce que de droit.
            </div>
            <div className="rcp-fait" style={{ marginTop:46 }}>
              <span>Fait à {bul.lieu}, le {fmtD(todayISO())}</span>
              <span className="sig2">{bul.signature}</span>
            </div>
          </div>
        );
      })}
      {!eleves.length && <div className="rcp-body"><p className="mut center">Aucun élève.</p></div>}
    </div>
  );
}

/* ================================================================
   v5.5 — CARTES SCOLAIRES & BADGES (planche A4, découpe pointillée).
   mode 'carte' : carte scolaire complète avec régime et année ;
   mode 'badge' : badge d'identité compact avec QR code. */
export function CartesReport({ eleves, mode = 'carte' }){
  const { db, anneeId } = useApp();
  const st = settingsOf(db);
  const an = yearById(db, anneeId);
  const bul = bulletinOf(db);
  const badge = mode === 'badge';
  const titre = badge ? 'Badges des élèves' : 'Cartes scolaires';
  /* v6.0 — format EXACT du modèle : 8,5 × 5,5 cm. La zone .rcp mesure
     756 px ≙ 20 cm utiles → 1 cm = 37,8 px → carte 321 × 208 px.
     Badge : variante compacte 7,5 × 4,5 cm (284 × 170 px). */
  const W = badge ? 284 : 321, H = badge ? 170 : 208;
  const republique = String(bul.blocGauche || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3);
  return (
    <div className="rcp" id="print-zone">
      <Head tag={titre} title={an ? an.libelle : ''}/>
      <div className="rcp-body">
        <div className="cartes-grid">
          {eleves.map(el => {
            const cl = classById(db, el.classeId) || {};
            const initiales = ((el.nom || '?')[0] + (el.prenom || ' ')[0] || '').toUpperCase();
            const qrTxt = 'AUREL-SIGES|ETAB:' + qrFold(st.nomEtablissement).slice(0, 28) + '|ELV:' + qrFold(el.matricule + ' ' + el.nom + ' ' + el.prenom).slice(0, 34) + '|CLA:' + qrFold(cl.libelle).slice(0, 14);
            return (
              <div key={el.id} className={'carte' + (badge ? ' badge' : '')} style={{ width:W, height:H }}>
                <div className="ct-head">
                  <div className="ct-rep">
                    {republique.map((l, i) => <span key={i} className={i === 0 ? 'l1' : ''}>{l}</span>)}
                  </div>
                  {st.logo
                    ? <img className="ct-logo" src={st.logo} alt=""/>
                    : <Logo size={badge ? 26 : 30}/>}
                  <div className="ct-etab">
                    <span className="l1">{st.nomEtablissement}</span>
                    {st.sousTitre && <span>{st.sousTitre}</span>}
                    {(st.telephone || st.adresse) && <span className="ct-c">{[st.adresse, st.telephone].filter(Boolean).join(' — ')}</span>}
                  </div>
                </div>
                <div className="ct-titre">CARTE SCOLAIRE{badge ? null : <i> / SCHOOL CARD</i>}</div>
                <div className="ct-body">
                  {el.photo
                    ? <img className="ct-photo" src={el.photo} alt=""/>
                    : <div className="ct-photo ct-photo-n">{initiales}</div>}
                  <div className="ct-fields">
                    <div className="ct-nom">{el.nom} {el.prenom}</div>
                    <div><span className="ct-k">né(e) le / Date of birth :</span> <b>{el.dateNaissance || '—'}</b>{el.lieuNaissance ? <> <span className="ct-k">à :</span> <b>{el.lieuNaissance}</b></> : null}</div>
                    <div><span className="ct-k">Mat. :</span> <b>{el.matricule || '—'}</b> &nbsp; <span className="ct-k">Classe :</span> <b>{cl.libelle || '—'}</b></div>
                    <div><span className="ct-k">Régime :</span> <b>{el.regime === 'interne' ? 'Interne' : 'Externe'}</b> &nbsp; <span className="ct-k">Statut :</span> <b>{el.statutEleve === 'ancien' ? 'Ancien' : 'Nouveau'}</b></div>
                  </div>
                  <div className="ct-qr"><QrCode text={qrTxt} size={badge ? 34 : 40}/></div>
                </div>
                <div className="ct-foot">
                  <span className="ct-an">Année Scolaire / School Year : <b>{an ? an.libelle : '—'}</b></span>
                  <span className="ct-sig">Le Chef d&apos;établissement</span>
                </div>
              </div>
            );
          })}
        </div>
        {!eleves.length && <p className="mut center" style={{ padding:14 }}>Aucun élève.</p>}
        <p className="mut" style={{ fontSize:10, marginTop:10 }}>
          {badge ? 'Badges' : 'Cartes de scolarité'} au format {badge ? '7,5 × 4,5 cm' : '8,5 × 5,5 cm'} — à découper
          le long des pointillés. Le QR code identifie l'élève (établissement, matricule, classe) : il peut être
          scanné pour retrouver la fiche.
        </p>
      </div>
      <div className="rcp-note">{st.piedEtat} • {titre} • {an ? an.libelle : ''} • Généré par Aurel School SIGES</div>
    </div>
  );
}
