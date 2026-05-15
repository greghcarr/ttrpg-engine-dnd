// Shared character-list-item card.
//
// Used by MyCharacters, Browse, and Favorites. Variants control which
// metadata badges show (e.g., the "public" badge only on /characters
// where the owner needs to see visibility; redundant on /browse).

import { Link } from 'react-router-dom';
import { FavoriteButton } from '@/components/FavoriteButton';

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
}

export const CharacterCard = ({
  character,
  showVisibilityBadge,
  showFavorite,
}: CharacterCardProps): JSX.Element => (
  <li className="character-card">
    <Link to={`/characters/${character.id}`}>
      <div className="character-card-head">
        <span className="character-name">{character.name}</span>
        {showFavorite && <FavoriteButton characterId={character.id} stopPropagation />}
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
