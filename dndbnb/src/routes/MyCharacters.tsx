// "My Characters" page.
//
// Lists characters owned by the signed-in user. Each card has a
// three-line drag handle on its left edge; pressing the handle and
// dragging up or down reorders the list. Pointer events drive the
// drag so the same code path works on mouse, pen, and touch. The
// new order is persisted to `characters.sort_order` (migration 0013)
// and read back on subsequent visits.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { useUser } from '@/lib/session';
import { CharacterCard, type CharacterCardModel } from '@/components/CharacterCard';
import { PlusIcon } from '@/components/Icons';
import { Pagination, usePageSize } from '@/components/Pagination';
import { errorMessage } from '@/lib/errors';
import { getClassColor } from '@/lib/class-colors';

type Row = Pick<
  CharacterRow,
  'id' | 'name' | 'updated_at' | 'is_public' | 'primary_class_id' | 'species_id' | 'sort_order'
>;

interface Insertion {
  readonly targetIndex: number;
  readonly side: 'before' | 'after';
}

export const MyCharacters = (): JSX.Element => {
  const user = useUser();
  const [rows, setRows] = useState<ReadonlyArray<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [insertion, setInsertion] = useState<Insertion | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [hasMore, setHasMore] = useState(false);
  // Refs to each card's <li> so we can hit-test the pointer position
  // against their bounding rects without walking the DOM each move.
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('characters')
      .select('id, name, updated_at, is_public, primary_class_id, species_id, sort_order')
      .eq('owner_id', user.id)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          return;
        }
        const fetched = data ?? [];
        setHasMore(fetched.length > pageSize);
        setRows(fetched.slice(0, pageSize));
      });
    return () => {
      cancelled = true;
    };
  }, [user, page, pageSize]);

  const onTogglePublic = (row: Row) => async (): Promise<void> => {
    const target = !row.is_public;
    if (target) {
      const ok = confirm(
        `Make "${row.name}" publicly visible? Anyone signed in will be able to see it on the Browse page, favorite it, or clone it for their own use. You can switch it back to private at any time.`,
      );
      if (!ok) return;
    }
    setError(null);
    const { error: err } = await supabase
      .from('characters')
      .update({ is_public: target })
      .eq('id', row.id);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    setRows((current) =>
      (current ?? []).map((r) => (r.id === row.id ? { ...r, is_public: target } : r)),
    );
  };

  // The reorder is local to the current page: each card's persisted
  // sort_order is the global index (page * pageSize + localIdx) so
  // cross-page ordering is preserved.
  const persistOrder = async (ordered: ReadonlyArray<Row>): Promise<void> => {
    setError(null);
    const offset = page * pageSize;
    const updates = ordered.map((row, idx) =>
      supabase.from('characters').update({ sort_order: offset + idx }).eq('id', row.id),
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) setError(errorMessage(firstErr));
  };

  const hitTest = (clientY: number): Insertion | null => {
    const refs = cardRefs.current;
    for (let i = 0; i < refs.length; i += 1) {
      const el = refs[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top) {
        return { targetIndex: i, side: 'before' };
      }
      if (clientY <= rect.bottom) {
        const side: 'before' | 'after' =
          clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        return { targetIndex: i, side };
      }
    }
    // Past the last card: drop at the end.
    if (refs.length > 0) return { targetIndex: refs.length - 1, side: 'after' };
    return null;
  };

  const onHandlePointerDown = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; // left mouse button only
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingIndex(idx);
    setInsertion(hitTest(e.clientY));
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (draggingIndex === null) return;
    e.preventDefault();
    setInsertion(hitTest(e.clientY));
  };

  const finalizeDrop = (): void => {
    if (draggingIndex === null || !insertion || !rows) {
      setDraggingIndex(null);
      setInsertion(null);
      return;
    }
    const fromIdx = draggingIndex;
    const targetIdx = insertion.targetIndex;
    let toIdx = insertion.side === 'before' ? targetIdx : targetIdx + 1;
    // Removing the source shifts everything after it left by one, so
    // adjust the destination when moving forward in the list.
    if (fromIdx < toIdx) toIdx -= 1;
    setDraggingIndex(null);
    setInsertion(null);
    if (toIdx === fromIdx) return;
    const next = rows.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    setRows(next);
    persistOrder(next);
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    finalizeDrop();
  };

  const onHandlePointerCancel = (): void => {
    setDraggingIndex(null);
    setInsertion(null);
  };

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>My characters</h2>
        <Link
          to="/characters/new"
          className="icon-btn"
          title="Create character"
          aria-label="Create character"
        >
          <PlusIcon />
        </Link>
      </div>
      {error ? (
        <p className="status error">{error}</p>
      ) : rows === null ? (
        <p className="status">Loading characters...</p>
      ) : rows.length === 0 && page === 0 ? (
        <p className="empty">No characters yet.</p>
      ) : (
        <>
        <ul className="character-list">
          {rows.map((row, idx) => {
            const isDragging = draggingIndex === idx;
            const targeted =
              insertion?.targetIndex === idx && draggingIndex !== null && draggingIndex !== idx
                ? insertion.side
                : null;
            const flags = [
              isDragging ? 'is-dragging' : '',
              targeted === 'before' ? 'drop-before' : '',
              targeted === 'after' ? 'drop-after' : '',
            ]
              .filter(Boolean)
              .join(' ');
            // While a drag is in progress, every row gets the dragged
            // character's class color exposed as --drop-color so the
            // divider line (rendered on the target) reads as "this is
            // where the dragged character will land", colored to match
            // the dragged character.
            const draggedRow = draggingIndex !== null ? rows[draggingIndex] : undefined;
            const dropColor = draggedRow
              ? getClassColor(draggedRow.primary_class_id).bg
              : undefined;
            const extraStyle = dropColor
              ? ({ ['--drop-color' as string]: dropColor } as React.CSSProperties)
              : undefined;
            return (
              <CharacterCard
                key={row.id}
                character={toCardModel(row)}
                showFavorite
                showVisibilityBadge
                onTogglePublic={onTogglePublic(row)}
                onDeleted={(deletedId) =>
                  setRows((current) => (current ?? []).filter((r) => r.id !== deletedId))
                }
                onError={setError}
                itemProps={{ className: flags }}
                extraStyle={extraStyle}
                liRef={(el) => {
                  cardRefs.current[idx] = el;
                }}
                dragHandleProps={{
                  onPointerDown: onHandlePointerDown(idx),
                  onPointerMove: onHandlePointerMove,
                  onPointerUp: onHandlePointerUp,
                  onPointerCancel: onHandlePointerCancel,
                }}
              />
            );
          })}
        </ul>
        <Pagination
          page={page}
          hasMore={hasMore}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(next: number) => {
            setPageSize(next);
            setPage(0);
          }}
        />
        </>
      )}
    </section>
  );
};

// No ownerLabel: every character in My Characters belongs to the
// signed-in user, so the "Updated by ..." line is redundant. Other
// surfaces (Browse, Favorites, Campaign) keep it because they show
// characters owned by other people.
const toCardModel = (row: Row): CharacterCardModel => ({
  id: row.id,
  name: row.name,
  updated_at: row.updated_at,
  is_public: row.is_public,
  primary_class_id: row.primary_class_id,
  species_id: row.species_id,
});
