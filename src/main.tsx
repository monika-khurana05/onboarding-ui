import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import { GlobalErrorProvider } from './app/GlobalErrorContext';
import { RootErrorBoundary } from './app/RootErrorBoundary';
import { ThemeModeProvider } from './app/ThemeModeContext';
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
          <ThemeModeProvider>
            <GlobalErrorProvider>
              <App />
            </GlobalErrorProvider>
          </ThemeModeProvider>
        </QueryClientProvider>
      </RootErrorBoundary>
    </React.StrictMode>
  );
}

void bootstrap();
