/**
 * Tests for API client functions.
 * 
 * Tests upload, job status, and download functionality with error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  uploadCSV,
  getJobStatus,
  downloadReport,
  downloadReportFile,
  APIError,
} from './client';

// Mock axios module
vi.mock('axios', () => {
  const mockAxiosInstance = {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  };
  
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      isAxiosError: vi.fn(),
    },
  };
});

describe('API Client', () => {
  let mockAxiosInstance: any;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Get the mocked axios instance
    mockAxiosInstance = (axios.create as any)();
  });

  describe('uploadCSV', () => {
    it('should upload CSV file successfully', async () => {
      const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' });
      const mockResponse = {
        data: {
          job_id: 'test-job-123',
          status: 'queued',
          message: 'File uploaded successfully',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await uploadCSV({
        file: mockFile,
        incomeYear: '2023-2024',
        ephemeralMode: true,
      });

      expect(result.job_id).toBe('test-job-123');
      expect(result.status).toBe('queued');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' });
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'invalid_file_type',
            message: 'Only CSV files are allowed',
          },
        },
        isAxiosError: true,
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);
      (axios.isAxiosError as any).mockReturnValue(true);

      await expect(
        uploadCSV({
          file: mockFile,
          incomeYear: '2023-2024',
          ephemeralMode: true,
        })
      ).rejects.toThrow(APIError);
    });
  });

  describe('getJobStatus', () => {
    it('should get job status successfully', async () => {
      const mockResponse = {
        data: {
          job_id: 'test-job-123',
          status: 'completed',
          progress: 100,
          report_urls: {
            pdf: '/api/jobs/test-job-123/download/pdf',
            csv: '/api/jobs/test-job-123/download/csv',
            json: '/api/jobs/test-job-123/download/json',
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await getJobStatus('test-job-123');

      expect(result.job_id).toBe('test-job-123');
      expect(result.status).toBe('completed');
      expect(result.report_urls).toBeDefined();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/jobs/test-job-123');
    });

    it('should handle 404 for invalid job ID', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            error: 'job_not_found',
            message: 'Job not found',
          },
        },
        isAxiosError: true,
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);
      (axios.isAxiosError as any).mockReturnValue(true);

      await expect(getJobStatus('invalid-job')).rejects.toThrow(APIError);
    });
  });

  describe('downloadReport', () => {
    it('should download PDF report successfully', async () => {
      const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });
      const mockResponse = {
        data: mockBlob,
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await downloadReport('test-job-123', 'pdf');

      expect(result).toBeInstanceOf(Blob);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/jobs/test-job-123/download/pdf',
        expect.objectContaining({
          responseType: 'blob',
        })
      );
    });

    it('should download CSV report successfully', async () => {
      const mockBlob = new Blob(['test csv content'], { type: 'text/csv' });
      const mockResponse = {
        data: mockBlob,
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await downloadReport('test-job-123', 'csv');

      expect(result).toBeInstanceOf(Blob);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/jobs/test-job-123/download/csv',
        expect.objectContaining({
          responseType: 'blob',
        })
      );
    });

    it('should handle download errors', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            error: 'report_not_found',
            message: 'Report not found',
          },
        },
        isAxiosError: true,
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);
      (axios.isAxiosError as any).mockReturnValue(true);

      await expect(downloadReport('test-job-123', 'pdf')).rejects.toThrow(APIError);
    });
  });

  describe('downloadReportFile', () => {
    it('should trigger browser download', async () => {
      const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
      const mockResponse = {
        data: mockBlob,
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      } as any;
      
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
      
      // Mock URL methods
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      await downloadReportFile('test-job-123', 'pdf', 'custom-report.pdf');

      expect(mockLink.download).toBe('custom-report.pdf');
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      // Cleanup
      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe('APIError', () => {
    it('should create APIError with all properties', () => {
      const error = new APIError(
        'Test error message',
        400,
        'test_error',
        { field: 'value' }
      );

      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('test_error');
      expect(error.details).toEqual({ field: 'value' });
      expect(error.name).toBe('APIError');
    });
  });
});
