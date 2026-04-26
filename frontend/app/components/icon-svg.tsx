import type { JSX, SVGProps } from "react";

type IconName =
  | "search"
  | "refresh"
  | "settings"
  | "upload"
  | "trash"
  | "plus"
  | "briefcase"
  | "board"
  | "external"
  | "wand"
  | "arrow-right"
  | "arrow-left";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, { viewBox: string; body: JSX.Element }> = {
  search: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <circle cx="7" cy="7" r="5" />
        <path d="M11 11l3 3" />
      </>
    ),
  },
  refresh: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <path d="M14 8a6 6 0 1 1-1.76-4.24" />
        <path d="M14 2v3.5h-3.5" strokeLinecap="round" />
      </>
    ),
  },
  settings: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <circle cx="8" cy="8" r="2.2" />
        <path
          d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  upload: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <path
          d="M8 11V2M8 2L4.5 5.5M8 2l3.5 3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M2 13h12" strokeLinecap="round" />
      </>
    ),
  },
  trash: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  plus: {
    viewBox: "0 0 16 16",
    body: <path d="M8 3v10M3 8h10" strokeLinecap="round" />,
  },
  briefcase: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <rect x="2" y="5" width="12" height="9" rx="1" />
        <path d="M5.5 5V3h5v2" strokeLinecap="round" />
      </>
    ),
  },
  board: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <rect x="2" y="3" width="3" height="10" />
        <rect x="6.5" y="3" width="3" height="6" />
        <rect x="11" y="3" width="3" height="8" />
      </>
    ),
  },
  external: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M9 3h4v4M13 3l-6 6M11 9v4H3V5h4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  wand: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M3 13L11 5M11 5l1-3 1 3 3 1-3 1-1 3-1-3-3-1 3-1z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  "arrow-right": {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M3 8h10M9 4l4 4-4 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  "arrow-left": {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M13 8H3M7 4L3 8l4 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
};

export default function Icon({ name, size = 14, ...rest }: IconProps) {
  const def = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={def.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      {...rest}
    >
      {def.body}
    </svg>
  );
}
