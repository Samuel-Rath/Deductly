/**
 * Tests for React Query hooks.
 * 
 * Tests upload mutation, job status polling, and download mutations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useUploadCSV,
  useJobStatus,
  useDownloadReport,
  useDownloadReportFile,
} from './hooks';
import * as client from './client';

// Mock the client module
vi.mock('./client');

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('React Query Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useUploadCSV', () => {
    it('should upload CSV successfully', async () => {
      const mockResponse = {
        job_id: 'test-job-123',
        status: 'queued' as const,
        message: 'File uploaded successfully',
      };

      vi.mocked(client.uploadCSV).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useUploadCSV(), {
        wrapper: createWrapper(),
      });

      const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' });
      
      result.current.mutate({
        file: mockFile,
        incomeYear: '2023-2024',
        ephemeralMode: true,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(client.uploadCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          file: mockFile,
          incomeYear: '2023-2024',
          ephemeralMode: true,
        }),
        expect.anything()
      );
    });

    it('should handle upload errors', async () => {
      const mockError = new client.APIError('Upload failed', 400, 'invalid_file');

      vi.mocked(client.uploadCSV).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUploadCSV(), {
        wrapper: createWrapper(),
      });

      const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' });
      
      result.current.mutate({
        file: mockFile,
        incomeYear: '2023-2024',
        ephemeralMode: true,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it('should call onSuccess callback', async () => {
      const mockResponse = {
        job_id: 'test-job-123',
        status: 'queued' as const,
        message: 'File uploaded successfully',
      };

      vi.mocked(client.uploadCSV).mockResolvedValue(mockResponse);

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useUploadCSV({ onSuccess }), {
        wrapper: createWrapper(),
      });

      const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' });
      
      result.current.mutate({
        file: mockFile,
        incomeYear: '2023-2024',
        ephemeralMode: true,
      });

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(mockResponse));
    });
  });

  describe('useJobStatus', () => {
    it('should fetch job status successfully', async () => {
      const mockResponse = {
        job_id: 'test-job-123',
        status: 'completed' as const,
        progress: 100,
        report_urls: {
          pdf: '/api/jobs/test-job-123/download/pdf',
          csv: '/api/jobs/test-job-123/download/csv',
          json: '/api/jobs/test-job-123/download/json',
        },
      };

      vi.mocked(client.getJobStatus).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useJobStatus('test-job-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(client.getJobStatus).toHaveBeenCalledWith('test-job-123');
    });

    it('should handle job status errors', async () => {
      const mockError = new client.APIError('Job not found', 404, 'job_not_found');

      vi.mocked(client.getJobStatus).mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useJobStatus('invalid-job', { 
          refetchInterval: false,
        }),
        { wrapper: createWrapper() }
      );

      // The query should eventually fail
      await waitFor(() => {
        return result.current.fetchStatus === 'idle';
      }, {
        timeout: 2000,
      });

      // Verify the mock was called
      expect(client.getJobStatus).toHaveBeenCalledWith('invalid-job');
    });

    it('should not fetch when disabled', async () => {
      const { result } = renderHook(
        () => useJobStatus('test-job-123', { enabled: false }),
        { wrapper: createWrapper() }
      );

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.isFetching).toBe(false);
      expect(client.getJobStatus).not.toHaveBeenCalled();
    });
  });

  describe('useDownloadReport', () => {
    it('should download report successfully', async () => {
      const mockBlob = new Blob(['test content'], { type: 'application/pdf' });

      vi.mocked(client.downloadReport).mockResolvedValue(mockBlob);

      const { result } = renderHook(() => useDownloadReport(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ jobId: 'test-job-123', format: 'pdf' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockBlob);
      expect(client.downloadReport).toHaveBeenCalledWith('test-job-123', 'pdf');
    });

    it('should handle download errors', async () => {
      const mockError = new client.APIError('Report not found', 404, 'report_not_found');

      vi.mocked(client.downloadReport).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDownloadReport(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ jobId: 'test-job-123', format: 'pdf' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useDownloadReportFile', () => {
    it('should download and trigger browser download', async () => {
      vi.mocked(client.downloadReportFile).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadReportFile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        jobId: 'test-job-123',
        format: 'pdf',
        filename: 'report.pdf',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(client.downloadReportFile).toHaveBeenCalledWith(
        'test-job-123',
        'pdf',
        'report.pdf'
      );
    });

    it('should call onSuccess callback', async () => {
      vi.mocked(client.downloadReportFile).mockResolvedValue(undefined);

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useDownloadReportFile({ onSuccess }), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        jobId: 'test-job-123',
        format: 'pdf',
      });

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
  });
});
