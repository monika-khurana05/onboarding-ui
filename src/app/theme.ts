import { createTheme } from '@mui/material/styles';
import { enterpriseDesign } from '../theme/designSystem';

export type AppThemeMode = 'light' | 'dark';

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === 'dark';
  const palette = {
    mode,
    primary: {
      main: isDark ? '#4B84FF' : '#005a9c',
      dark: isDark ? '#2F67DD' : '#003b68',
      light: isDark ? '#82A9FF' : '#3f83bd',
      contrastText: isDark ? '#0F1115' : '#ffffff'
    },
    secondary: {
      main: isDark ? '#1FB6A9' : '#007a8a',
      dark: isDark ? '#15887E' : '#005e6a',
      light: isDark ? '#56CEC5' : '#3ea5b2',
      contrastText: isDark ? '#0F1115' : '#ffffff'
    },
    success: {
      main: isDark ? '#1f9d6c' : '#13795b'
    },
    warning: {
      main: isDark ? '#d4a037' : '#b7791f'
    },
    error: {
      main: isDark ? '#e05a4f' : '#b3261e'
    },
    background: {
      default: isDark ? '#0F1115' : '#f3f7fb',
      paper: isDark ? '#1A1D23' : '#ffffff'
    },
    text: {
      primary: isDark ? '#E6EDF3' : '#111827',
      secondary: isDark ? '#9DA7B3' : '#4b5563'
    },
    divider: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
    action: {
      hover: isDark ? 'rgba(230,237,243,0.06)' : 'rgba(15, 23, 42, 0.06)',
      selected: isDark ? 'rgba(75,132,255,0.24)' : 'rgba(0, 90, 156, 0.12)'
    }
  };

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
      }
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: isDark ? '#151821' : 'linear-gradient(90deg, #003b68 0%, #005a9c 55%, #007a8a 100%)',
            backgroundImage: 'none',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : undefined
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#12151B' : '#ffffff',
            backgroundImage: 'none'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#1A1D23' : '#ffffff'
          },
          outlined: {
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
            boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.24)' : undefined
          }
        }
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : undefined,
            borderRadius: enterpriseDesign.borderRadius,
            backgroundColor: isDark ? '#171B21' : undefined
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': {
              backgroundColor: isDark ? 'rgba(230,237,243,0.04)' : undefined
            }
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: isDark ? '#20242D' : '#e9f1f9',
            color: isDark ? '#E6EDF3' : '#1f2a44',
            fontWeight: 600,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.16)' : '#e2e8f0'
          },
          root: {
            color: isDark ? '#E6EDF3' : undefined,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
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
            fontWeight: 500
          },
          sizeSmall: {
            minHeight: 32
          },
          sizeLarge: {
            minHeight: 40
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: enterpriseDesign.borderRadius,
            backgroundColor: isDark ? '#131821' : '#ffffff',
            color: isDark ? '#E6EDF3' : undefined,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(230,237,243,0.22)' : undefined
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(230,237,243,0.34)' : undefined
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? '#4B84FF' : undefined,
              borderWidth: 1
            },
            '& input::placeholder, & textarea::placeholder': {
              color: isDark ? '#9DA7B3' : undefined,
              opacity: 1
            }
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: isDark ? '#9DA7B3' : undefined,
            '&.Mui-focused': {
              color: isDark ? '#82A9FF' : undefined
            }
          }
        }
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: isDark ? '#9DA7B3' : undefined
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#1A1D23' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : undefined,
            boxShadow: isDark ? '0 20px 48px rgba(0, 0, 0, 0.45)' : undefined
          }
        }
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            color: isDark ? '#E6EDF3' : undefined,
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : undefined
          }
        }
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            color: isDark ? '#E6EDF3' : undefined
          },
          dividers: {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : undefined
          }
        }
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : undefined
          }
        }
      }
    }
  });
}
