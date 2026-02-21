import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import MenuIcon from '@mui/icons-material/Menu';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import RuleIcon from '@mui/icons-material/Rule';
import ScienceIcon from '@mui/icons-material/Science';
import SettingsIcon from '@mui/icons-material/Settings';
import TableChartIcon from '@mui/icons-material/TableChart';
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
  Slide,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { type ReactElement, useMemo, useState } from 'react';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { useGlobalError } from './GlobalErrorContext';
import { ApiError } from '../lib/apiClient';
import { hasAssemblyPodAccess } from '../lib/accessControl';
import { env } from '../lib/env';
import { deriveEnvironmentFromApiUrl, environmentChipColor } from '../lib/environment';
import { useHealthQuery } from '../features/onboarding-flow/hooks';

type NavItem = {
  label: string;
  to: string;
  icon: ReactElement;
  requiresAssemblyAccess?: boolean;
};

type Crumb = {
  label: string;
  to?: string;
};

const drawerWidth = 270;

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: <DashboardCustomizeIcon /> },
  { label: 'Requirement Analysis', to: '/ai/requirements', icon: <RuleIcon /> },
  { label: 'Payload Mapping', to: '/ai/mapping', icon: <TableChartIcon /> },
  { label: 'Create Snapshot', to: '/snapshots/new', icon: <FactCheckIcon /> },
  {
    label: 'Create Assembly Pod',
    to: '/onboarding/create-assembly-pod',
    icon: <Inventory2OutlinedIcon />,
    requiresAssemblyAccess: true
  },
  { label: 'Generate Preview', to: '/generate/preview', icon: <QueryStatsIcon /> },
  { label: 'Jobs', to: '/jobs', icon: <InfoOutlinedIcon /> },
  { label: 'Test Case Generation', to: '/ai/testing', icon: <ScienceIcon /> },
  { label: 'Settings/About', to: '/settings', icon: <SettingsIcon /> }
];

const breadcrumbOverrides: Record<string, Crumb[]> = {
  '/onboarding/create-assembly-pod': [
    { label: 'Home', to: '/' },
    { label: 'Country Onboarding' },
    { label: 'Create Assembly Pod' }
  ]
};

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
  const healthQuery = useHealthQuery();
  const canAccessAssemblyPod = hasAssemblyPodAccess();
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.requiresAssemblyAccess || canAccessAssemblyPod),
    [canAccessAssemblyPod]
  );

  const healthStatus = healthQuery.isError ? 'unavailable' : healthQuery.data?.status ?? 'checking';
  const normalizedStatus = healthStatus.toLowerCase();
  const isHealthDegraded =
    !healthQuery.isError &&
    normalizedStatus !== 'checking' &&
    !['ok', 'healthy', 'up', 'unknown'].includes(normalizedStatus);
  const healthChipColor =
    healthQuery.isError || isHealthDegraded
      ? 'warning'
      : ['checking', 'unknown'].includes(normalizedStatus)
        ? 'default'
        : 'success';
  const healthService = healthQuery.data?.service;
  const healthVersion = healthQuery.data?.version;
  const correlationId = healthQuery.error instanceof ApiError ? healthQuery.error.correlationId : undefined;
  const healthDetails = [healthService, healthVersion ? `v${healthVersion}` : null].filter(Boolean).join(' · ');

  const crumbs = useMemo(() => {
    const override = breadcrumbOverrides[location.pathname];
    if (override) {
      return override;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return [{ label: 'Dashboard', to: '/' }];
    }

    const all: Crumb[] = [{ label: 'Dashboard', to: '/' }];
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
        {visibleNavItems.map((item) => {
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
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor:
                    themeValue.palette.mode === 'dark' ? 'rgba(75,132,255,0.24)' : themeValue.palette.primary.light,
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
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: 'auto' }}>
            <Stack spacing={0.25} alignItems="flex-end">
              <Chip
                label={`Health: ${healthStatus}`}
                size="small"
                color={healthChipColor}
                variant={healthQuery.isError || isHealthDegraded ? 'outlined' : 'filled'}
                aria-label={`Service health ${healthStatus}`}
              />
              {healthQuery.isError ? (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Correlation: {correlationId ?? 'unknown'}
                </Typography>
              ) : healthDetails ? (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {healthDetails}
                </Typography>
              ) : null}
            </Stack>
            <Chip
              label={deploymentEnvironment}
              size="small"
              color={environmentColor}
              variant="filled"
              aria-label={`Environment ${deploymentEnvironment}`}
            />
          </Stack>
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
              ? 'radial-gradient(circle at 100% 0, rgba(75,132,255,0.15) 0, rgba(15,17,21,1) 46%)'
              : 'radial-gradient(circle at 100% 0, rgba(63,131,189,0.12) 0, rgba(243,247,251,1) 40%)'
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" disableGutters>
          <Stack spacing={2}>
            <Breadcrumbs aria-label="Breadcrumb">
              {crumbs.map((crumb, index) =>
                index === crumbs.length - 1 || !crumb.to ? (
                  <Typography color="text.primary" key={`${crumb.label}-${index}`}>
                    {crumb.label}
                  </Typography>
                ) : (
                  <Link
                    component={RouterLink}
                    underline="hover"
                    color="inherit"
                    to={crumb.to}
                    key={`${crumb.label}-${index}`}
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'left' }}
        sx={{ mb: { xs: 2, md: 3 } }}
      >
        <Alert onClose={clearError} severity="error" variant="filled" sx={{ width: '100%' }}>
          {globalErrorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
