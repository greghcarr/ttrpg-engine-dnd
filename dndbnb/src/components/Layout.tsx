import { Link, NavLink, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import {
  CompassFilledIcon,
  CompassIcon,
  LogOutIcon,
  StarFilledIcon,
  StarOutlineIcon,
  UserFilledIcon,
  UserIcon,
  UsersFilledIcon,
  UsersIcon,
} from '@/components/Icons';

const iconNavClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'nav-icon active' : 'nav-icon';

export const Layout = (): JSX.Element => {
  const session = useSession();

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand">
            <Link to="/characters">
              <h1>dndbnb</h1>
            </Link>
          </div>

          {session && (
            <nav className="site-nav-icons" aria-label="Primary navigation">
              <NavLink
                to="/characters"
                className={iconNavClass}
                title="My characters"
                aria-label="My characters"
              >
                {({ isActive }) => (isActive ? <UserFilledIcon /> : <UserIcon />)}
              </NavLink>
              <NavLink
                to="/browse"
                className={iconNavClass}
                title="Browse public characters"
                aria-label="Browse public characters"
              >
                {({ isActive }) => (isActive ? <CompassFilledIcon /> : <CompassIcon />)}
              </NavLink>
              <NavLink
                to="/favorites"
                className={iconNavClass}
                title="Favorites"
                aria-label="Favorites"
              >
                {({ isActive }) => (isActive ? <StarFilledIcon /> : <StarOutlineIcon />)}
              </NavLink>
              <NavLink
                to="/campaigns"
                className={iconNavClass}
                title="Campaigns"
                aria-label="Campaigns"
              >
                {({ isActive }) => (isActive ? <UsersFilledIcon /> : <UsersIcon />)}
              </NavLink>
            </nav>
          )}
          {session && (
            <button
              type="button"
              onClick={signOut}
              className="nav-icon sign-out-icon"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOutIcon />
            </button>
          )}
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
};
