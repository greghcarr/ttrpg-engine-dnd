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
}: CharacterCardProps): JSX.Element => {
  const summary = formatSummary(character.species_id, character.primary_class_id);
  return (
    <li className="character-card" style={classColorVars(character.primary_class_id)}>
      <Link to={`/characters/${character.id}`}>
        <div className="character-card-head">
          <span className="character-name">
            {character.name}
            {character.is_public && showVisibilityBadge && (
              <span className="badge badge-public">Public</span>
            )}
          </span>
          <div className="character-card-actions">
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
