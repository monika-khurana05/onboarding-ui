import { Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { CreateAssemblyPodPage } from '../pages/CreateAssemblyPodPage';
import { CreateSnapshotPage } from '../pages/CreateSnapshotPage';
import { DashboardPage } from '../pages/DashboardPage';
import { GeneratePreviewPage } from '../pages/GeneratePreviewPage';
import { JobsPage } from '../pages/JobsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SnapshotDetailsPage } from '../pages/SnapshotDetailsPage';
import { RequirementAnalysisPage } from '../features/ai-requirements/RequirementAnalysisPage';
import { PayloadMappingPage } from '../features/ai-mapping/PayloadMappingPage';
import { TestCaseGenerationPage } from '../features/ai-testing/TestCaseGenerationPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/snapshots/new" element={<CreateSnapshotPage />} />
        <Route path="/onboarding/create-assembly-pod" element={<CreateAssemblyPodPage />} />
        <Route path="/snapshots/:snapshotId" element={<SnapshotDetailsPage />} />
        <Route path="/generate/preview" element={<GeneratePreviewPage />} />
        <Route path="/ai/requirements" element={<RequirementAnalysisPage />} />
        <Route path="/ai/mapping" element={<PayloadMappingPage />} />
        <Route path="/ai/testing" element={<TestCaseGenerationPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
