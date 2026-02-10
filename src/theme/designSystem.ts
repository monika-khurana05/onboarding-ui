export const spacingScale = {
  s4: 0.5,
  s8: 1,
  s12: 1.5,
  s16: 2,
  s24: 3,
  s32: 4
} as const;

export const spacingPixels = {
  s4: 4,
  s8: 8,
  s12: 12,
  s16: 16,
  s24: 24,
  s32: 32
} as const;

export const enterpriseDesign = {
  borderRadius: 8,
  buttonHeight: 36,
  cardPadding: {
    mobile: spacingPixels.s16,
    desktop: 20
  },
  typography: {
    pageTitle: 24,
    sectionTitle: 18,
    body: 14,
    caption: 12
  }
} as const;
