import { QueryClient, keepPreviousData } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes default — reduced refetching for list views
      gcTime: 5 * 60 * 1000,    // 5 minutes (formerly cacheTime)
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
      structuralSharing: true,
      placeholderData: keepPreviousData, // Show stale data while refetching — no loading spinners on tab switch
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

export default queryClient;
