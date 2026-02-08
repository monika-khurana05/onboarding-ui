import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#005a9c',
      dark: '#003b68',
      light: '#3f83bd',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#007a8a',
      dark: '#005e6a',
      light: '#3ea5b2'
    },
    success: {
      main: '#13795b'
    },
    warning: {
      main: '#b7791f'
    },
    error: {
      main: '#b3261e'
    },
    background: {
      default: '#f3f7fb',
      paper: '#ffffff'
    }
  },
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
          background: 'linear-gradient(90deg, #003b68 0%, #005a9c 55%, #007a8a 100%)'
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
    MuiButton: {
      defaultProps: {
        disableElevation: true
      }
    }
  }
});
