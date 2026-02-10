import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Alert,
  AppBar,
  Box,
  Breadcrumbs,
  Chip,
  Container,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { type ReactElement, useMemo, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useGlobalError } from './GlobalErrorContext';
import { env } from '../lib/env';
import { deriveEnvironmentFromApiUrl, environmentChipColor } from '../lib/environment';

type NavItem = {
  label: string;
  to: string;
  icon: ReactElement;
};

const drawerWidth = 270;

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: <DashboardCustomizeIcon /> },
  { label: 'Create Snapshot', to: '/snapshots/new', icon: <FactCheckIcon /> },
  { label: 'Generate Preview', to: '/generate/preview', icon: <QueryStatsIcon /> },
  { label: 'Jobs', to: '/jobs', icon: <InfoOutlinedIcon /> },
  { label: 'Settings/About', to: '/settings', icon: <SettingsIcon /> }
];

function toTitle(segment: string) {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { message: globalErrorMessage, clearError } = useGlobalError();

  const deploymentEnvironment = deriveEnvironmentFromApiUrl(env.apiBaseUrl);
  const environmentColor = environmentChipColor(deploymentEnvironment);

  const crumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return [{ label: 'Dashboard', to: '/' }];
    }

    const all = [{ label: 'Dashboard', to: '/' }];
    let current = '';
    for (const segment of segments) {
      current += `/${segment}`;
      all.push({ label: toTitle(segment), to: current });
    }
    return all;
  }, [location.pathname]);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Stack spacing={0.25}>
          <Typography variant="h6" sx={{ color: 'primary.main' }}>
            CPX
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Country Onboarding
          </Typography>
        </Stack>
      </Toolbar>
      <List role="navigation" aria-label="Primary navigation">
        {navItems.map((item) => {
          const selected = (() => {
            if (item.to === '/') {
              return location.pathname === item.to;
            }
            if (item.to === '/snapshots/new') {
              return location.pathname.startsWith('/snapshots');
            }
            if (item.to === '/generate/preview') {
              return location.pathname.startsWith('/generate');
            }
            return location.pathname.startsWith(item.to);
          })();
          return (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={selected}
              aria-label={`Navigate to ${item.label}`}
              onClick={() => setMobileOpen(false)}
              sx={(themeValue) => ({
                mx: 1,
                my: 0.5,
                borderRadius: '8px',
                '&.Mui-selected': {
                  backgroundColor:
                    themeValue.palette.mode === 'dark' ? 'rgba(79, 163, 255, 0.2)' : themeValue.palette.primary.light,
                  color: themeValue.palette.mode === 'dark' ? themeValue.palette.text.primary : themeValue.palette.primary.contrastText,
                  '& .MuiListItemIcon-root': {
                    color:
                      themeValue.palette.mode === 'dark'
                        ? themeValue.palette.text.primary
                        : themeValue.palette.primary.contrastText
                  }
                }
              })}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (themeValue) => themeValue.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen((prev) => !prev)}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Stack>
            <Typography variant="h6">CPX Country Onboarding</Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Enterprise Onboarding Pipeline
            </Typography>
          </Stack>
          <Box sx={{ ml: 'auto' }}>
            <Chip
              label={deploymentEnvironment}
              size="small"
              color={environmentColor}
              variant="filled"
              aria-label={`Environment ${deploymentEnvironment}`}
            />
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider'
            }
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
          background: (themeValue) =>
            themeValue.palette.mode === 'dark'
              ? 'radial-gradient(circle at 100% 0, rgba(79,163,255,0.12) 0, rgba(11,18,32,1) 45%)'
              : 'radial-gradient(circle at 100% 0, rgba(63,131,189,0.12) 0, rgba(243,247,251,1) 40%)'
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" disableGutters>
          <Stack spacing={2}>
            <Breadcrumbs aria-label="Breadcrumb">
              {crumbs.map((crumb, index) =>
                index === crumbs.length - 1 ? (
                  <Typography color="text.primary" key={crumb.to}>
                    {crumb.label}
                  </Typography>
                ) : (
                  <Link
                    component={RouterLink}
                    underline="hover"
                    color="inherit"
                    to={crumb.to}
                    key={crumb.to}
                  >
                    {crumb.label}
                  </Link>
                )
              )}
            </Breadcrumbs>
            <Outlet />
          </Stack>
        </Container>
      </Box>

      <Snackbar
        open={Boolean(globalErrorMessage)}
        autoHideDuration={7000}
        onClose={clearError}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: { xs: 7, md: 8 } }}
      >
        <Alert onClose={clearError} severity="error" variant="filled" sx={{ width: '100%' }}>
          {globalErrorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
