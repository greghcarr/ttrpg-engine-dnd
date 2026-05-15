// Small SVG icon set, hand-rolled (Feather / Lucide style paths).
//
// Used by the icon-only toolbar buttons so the chrome stays compact
// (especially on mobile) and the surface visual-weight stays low.
// Each icon takes a size prop (default 16px); the stroke uses
// currentColor so the parent button controls the hue.

interface IconProps {
  readonly size?: number;
  readonly className?: string;
}

const baseSvgProps = (size: number, className: string | undefined): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className,
  'aria-hidden': true,
});

export const PencilIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

export const DownloadIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const CopyIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const GlobeIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const LockIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const TrashIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const LogOutIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const CheckIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const PlusIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const MenuIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const CloseIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="6" y1="18" x2="18" y2="6" />
  </svg>
);

// Per-route nav icons exist in both outline and filled variants; the
// active-route NavLink renders the filled version while the rest stay
// outline. The two variants of each pair share the same path geometry
// so the swap reads as "this one is selected" rather than "this one
// is a different shape." Outline uses fill=none + stroke=currentColor;
// filled flips both to currentColor.

const filledSvgProps = (size: number, className: string | undefined): React.SVGProps<SVGSVGElement> => ({
  ...baseSvgProps(size, className),
  fill: 'currentColor',
});

export const UserIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
  </svg>
);

export const UserFilledIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...filledSvgProps(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
  </svg>
);

export const CompassIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

export const CompassFilledIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...filledSvgProps(size, className)}>
    <circle cx="12" cy="12" r="10" />
    {/* Filled compass: invert the needle to a contrasting hole so the
        shape still reads as a compass when the outer disk is filled. */}
    <polygon
      points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
      fill="var(--card)"
      stroke="var(--card)"
    />
  </svg>
);

export const StarOutlineIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const StarFilledIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...filledSvgProps(size, className)}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const UsersIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const UsersFilledIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...filledSvgProps(size, className)}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// Die-face icon (five-pip / classic d6) used for the Randomize action.
export const KeyIcon = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="8" cy="12" r="4" />
    <line x1="12" y1="12" x2="22" y2="12" />
    <line x1="19" y1="12" x2="19" y2="16" />
    <line x1="16" y1="12" x2="16" y2="15" />
  </svg>
);

export const ChevronLeftIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const ChevronRightIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const DiceIcon = ({ size = 18, className }: IconProps): JSX.Element => (
  <svg {...baseSvgProps(size, className)}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" ry="2.5" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
  </svg>
);
