import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import './styles/tailwind.css';
import './styles/theme.css';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import { GlobalErrorProvider } from './app/GlobalErrorContext';
import { RootErrorBoundary } from './app/RootErrorBoundary';
import { darkTheme } from './theme/theme';
import { env } from './lib/env';
import { queryClient } from './lib/queryClient';

async function bootstrap() {
  if (env.enableMsw) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <GlobalErrorProvider>
              <App />
            </GlobalErrorProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </RootErrorBoundary>
    </React.StrictMode>
  );
}

void bootstrap();




