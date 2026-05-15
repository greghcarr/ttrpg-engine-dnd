// Inline trash-icon button used on character-list cards.
//
// Stops propagation so clicking the icon doesn't follow the wrapping
// <Link>. Native confirm() warns before the destructive call; on
// success it pings `onDeleted` so the parent can drop the row from
// its local list without a refetch.

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';

interface DeleteCharacterButtonProps {
  readonly characterId: string;
  readonly characterName: string;
  readonly onDeleted?: (characterId: string) => void;
  readonly onError?: (message: string) => void;
}

export const DeleteCharacterButton = ({
  characterId,
  characterName,
  onDeleted,
  onError,
}: DeleteCharacterButtonProps): JSX.Element => {
  const [pending, setPending] = useState(false);

  const onClick = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    if (!confirm(`Delete "${characterName}"? This can't be undone.`)) return;
    setPending(true);
    try {
      const { error } = await supabase.from('characters').delete().eq('id', characterId);
      if (error) throw error;
      onDeleted?.(characterId);
    } catch (err) {
      onError?.(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className="trash-btn"
      aria-label={`Delete ${characterName}`}
      title={`Delete ${characterName}`}
      onClick={onClick}
      disabled={pending}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  );
};
