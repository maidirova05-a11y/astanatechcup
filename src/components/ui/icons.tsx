import type { SVGProps } from "react";

/**
 * Inline SVG icon set.
 *
 * No icon library: a dependency for fifteen glyphs is 40 kB of JavaScript, a
 * supply-chain surface, and — if loaded from a CDN — a CSP exception. These
 * are server-rendered markup with zero runtime cost.
 *
 * Every icon is decorative and marked `aria-hidden`; the accessible name comes
 * from the surrounding control's text or `aria-label`.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const ArrowDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);

export const Check = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12.5l5 5L20 6.5" />
  </Icon>
);

export const Close = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const Menu = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const Globe = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
  </Icon>
);

export const Calendar = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const MapPin = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21s7-5.7 7-11a7 7 0 10-14 0c0 5.3 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const Users = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 5.3A3.2 3.2 0 0119 8.5M17.5 14.4A6 6 0 0121 20" />
  </Icon>
);

export const Trophy = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
    <path d="M8 5.5H5.5A2.5 2.5 0 008 10M16 5.5h2.5A2.5 2.5 0 0116 10" />
    <path d="M12 13v4M9 20h6M10 17h4" />
  </Icon>
);

export const Medal = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="15" r="5" />
    <path d="M8.5 10.5L6 3h5l1.5 4.5M15.5 10.5L18 3h-5" />
  </Icon>
);

export const Certificate = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M7 9h7M7 12.5h5M16 17v4l-2-1.4L12 21v-4" />
  </Icon>
);

export const Sparkle = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" />
    <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
  </Icon>
);

export const Gift = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="9" width="18" height="12" rx="2" />
    <path d="M3 13h18M12 9v12" />
    <path d="M12 9S9.5 3 7.5 4.2 10 9 12 9zM12 9s2.5-6 4.5-4.8S14 9 12 9z" />
  </Icon>
);

export const Play = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 5.5l10 6.5-10 6.5V5.5z" />
  </Icon>
);

export const Download = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M7.5 11l4.5 4.5L16.5 11" />
    <path d="M4 17.5V19a2 2 0 002 2h12a2 2 0 002-2v-1.5" />
  </Icon>
);

export const Mail = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </Icon>
);

export const Phone = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16.5 16.5 0 014.5 5.7a2 2 0 012-2.2z" />
  </Icon>
);

export const Chat = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 21l1.4-3.6A6.6 6.6 0 014 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7z" />
  </Icon>
);

export const Chip = (props: IconProps) => (
  <Icon {...props}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
  </Icon>
);

export const Drone = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="6" height="6" rx="1.5" />
    <path d="M9 9L5.5 5.5M15 9l3.5-3.5M9 15l-3.5 3.5M15 15l3.5 3.5" />
    <circle cx="4.5" cy="4.5" r="2" />
    <circle cx="19.5" cy="4.5" r="2" />
    <circle cx="4.5" cy="19.5" r="2" />
    <circle cx="19.5" cy="19.5" r="2" />
  </Icon>
);

export const Blocks = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="10" width="8" height="8" rx="1.5" />
    <rect x="13" y="10" width="8" height="8" rx="1.5" />
    <rect x="8" y="3" width="8" height="6" rx="1.5" />
  </Icon>
);

export const Gamepad = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7.5 8h9a4.5 4.5 0 014.4 3.6l.8 4a3 3 0 01-5.3 2.5L15 16H9l-1.4 2.1a3 3 0 01-5.3-2.5l.8-4A4.5 4.5 0 017.5 8z" />
    <path d="M7 12h2M8 11v2M16 11.5h.01M17.5 13h.01" />
  </Icon>
);

export const Robot = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="8" width="16" height="11" rx="3" />
    <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5" />
    <circle cx="12" cy="3.5" r="1.2" />
  </Icon>
);

export const Shield = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l7.5 3v5.5c0 4.4-3 8.3-7.5 9.5-4.5-1.2-7.5-5.1-7.5-9.5V6L12 3z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

export const Info = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const Warning = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4l9 15.5H3L12 4z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
);
