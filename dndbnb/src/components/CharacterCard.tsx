// Shared character-list-item card.
//
// Used by MyCharacters, Browse, and Favorites. Variants control which
// metadata badges + inline actions show (e.g., the trash icon only
// makes sense on /characters where the user owns every row).

import { Link } from 'react-router-dom';
import { resolveContent } from 'ttrpg-engine-dnd';
import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
import { FavoriteButton } from '@/components/FavoriteButton';
import { DeleteCharacterButton } from '@/components/DeleteCharacterButton';
import { CompassFilledIcon, CompassIcon, DragHandleIcon } from '@/components/Icons';
import { classColorVars } from '@/lib/class-colors';

// Resolved once at module load so we can map species/class ids to
// their display names ("tiefling" -> "Tiefling", "ranger" -> "Ranger")
// without hammering the engine on every render.
const content = resolveContent([loadStarterPack()]);

export interface CharacterCardModel {
  readonly id: string;
  readonly name: string;
  readonly updated_at?: string;
  readonly is_public?: boolean;
  readonly ownerLabel?: string | null;
  readonly primary_class_id?: string | null;
  readonly species_id?: string | null;
}

interface CharacterCardProps {
  readonly character: CharacterCardModel;
  readonly showVisibilityBadge?: boolean;
  readonly showFavorite?: boolean;
  readonly onDeleted?: (characterId: string) => void;
  readonly onError?: (message: string) => void;
  /** When provided, the public-marker compass becomes a clickable
   *  button that flips visibility. Pass it on owner-only surfaces
   *  (MyCharacters). Leave undefined elsewhere so the compass
   *  renders as a read-only status indicator. */
  readonly onTogglePublic?: () => void | Promise<void>;
  /** Forwarded to the outer <li> so callers can attach drag handlers,
   *  extra class names, etc. without wrapping the card in another <li>. */
  readonly itemProps?: Omit<React.LiHTMLAttributes<HTMLLIElement>, 'children' | 'style'>;
  /** Extra CSS variables / styles to merge with the class-color vars on
   *  the outer <li>. Used by callers that need to set per-row colors
   *  for things like drop indicators. */
  readonly extraStyle?: React.CSSProperties;
  /** Ref to the outer <li>. Separate from itemProps because React
   *  intercepts the `ref` key during spread before it reaches the DOM. */
  readonly liRef?: React.Ref<HTMLLIElement>;
  /** When provided, renders a three-line drag handle on the left edge
   *  of the card. The props are spread onto the handle button so the
   *  caller can attach pointer-event handlers. */
  readonly dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

const titleCase = (id: string): string =>
  id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatSummary = (
  speciesId: string | null | undefined,
  classId: string | null | undefined,
): string | null => {
  const speciesName = speciesId
    ? content.species.get(speciesId)?.name ?? titleCase(speciesId)
    : null;
  const className = classId
    ? content.classes.get(classId)?.name ?? titleCase(classId)
    : null;
  const parts = [speciesName, className].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' ') : null;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export const CharacterCard = ({
  character,
  showVisibilityBadge,
  showFavorite,
  onDeleted,
  onError,
  itemProps,
  extraStyle,
  liRef,
  dragHandleProps,
  onTogglePublic,
}: CharacterCardProps): JSX.Element => {
  const summary = formatSummary(character.species_id, character.primary_class_id);
  const { className: extraClass, ...restItemProps } = itemProps ?? {};
  const hasHandle = !!dragHandleProps;
  return (
    <li
      {...restItemProps}
      ref={liRef}
      className={`character-card${hasHandle ? ' has-drag-handle' : ''}${extraClass ? ` ${extraClass}` : ''}`}
      style={{ ...classColorVars(character.primary_class_id), ...extraStyle }}
    >
      {hasHandle && (
        <button
          type="button"
          {...dragHandleProps}
          className={`character-drag-handle${dragHandleProps.className ? ` ${dragHandleProps.className}` : ''}`}
          aria-label="Reorder character"
          title="Drag to reorder"
        >
          <DragHandleIcon size={18} />
        </button>
      )}
      <Link to={`/characters/${character.id}`}>
        <div className="character-card-head">
          <span className="character-name">{character.name}</span>
          <div className="character-card-actions">
            {showVisibilityBadge &&
              (onTogglePublic ? (
                <button
                  type="button"
                  className="public-marker public-marker-btn"
                  title={character.is_public ? 'Click to make private' : 'Click to share publicly'}
                  aria-label={character.is_public ? 'Make private' : 'Make public'}
                  aria-pressed={!!character.is_public}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTogglePublic();
                  }}
                >
                  {character.is_public ? <CompassFilledIcon size={16} /> : <CompassIcon size={16} />}
                </button>
              ) : (
                character.is_public && (
                  <span
                    className="public-marker"
                    title="Public"
                    aria-label="Public character"
                  >
                    <CompassFilledIcon size={16} />
                  </span>
                )
              ))}
            {onDeleted && (
              <DeleteCharacterButton
                characterId={character.id}
                characterName={character.name}
                onDeleted={onDeleted}
                onError={onError}
              />
            )}
            {showFavorite && <FavoriteButton characterId={character.id} stopPropagation />}
          </div>
        </div>
        {summary && <div className="character-summary">{summary}</div>}
        {character.updated_at && (
          <div className="character-updated">
            Updated{' '}
            {character.ownerLabel && (
              <>
                by <em className="character-owner">{character.ownerLabel}</em>{' '}
              </>
            )}
            on {formatDate(character.updated_at)}
          </div>
        )}
      </Link>
    </li>
  );
};
