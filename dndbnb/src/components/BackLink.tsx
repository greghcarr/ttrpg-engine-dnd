// Generic "go back" breadcrumb link.
//
// Prefers the browser's history.back() so the user lands on whatever
// page they were last viewing, regardless of which list page that was.
// Falls back to a route path when there's nothing in history (direct
// load, fresh tab, bookmark) so the link is never a dead end.
//
// Rendered as an <a> with the fallback URL so right-click / cmd-click
// still work as expected.

import { useNavigate } from 'react-router-dom';

interface Props {
  readonly children: React.ReactNode;
  /** Where to navigate when there's no previous page in history. */
  readonly fallback: string;
}

export const BackLink = ({ children, fallback }: Props): JSX.Element => {
  const navigate = useNavigate();
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };
  return (
    <a href={fallback} onClick={onClick} className="back-link">
      {children}
    </a>
  );
};
