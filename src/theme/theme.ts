import { createTheme } from '@mui/material/styles';
import { enterpriseDesign } from './designSystem';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4B84FF',
      dark: '#2F67DD',
      light: '#82A9FF',
      contrastText: '#0F1115'
    },
    secondary: {
      main: '#1FB6A9',
      dark: '#15887E',
      light: '#56CEC5',
      contrastText: '#0F1115'
    },
    background: {
      default: '#0F1115',
      paper: '#1A1D23'
    },
    text: {
      primary: '#E6EDF3',
      secondary: '#A8B3BF'
    },
    divider: 'rgba(255,255,255,0.12)',
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
    },
    action: {
      hover: 'rgba(230,237,243,0.06)',
      selected: 'rgba(75,132,255,0.24)'
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
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--space-4': '4px',
          '--space-8': '8px',
          '--space-12': '12px',
          '--space-16': '16px',
          '--space-24': '24px',
          '--space-32': '32px'
        },
        body: {
          backgroundColor: '#0F1115',
          color: '#E6EDF3'
        },
        ':focus-visible': {
          outline: '2px solid #4B84FF',
          outlineOffset: 2
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1A1D23',
          borderRadius: enterpriseDesign.borderRadius
        },
        outlined: {
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: 'none'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#151821',
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#12151B',
          backgroundImage: 'none'
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: enterpriseDesign.borderRadius,
          backgroundColor: '#171B21',
          maxHeight: 'min(60vh, 560px)',
          overflow: 'auto'
        }
      }
    },
    MuiTable: {
      defaultProps: {
        stickyHeader: true
      },
      styleOverrides: {
        root: {
          '& tbody .MuiTableRow-root:nth-of-type(odd)': {
            backgroundColor: 'rgba(255,255,255,0.02)'
          },
          '& tbody .MuiTableRow-root:hover': {
            backgroundColor: 'rgba(255,255,255,0.05)'
          }
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': {
            backgroundColor: 'rgba(255,255,255,0.05)'
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#20242D',
          color: '#E6EDF3',
          fontWeight: 600,
          borderBottomColor: 'rgba(255,255,255,0.16)'
        },
        stickyHeader: {
          backgroundColor: '#20242D',
          color: '#E6EDF3',
          zIndex: 2
        },
        root: {
          color: '#E6EDF3',
          borderBottomColor: 'rgba(255,255,255,0.1)'
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
            outline: '2px solid #4B84FF',
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
          backgroundColor: '#131821',
          color: '#E6EDF3',
          '&:not(.MuiInputBase-multiline)': {
            minHeight: 44
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(230,237,243,0.22)'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(230,237,243,0.34)'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4B84FF',
            borderWidth: 1
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: '#E66B61'
          },
          '& input::placeholder, & textarea::placeholder': {
            color: '#A8B3BF',
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
          color: '#A8B3BF',
          fontSize: 12,
          fontWeight: 500,
          '&.Mui-focused': {
            color: '#82A9FF'
          }
        }
      }
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: '#A8B3BF',
          fontSize: 12,
          minHeight: 20
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1A1D23',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.45)'
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: '#E6EDF3',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: '#E6EDF3'
        },
        dividers: {
          borderColor: 'rgba(255,255,255,0.08)'
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: '1px solid rgba(255,255,255,0.08)'
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
            color: '#A8B3BF'
          }
        }
      ]
    }
  }
});
