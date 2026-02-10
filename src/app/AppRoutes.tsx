import { Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { CreateSnapshotPage } from '../pages/CreateSnapshotPage';
import { DashboardPage } from '../pages/DashboardPage';
import { GeneratePreviewPage } from '../pages/GeneratePreviewPage';
import { JobsPage } from '../pages/JobsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SnapshotDetailsPage } from '../pages/SnapshotDetailsPage';
import { ThemePreviewPage } from '../pages/ThemePreviewPage';

export function AppRoutes() {
  const showThemePreview = import.meta.env.DEV;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/snapshots/new" element={<CreateSnapshotPage />} />
        <Route path="/snapshots/:snapshotId" element={<SnapshotDetailsPage />} />
        <Route path="/generate/preview" element={<GeneratePreviewPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {showThemePreview ? <Route path="/theme-preview" element={<ThemePreviewPage />} /> : null}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}


