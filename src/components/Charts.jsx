import React from 'react';
import { fmt } from '../core/utils.js';

function niceMax(v){
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log(v)/Math.LN10));
  const f = v/exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n*exp;
}

export function BarChart({ items, unit='FCFA' }){
  const W = 680, H = 220, padL = 8, padB = 26, top = 26;
  const max = niceMax(Math.max(1, ...items.map(i => i.v)));
  const bw = (W - padL*2)/items.length;
  const y = v => H - padB - (v/max)*(H - padB - top);
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width:'100%', height:'auto', display:'block' }} role="img">
      {[0,.25,.5,.75,1].map((g,i) => {
        const yy = y(max*g);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W-padL} y2={yy} stroke="#e4eaf2" strokeWidth="1"/>
            <text x={W-padL} y={yy-4} textAnchor="end" fontSize="9.5" fill="#8ea1b8" fontFamily="Tahoma">{fmt(max*g)}</text>
          </g>
        );
      })}
      {items.map((it, i) => {
        const x = padL + i*bw + 5, w = bw - 10;
        const h = Math.max(it.v > 0 ? 3 : 0, (H-padB) - y(it.v));
        const fill = it.hl ? '#c9a227' : '#1b5290';
        return (
          <g key={i}>
            <rect x={x} y={H-padB-h} width={w} height={h} rx="3" fill={fill}>
              <title>{(it.title || it.l) + ' : ' + fmt(it.v) + ' ' + unit}</title>
            </rect>
            <text x={x+w/2} y={H-8} textAnchor="middle" fontSize="9.5" fill={it.hl ? '#a8871e' : '#5c6f88'}
              fontFamily="Tahoma" fontWeight={it.hl ? '700' : '400'}>{it.l}</text>
            {it.v > 0 && <text x={x+w/2} y={(H-padB-h)-6} textAnchor="middle" fontSize="8.5" fill="#8ea1b8" fontFamily="Tahoma">{fmt(it.v)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ pct, top, bottom }){
  const r = 52, C = 2*Math.PI*r, off = C*(1-Math.max(0,Math.min(1,pct)));
  return (
    <svg viewBox="0 0 140 140" style={{ width:150, height:150, flex:'none' }}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e4eaf2" strokeWidth="13"/>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#c9a227" strokeWidth="13" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 70 70)"/>
      <text x="70" y="66" textAnchor="middle" fontSize="21" fontWeight="bold" fill="#0e2f52" fontFamily="Tahoma">{top}</text>
      <text x="70" y="84" textAnchor="middle" fontSize="9" fill="#8ea1b8" fontFamily="Tahoma" letterSpacing="1">{bottom}</text>
    </svg>
  );
}
