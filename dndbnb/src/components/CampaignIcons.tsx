// Campaign-icon registry.
//
// 20 hand-rolled outline SVGs covering the usual fantasy / tabletop
// vocabulary: shield, sword, crown, tower, skull, scroll, flame,
// mountain, bow, star, compass, anchor, hammer, eye, moon, sun, tree,
// key, book, wand. Owners pick one when they create a campaign and
// can change it at any time from the campaign detail page.
//
// The icon id is stored as plain text on the row (campaigns.icon).
// Unknown ids fall back to `shield` so a stale id never renders blank.

const baseProps = (size: number, className?: string): React.SVGProps<SVGSVGElement> => ({
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

type IconRender = (props: { size?: number; className?: string }) => JSX.Element;

const ICONS: Record<string, IconRender> = {
  shield: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M12 2 L20 5 L20 12 C20 17 16 21 12 22 C8 21 4 17 4 12 L4 5 Z" />
    </svg>
  ),
  sword: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M12 2 L12 18" />
      <path d="M8 14 L16 14" />
      <path d="M11 18 L11 22 L13 22 L13 18 Z" />
    </svg>
  ),
  crown: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M3 18 L3 8 L9 13 L12 6 L15 13 L21 8 L21 18 Z" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  tower: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M6 22 L6 6 L8 6 L8 4 L10 4 L10 6 L14 6 L14 4 L16 4 L16 6 L18 6 L18 22 Z" />
      <path d="M10 22 L10 14 L14 14 L14 22" />
    </svg>
  ),
  skull: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M12 3 C7 3 4 7 4 11 C4 14 5 16 7 17 L7 21 L17 21 L17 17 C19 16 20 14 20 11 C20 7 17 3 12 3 Z" />
      <circle cx="9" cy="11" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  ),
  scroll: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <rect x="5" y="4" width="14" height="16" rx="1" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="15" x2="13" y2="15" />
    </svg>
  ),
  flame: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M12 22 C7 22 5 18 5 14 C5 11 7 9 8 7 C9 12 11 11 11 6 C13 7 16 11 18 15 C18 18 16 22 12 22 Z" />
    </svg>
  ),
  mountain: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M3 20 L9 8 L14 15 L17 11 L21 20 Z" />
    </svg>
  ),
  bow: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M6 4 C18 6 18 18 6 20" />
      <line x1="3" y1="12" x2="20" y2="12" />
      <path d="M17 9 L20 12 L17 15" />
    </svg>
  ),
  star: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <polygon points="12 3 14.5 9 21 9 16 13.5 17.5 20 12 16.5 6.5 20 8 13.5 3 9 9.5 9" />
    </svg>
  ),
  compass: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16 7 13.5 13.5 8 16 10.5 10.5" />
    </svg>
  ),
  anchor: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="20" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <path d="M5 16 C5 19 8 21 12 21 C16 21 19 19 19 16" />
    </svg>
  ),
  hammer: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M7 3 L17 3 L17 8 L13 8 L13 21 L11 21 L11 8 L7 8 Z" />
    </svg>
  ),
  eye: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M2 12 C5 7 8.5 5 12 5 C15.5 5 19 7 22 12 C19 17 15.5 19 12 19 C8.5 19 5 17 2 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  moon: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <path d="M21 14 A9 9 0 1 1 10 3 A7 7 0 1 0 21 14 Z" />
    </svg>
  ),
  sun: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="5" y1="5" x2="7" y2="7" />
      <line x1="17" y1="17" x2="19" y2="19" />
      <line x1="5" y1="19" x2="7" y2="17" />
      <line x1="17" y1="7" x2="19" y2="5" />
    </svg>
  ),
  tree: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <line x1="12" y1="22" x2="12" y2="16" />
      <path d="M12 16 C5 16 7 10 10 9 C8 6 13 4 15 7 C19 6 19 14 12 16 Z" />
    </svg>
  ),
  key: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <circle cx="8" cy="12" r="4" />
      <line x1="12" y1="12" x2="22" y2="12" />
      <line x1="19" y1="12" x2="19" y2="16" />
      <line x1="16" y1="12" x2="16" y2="15" />
    </svg>
  ),
  book: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <line x1="8" y1="4" x2="8" y2="20" />
    </svg>
  ),
  wand: ({ size = 20, className }) => (
    <svg {...baseProps(size, className)}>
      <line x1="5" y1="19" x2="14" y2="10" />
      <polygon points="16 4 17 7 20 8 17 9 16 12 15 9 12 8 15 7" />
    </svg>
  ),
};

export const CAMPAIGN_ICON_IDS: ReadonlyArray<string> = Object.keys(ICONS);

export const DEFAULT_CAMPAIGN_ICON = 'shield';

interface CampaignIconProps {
  readonly id: string | null | undefined;
  readonly size?: number;
  readonly className?: string;
}

export const CampaignIcon = ({ id, size = 20, className }: CampaignIconProps): JSX.Element => {
  const render = (id ? ICONS[id] : undefined) ?? ICONS[DEFAULT_CAMPAIGN_ICON]!;
  return render({ size, className });
};
