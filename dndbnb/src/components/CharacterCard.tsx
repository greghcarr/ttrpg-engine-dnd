// Shared character-list-item card.
//
// Used by MyCharacters, Browse, and Favorites. Variants control which
// metadata badges + inline actions show (e.g., the trash icon only
// makes sense on /characters where the user owns every row).

import { Link } from 'react-router-dom';
import { FavoriteButton } from '@/components/FavoriteButton';
import { DeleteCharacterButton } from '@/components/DeleteCharacterButton';
import { GlobeIcon } from '@/components/Icons';
import { classColorVars } from '@/lib/class-colors';

export interface CharacterCardModel {
  readonly id: string;
  readonly name: string;
  readonly updated_at?: string;
  readonly is_public?: boolean;
  readonly ownerLabel?: string | null;
  readonly primary_class_id?: string | null;
}

interface CharacterCardProps {
  readonly character: CharacterCardModel;
  readonly showVisibilityBadge?: boolean;
  readonly showFavorite?: boolean;
  readonly onDeleted?: (characterId: string) => void;
  readonly onError?: (message: string) => void;
}

export const CharacterCard = ({
  character,
  showVisibilityBadge,
  showFavorite,
  onDeleted,
  onError,
}: CharacterCardProps): JSX.Element => (
  <li className="character-card" style={classColorVars(character.primary_class_id)}>
    <Link to={`/characters/${character.id}`}>
      <div className="character-card-head">
        <span className="character-name">
          {character.name}
          {character.is_public && (
            <span
              className="public-marker"
              title="Public character"
              aria-label="Public character"
            >
              <GlobeIcon size={13} />
            </span>
          )}
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
      <div className="character-meta">
        {character.ownerLabel && <span className="owner-label">by {character.ownerLabel}</span>}
        {character.updated_at && (
          <span className="character-updated">
            Updated {new Date(character.updated_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  </li>
);
