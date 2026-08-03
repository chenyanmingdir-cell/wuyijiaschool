import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
}

function Icon({ size = 20, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconDashboard({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </Icon>
  );
}

export function IconClasses({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.4 14.7c2 .6 3.3 2 3.8 4.3" />
    </Icon>
  );
}

export function IconReports({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 20V12" />
      <path d="M10 20V5" />
      <path d="M16 20v-9" />
      <path d="M2 20h20" />
    </Icon>
  );
}

export function IconSettings({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 7h16" />
      <path d="M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </Icon>
  );
}

export function IconCalendar({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Icon>
  );
}

export function IconClipboard({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4.5h6" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function IconPen({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="m4 20 4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20z" />
      <path d="m13.5 6.5 3 3" />
    </Icon>
  );
}

export function IconPhone({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
    </Icon>
  );
}

export function IconChevronLeft({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function IconChevronRight({ size = 20 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}
