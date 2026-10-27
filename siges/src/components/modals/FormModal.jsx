import React, { useState } from 'react';
import { Modal, Avatar } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import { useApp } from '../../context/AppContext.jsx';

/*
  Formulaire générique.
  fields : [{ name, label, type, options|groups, half, required, hint, placeholder, placeholderOption, defaultValue, uppercase, min, maxLength, header }]
  types : text | password | date | number | select | checkbox | header | hint
*/
export default function FormModal({ title, icon='info', fields, initial={}, submitLabel='Enregistrer', onSubmit, wide, slim, note, observe }){
  const { closeModal, toast } = useApp();
  const [values, setValues] = useState(() => {
    const v = { ...initial };
    fields.forEach(f => {
      if (f.type === 'checkbox'){ if (!(f.name in v)) v[f.name] = !!f.defaultValue; }
      if (f.type === 'checklist'){ if (!Array.isArray(v[f.name])) v[f.name] = Array.isArray(f.defaultValue) ? f.defaultValue.slice() : []; }
      else if (!(f.name in v) || v[f.name] == null) v[f.name] = f.defaultValue != null ? f.defaultValue : '';
    });
    return v;
  });
  const set = (k, val) => setValues(s => ({ ...s, [k]:val }));
  React.useEffect(() => { if (observe) observe(values); }, [values]);

  const submit = e => {
    e.preventDefault();
    try {
      onSubmit(values);
      closeModal();
    } catch(err){
      toast(String(err && err.message ? err.message : err), 'err');
    }
  };

  /* regroupement des champs `half` deux par deux */
  const rows = [];
  let i = 0;
  while (i < fields.length){
    const f = fields[i];
    if (f.half && fields[i+1] && fields[i+1].half){
      rows.push([f, fields[i+1]]); i += 2;
    } else if (f.half){
      rows.push([f, null]); i += 1;
    } else {
      rows.push([f]); i += 1;
    }
  }

  const renderField = f => {
    if (f.type === 'header') return null;
    if (f.type === 'photo'){
      const val = values[f.name] || '';
      const onPick = e => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (!/^image\//.test(file.type)){ toast('Fichier ignoré : choisissez une image (PNG, JPG…).', 'err'); return; }
        if (file.size > 400*1024){ toast('Image trop lourde (' + Math.round(file.size/1024) + ' Ko) — 400 Ko maximum.', 'err'); return; }
        const rd = new FileReader();
        rd.onload = () => set(f.name, String(rd.result));
        rd.onerror = () => toast('Lecture du fichier impossible.', 'err');
        rd.readAsDataURL(file);
      };
      return (
        <div className="field" key={f.name} style={{ flex:1 }}>
          <label>{f.label}</label>
          <div className="photo-pick">
            {val ? <img src={val} alt=""/> : <Avatar name={(values.nom || '') + ' ' + (values.prenom || '')}/>}
            <div className="pp-acts">
              <label className="btn btn-ghost btn-sm">
                <Ic name="download"/> Choisir une image…
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={onPick}/>
              </label>
              {val && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(f.name, '')}>
                <Ic name="x"/> Retirer la photo
              </button>}
            </div>
          </div>
          {f.hint ? <span className="hint">{f.hint}</span> : null}
        </div>
      );
    }
    if (f.type === 'hint') return <p className="hint" style={{ margin:'-6px 0 12px' }}>{f.label}</p>;
    const common = {
      id: 'ff-' + f.name,
      name: f.name,
      required: f.required,
      placeholder: f.placeholder || '',
      maxLength: f.maxLength,
      value: values[f.name] != null ? values[f.name] : '',
      onChange: e => set(f.name, f.type === 'checkbox' ? e.target.checked : (f.uppercase ? e.target.value.toUpperCase() : e.target.value))
    };
    let input;
    if (f.type === 'select'){
      input = (
        <select {...common}>
          {f.placeholderOption != null && <option value="">{f.placeholderOption}</option>}
          {(f.groups || []).map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          ))}
          {(f.options || []).map(o => <option key={o.value} value={o.value} disabled={!!o.disabled}>{o.label}</option>)}
        </select>
      );
    } else if (f.type === 'checklist'){
      const arr = Array.isArray(values[f.name]) ? values[f.name] : [];
      const toggle = val => set(f.name, arr.includes(val) ? arr.filter(x => x !== val) : arr.concat([val]));
      return (
        <div className="field" key={f.name} style={{ flex:1 }}>
          <label>{f.label}{f.required ? ' *' : ''}{arr.length ? ' — ' + arr.length + ' sélectionnée(s)' : ''}</label>
          {(f.options || []).length >= 4 && (
            <div style={{ display:'flex', gap:6, margin:'0 0 6px' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(f.name, (f.options || []).map(o => o.value))}>Tout cocher</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(f.name, [])}>Tout décocher</button>
            </div>
          )}
          <div className="chk-list">
            {(f.options || []).map(o => (
              <label key={o.value} className={'chk-chip' + (arr.includes(o.value) ? ' on' : '')}>
                <input type="checkbox" checked={arr.includes(o.value)} onChange={() => toggle(o.value)}/>
                {o.label}
              </label>
            ))}
            {!(f.options || []).length && <span className="hint">{f.emptyText || 'Aucun élément disponible.'}</span>}
          </div>
          {f.hint ? <span className="hint">{f.hint}</span> : null}
        </div>
      );
    } else if (f.type === 'checkbox'){
      return (
        <div className="field" key={f.name}>
          <label className="chk">
            <input type="checkbox" checked={!!values[f.name]} onChange={e => set(f.name, e.target.checked)}/>
            <span>{f.label}</span>
          </label>
          {f.hint ? <span className="hint">{f.hint}</span> : null}
        </div>
      );
    } else {
      input = <input type={f.type || 'text'} {...common} style={f.uppercase ? { textTransform:'uppercase' } : undefined}/>;
    }
    return (
      <div className="field" key={f.name}>
        <label className={f.required ? 'req' : ''} htmlFor={common.id}>{f.label}</label>
        {input}
        {f.hint ? <span className="hint">{f.hint}</span> : null}
      </div>
    );
  };

  return (
    <Modal title={title} icon={icon} wide={wide} slim={slim} onClose={closeModal}
      footer={
        <>
          {note ? <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'60%' }}>{note}</span> : null}
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Annuler</button>
          <button type="submit" form="form-modal-form" className="btn btn-pri"><Ic name="check"/> {submitLabel}</button>
        </>
      }>
      <form id="form-modal-form" onSubmit={submit} noValidate>
        {rows.map((r, idx) => {
          const content = r.filter(Boolean).map(renderField);
          const hasHeader = r[0] && r[0].type === 'header';
          if (hasHeader){
            return <div key={idx}><div className="sec-t" style={{ margin:'14px 0 10px' }}>{r[0].label}</div>{r.filter(x => x !== r[0]).map(renderField)}</div>;
          }
          if (r.length === 2) return <div className="frow" key={idx}>{content}</div>;
          return <div key={idx}>{content}</div>;
        })}
      </form>
    </Modal>
  );
}
