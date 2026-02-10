import { PageContainer } from '../components/PageContainer';
import { CreateSnapshotWizard } from '../features/onboarding-flow/CreateSnapshotWizard';

export function CreateSnapshotPage() {
  return (
    <PageContainer
      title="Create Snapshot"
      subtitle="Capture country domains, workflow controls, and pack targeting for versioned onboarding."
    >
      <CreateSnapshotWizard />
    </PageContainer>
  );
}


