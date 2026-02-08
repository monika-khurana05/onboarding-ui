import { describe, expect, it } from 'vitest';
import { generatePreviewSchema, snapshotFormSchema } from './schema';

describe('snapshotFormSchema', () => {
  it('accepts a valid snapshot request payload', () => {
    const result = snapshotFormSchema.safeParse({
      countryCode: 'GB',
      countryName: 'United Kingdom',
      legalEntity: 'CPX Markets Ltd',
      region: 'EMEA',
      requestedBy: 'ops@cpx.com',
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
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid country codes', () => {
    const result = snapshotFormSchema.safeParse({
      countryCode: 'gbr',
      countryName: 'United Kingdom',
      legalEntity: 'CPX Markets Ltd',
      region: 'EMEA',
      requestedBy: 'ops@cpx.com',
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
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('2 uppercase letters');
    }
  });
});

describe('generatePreviewSchema', () => {
  it('requires at least one repo target', () => {
    const result = generatePreviewSchema.safeParse({
      snapshotId: 'snap-101',
      version: '2',
      repos: []
    });

    expect(result.success).toBe(false);
  });
});
