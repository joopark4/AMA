// Lightweight icon set — single-stroke, lucide-ish, 1.6 stroke
const Icon = ({ d, size = 18, stroke = 1.6, fill = 'none', children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  Mic:       (p) => <Icon {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></Icon>,
  MicOff:    (p) => <Icon {...p}><path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 0 0 5.12 2.12"/><path d="M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M19 11a7 7 0 0 1-1.5 4.34"/><path d="M5 11a7 7 0 0 0 11 5.65"/><path d="M12 18v3"/></Icon>,
  Send:      (p) => <Icon {...p} d="M5 12l14-7-5 14-3-6-6-1z"/>,
  Settings:  (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>,
  History:   (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></Icon>,
  Sparkles:  (p) => <Icon {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/><path d="M5 16l.6 1.6L7 18l-1.4.4L5 20l-.6-1.6L3 18l1.4-.4z"/></Icon>,
  Keyboard:  (p) => <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M10 14h4"/></Icon>,
  Close:     (p) => <Icon {...p}><path d="M6 6l12 12M18 6l-12 12"/></Icon>,
  Chevron:   (p) => <Icon {...p} d="M9 6l6 6-6 6"/>,
  ChevDown:  (p) => <Icon {...p} d="M6 9l6 6 6-6"/>,
  Check:     (p) => <Icon {...p} d="M5 13l4 4 10-10"/>,
  Plus:      (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Search:    (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></Icon>,
  Star:      (p) => <Icon {...p} d="M12 3l2.7 5.6 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.5 2.9 1.1-6.3L3 9.5l6.3-.9z"/>,
  Heart:     (p) => <Icon {...p} d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>,
  Globe:     (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></Icon>,
  Brain:     (p) => <Icon {...p}><path d="M9.5 4a3.5 3.5 0 0 0-3.5 3.5v.5a3 3 0 0 0-2 5.3 3 3 0 0 0 2 5.2v.5A3.5 3.5 0 0 0 9.5 22h0A2.5 2.5 0 0 0 12 19.5V4.5A2.5 2.5 0 0 0 9.5 2"/><path d="M14.5 4a3.5 3.5 0 0 1 3.5 3.5v.5a3 3 0 0 1 2 5.3 3 3 0 0 1-2 5.2v.5a3.5 3.5 0 0 1-3.5 3.5h0A2.5 2.5 0 0 1 12 19.5V4.5A2.5 2.5 0 0 1 14.5 2"/></Icon>,
  Volume:    (p) => <Icon {...p}><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></Icon>,
  Cube:      (p) => <Icon {...p}><path d="M12 2L3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></Icon>,
  Cloud:     (p) => <Icon {...p} d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 11a4 4 0 0 1 0 7H7z"/>,
  Lock:      (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></Icon>,
  Bolt:      (p) => <Icon {...p} d="M13 2L4 14h7l-1 8 9-12h-7z"/>,
  Sun:       (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2M20 12h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/></Icon>,
  Moon:      (p) => <Icon {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
  Drag:      (p) => <Icon {...p}><circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/></Icon>,
  User:      (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>,
  Logout:    (p) => <Icon {...p}><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></Icon>,
  Pin:       (p) => <Icon {...p}><path d="M12 17v5"/><path d="M9 3h6l-1 7 4 3v2H6v-2l4-3z"/></Icon>,
  Folder:    (p) => <Icon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  Code:      (p) => <Icon {...p}><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></Icon>,
  Calendar:  (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Icon>,
  Mail:      (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></Icon>,
  Camera:    (p) => <Icon {...p}><path d="M3 7h3l2-3h8l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></Icon>,
  Translate: (p) => <Icon {...p}><path d="M5 8h12M9 4v4c0 4-2 7-6 8M14 6c2 7 5 11 8 13M11 14c1 3 4 5 7 6M14 21l5-11 5 11M16 17h6"/></Icon>,
  Bookmark:  (p) => <Icon {...p} d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z"/>,
  Music:     (p) => <Icon {...p}><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/></Icon>,
  Pen:       (p) => <Icon {...p} d="M14 4l6 6-12 12H2v-6z"/>,
  Hand:      (p) => <Icon {...p}><path d="M9 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 11V4a1.5 1.5 0 0 1 3 0v7"/><path d="M15 11V6a1.5 1.5 0 0 1 3 0v8"/><path d="M9 12V8a1.5 1.5 0 0 0-3 0v9a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5v-3"/></Icon>,
  Filter:    (p) => <Icon {...p} d="M3 5h18l-7 9v6l-4-2v-4z"/>,
  Pause:     (p) => <Icon {...p}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></Icon>,
  Play:      (p) => <Icon {...p} d="M6 4l14 8-14 8z"/>,
  Trash:     (p) => <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></Icon>,
  Download:  (p) => <Icon {...p} d="M12 3v12m-5-5l5 5 5-5M4 21h16"/>,
  Eye:       (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>,
  EyeOff:    (p) => <Icon {...p}><path d="M3 3l18 18"/><path d="M10.6 6.1A10.4 10.4 0 0 1 12 6c6.5 0 10 6 10 6a17.6 17.6 0 0 1-3.2 4.1"/><path d="M6.6 7.6A17.7 17.7 0 0 0 2 12s3.5 6 10 6c1.6 0 3-.4 4.3-1"/><path d="M9.5 9.5a3 3 0 0 0 4 4"/></Icon>,
  Apple:     (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M16.4 12.5c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.8.9-3.6.9-.8 0-1.9-.9-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.6-3.9zM14 5.4c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z"/></Icon>,
  Google:    (p) => <Icon {...p} fill="none" stroke="none"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.5-1.7 4.4-5.5 4.4-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/></Icon>,
};

window.I = I;
window.Icon = Icon;
