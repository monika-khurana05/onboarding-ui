/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { setGlobalErrorHandler } from './globalErrorReporter';

type GlobalErrorContextValue = {
  message: string | null;
  showError: (message: string) => void;
  clearError: () => void;
};

const GlobalErrorContext = createContext<GlobalErrorContextValue | null>(null);

function toMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Unexpected error occurred.';
}

export function GlobalErrorProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<string | null>(null);

  const showError = useCallback((next: string) => {
    setMessage(next.trim() || 'Unexpected error occurred.');
  }, []);

  const clearError = useCallback(() => {
    setMessage(null);
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      showError(event.message || 'Unhandled error');
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      showError(toMessage(event.reason));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    setGlobalErrorHandler(showError);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      setGlobalErrorHandler(null);
    };
  }, [showError]);

  const value = useMemo(
    () => ({
      message,
      showError,
      clearError
    }),
    [clearError, message, showError]
  );

  return <GlobalErrorContext.Provider value={value}>{children}</GlobalErrorContext.Provider>;
}

export function useGlobalError() {
  const context = useContext(GlobalErrorContext);
  if (!context) {
    throw new Error('useGlobalError must be used within GlobalErrorProvider.');
  }
  return context;
}


