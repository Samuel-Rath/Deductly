/**
 * API module exports.
 * 
 * Provides centralized access to API client functions, React Query hooks,
 * and query client configuration.
 */

// Client functions
export {
  uploadCSV,
  getJobStatus,
  downloadReport,
  downloadReportFile,
  APIError,
} from './client';

export type {
  UploadRequest,
  UploadResponse,
  JobStatusResponse,
  ErrorResponse,
} from './client';

// React Query hooks
export {
  useUploadCSV,
  useJobStatus,
  useDownloadReport,
  useDownloadReportFile,
  queryKeys,
} from './hooks';

export type {
  UseUploadCSVOptions,
  UseJobStatusOptions,
  UseDownloadReportOptions,
} from './hooks';

// Query client
export {
  queryClient,
  clearCache,
  invalidateJobs,
} from './queryClient';
