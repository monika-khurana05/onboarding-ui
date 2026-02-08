import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './app/App';
import { GlobalErrorProvider } from './app/GlobalErrorContext';
import { RootErrorBoundary } from './app/RootErrorBoundary';
import { env } from './lib/env';
import { queryClient } from './lib/queryClient';
import { appTheme } from './app/theme';

async function bootstrap() {
  if (env.enableMsw) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={appTheme}>
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
