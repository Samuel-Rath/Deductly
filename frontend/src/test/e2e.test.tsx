/**
 * End-to-end tests for Tax Deduction Analyzer
 * 
 * Tests complete user journey from landing to export
 * Validates: All requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../api/queryClient'
import App from '../App'
import * as apiClient from '../api/client'

// Mock API client
vi.mock('../api/client')

describe('End-to-End User Journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  const renderApp = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  it('completes full journey from landing to report export', async () => {
    const user = userEvent.setup()

    // Mock API responses
    const mockJobId = 'test-job-123'
    const mockUploadResponse = {
      job_id: mockJobId,
      status: 'queued' as const,
      message: 'File uploaded successfully'
    }

    const mockJobStatusProcessing = {
      job_id: mockJobId,
      status: 'processing' as const,
      progress: 50
    }

    const mockJobStatusCompleted = {
      job_id: mockJobId,
      status: 'completed' as const,
      progress: 100,
      report_urls: {
        pdf: `/api/jobs/${mockJobId}/download/pdf`,
        csv: `/api/jobs/${mockJobId}/download/csv`,
        json: `/api/jobs/${mockJobId}/download/json`
      }
    }

    vi.mocked(apiClient.uploadCSV).mockResolvedValue(mockUploadResponse)
    vi.mocked(apiClient.getJobStatus)
      .mockResolvedValueOnce(mockJobStatusProcessing)
      .mockResolvedValue(mockJobStatusCompleted)
    vi.mocked(apiClient.downloadReportFile).mockResolvedValue()

    // Step 1: Start on landing page
    renderApp()
    
    expect(screen.getByText(/Turn your bank CSV into an evidence-ready deduction report/i)).toBeInTheDocument()

    // Step 2: Navigate to upload page
    const uploadButton = screen.getByRole('link', { name: /Upload CSV/i })
    await user.click(uploadButton)

    await waitFor(() => {
      expect(screen.getByText(/Upload your bank CSV/i)).toBeInTheDocument()
    })

    // Step 3: Upload a file
    const file = new File(['date,description,amount\n2024-01-15,Adobe,79.99'], 'test.csv', {
      type: 'text/csv'
    })

    const fileInput = screen.getByLabelText(/Upload CSV file/i, { selector: 'input[type="file"]' })
    await user.upload(fileInput, file)

    // Verify file is selected
    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument()
    })

    // Step 4: Start analysis
    const analyzeButton = screen.getByRole('button', { name: /Start Analysis/i })
    await user.click(analyzeButton)

    // Verify upload was called
    await waitFor(() => {
      expect(apiClient.uploadCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.any(File),
          incomeYear: expect.any(String),
          ephemeralMode: true
        })
      )
    })

    // Step 5: Wait for processing to complete
    await waitFor(() => {
      expect(screen.getByText(/Processing your file/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/Deduction Report/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Step 6: Verify report is displayed
    expect(screen.getByText(/Income Year:/i)).toBeInTheDocument()

    // Step 7: Download PDF report
    const pdfButton = screen.getByRole('button', { name: /Download PDF/i })
    await user.click(pdfButton)

    await waitFor(() => {
      expect(apiClient.downloadReportFile).toHaveBeenCalledWith(
        mockJobId,
        'pdf',
        expect.any(String)
      )
    })
  })

  it('handles upload errors gracefully', async () => {
    const user = userEvent.setup()

    // Mock API error
    vi.mocked(apiClient.uploadCSV).mockRejectedValue(
      new apiClient.APIError('File too large', 400, 'file_too_large')
    )

    renderApp()

    // Navigate to upload
    const uploadButton = screen.getByRole('link', { name: /Upload CSV/i })
    await user.click(uploadButton)

    // Upload file
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const fileInput = screen.getByLabelText(/Upload CSV file/i, { selector: 'input[type="file"]' })
    await user.upload(fileInput, file)

    // Start analysis
    const analyzeButton = screen.getByRole('button', { name: /Start Analysis/i })
    await user.click(analyzeButton)

    // Verify error is displayed
    await waitFor(() => {
      expect(screen.getByText(/File too large/i)).toBeInTheDocument()
    })
  })

  it('handles job processing failures', async () => {
    const user = userEvent.setup()

    const mockJobId = 'test-job-456'
    const mockUploadResponse = {
      job_id: mockJobId,
      status: 'queued' as const,
      message: 'File uploaded successfully'
    }

    const mockJobStatusFailed = {
      job_id: mockJobId,
      status: 'failed' as const,
      error: 'Invalid CSV format'
    }

    vi.mocked(apiClient.uploadCSV).mockResolvedValue(mockUploadResponse)
    vi.mocked(apiClient.getJobStatus).mockResolvedValue(mockJobStatusFailed)

    renderApp()

    // Navigate and upload
    const uploadButton = screen.getByRole('link', { name: /Upload CSV/i })
    await user.click(uploadButton)

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const fileInput = screen.getByLabelText(/Upload CSV file/i, { selector: 'input[type="file"]' })
    await user.upload(fileInput, file)

    const analyzeButton = screen.getByRole('button', { name: /Start Analysis/i })
    await user.click(analyzeButton)

    // Verify failure message
    await waitFor(() => {
      expect(screen.getByText(/Processing failed/i)).toBeInTheDocument()
      expect(screen.getByText(/Invalid CSV format/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('validates file type before upload', async () => {
    const user = userEvent.setup()

    renderApp()

    // Navigate to upload
    const uploadButton = screen.getByRole('link', { name: /Upload CSV/i })
    await user.click(uploadButton)

    // Try to upload non-CSV file
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const fileInput = screen.getByLabelText(/Upload CSV file/i, { selector: 'input[type="file"]' })
    
    // Note: File input validation happens in the component
    await user.upload(fileInput, file)

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText(/Only CSV files are accepted/i)).toBeInTheDocument()
    })

    // Verify analyze button is disabled
    const analyzeButton = screen.getByRole('button', { name: /Start Analysis/i })
    expect(analyzeButton).toBeDisabled()
  })

  it('supports keyboard navigation throughout the app', async () => {
    const user = userEvent.setup()

    renderApp()

    // Tab through navigation
    await user.tab()
    expect(screen.getByRole('link', { name: /Rules/i })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('link', { name: /Privacy/i })).toHaveFocus()

    // Navigate to upload page using keyboard
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/Upload your bank CSV/i)).toBeInTheDocument()
    })
  })
})
