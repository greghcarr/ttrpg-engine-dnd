// Shared character-list-item card.
//
// Used by MyCharacters, Browse, and Favorites. Variants control which
// metadata badges + inline actions show (e.g., the trash icon only
// makes sense on /characters where the user owns every row).

import { Link } from 'react-router-dom';
import { FavoriteButton } from '@/components/FavoriteButton';
import { DeleteCharacterButton } from '@/components/DeleteCharacterButton';

export interface CharacterCardModel {
  readonly id: string;
  readonly name: string;
  readonly updated_at?: string;
  readonly is_public?: boolean;
  readonly ownerLabel?: string | null;
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
  <li className="character-card">
    <Link to={`/characters/${character.id}`}>
      <div className="character-card-head">
        <span className="character-name">{character.name}</span>
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
        {showVisibilityBadge && (
          <span className={`badge ${character.is_public ? 'badge-public' : 'badge-private'}`}>
            {character.is_public ? 'Public' : 'Private'}
          </span>
        )}
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
