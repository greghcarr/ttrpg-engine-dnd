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
