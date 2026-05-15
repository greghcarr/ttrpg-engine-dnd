import { useState } from 'react';
import { toggleFavorite, useIsFavorite } from '@/lib/favorites';
import { useUser } from '@/lib/session';

interface FavoriteButtonProps {
  readonly characterId: string;
  readonly className?: string;
  readonly stopPropagation?: boolean;
}

export const FavoriteButton = ({
  characterId,
  className,
  stopPropagation,
}: FavoriteButtonProps): JSX.Element | null => {
  const user = useUser();
  const isFavorite = useIsFavorite(characterId);
  const [pending, setPending] = useState(false);
  if (!user) return null;

  const onClick = async (e: React.MouseEvent): Promise<void> => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (pending) return;
    setPending(true);
    try {
      await toggleFavorite(characterId);
    } catch {
      // Optimistic update already rolled back inside toggleFavorite.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className={`star-btn ${isFavorite ? 'is-on' : ''} ${className ?? ''}`}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={onClick}
      disabled={pending}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
};
