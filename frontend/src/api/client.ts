/**
 * API client for Tax Deduction Analyzer backend.
 * 
 * Provides functions for uploading CSV files, checking job status,
 * and downloading reports with error handling and retries.
 * 
 * Validates: Requirements 11.1-11.5
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const COLD_START_RETRY_DELAY_MS = 5000; // Render/Railway free tier needs ~30s to wake
const UPLOAD_TIMEOUT_MS = 120000; // 2 min — PDF processing can be slow

// ============================================================================
// Types
// ============================================================================

export interface UploadRequest {
  file: File;
  incomeYear?: string; // Optional - will be auto-detected if not provided
  ephemeralMode: boolean;
  confidenceThreshold?: number;
  /** Called with 0–100 as bytes are sent to the server */
  onUploadProgress?: (pct: number) => void;
  /** Called before each retry attempt with the 1-based attempt number */
  onRetry?: (attempt: number) => void;
}

export interface UploadResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
  report_data?: any; // Report data included in ephemeral mode
}

export interface JobStatusResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  report_urls?: {
    pdf: string;
    csv: string;
    json: string;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, any>;
}

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// ============================================================================
// Axios Instance
// ============================================================================

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Error Handler
// ============================================================================

function handleAPIError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorResponse>;
    
    if (axiosError.response) {
      // Server responded with error status
      const { status, data } = axiosError.response;
      const errorData = data || {};
      
      throw new APIError(
        errorData.message || axiosError.message || 'An error occurred',
        status,
        errorData.error,
        errorData.details
      );
    } else if (axiosError.request) {
      // Request made but no response received
      throw new APIError(
        'No response from server. Please check your connection.',
        0,
        'network_error'
      );
    } else {
      // Error setting up request
      throw new APIError(
        axiosError.message || 'Failed to make request',
        0,
        'request_error'
      );
    }
  }
  
  // Unknown error type
  throw new APIError(
    error instanceof Error ? error.message : 'An unknown error occurred',
    0,
    'unknown_error'
  );
}

// ============================================================================
// Retry Logic
// ============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY_MS,
  onRetry?: (attempt: number) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && shouldRetry(error)) {
      const attempt = MAX_RETRIES - retries + 1;
      onRetry?.(attempt);
      // Network errors mean the server is likely cold-starting — use longer delays
      const isNetworkError = error instanceof APIError && error.statusCode === 0;
      const retryDelay = isNetworkError ? Math.max(delay, COLD_START_RETRY_DELAY_MS) : delay;
      await sleep(retryDelay);
      return withRetry(fn, retries - 1, retryDelay * 2, onRetry);
    }
    throw error;
  }
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof APIError) {
    // Retry on network errors and 5xx server errors
    return error.statusCode === 0 || error.statusCode >= 500;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Upload a CSV file for processing.
 * 
 * @param request - Upload request with file and configuration
 * @returns Upload response with job_id
 * @throws APIError on validation or server errors
 */
export async function uploadCSV(request: UploadRequest): Promise<UploadResponse> {
  try {
    const formData = new FormData();
    formData.append('file', request.file);
    
    // Only append income_year if provided (otherwise backend will auto-detect)
    if (request.incomeYear) {
      formData.append('income_year', request.incomeYear);
    }
    
    formData.append('ephemeral_mode', String(request.ephemeralMode));
    
    if (request.confidenceThreshold !== undefined) {
      formData.append('confidence_threshold', String(request.confidenceThreshold));
    }
    
    const response = await withRetry(
      () => apiClient.post<UploadResponse>('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
        onUploadProgress: request.onUploadProgress
          ? (evt) => {
              const pct = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
              request.onUploadProgress!(pct);
            }
          : undefined,
      }),
      MAX_RETRIES,
      RETRY_DELAY_MS,
      request.onRetry
    );
    
    return response.data;
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * Get the status of a processing job.
 * 
 * @param jobId - Unique job identifier
 * @returns Job status with progress and download URLs when complete
 * @throws APIError if job not found or server error
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  try {
    const response = await withRetry(() =>
      apiClient.get<JobStatusResponse>(`/api/jobs/${jobId}`)
    );
    
    return response.data;
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * Download a report file.
 * 
 * @param jobId - Unique job identifier
 * @param format - Report format ('pdf', 'csv', or 'json')
 * @returns Blob containing the report file
 * @throws APIError if report not found or server error
 */
export async function downloadReport(
  jobId: string,
  format: 'pdf' | 'csv' | 'json'
): Promise<Blob> {
  try {
    const response = await withRetry(() =>
      apiClient.get(`/api/jobs/${jobId}/download/${format}`, {
        responseType: 'blob',
      })
    );
    
    return response.data;
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * Download a report and trigger browser download.
 * 
 * @param jobId - Unique job identifier
 * @param format - Report format ('pdf', 'csv', or 'json')
 * @param filename - Optional custom filename
 */
export async function downloadReportFile(
  jobId: string,
  format: 'pdf' | 'csv' | 'json',
  filename?: string
): Promise<void> {
  try {
    const blob = await downloadReport(jobId, format);
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `deduction_report.${format}`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    return handleAPIError(error);
  }
}
