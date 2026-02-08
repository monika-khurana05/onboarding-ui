import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../api/http';
import { reportGlobalError } from '../app/globalErrorReporter';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.suppressGlobalError) {
        return;
      }
      reportGlobalError(getErrorMessage(error));
    }
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressGlobalError) {
        return;
      }
      reportGlobalError(getErrorMessage(error));
    }
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
});
