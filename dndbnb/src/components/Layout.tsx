import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession, useUsername } from '@/lib/session';
import { CloseIcon, MenuIcon } from '@/components/Icons';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'nav-link active' : 'nav-link';

export const Layout = (): JSX.Element => {
  const session = useSession();
  const username = useUsername();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on any route change so tapping a link
  // dismisses the dropdown automatically.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const signOut = async (): Promise<void> => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  const navLinks = session ? (
    <>
      <NavLink to="/characters" className={navLinkClass}>
        Characters
      </NavLink>
      <NavLink to="/browse" className={navLinkClass}>
        Browse
      </NavLink>
      <NavLink to="/favorites" className={navLinkClass}>
        Favorites
      </NavLink>
      <NavLink to="/campaigns" className={navLinkClass}>
        Campaigns
      </NavLink>
    </>
  ) : null;

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <Link to="/characters">
            <h1>dndbnb</h1>
          </Link>
          <p className="tagline">a D&amp;D character workbench</p>
        </div>

        {session ? (
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            title={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        ) : (
          <Link to="/sign-in" className="link-button">
            Sign in
          </Link>
        )}

        {menuOpen && session && (
          <div className="mobile-menu">
            <div className="mobile-menu-links">{navLinks}</div>
            <div className="mobile-menu-footer">
              <span className="user-name">{username ?? 'signed in'}</span>
              <button type="button" onClick={signOut} className="link-button">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
};
