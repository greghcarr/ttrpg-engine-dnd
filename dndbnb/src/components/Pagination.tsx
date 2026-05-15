// Shared prev/next pagination controls with an inline page-size
// selector. Pages are 0-indexed; the component renders only when
// there's somewhere to navigate to (page > 0 or hasMore). The size
// choice is persisted in localStorage via usePageSize() so it's
// remembered across pages and reloads.

import { useState } from 'react';

export const PAGE_SIZE_OPTIONS: ReadonlyArray<number> = [4, 8, 16];
const DEFAULT_PAGE_SIZE = 8;
const STORAGE_KEY = 'dndbnb:pageSize';

const isValidPageSize = (n: number): boolean => PAGE_SIZE_OPTIONS.includes(n);

const readStoredPageSize = (): number => {
  if (typeof localStorage === 'undefined') return DEFAULT_PAGE_SIZE;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return isValidPageSize(parsed) ? parsed : DEFAULT_PAGE_SIZE;
};

// Shared page-size state hook. Every paginated route uses this so the
// user's choice carries between routes.
export const usePageSize = (): [number, (next: number) => void] => {
  const [size, setSize] = useState<number>(readStoredPageSize);
  const update = (next: number): void => {
    if (!isValidPageSize(next)) return;
    setSize(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore: storage is best-effort
    }
  };
  return [size, update];
};

interface Props {
  readonly page: number;
  readonly hasMore: boolean;
  readonly onPageChange: (next: number) => void;
  readonly pageSize: number;
  readonly onPageSizeChange: (size: number) => void;
}

export const Pagination = ({
  page,
  hasMore,
  onPageChange,
  pageSize,
  onPageSizeChange,
}: Props): JSX.Element | null => {
  // Always render the size selector so users can change page size even
  // when they only have one page of results.
  return (
    <div className="pagination">
      <button
        type="button"
        className="ghost"
        disabled={page === 0}
        onClick={() => onPageChange(Math.max(0, page - 1))}
      >
        Previous
      </button>
      <span className="pagination-page">Page {page + 1}</span>
      <button
        type="button"
        className="ghost"
        disabled={!hasMore}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
      <label className="pagination-size">
        Per page
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
