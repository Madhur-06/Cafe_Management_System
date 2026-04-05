const ICONS = {
  brand: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 8h8a0 0 0 0 1 0 0v4a4 4 0 0 1-4 4H7a0 0 0 0 1 0 0V8a0 0 0 0 1 0 0Z"/>
      <path d="M15 10h2a2 2 0 0 1 0 4h-2"/>
      <path d="M8 4v2"/>
      <path d="M11 4v2"/>
      <path d="M14 4v2"/>
      <path d="M5 20h10"/>
    </svg>
  `,
  branch: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 21h18"/>
      <path d="M5 21V7l7-4 7 4v14"/>
      <path d="M9 10h.01"/>
      <path d="M15 10h.01"/>
      <path d="M9 14h.01"/>
      <path d="M15 14h.01"/>
      <path d="M10 21v-4h4v4"/>
    </svg>
  `,
  products: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 8.5 12 3 3 8.5 12 14l9-5.5Z"/>
      <path d="M3 8.5V16l9 5 9-5V8.5"/>
      <path d="M12 14v7"/>
    </svg>
  `,
  payment: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2"/>
      <path d="M3 10h18"/>
      <path d="M7 15h3"/>
    </svg>
  `,
  wallet: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"/>
      <path d="M4 8h15"/>
      <path d="M16 13h2"/>
    </svg>
  `,
  floors: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 21V7l8-4 8 4v14"/>
      <path d="M8 11h2"/>
      <path d="M14 11h2"/>
      <path d="M8 15h2"/>
      <path d="M14 15h2"/>
      <path d="M10 21v-4h4v4"/>
    </svg>
  `,
  users: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
      <circle cx="9.5" cy="7" r="3"/>
      <path d="M20 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 4.13a3 3 0 0 1 0 5.74"/>
    </svg>
  `,
  analytics: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 20V10"/>
      <path d="M10 20V4"/>
      <path d="M16 20v-7"/>
      <path d="M22 20v-4"/>
      <path d="M2 20h20"/>
    </svg>
  `,
  pos: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2"/>
      <path d="M8 20h8"/>
      <path d="M12 16v4"/>
    </svg>
  `,
  mobile: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5"/>
      <path d="M11 18h2"/>
    </svg>
  `,
  kitchen: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 3v8"/>
      <path d="M7 3v8"/>
      <path d="M5.5 11v10"/>
      <path d="M14 3v7a2 2 0 0 0 2 2h1v9"/>
      <path d="M19 3v18"/>
    </svg>
  `,
  customer: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="11" rx="2"/>
      <path d="M8 20h8"/>
      <path d="M12 16v4"/>
    </svg>
  `,
  open: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 5h5v5"/>
      <path d="M10 14 19 5"/>
      <path d="M19 14v5h-14v-14h5"/>
    </svg>
  `,
  logout: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <path d="M16 17l5-5-5-5"/>
      <path d="M21 12H9"/>
    </svg>
  `,
  sun: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2.5"/>
      <path d="M12 19.5V22"/>
      <path d="M4.93 4.93l1.77 1.77"/>
      <path d="M17.3 17.3l1.77 1.77"/>
      <path d="M2 12h2.5"/>
      <path d="M19.5 12H22"/>
      <path d="M4.93 19.07l1.77-1.77"/>
      <path d="M17.3 6.7l1.77-1.77"/>
    </svg>
  `,
  moon: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"/>
    </svg>
  `,
  session: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3"/>
      <path d="M12 19v3"/>
      <path d="M2 12h3"/>
      <path d="M19 12h3"/>
    </svg>
  `,
  chevronDown: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  `,
  table: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9h16"/>
      <path d="M6 9v8"/>
      <path d="M18 9v8"/>
      <path d="M9 9V5h6v4"/>
    </svg>
  `,
  circleCheck: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `,
  clock: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 2"/>
    </svg>
  `,
  alert: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3 2.5 19h19L12 3Z"/>
      <path d="M12 9v4"/>
      <path d="M12 17h.01"/>
    </svg>
  `,
  qr: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 4h6v6H4z"/>
      <path d="M14 4h6v6h-6z"/>
      <path d="M4 14h6v6H4z"/>
      <path d="M15 15h1"/>
      <path d="M18 15h2"/>
      <path d="M15 18h3"/>
      <path d="M20 18v2"/>
      <path d="M18 20h2"/>
    </svg>
  `,
  eye: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `,
  eyeOff: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3l18 18"/>
      <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42"/>
      <path d="M9.88 5.09A11.4 11.4 0 0 1 12 5c6.5 0 10 7 10 7a19.7 19.7 0 0 1-4.35 5.1"/>
      <path d="M6.61 6.61A19.3 19.3 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.16-.86"/>
    </svg>
  `,
  close: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  `,
  success: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `,
  error: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M15 9 9 15"/>
      <path d="m9 9 6 6"/>
    </svg>
  `,
  info: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 10v6"/>
      <path d="M12 7h.01"/>
    </svg>
  `,
  minus: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14"/>
    </svg>
  `,
  trash: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/>
      <path d="M8 6V4h8v2"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 10v6"/>
      <path d="M14 10v6"/>
    </svg>
  `,
};

export function icon(name, className = "", label = "") {
  const svg = ICONS[name] || ICONS.info;
  const classes = ["ui-icon", className].filter(Boolean).join(" ");
  const aria = label ? ` aria-label="${label}" role="img"` : ` aria-hidden="true"`;
  return `<span class="${classes}"${aria}>${svg}</span>`;
}
