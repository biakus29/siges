import React from 'react';

/* Sprite d'icônes SVG (injecté une fois dans l'application) */
const SYMBOLS = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17 14.7c2.8.4 4.3 2.2 4.5 5.3"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-4 3.4-6 7-6s6.4 2 7 6"/></>,
  receipt: <><path d="M5 3h14v18l-2.3-1.6-2.4 1.6-2.3-1.6L9.7 21l-2.4-1.6L5 21z"/><path d="M9 7.5h6M9 11h6M9 14.5h4"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
  classroom: <><rect x="3" y="4" width="18" height="10.5" rx="1"/><path d="M12 14.5V18M8 21l4-3 4 3"/><path d="M7 7.5h6M7 10h4"/></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 12h.01M18 12h.01"/></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/></>,
  activity: <path d="M22 12h-4l-3 8-6-16-3 8H2"/>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></>,

  logout: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
  eye: <><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <><path d="M2 2l20 20"/><path d="M6.7 6.8C3.7 8.8 1.5 12 1.5 12s4 7 10.5 7c1.9 0 3.7-.6 5.2-1.5M10.6 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10.5 7 10.5 7s-.9 1.6-2.5 3.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  pencil: <path d="m17 3 4 4L8 20l-5 1 1-5z"/>,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/><path d="M10 11v6M14 11v6"/></>,
  printer: <><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></>,
  check: <path d="M20 6 9 17l-5-5"/>,
  'check-circle': <><circle cx="12" cy="12" r="9.5"/><path d="m8 12.5 2.7 2.7L16.5 9"/></>,
  x: <path d="M18 6 6 18M6 6l12 12"/>,
  'x-circle': <><circle cx="12" cy="12" r="9.5"/><path d="M15 9l-6 6M9 9l6 6"/></>,
  ban: <><circle cx="12" cy="12" r="9.5"/><path d="M5.3 5.3l13.4 13.4"/></>,
  alert: <><path d="M12 3 2 20h20z"/><path d="M12 9.5V14M12 17v.01"/></>,
  lock: <><rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 15v2.5"/></>,
  shield: <><path d="M12 2 20 5.5v6.3c0 5-3.4 8.4-8 10.2-4.6-1.8-8-5.2-8-10.2V5.5z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/></>,
  info: <><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5M12 8v.01"/></>,
  'chev-d': <path d="m6 9 6 6 6-6"/>,
  'chev-l': <path d="m15 6-6 6 6 6"/>,
  'chev-r': <path d="m9 6 6 6-6 6"/>,
  coins: <><circle cx="8.5" cy="8.5" r="5.5"/><path d="M6.8 13.2A5.5 5.5 0 1 0 17 19"/></>,
  chart: <><path d="M3 21h18"/><path d="M5.5 21v-6M10.5 21V8M15.5 21v-9M20.5 21V11"/></>,
  download: <><path d="M12 3v11M12 14l-4.5-4.5M12 14l4.5-4.5"/><path d="M4 19.5h16"/></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6M20.5 3.5V8H16"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  book: <><path d="M4 19.2A2.8 2.8 0 0 1 6.8 16.5H20V3H6.8A2.8 2.8 0 0 0 4 5.8z"/><path d="M4 19.2A2.8 2.8 0 0 0 6.8 22H20v-5.5"/></>,
  target: <><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/></>,
  'arrow-r': <path d="M4 12h15M15 7l5 5-5 5"/>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="17" height="11" rx="2"/><path d="M16.5 13.5h.01"/></>,
  bank: <><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/></>,
  wrench: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.6 12l-2.6-2.6z"/>,
  'calendar-x': <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9.5 13.5 5 5M14.5 13.5l-5 5"/></>,
  gavel: <><path d="m13.5 4.5 6 6M11 7l6 6"/><path d="m8.5 9.5-5 5L8 19l5-5"/><path d="M12.5 21H21"/></>,
  award: <><circle cx="12" cy="9" r="6"/><path d="m8.5 14-2 7 5.5-3 5.5 3-2-7"/></>,
  id: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.5-1.6 1.6-2.5 3-2.5s2.5.9 3 2.5"/><path d="M14.5 9.5h5M14.5 13h5"/></>,
  qr: <><rect x="3.5" y="3.5" width="6" height="6"/><rect x="14.5" y="3.5" width="6" height="6"/><rect x="3.5" y="14.5" width="6" height="6"/><path d="M14.5 14.5h3v3h-3zM20.5 14.5v3M14.5 20.5h6"/></>,
  upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
  wa: <><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5Z"/><path d="M9 9.5c.4 2.4 2.6 4.6 5 5l1-1.4 1.8.8c-.3 1.2-1.3 1.9-2.5 1.7-3.2-.6-5.8-3.2-6.4-6.4-.2-1.2.5-2.2 1.7-2.5l.8 1.8Z"/></>
};

export function Sprite(){
  return (
    <svg width="0" height="0" style={{ position:'absolute' }} aria-hidden="true">
      <defs>
        {Object.entries(SYMBOLS).map(([id, children]) => (
          <symbol id={'i-'+id} viewBox="0 0 24 24" key={id}>{children}</symbol>
        ))}
      </defs>
    </svg>
  );
}

export function Ic({ name, className='' }){
  return <svg className={'ic ' + className} aria-hidden="true"><use href={'#i-' + name}/></svg>;
}
