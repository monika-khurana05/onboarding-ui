export const FSM_PRESETS = [
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
export function findPresetUrl(countryCode, direction) {
    const normalizedCountryCode = countryCode.trim().toUpperCase();
    return FSM_PRESETS.find((preset) => preset.countryCode === normalizedCountryCode && preset.direction === direction)?.url;
}
