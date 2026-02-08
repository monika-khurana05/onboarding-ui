import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4FC3F7'
    },
    secondary: {
      main: '#81C784'
    },
    background: {
      default: '#0F1115',
      paper: '#1A1D23'
    },
    text: {
      primary: '#E6EDF3',
      secondary: '#9DA7B3'
    },
    divider: 'rgba(255,255,255,0.08)',
    error: {
      main: '#F87171'
    },
    warning: {
      main: '#FBBF24'
    },
    success: {
      main: '#4ADE80'
    },
    info: {
      main: '#38BDF8'
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", Tahoma, sans-serif',
    fontSize: 14
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#151821'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#12151B'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.08)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none'
        }
      }
    }
  }
});
