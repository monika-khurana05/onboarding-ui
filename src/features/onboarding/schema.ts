import { z } from 'zod';

export const regionSchema = z.enum(['Americas', 'EMEA', 'APAC']);
export const regulatoryTierSchema = z.enum(['Tier 1', 'Tier 2', 'Tier 3']);

export const workflowConfigSchema = z.object({
  approvalMode: z.enum(['single', 'dual', 'committee']),
  autoProvision: z.boolean(),
  settlementCutoff: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Settlement cutoff must be in HH:MM format'),
  alertChannel: z.enum(['email', 'slack', 'service-desk']),
  escalationHours: z
    .number({ message: 'Escalation window is required' })
    .int('Escalation window must be an integer')
    .min(1, 'Escalation window must be at least 1 hour')
    .max(72, 'Escalation window cannot exceed 72 hours')
});

export const countryOnboardingSchema = z.object({
  countryName: z
    .string({ message: 'Country name is required' })
    .trim()
    .min(2, 'Country name must be at least 2 characters'),
  iso2: z
    .string({ message: 'ISO code is required' })
    .trim()
    .regex(/^[A-Z]{2}$/, 'ISO code must be exactly two uppercase letters'),
  region: regionSchema,
  regulatoryTier: regulatoryTierSchema,
  launchDate: z
    .string({ message: 'Launch date is required' })
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Launch date must be valid'),
  settlementCurrency: z
    .string({ message: 'Settlement currency is required' })
    .trim()
    .regex(/^[A-Z]{3}$/, 'Settlement currency must be a 3-letter uppercase code'),
  enableSanctionsScreening: z.boolean(),
  riskThreshold: z
    .number({ message: 'Risk threshold is required' })
    .min(1, 'Risk threshold must be at least 1')
    .max(100, 'Risk threshold cannot exceed 100'),
  goLiveChecklistComplete: z.boolean(),
  workflowConfig: workflowConfigSchema
});

export type CountryOnboardingInput = z.infer<typeof countryOnboardingSchema>;
