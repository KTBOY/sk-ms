import type { SVGProps } from 'react';

/** 内置线性图标（24 viewBox，stroke: currentColor）。 */

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: P, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const IconDashboard = (p: P) => base(p, <>
  <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
  <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
</>);

export const IconWriting = (p: P) => base(p, <>
  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
</>);

export const IconUsers = (p: P) => base(p, <>
  <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
  <circle cx="17" cy="9" r="2.6" /><path d="M16.4 14.6c2.8.2 4.7 1.9 5.1 4.9" />
</>);

export const IconGraph = (p: P) => base(p, <>
  <circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" />
  <path d="M15.6 6.4 8.4 10.6M8.4 13.4l7.2 4.2" />
</>);

export const IconEvent = (p: P) => base(p, <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />);

export const IconTimeline = (p: P) => base(p, <>
  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
</>);

export const IconLocation = (p: P) => base(p, <>
  <path d="M12 21.5S5 16 5 10a7 7 0 1 1 14 0c0 6-7 11.5-7 11.5z" /><circle cx="12" cy="10" r="2.6" />
</>);

export const IconFaction = (p: P) => base(p, <>
  <path d="M5 21V4" /><path d="M5 4.5h13.5L16 8.75l2.5 4.25H5" />
</>);

export const IconItem = (p: P) => base(p, <>
  <path d="M7 3h10l4 6-9 12L3 9l4-6z" /><path d="M3 9h18M12 21 8.2 9l2.3-6M12 21l3.8-12-2.3-6" />
</>);

export const IconExport = (p: P) => base(p, <>
  <path d="M12 3v12" /><path d="m6.5 10.5 5.5 5.5 5.5-5.5" /><path d="M4 21h16" />
</>);

export const IconSettings = (p: P) => base(p, <>
  <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />
  <circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="17" r="2" />
</>);

export const IconPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IconSearch = (p: P) => base(p, <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.5-4.5" /></>);
export const IconBell = (p: P) => base(p, <>
  <path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z" /><path d="M10.3 20.5a2 2 0 0 0 3.4 0" />
</>);
export const IconX = (p: P) => base(p, <path d="m6 6 12 12M18 6 6 18" />);
export const IconChevronDown = (p: P) => base(p, <path d="m6 9 6 6 6-6" />);
export const IconTrash = (p: P) => base(p, <>
  <path d="M4 7h16M10 4h4M6.5 7l1 13h9l1-13" /><path d="M10 11v6M14 11v6" />
</>);
export const IconEdit = (p: P) => base(p, <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />);
export const IconCopy = (p: P) => base(p, <>
  <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
</>);
export const IconSparkles = (p: P) => base(p, <>
  <path d="m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9L12 3z" />
  <path d="m19 14.5.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
</>);
export const IconUpload = (p: P) => base(p, <>
  <path d="M12 15V3" /><path d="m6.5 7.5 5.5-5 5.5 5" /><path d="M4 21h16" />
</>);
export const IconDownload = (p: P) => base(p, <>
  <path d="M12 3v12" /><path d="m6.5 10.5 5.5 5 5.5-5" /><path d="M4 21h16" />
</>);
export const IconArrowUp = (p: P) => base(p, <><path d="M12 19V5" /><path d="m5.5 11.5 6.5-6.5 6.5 6.5" /></>);
export const IconArrowDown = (p: P) => base(p, <><path d="M12 5v14" /><path d="m5.5 12.5 6.5 6.5 6.5-6.5" /></>);
export const IconCheck = (p: P) => base(p, <path d="m4 12.5 5 5L20 6.5" />);
export const IconAlert = (p: P) => base(p, <>
  <path d="M12 3.5 21.5 20h-19L12 3.5z" /><path d="M12 10v4.5" /><path d="M12 17.5h.01" />
</>);
export const IconLink = (p: P) => base(p, <>
  <path d="m9.5 14.5 5-5" />
  <path d="m11 6.5 1.5-1.5a3.9 3.9 0 0 1 5.5 5.5L16.5 12" />
  <path d="m13 17.5-1.5 1.5a3.9 3.9 0 0 1-5.5-5.5L7.5 12" />
</>);
export const IconBook = (p: P) => base(p, <>
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
</>);
export const IconDoc = (p: P) => base(p, <>
  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
  <path d="M9 13h6M9 17h6M9 9h1" />
</>);
export const IconSend = (p: P) => base(p, <>
  <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" />
</>);
export const IconUser = (p: P) => base(p, <>
  <circle cx="12" cy="8" r="4" /><path d="M4.5 21c.7-4 3.7-6 7.5-6s6.8 2 7.5 6" />
</>);
export const IconRefresh = (p: P) => base(p, <>
  <path d="M21 12a9 9 0 1 1-2.9-6.6" /><path d="M21 3v6h-6" />
</>);
export const IconEye = (p: P) => base(p, <>
  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
</>);
export const IconHistory = (p: P) => base(p, <>
  <path d="M3.5 12a8.5 8.5 0 1 1 2.5 6" /><path d="M3.5 8.5V12H7" /><path d="M12 8v4.5l3 2" />
</>);
