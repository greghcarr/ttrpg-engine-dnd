import { Link, NavLink, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession, useUsername } from '@/lib/session';

export const Layout = (): JSX.Element => {
  const session = useSession();
  const username = useUsername();
  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };
  return (
    <>
      <header className="site-header">
        <div className="brand">
          <Link to="/characters">
            <h1>dndbnb</h1>
          </Link>
          <p className="tagline">a D&amp;D character workbench</p>
        </div>
        <nav className="site-nav">
          {session && (
            <div className="site-nav-links">
              <NavLink
                to="/characters"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Characters
              </NavLink>
              <NavLink
                to="/browse"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Browse
              </NavLink>
              <NavLink
                to="/favorites"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Favorites
              </NavLink>
              <NavLink
                to="/campaigns"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Campaigns
              </NavLink>
            </div>
          )}
          {session ? (
            <>
              <span className="user-name">{username ?? 'signed in'}</span>
              <button type="button" onClick={signOut} className="link-button">
                Sign out
              </button>
            </>
          ) : (
            <Link to="/sign-in" className="link-button">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
};
