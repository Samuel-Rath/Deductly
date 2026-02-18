/**
 * React Query client configuration.
 * 
 * Configures default options for queries and mutations including
 * retry logic, caching, and error handling.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Create and configure React Query client.
 * 
 * Default configuration:
 * - Queries: 3 retries with exponential backoff, 5 minute stale time
 * - Mutations: No retries by default
 * - Errors: Logged to console in development
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0, // Don't retry mutations by default
    },
  },
});

/**
 * Clear all cached data.
 * Useful for logout or when switching contexts.
 */
export function clearCache(): void {
  queryClient.clear();
}

/**
 * Invalidate all job-related queries.
 * Forces refetch of job data on next access.
 */
export function invalidateJobs(): void {
  queryClient.invalidateQueries({ queryKey: ['jobs'] });
}
