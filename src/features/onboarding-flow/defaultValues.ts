import type { GeneratePreviewValues, SnapshotFormValues, SnapshotVersionValues } from './schema';

export const snapshotFormDefaults: SnapshotFormValues = {
  countryCode: '',
  countryName: '',
  legalEntity: '',
  region: 'EMEA',
  requestedBy: '',
  commitStrategy: 'multi-repo',
  generateFsm: true,
  generateConfigs: true,
  notes: '',
  domains: {
    glsClearing: true,
    sanctions: true,
    posting: true,
    routing: true,
    initiation: true,
    stateManager: true,
    notificationsBigdata: true
  }
};

export const snapshotVersionDefaults: SnapshotVersionValues = {
  reason: ''
};

export const generatePreviewDefaults: GeneratePreviewValues = {
  snapshotId: '',
  version: '',
  repos: []
};
