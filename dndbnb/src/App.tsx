import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/components/RequireAuth';
import { useInstallSessionListener } from '@/lib/session';
import { SignIn } from '@/routes/SignIn';
import { MyCharacters } from '@/routes/MyCharacters';
import { Sheet } from '@/routes/Sheet';
import { Creator } from '@/routes/Creator';
import { Browse } from '@/routes/Browse';
import { Favorites } from '@/routes/Favorites';
import { Campaigns } from '@/routes/Campaigns';
import { CampaignDetail } from '@/routes/CampaignDetail';
import { useLoadFavorites } from '@/lib/favorites';

export const App = (): JSX.Element => {
  useInstallSessionListener();
  useLoadFavorites();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/sign-in" element={<SignIn />} />
        <Route
          path="/characters"
          element={
            <RequireAuth>
              <MyCharacters />
            </RequireAuth>
          }
        />
        <Route
          path="/characters/new"
          element={
            <RequireAuth>
              <Creator />
            </RequireAuth>
          }
        />
        <Route
          path="/characters/:id"
          element={
            <RequireAuth>
              <Sheet />
            </RequireAuth>
          }
        />
        <Route
          path="/browse"
          element={
            <RequireAuth>
              <Browse />
            </RequireAuth>
          }
        />
        <Route
          path="/favorites"
          element={
            <RequireAuth>
              <Favorites />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns"
          element={
            <RequireAuth>
              <Campaigns />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:id"
          element={
            <RequireAuth>
              <CampaignDetail />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/characters" replace />} />
        <Route path="*" element={<Navigate to="/characters" replace />} />
      </Route>
    </Routes>
  );
};
