import { createTheme } from '@mui/material/styles';
import { enterpriseDesign } from './designSystem';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4B84FF',
      dark: '#2F67DD',
      light: '#82A9FF',
      contrastText: '#F8FAFC'
    },
    secondary: {
      main: '#1FB6A9',
      dark: '#15887E',
      light: '#56CEC5'
    },
    background: {
      default: '#0B1322',
      paper: '#121E33'
    },
    text: {
      primary: '#E2E8F0',
      secondary: '#96A4BC'
    },
    divider: 'rgba(148,163,184,0.25)',
    error: {
      main: '#E66B61'
    },
    warning: {
      main: '#D6A744'
    },
    success: {
      main: '#2EB67D'
    },
    info: {
      main: '#3AA7EA'
    }
  },
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
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--space-4': '4px',
          '--space-8': '8px',
          '--space-12': '12px',
          '--space-16': '16px',
          '--space-24': '24px',
          '--space-32': '32px'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: enterpriseDesign.borderRadius
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #11264A 0%, #173365 55%, #1E3F72 100%)'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#0F1A2D'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: '#C9D4E8',
          fontWeight: 600
        },
        root: {
          borderColor: 'rgba(148,163,184,0.25)'
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
          paddingInline: '14px'
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
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: enterpriseDesign.borderRadius,
          backgroundColor: 'rgba(15, 23, 42, 0.5)'
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
            color: '#96A4BC'
          }
        }
      ]
    }
  }
});
