/**
 * React Query hooks for Tax Deduction Analyzer API.
 * 
 * Provides hooks for uploading files, polling job status, and downloading reports
 * with automatic state management and caching.
 * 
 * Validates: Requirements 11.1-11.5
 */

import { useMutation, useQuery, useQueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import {
  uploadCSV,
  getJobStatus,
  downloadReport,
  downloadReportFile,
  UploadRequest,
  UploadResponse,
  JobStatusResponse,
  APIError,
} from './client';

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  job: (jobId: string) => ['job', jobId] as const,
  jobs: () => ['jobs'] as const,
};

// ============================================================================
// Upload Mutation
// ============================================================================

export interface UseUploadCSVOptions {
  onSuccess?: (data: UploadResponse) => void;
  onError?: (error: APIError) => void;
}

/**
 * Hook for uploading CSV files.
 * 
 * @param options - Callback options for success and error
 * @returns Mutation result with upload function and state
 * 
 * @example
 * ```tsx
 * const uploadMutation = useUploadCSV({
 *   onSuccess: (data) => {
 *     navigate(`/report/${data.job_id}`);
 *   },
 * });
 * 
 * const handleUpload = (file: File) => {
 *   uploadMutation.mutate({
 *     file,
 *     incomeYear: '2023-2024',
 *     ephemeralMode: true,
 *   });
 * };
 * ```
 */
export function useUploadCSV(
  options?: UseUploadCSVOptions
): UseMutationResult<UploadResponse, APIError, UploadRequest> {
  const queryClient = useQueryClient();
  
  return useMutation<UploadResponse, APIError, UploadRequest>({
    mutationFn: uploadCSV,
    onSuccess: (data) => {
      // Invalidate jobs list
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs() });
      
      // Pre-populate job status cache
      queryClient.setQueryData(queryKeys.job(data.job_id), {
        job_id: data.job_id,
        status: data.status,
      });
      
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}

// ============================================================================
// Job Status Query
// ============================================================================

export interface UseJobStatusOptions {
  enabled?: boolean;
  refetchInterval?: number | false | ((data: JobStatusResponse | undefined) => number | false);
  onSuccess?: (data: JobStatusResponse) => void;
  onError?: (error: APIError) => void;
}

/**
 * Hook for polling job status.
 * 
 * Automatically polls the job status at regular intervals until the job is completed or failed.
 * 
 * @param jobId - Unique job identifier
 * @param options - Query options including polling configuration
 * @returns Query result with job status and state
 * 
 * @example
 * ```tsx
 * const { data: jobStatus, isLoading } = useJobStatus('job-123', {
 *   refetchInterval: (data) => {
 *     // Stop polling when job is complete or failed
 *     return data?.status === 'completed' || data?.status === 'failed' ? false : 2000;
 *   },
 * });
 * ```
 */
export function useJobStatus(
  jobId: string,
  options?: UseJobStatusOptions
): UseQueryResult<JobStatusResponse, APIError> {
  return useQuery<JobStatusResponse, APIError>({
    queryKey: queryKeys.job(jobId),
    queryFn: () => getJobStatus(jobId),
    enabled: options?.enabled !== false && !!jobId,
    // React Query v5: refetchInterval receives the Query object (not data).
    // We expose a data-based callback in our public API (back-compat), then
    // translate it to the Query-based signature the library now expects.
    refetchInterval: (query) => {
      const data = query.state.data;
      const userOpt = options?.refetchInterval;
      if (typeof userOpt === 'function') {
        return userOpt(data);
      }
      if (userOpt !== undefined) {
        return userOpt;
      }
      if (!data) return 2000;
      return data.status === 'completed' || data.status === 'failed' ? false : 2000;
    },
    retry: (failureCount, error) => {
      // Don't retry on 404 (job not found)
      if (error.statusCode === 404) return false;
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
  });
}

// ============================================================================
// Download Mutations
// ============================================================================

export interface UseDownloadReportOptions {
  onSuccess?: (blob: Blob) => void;
  onError?: (error: APIError) => void;
}

/**
 * Hook for downloading report files.
 * 
 * @param options - Callback options for success and error
 * @returns Mutation result with download function and state
 * 
 * @example
 * ```tsx
 * const downloadMutation = useDownloadReport({
 *   onSuccess: (blob) => {
 *     console.log('Downloaded:', blob.size, 'bytes');
 *   },
 * });
 * 
 * const handleDownload = () => {
 *   downloadMutation.mutate({ jobId: 'job-123', format: 'pdf' });
 * };
 * ```
 */
export function useDownloadReport(
  options?: UseDownloadReportOptions
): UseMutationResult<Blob, APIError, { jobId: string; format: 'pdf' | 'csv' | 'json' }> {
  return useMutation<Blob, APIError, { jobId: string; format: 'pdf' | 'csv' | 'json' }>({
    mutationFn: ({ jobId, format }) => downloadReport(jobId, format),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for downloading report files and triggering browser download.
 * 
 * @param options - Callback options for success and error
 * @returns Mutation result with download function and state
 * 
 * @example
 * ```tsx
 * const downloadFileMutation = useDownloadReportFile({
 *   onSuccess: () => {
 *     toast.success('Report downloaded successfully');
 *   },
 * });
 * 
 * const handleDownload = () => {
 *   downloadFileMutation.mutate({
 *     jobId: 'job-123',
 *     format: 'pdf',
 *     filename: 'my-report.pdf',
 *   });
 * };
 * ```
 */
export function useDownloadReportFile(
  options?: UseDownloadReportOptions
): UseMutationResult<void, APIError, { jobId: string; format: 'pdf' | 'csv' | 'json'; filename?: string }> {
  return useMutation<void, APIError, { jobId: string; format: 'pdf' | 'csv' | 'json'; filename?: string }>({
    mutationFn: ({ jobId, format, filename }) => downloadReportFile(jobId, format, filename),
    onSuccess: () => options?.onSuccess?.(new Blob()),
    onError: options?.onError,
  });
}
