import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession, useSessionLoading } from '@/lib/session';

interface RequireAuthProps {
  readonly children: ReactNode;
}

export const RequireAuth = ({ children }: RequireAuthProps): JSX.Element => {
  const session = useSession();
  const loading = useSessionLoading();
  const location = useLocation();
  if (loading) return <p className="status">Loading...</p>;
  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};
