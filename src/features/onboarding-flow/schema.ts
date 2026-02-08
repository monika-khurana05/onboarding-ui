import { z } from 'zod';

export const snapshotFormSchema = z.object({
  countryCode: z
    .string({ message: 'Country code is required.' })
    .trim()
    .regex(/^[A-Z]{2}$/, 'Country code must be exactly 2 uppercase letters.'),
  countryName: z
    .string({ message: 'Country name is required.' })
    .trim()
    .min(2, 'Country name must be at least 2 characters.'),
  legalEntity: z
    .string({ message: 'Legal entity is required.' })
    .trim()
    .min(2, 'Legal entity must be at least 2 characters.'),
  region: z.enum(['Americas', 'EMEA', 'APAC']),
  requestedBy: z
    .string({ message: 'Requester email is required.' })
    .trim()
    .email('Requester email must be valid.'),
  commitStrategy: z.enum(['mono-repo', 'multi-repo']),
  generateFsm: z.boolean(),
  generateConfigs: z.boolean(),
  notes: z.string().trim(),
  domains: z.object({
    glsClearing: z.boolean(),
    sanctions: z.boolean(),
    posting: z.boolean(),
    routing: z.boolean(),
    initiation: z.boolean(),
    stateManager: z.boolean(),
    notificationsBigdata: z.boolean()
  })
});

export const snapshotVersionSchema = z.object({
  reason: z
    .string({ message: 'Version reason is required.' })
    .trim()
    .min(5, 'Please provide at least 5 characters for version reason.')
});

export const generatePreviewSchema = z.object({
  snapshotId: z
    .string({ message: 'Snapshot ID is required.' })
    .trim()
    .min(3, 'Snapshot ID is required.'),
  version: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), 'Version must be numeric when provided.'),
  repos: z.array(z.string().trim().min(1)).min(1, 'Select at least one repository target.')
});

export type SnapshotFormValues = z.infer<typeof snapshotFormSchema>;
export type SnapshotVersionValues = z.infer<typeof snapshotVersionSchema>;
export type GeneratePreviewValues = z.infer<typeof generatePreviewSchema>;
