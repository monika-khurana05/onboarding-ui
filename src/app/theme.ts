import { createTheme } from '@mui/material/styles';
import { enterpriseDesign } from '../theme/designSystem';

export type AppThemeMode = 'light' | 'dark';

const cssVar = (name: string) => `var(--${name})`;

const tokens = {
  bg: cssVar('bg'),
  surface: cssVar('surface'),
  surface2: cssVar('surface2'),
  border: cssVar('border'),
  text: cssVar('text'),
  textMuted: cssVar('text-muted'),
  primary: cssVar('primary'),
  primaryHover: cssVar('primary-hover'),
  primaryActive: cssVar('primary-active'),
  primaryFg: cssVar('primary-fg'),
  accent: cssVar('accent'),
  accentHover: cssVar('accent-hover'),
  accentFg: cssVar('accent-fg'),
  success: cssVar('success'),
  warning: cssVar('warning'),
  error: cssVar('error'),
  info: cssVar('info'),
  focusRing: cssVar('focus-ring'),
  selection: cssVar('selection'),
  hover: cssVar('hover'),
  overlay: cssVar('overlay'),
  shadowSubtle: cssVar('shadow-subtle'),
  shadowElevated: cssVar('shadow-elevated')
} as const;

export function createAppTheme(mode: AppThemeMode) {
  const resolvedMode: AppThemeMode = mode === 'light' ? 'dark' : mode;

  const palette = {
    mode: resolvedMode,
    primary: {
      main: tokens.primary,
      dark: tokens.primaryActive,
      light: tokens.primaryHover,
      contrastText: tokens.primaryFg
    },
    secondary: {
      main: tokens.accent,
      dark: tokens.accent,
      light: tokens.accentHover,
      contrastText: tokens.accentFg
    },
    success: {
      main: tokens.success
    },
    warning: {
      main: tokens.warning
    },
    error: {
      main: tokens.error
    },
    info: {
      main: tokens.info
    },
    background: {
      default: tokens.bg,
      paper: tokens.surface
    },
    text: {
      primary: tokens.text,
      secondary: tokens.textMuted
    },
    divider: tokens.border,
    action: {
      hover: tokens.hover,
      selected: tokens.selection
    }
  };
  const secondaryText = palette.text.secondary;

  return createTheme({
    palette,
    shape: {
      borderRadius: enterpriseDesign.borderRadius
    },
    typography: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", Tahoma, sans-serif',
      fontSize: enterpriseDesign.typography.body,
      h4: {
        fontSize: enterpriseDesign.typography.pageTitle,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.01em'
      },
      h5: {
        fontSize: enterpriseDesign.typography.sectionTitle,
        fontWeight: 500,
        lineHeight: 1.35
      },
      h6: {
        fontWeight: 600
      },
      body1: {
        fontSize: enterpriseDesign.typography.body,
        lineHeight: 1.5
      },
      body2: {
        fontSize: enterpriseDesign.typography.body,
        lineHeight: 1.5
      },
      caption: {
        fontSize: enterpriseDesign.typography.caption,
        lineHeight: 1.4
      },
      subtitle1: {
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1.45
      },
      subtitle2: {
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.45
      },
      overline: {
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em'
      },
      button: {
        fontWeight: 600,
        letterSpacing: '0.01em'
      }
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.surface,
            backgroundImage: 'none',
            borderBottom: `1px solid ${tokens.border}`
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.surface,
            backgroundImage: 'none'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: tokens.surface,
            borderRadius: enterpriseDesign.borderRadius
          },
          outlined: {
            border: `1px solid ${tokens.border}`,
            boxShadow: 'none'
          }
        }
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            border: `1px solid ${tokens.border}`,
            borderRadius: enterpriseDesign.borderRadius,
            backgroundColor: tokens.surface,
            maxHeight: 'min(60vh, 560px)',
            overflow: 'auto'
          }
        }
      },
      MuiTable: {
        styleOverrides: {
          root: {
            '& tbody .MuiTableRow-root:nth-of-type(odd)': {
              backgroundColor: tokens.surface2
            },
            '& tbody .MuiTableRow-root:hover': {
              backgroundColor: tokens.hover
            }
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': {
              backgroundColor: tokens.hover
            }
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: tokens.surface2,
            color: tokens.text,
            fontWeight: 600,
            borderBottomColor: tokens.border
          },
          stickyHeader: {
            backgroundColor: tokens.surface2,
            color: tokens.text,
            zIndex: 2
          },
          root: {
            color: tokens.text,
            borderBottomColor: tokens.border
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: enterpriseDesign.borderRadius,
            minHeight: enterpriseDesign.buttonHeight,
            fontWeight: 500,
            paddingInline: '14px',
            transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease'
          },
          sizeSmall: {
            minHeight: 32,
            paddingInline: '10px'
          },
          sizeLarge: {
            minHeight: 40,
            paddingInline: '18px'
          }
        }
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&.Mui-focusVisible': {
              outline: `2px solid ${tokens.focusRing}`,
              outlineOffset: 2
            }
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: enterpriseDesign.borderRadius,
            transition: 'background-color 150ms ease, color 150ms ease'
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: enterpriseDesign.borderRadius,
            backgroundColor: tokens.surface2,
            color: tokens.text,
            '&:not(.MuiInputBase-multiline)': {
              minHeight: 44
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.border
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.textMuted
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.primary,
              borderWidth: 1
            },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.error
            },
            '& input::placeholder, & textarea::placeholder': {
              color: tokens.textMuted,
              opacity: 1
            }
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 40
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 40,
            textTransform: 'none',
            fontWeight: 600,
            letterSpacing: '0.01em'
          }
        }
      },
      MuiInputLabel: {
        defaultProps: {
          shrink: true
        },
        styleOverrides: {
          root: {
            textAlign: 'left',
            color: secondaryText,
            fontSize: 12,
            fontWeight: 500,
            '&.Mui-focused': {
              color: tokens.primaryHover
            }
          }
        }
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: secondaryText,
            fontSize: 12,
            minHeight: 20
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            boxShadow: tokens.shadowElevated
          }
        }
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            color: tokens.text,
            borderBottom: `1px solid ${tokens.border}`
          }
        }
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            color: tokens.text
          },
          dividers: {
            borderColor: tokens.border
          }
        }
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            borderTop: `1px solid ${tokens.border}`
          }
        }
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.overlay
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: enterpriseDesign.borderRadius
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: enterpriseDesign.borderRadius
          }
        }
      },
      MuiTypography: {
        variants: [
          {
            props: { variant: 'caption' },
            style: {
              color: secondaryText
            }
          }
        ]
      }
    }
  });
}
