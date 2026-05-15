// Owner-aware controls for the icon + name of a campaign.
//
// `CampaignIconButton` renders the icon. For owners it's clickable
// and opens a modal grid of every available icon with its name label.
// For non-owners it renders as a plain SVG.
//
// `CampaignNameEditor` renders the name. For owners a pencil button
// sits immediately to its right; clicking it swaps the name for an
// inline text input with save / cancel actions. For non-owners the
// pencil is hidden and the name is plain text.
//
// Both are used inside the <summary> of an expandable <details>
// element, so every interactive button calls preventDefault +
// stopPropagation to keep clicks from toggling the parent details.

import { useState } from 'react';
import {
  CAMPAIGN_ICON_IDS,
  CampaignIcon,
  DEFAULT_CAMPAIGN_ICON,
} from '@/components/CampaignIcons';
import { CheckIcon, PencilIcon, CloseIcon } from '@/components/Icons';
import { setCampaignIcon, setCampaignName } from '@/lib/campaigns';
import { errorMessage } from '@/lib/errors';

const MAX_CAMPAIGN_NAME_LEN = 80;

const titleCase = (id: string): string =>
  id.charAt(0).toUpperCase() + id.slice(1);

const swallow = (e: React.SyntheticEvent): void => {
  e.preventDefault();
  e.stopPropagation();
};

interface CampaignIconButtonProps {
  readonly campaignId: string;
  readonly icon: string;
  readonly isOwner: boolean;
  readonly size?: number;
  readonly className?: string;
  readonly onChanged: () => void | Promise<void>;
}

export const CampaignIconButton = ({
  campaignId,
  icon,
  isOwner,
  size = 28,
  className,
  onChanged,
}: CampaignIconButtonProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner) {
    return <CampaignIcon id={icon} size={size} className={className} />;
  }

  const onPick = async (newIcon: string): Promise<void> => {
    if (newIcon === icon) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setCampaignIcon(campaignId, newIcon);
      await onChanged();
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="campaign-icon-button"
        onClick={(e) => {
          swallow(e);
          setOpen(true);
        }}
        title="Change campaign icon"
        aria-label="Change campaign icon"
      >
        <CampaignIcon id={icon} size={size} className={className} />
      </button>
      {open && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            swallow(e);
            if (!saving) setOpen(false);
          }}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-label="Pick a campaign icon"
            onClick={swallow}
          >
            <h3 className="modal-title">Campaign icon</h3>
            <div className="icon-picker-named">
              {CAMPAIGN_ICON_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`icon-pick-named ${id === icon ? 'is-selected' : ''}`}
                  onClick={(e) => {
                    swallow(e);
                    onPick(id);
                  }}
                  disabled={saving}
                  aria-pressed={id === icon}
                >
                  <CampaignIcon id={id} size={28} />
                  <span className="icon-pick-name">{titleCase(id)}</span>
                </button>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
};

CampaignIconButton.defaultIcon = DEFAULT_CAMPAIGN_ICON;

interface CampaignNameEditorProps {
  readonly campaignId: string;
  readonly name: string;
  readonly isOwner: boolean;
  /** The element used for the static name. Summary uses 'span'; the
   *  detail route uses 'h2'. */
  readonly as?: 'span' | 'h2';
  readonly className?: string;
  readonly onChanged: () => void | Promise<void>;
}

export const CampaignNameEditor = ({
  campaignId,
  name,
  isOwner,
  as = 'span',
  className,
  onChanged,
}: CampaignNameEditorProps): JSX.Element => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Tag = as;

  if (!editing) {
    return (
      <span className="campaign-name-row">
        <Tag className={className}>{name}</Tag>
        {isOwner && (
          <button
            type="button"
            className="icon-btn campaign-rename-btn"
            onClick={(e) => {
              swallow(e);
              setDraft(name);
              setError(null);
              setEditing(true);
            }}
            title="Rename campaign"
            aria-label="Rename campaign"
          >
            <PencilIcon size={14} />
          </button>
        )}
      </span>
    );
  }

  const cancel = (): void => {
    setEditing(false);
    setError(null);
  };

  const save = async (): Promise<void> => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === name) {
      cancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setCampaignName(campaignId, trimmed);
      await onChanged();
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="campaign-name-row campaign-name-row-editing">
      <input
        type="text"
        className="campaign-rename-input"
        value={draft}
        maxLength={MAX_CAMPAIGN_NAME_LEN}
        onChange={(e) => setDraft(e.target.value)}
        onClick={swallow}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            swallow(e);
            save();
          } else if (e.key === 'Escape') {
            swallow(e);
            cancel();
          }
        }}
        autoFocus
        disabled={saving}
      />
      <button
        type="button"
        className="icon-btn"
        onClick={(e) => {
          swallow(e);
          save();
        }}
        disabled={saving || draft.trim().length === 0}
        title="Save name"
        aria-label="Save name"
      >
        <CheckIcon size={14} />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={(e) => {
          swallow(e);
          cancel();
        }}
        disabled={saving}
        title="Cancel rename"
        aria-label="Cancel rename"
      >
        <CloseIcon size={14} />
      </button>
      {error && <span className="form-error campaign-rename-error">{error}</span>}
    </span>
  );
};
