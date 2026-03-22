import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStateManagerConfig } from '../../../src/features/state-manager/defaultScenarios';
import { clearStateManagerDraft, loadStateManagerDraft, saveStateManagerDraft } from '../../../src/features/state-manager/stateManagerStorage';

describe('stateManagerStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('supports a save/load/clear roundtrip', () => {
    const config = createDefaultStateManagerConfig('BR', 'OUTGOING');

    saveStateManagerDraft(config);
    expect(loadStateManagerDraft('BR', 'OUTGOING')).toEqual(config);

    clearStateManagerDraft('BR', 'OUTGOING');
    expect(loadStateManagerDraft('BR', 'OUTGOING')).toBeNull();
  });
});
