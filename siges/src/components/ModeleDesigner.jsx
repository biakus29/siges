import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Ic } from '../components/Icons.jsx';
import { Modal } from './UI.jsx';
import { ReportModal } from './Reports.jsx';
import { TemplateReport } from './ModeleReport.jsx';
import { classesSorted, sequencesSorted, classeParDefaut, optionClasse } from '../core/business.js';
import { TYPES_DOCS, typeDocOf, FORMATS_PAGE, POLICES, BLOC_TYPES, blocsDispo,
  catalogueChamps, newBloc, normalizeModele, pageOf, interpoler, STYLE_DEFAUT } from '../core/modeles.js';

/* =====================================================================
   v6.3 — CONCEPTEUR DE MODÈLE DE DOCUMENT
   Canevas millimétré : ajout de blocs (palette), déplacement à la souris,
   poignée de redimensionnement, panneau de propriétés complet (texte,
   champ, police, taille, style, alignement, couleurs, géométrie),
   réglages de page (format, orientation, marges, fond), aperçu intégré
   et enregistrement.
   ===================================================================== */

const PXMM = 3.7795;   /* 96 dpi : 1 mm = 3,78 px */

export function ModeleDesigner({ initial, onClose }){
  const { db, anneeId, M, toast } = useApp();
  const [mdl, setMdl] = useState(() => { const n = normalizeModele(initial); return n; });
  const [sel, setSel] = useState('');
  const [apercu, setApercu] = useState(false);
  /* aperçu : classe et élève au choix (toutes les classes de l'établissement) */
  const classesAp = classesSorted(db);
  const [apClasse, setApClasse] = useState(() => classeParDefaut(db, anneeId, classesAp));
  const [apEleve, setApEleve] = useState('');
  const elevesAp = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === apClasse && e.statut !== 'radie')
    .sort((a, b) => ((a.nom || '') + (a.prenom || '')).localeCompare((b.nom || '') + (b.prenom || ''), 'fr'));
  const t = typeDocOf(mdl.typeDoc) || TYPES_DOCS[0];
  const dims = pageOf({ ...mdl.page, typeDoc: mdl.typeDoc });
  const ech = Math.min(1.5, 520 / (dims.w * PXMM));
  const cW = Math.round(dims.w * PXMM * ech);
  const cH = Math.round(dims.h * PXMM * ech);

  const bloc = mdl.blocs.find(b => b.id === sel) || null;
  const setBloc = (id, patch) => setMdl(m => ({ ...m, blocs: m.blocs.map(b => (b.id === id ? { ...b, ...patch } : b)) }));
  const setStyle = (id, patch) => setMdl(m => ({ ...m, blocs: m.blocs.map(b => (b.id === id ? { ...b, style:{ ...b.style, ...patch } } : b)) }));
  const setOpt = (id, patch) => setMdl(m => ({ ...m, blocs: m.blocs.map(b => (b.id === id ? { ...b, options:{ ...b.options, ...patch } } : b)) }));
  const setPage = (k, v) => setMdl(m => ({ ...m, page:{ ...m.page, [k]: v } }));
  const setMarge = (k, v) => setMdl(m => ({ ...m, page:{ ...m.page, marges:{ ...m.page.marges, [k]: Math.max(0, Math.min(30, Number(v) || 0)) } } }));

  /* ---------- déplacement / redimensionnement à la souris ---------- */
  const moveRef = useRef(null), upRef = useRef(null);
  const nettoyer = () => {
    if (moveRef.current) window.removeEventListener('mousemove', moveRef.current);
    if (upRef.current) window.removeEventListener('mouseup', upRef.current);
    moveRef.current = upRef.current = null;
  };
  const saisir = (e, b, mode) => {
    e.preventDefault(); e.stopPropagation();
    setSel(b.id);
    const dep = { id:b.id, mode, sx:e.clientX, sy:e.clientY, ox:b.x, oy:b.y, ow:b.w, oh:b.h };
    moveRef.current = ev => {
      const dx = (ev.clientX - dep.sx) / (PXMM * ech);
      const dy = (ev.clientY - dep.sy) / (PXMM * ech);
      setMdl(m => ({ ...m, blocs: m.blocs.map(x => {
        if (x.id !== dep.id) return x;
        if (dep.mode === 'mv') return { ...x, x: Math.max(0, Math.round((dep.ox + dx) * 10) / 10), y: Math.max(0, Math.round((dep.oy + dy) * 10) / 10) };
        return { ...x, w: Math.max(2, Math.round((dep.ow + dx) * 10) / 10), h: Math.max(1, Math.round((dep.oh + dy) * 10) / 10) };
      }) }));
    };
    upRef.current = () => nettoyer();
    window.addEventListener('mousemove', moveRef.current);
    window.addEventListener('mouseup', upRef.current);
  };

  /* ---------- actions sur les blocs ---------- */
  const ajouter = type => {
    const b = newBloc(type, { page: dims });
    setMdl(m => ({ ...m, blocs: m.blocs.concat([b]) }));
    setSel(b.id);
  };
  const dupliquer = id => {
    const b = mdl.blocs.find(x => x.id === id);
    if (!b) return;
    const cop = { ...b, id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), x: Math.min(dims.w - 5, b.x + 3), y: Math.min(dims.h - 5, b.y + 3) };
    setMdl(m => ({ ...m, blocs: m.blocs.concat([cop]) }));
    setSel(cop.id);
  };
  const supprimer = id => { setMdl(m => ({ ...m, blocs: m.blocs.filter(b => b.id !== id) })); setSel(''); };
  const bouger = (id, d) => {
    setMdl(m => {
      const i = m.blocs.findIndex(b => b.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= m.blocs.length) return m;
      const blocs = m.blocs.slice();
      const [x] = blocs.splice(i, 1);
      blocs.splice(j, 0, x);
      return { ...m, blocs };
    });
  };

  /* ---------- aperçu avec données réelles ---------- */
  const echantillon = () => {
    const cls = classesAp.find(c => c.id === apClasse) || null;
    const el = elevesAp.find(e => e.id === apEleve) || elevesAp[0] || null;
    if (mdl.typeDoc === 'bulletin'){
      const sq = sequencesSorted(db)[0] || {};
      return { eleveId: el ? el.id : null, periode: sq.id != null ? String(sq.id) : '', periodeLabel: sq.libelle || 'Séquence' };
    }
    if (mdl.typeDoc === 'honneur') return { classes: cls ? [cls] : [], periode:'', periodeLabel:'Année complète', seuilF:14, seuilH:12 };
    return { eleves: el ? [el] : [] };
  };

  const enregistrer = () => {
    try {
      const r = M.saveModeleDoc(mdl);
      setMdl(m => ({ ...m, id: r.id }));
      toast('Modèle « ' + mdl.nom + ' » enregistré (' + mdl.blocs.length + ' bloc(s)).', 'ok');
    } catch(e){ toast(String(e.message || e), 'err'); }
  };

  const libelleBloc = b => (BLOC_TYPES.find(x => x.id === b.type) || {}).label || b.type;
  const champs = catalogueChamps(mdl.typeDoc);

  return (
    <Modal wide icon="wrench" title={'Concepteur — ' + (t.label) + (mdl.nom ? ' : ' + mdl.nom : '')} onClose={onClose}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>
          <Ic name="info"/> Canevas au millimètre — glissez les blocs, tirez la poignée pour redimensionner.
        </span>
        <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        <button className="btn btn-ghost" onClick={() => setApercu(a => !a)}><Ic name="eye"/> {apercu ? 'Édition' : 'Aperçu'}</button>
        <button className="btn btn-pri" onClick={enregistrer}><Ic name="check"/> Enregistrer</button>
      </>}>
      <div className="dsn">
        {/* ---------- barre d'outils ---------- */}
        <div className="dsn-bar">
          <div className="field" style={{ minWidth:200 }}>
            <label>Nom du modèle</label>
            <input aria-label="Nom du modèle" value={mdl.nom} maxLength={80} placeholder="ex : Bulletin séquence — version simple"
              onChange={e => setMdl(m => ({ ...m, nom: e.target.value }))}/>
          </div>
          {t.formats.length > 1 && (
            <div className="field" style={{ minWidth:150 }}>
              <label>Format</label>
              <select aria-label="Format de page" value={mdl.page.format} onChange={e => setPage('format', e.target.value)}>
                {t.formats.map(f => <option key={f} value={f}>{FORMATS_PAGE[f].label}</option>)}
              </select>
            </div>
          )}
          {t.orient && (
            <div className="field" style={{ minWidth:110 }}>
              <label>Orientation</label>
              <select aria-label="Orientation" value={mdl.page.orientation} onChange={e => setPage('orientation', e.target.value)}>
                <option value="portrait">Portrait</option>
                <option value="paysage">Paysage</option>
              </select>
            </div>
          )}
          {t.periodes && (
            <div className="field" style={{ minWidth:150 }}>
              <label>Période concernée</label>
              <select aria-label="Période concernée" value={mdl.periode} onChange={e => setMdl(m => ({ ...m, periode: e.target.value }))}>
                <option value="tous">Toutes les périodes</option>
                <option value="sequence">Séquence</option>
                <option value="trimestre">Trimestre</option>
                <option value="annee">Année complète</option>
              </select>
            </div>
          )}
          <div className="dsn-marges">
            {[['g','Marge gauche'],['d','Marge droite'],['h','Marge haute'],['b','Marge basse']].map(([k, l]) => (
              <div className="field" key={k} style={{ width:72 }}>
                <label>{l}</label>
                <input aria-label={l} type="number" min="0" max="30" value={mdl.page.marges[k]}
                  onChange={e => setMarge(k, e.target.value)}/>
              </div>
            ))}
          </div>
          <div className="field" style={{ width:64 }}>
            <label>Fond</label>
            <input aria-label="Couleur de fond de page" type="color" value={mdl.page.fond || '#ffffff'}
              onChange={e => setPage('fond', e.target.value === '#ffffff' ? '' : e.target.value)}/>
          </div>
        </div>

        {apercu ? (
          <div className="dsn-apercu">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
              <span className="mut" style={{ fontSize:12 }}>Aperçu pour :</span>
              <select className="sel" value={apClasse} onChange={e => { setApClasse(e.target.value); setApEleve(''); }} aria-label="Classe de l’aperçu">
                {classesAp.map(c => { const o = optionClasse(db, anneeId, c); return <option key={c.id} value={c.id}>{o.label}</option>; })}
              </select>
              {mdl.typeDoc !== 'honneur' && (
                <select className="sel" value={apEleve || (elevesAp[0] ? elevesAp[0].id : '')} onChange={e => setApEleve(e.target.value)}
                  disabled={!elevesAp.length} aria-label="Élève de l’aperçu">
                  {elevesAp.length ? elevesAp.map(e => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)
                    : <option value="">Aucun élève dans cette classe</option>}
                </select>
              )}
            </div>
            <TemplateReport modele={mdl} {...echantillon()}/>
            <p className="mut" style={{ fontSize:11, marginTop:8 }}>
              <Ic name="eye"/> Aperçu avec les données réelles de la classe choisie — revenez à « Édition » pour continuer.
            </p>
          </div>
        ) : (
          <div className="dsn-corps">
            {/* ---------- palette + liste des blocs ---------- */}
            <div className="dsn-gauche">
              <div className="clone-g">Ajouter un bloc</div>
              <div className="dsn-palette">
                {blocsDispo(mdl.typeDoc).map(bt => (
                  <button key={bt.id} className="btn btn-ghost btn-sm" title={bt.aide} onClick={() => ajouter(bt.id)}>
                    <Ic name={bt.icone}/> {bt.label}
                  </button>
                ))}
              </div>
              <div className="clone-g" style={{ marginTop:12 }}>Blocs du modèle ({mdl.blocs.length})</div>
              <div className="dsn-liste">
                {!mdl.blocs.length && <p className="mut" style={{ fontSize:11.5 }}>Aucun bloc — ajoutez-en depuis la palette ci-dessus.</p>}
                {mdl.blocs.map((b, i) => (
                  <div key={b.id} className={'dsn-item' + (b.id === sel ? ' on' : '')} onClick={() => setSel(b.id)}>
                    <span className="dsn-item-t"><Ic name={(BLOC_TYPES.find(x => x.id === b.type) || {}).icone}/> {libelleBloc(b)}</span>
                    <span className="dsn-item-x">
                      <button title="Monter" disabled={!i} onClick={e => { e.stopPropagation(); bouger(b.id, -1); }}>↑</button>
                      <button title="Descendre" disabled={i === mdl.blocs.length - 1} onClick={e => { e.stopPropagation(); bouger(b.id, 1); }}>↓</button>
                      <button title="Dupliquer" onClick={e => { e.stopPropagation(); dupliquer(b.id); }}><Ic name="copy"/></button>
                      <button title="Supprimer" onClick={e => { e.stopPropagation(); supprimer(b.id); }}><Ic name="trash"/></button>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ---------- canevas ---------- */}
            <div className="dsn-canevas">
              <div className="dsn-page" style={{ width:cW, height:cH, padding:Math.round((mdl.page.marges.h) * PXMM * ech) + 'px ' + Math.round((mdl.page.marges.d) * PXMM * ech) + 'px ' + Math.round((mdl.page.marges.b) * PXMM * ech) + 'px ' + Math.round((mdl.page.marges.g) * PXMM * ech) + 'px', background:mdl.page.fond || '#fff' }}>
                {mdl.blocs.map(b => (
                  <div key={b.id} className={'dsn-bloc' + (b.id === sel ? ' on' : '')}
                    style={{ left:Math.round(b.x * PXMM * ech), top:Math.round(b.y * PXMM * ech),
                      width:Math.round(b.w * PXMM * ech), minHeight:Math.round(b.h * PXMM * ech),
                      fontFamily:b.style.police + ', Tahoma, sans-serif', fontSize:Math.max(4, b.style.taille * ech * 0.75) + 'pt',
                      fontWeight:b.style.gras ? 700 : 400, fontStyle:b.style.italique ? 'italic' : 'normal',
                      textDecoration:b.style.souligne ? 'underline' : 'none',
                      textAlign:b.style.alignement === 'centre' ? 'center' : (b.style.alignement === 'droite' ? 'right' : 'left'),
                      color:b.style.couleur || undefined, background:b.style.fond || undefined,
                      border:(b.style.bordure ? '1px solid #7e8aa5;' : '') + (b.id === sel ? '1.5px dashed var(--gold-600)' : '1px dotted #b9c2d2') }}
                    onMouseDown={e => saisir(e, b, 'mv')}>
                    <span className="dsn-tag">{libelleBloc(b)}</span>
                    {(b.type === 'tableau-notes' || b.type === 'liste') && <div className="dsn-tbl-ghost">tableau</div>}
                    {b.type === 'photo' && <div className="dsn-photo-ghost">PHOTO</div>}
                    {b.type === 'qr' && <div className="dsn-photo-ghost">QR</div>}
                    {b.type === 'logo' && <div className="dsn-photo-ghost">LOGO</div>}
                    {b.type === 'texte' && <div className="dsn-txt">{interpoler(b.texte, { eleve:{ nom:'ÉLÈVE', prenom:'Exemple' }, annee:{ libelle:'2025-2026' } })}</div>}
                    {b.type === 'champ' && <div className="dsn-txt">{'{' + (b.champ || 'champ') + '}'}</div>}
                    <span className="dsn-poignee" onMouseDown={e => saisir(e, b, 'rs')}/>
                  </div>
                ))}
              </div>
              <p className="mut" style={{ fontSize:10.5, marginTop:6 }}>
                Page {dims.w} × {dims.h} mm — échelle {Math.round(ech * 100)} % • clic : sélectionner • glisser : déplacer • poignée : redimensionner
              </p>
            </div>

            {/* ---------- propriétés du bloc sélectionné ---------- */}
            <div className="dsn-props">
              {!bloc ? (
                <p className="mut" style={{ fontSize:12 }}>Sélectionnez un bloc sur le canevas (ou dans la liste) pour modifier ses propriétés.</p>
              ) : (
                <>
                  <div className="clone-g">{libelleBloc(bloc)}</div>
                  {bloc.type === 'texte' && (
                    <div className="field"><label>Texte (champs dynamiques entre accolades)</label>
                      <textarea aria-label="Texte du bloc" className="ta" rows={4} value={bloc.texte || ''} maxLength={900}
                        onChange={e => setBloc(bloc.id, { texte: e.target.value })}/></div>
                  )}
                  {bloc.type === 'champ' && (
                    <div className="field"><label>Champ dynamique</label>
                      <select aria-label="Champ dynamique" value={bloc.champ || ''} onChange={e => setBloc(bloc.id, { champ: e.target.value })}>
                        {champs.map(c => <option key={c.cle} value={c.cle}>{c.label}</option>)}
                      </select></div>
                  )}
                  {bloc.type === 'tableau-notes' && (
                    <div className="dsn-opts">
                      <div className="clone-g">Colonnes du tableau</div>
                      {[['groupes','Groupes du plan'],['note','Note de l\u2019élève /20'],['coef','Coefficient'],['points','Points'],['moyClasse','Moyenne de classe'],['rang','Rang'],['appreciation','Appréciation']].map(([k, l]) => (
                        <label key={k} className="chk"><input type="checkbox" checked={bloc.options[k] !== false} onChange={e => setOpt(bloc.id, { [k]: e.target.checked })}/><span>{l}</span></label>
                      ))}
                    </div>
                  )}
                  {bloc.type === 'liste' && (
                    <div className="dsn-opts">
                      <div className="clone-g">Colonnes de la liste</div>
                      {[['moyenne','Moyenne'],['rang','Rang'],['appreciation','Appréciation']].map(([k, l]) => (
                        <label key={k} className="chk"><input type="checkbox" checked={bloc.options[k] !== false} onChange={e => setOpt(bloc.id, { [k]: e.target.checked })}/><span>{l}</span></label>
                      ))}
                    </div>
                  )}
                  {bloc.type === 'signatures' && (
                    <>
                      <div className="field"><label>Signature gauche</label>
                        <input aria-label="Signature gauche" value={bloc.options.gauche || ''} maxLength={60} onChange={e => setOpt(bloc.id, { gauche: e.target.value })}/></div>
                      <div className="field"><label>Signature droite</label>
                        <input aria-label="Signature droite" value={bloc.options.droite || ''} maxLength={60} onChange={e => setOpt(bloc.id, { droite: e.target.value })}/></div>
                    </>
                  )}
                  {bloc.type !== 'texte' && bloc.type !== 'champ' && bloc.type !== 'tableau-notes' && bloc.type !== 'liste' && bloc.type !== 'signatures' && (
                    <p className="mut" style={{ fontSize:11, lineHeight:1.5 }}>{(BLOC_TYPES.find(x => x.id === bloc.type) || {}).aide}</p>
                  )}

                  <div className="clone-g" style={{ marginTop:10 }}>Style</div>
                  <div className="frow">
                    <div className="field" style={{ flex:1 }}>
                      <label>Police</label>
                      <select aria-label="Police" value={bloc.style.police} onChange={e => setStyle(bloc.id, { police: e.target.value })}>
                        {POLICES.map(p => <option key={p} value={p}>{p.replace(/"/g, '')}</option>)}
                      </select>
                    </div>
                    <div className="field" style={{ width:76 }}>
                      <label>Taille (pt)</label>
                      <input aria-label="Taille" type="number" min="4" max="72" step="0.5" value={bloc.style.taille}
                        onChange={e => setStyle(bloc.id, { taille: Number(e.target.value) || 10 })}/>
                    </div>
                    <div className="field" style={{ width:110 }}>
                      <label>Alignement</label>
                      <select aria-label="Alignement" value={bloc.style.alignement} onChange={e => setStyle(bloc.id, { alignement: e.target.value })}>
                        <option value="gauche">Gauche</option><option value="centre">Centre</option>
                        <option value="droite">Droite</option><option value="justifie">Justifié</option>
                      </select>
                    </div>
                  </div>
                  <div className="frow" style={{ gap:12 }}>
                    {[['gras','Gras'],['italique','Italique'],['souligne','Souligné'],['bordure','Bordure']].map(([k, l]) => (
                      <label key={k} className="chk"><input type="checkbox" checked={bloc.style[k] === true}
                        onChange={e => setStyle(bloc.id, { [k]: e.target.checked })}/><span>{l}</span></label>
                    ))}
                  </div>
                  <div className="frow">
                    <div className="field" style={{ width:96 }}>
                      <label>Couleur</label>
                      <input aria-label="Couleur du texte" type="color" value={bloc.style.couleur || '#28304a'}
                        onChange={e => setStyle(bloc.id, { couleur: e.target.value === '#28304a' ? '' : e.target.value })}/>
                    </div>
                    <div className="field" style={{ width:96 }}>
                      <label>Fond</label>
                      <input aria-label="Couleur de fond" type="color" value={bloc.style.fond || '#ffffff'}
                        onChange={e => setStyle(bloc.id, { fond: e.target.value === '#ffffff' ? '' : e.target.value })}/>
                    </div>
                  </div>

                  <div className="clone-g" style={{ marginTop:10 }}>Position et dimensions (mm)</div>
                  <div className="frow">
                    {[['x','Position X'],['y','Position Y'],['w','Largeur'],['h','Hauteur']].map(([k, l]) => (
                      <div className="field" key={k} style={{ width:88 }}>
                        <label>{l}</label>
                        <input aria-label={l} type="number" min="0" max={k === 'x' || k === 'w' ? dims.w : dims.h} step="0.5"
                          value={bloc[k]} onChange={e => setBloc(bloc.id, { [k]: Math.max(k === 'w' ? 2 : k === 'h' ? 1 : 0, Number(e.target.value) || 0) })}/>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => dupliquer(bloc.id)}><Ic name="copy"/> Dupliquer</button>
                    <button className="btn btn-danger btn-sm" onClick={() => supprimer(bloc.id)}><Ic name="trash"/> Supprimer</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStyle(bloc.id, { ...STYLE_DEFAUT })}><Ic name="refresh"/> Style par défaut</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
