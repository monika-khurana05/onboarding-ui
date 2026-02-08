import { createTheme } from '@mui/material/styles';

export type AppThemeMode = 'light' | 'dark';

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === 'dark';
  const palette = {
    mode,
    primary: {
      main: isDark ? '#4fa3ff' : '#005a9c',
      dark: isDark ? '#2b6fb6' : '#003b68',
      light: isDark ? '#7bbcff' : '#3f83bd',
      contrastText: isDark ? '#0b1220' : '#ffffff'
    },
    secondary: {
      main: isDark ? '#22c1b0' : '#007a8a',
      dark: isDark ? '#128f84' : '#005e6a',
      light: isDark ? '#58d6c8' : '#3ea5b2'
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
      default: isDark ? '#0b1220' : '#f3f7fb',
      paper: isDark ? '#111c2e' : '#ffffff'
    },
    text: {
      primary: isDark ? '#e2e8f0' : '#111827',
      secondary: isDark ? '#9fb0c6' : '#4b5563'
    },
    divider: isDark ? '#1f2a3d' : '#e2e8f0',
    action: {
      hover: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.06)',
      selected: isDark ? 'rgba(79, 163, 255, 0.18)' : 'rgba(0, 90, 156, 0.12)'
    }
  };

  return createTheme({
    palette,
    shape: {
      borderRadius: 12
    },
    typography: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", Tahoma, sans-serif',
      h4: {
        fontWeight: 600,
        letterSpacing: '-0.01em'
      },
      h5: {
        fontWeight: 600
      },
      h6: {
        fontWeight: 600
      }
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: isDark
              ? 'linear-gradient(90deg, #0f2342 0%, #153156 55%, #1a3b5f 100%)'
              : 'linear-gradient(90deg, #003b68 0%, #005a9c 55%, #007a8a 100%)'
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#0f1a2b' : '#ffffff'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: isDark ? '#142238' : '#e9f1f9',
            color: isDark ? '#c8d7f0' : '#1f2a44',
            fontWeight: 600
          },
          root: {
            borderBottomColor: isDark ? '#1f2a3d' : '#e2e8f0'
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            textTransform: 'none'
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff'
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#111c2e' : '#ffffff'
          }
        }
      }
    }
  });
}
