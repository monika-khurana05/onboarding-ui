import type { FlowDirection } from '../../state-manager/types';

export type FsmPreset = {
  id: string;
  label: string;
  url: string;
  countryCode: string;
  direction: FlowDirection;
};

export const FSM_PRESETS: FsmPreset[] = [
  {
    id: 'ar-outgoing-full',
    label: 'Argentina — Outgoing (Full)',
    url: '/fsm-presets/ar-outgoing-fsm.yaml',
    countryCode: 'AR',
    direction: 'OUTGOING'
  },
  {
    id: 'br-outgoing-full',
    label: 'Brazil — Outgoing (Full)',
    url: '/fsm-presets/br-outgoing-fsm.yaml',
    countryCode: 'BR',
    direction: 'OUTGOING'
  }
];

export function findPresetUrl(countryCode: string, direction: FlowDirection): string | undefined {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  return FSM_PRESETS.find(
    (preset) => preset.countryCode === normalizedCountryCode && preset.direction === direction
  )?.url;
}
