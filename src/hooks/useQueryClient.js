import { QueryClient, keepPreviousData } from '@tanstack/react-query';

// Don't burn retries on errors the server already told us are permanent.
// 4xx other than 408 (timeout) and 429 (rate limit) will never succeed on retry.
const shouldRetry = (failureCount, error) => {
  const status = error?.response?.status;
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }
  return failureCount < 2;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes default — reduced refetching for list views
      gcTime: 5 * 60 * 1000,    // 5 minutes (formerly cacheTime)
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
      structuralSharing: true,
      placeholderData: keepPreviousData, // Show stale data while refetching — no loading spinners on tab switch
    },
    mutations: {
      retry: (failureCount, error) => {
        // Mutations are risky to retry (side effects). Only retry transient
        // network errors — never retry an HTTP error the server returned.
        if (error?.response) return false;
        return failureCount < 1;
      },
      networkMode: 'offlineFirst',
    },
  },
});

export default queryClient;
