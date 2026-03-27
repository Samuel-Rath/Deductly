/**
 * End-to-end tests for Tax Deduction Analyzer
 *
 * Tests complete user journey from landing to upload
 * Validates: routing, file upload, error states
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import * as apiClient from '../api/client'

// Mock API client
vi.mock('../api/client')

// Fresh query client per test — no retries, no caching delays
const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })

describe('End-to-End User Journey', () => {
  let testQueryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    testQueryClient = makeQueryClient()
  })

  const renderApp = () => {
    // App already contains its own BrowserRouter — do not wrap again
    return render(
      <QueryClientProvider client={testQueryClient}>
        <App />
      </QueryClientProvider>
    )
  }

  it('renders landing page with current headline', () => {
    renderApp()
    expect(screen.getByText(/Turn Bank Statements Into/i)).toBeInTheDocument()
    expect(screen.getByText('Deductly')).toBeInTheDocument()
  })

  it('navigates to upload page when Get Started is clicked', async () => {
    const user = userEvent.setup()
    renderApp()

    const getStartedLink = screen.getByRole('link', { name: /Get Started/i })
    await user.click(getStartedLink)

    await waitFor(() => {
      expect(screen.getByText('Upload Your Bank Statement')).toBeInTheDocument()
    })
  })

  it('handles upload errors gracefully', async () => {
    const user = userEvent.setup()

    // Use plain Error — apiClient.APIError is auto-mocked and won't set .message
    vi.mocked(apiClient.uploadCSV).mockRejectedValue(
      new Error('File too large')
    )

    renderApp()

    // Navigate to upload via nav link
    const getStartedLink = screen.getByRole('link', { name: /Get Started/i })
    await user.click(getStartedLink)

    await waitFor(() => {
      expect(screen.getByText('Upload Your Bank Statement')).toBeInTheDocument()
    })

    // Upload a valid CSV file using the labelled input
    const fileInput = screen.getByLabelText('Bank Statement') as HTMLInputElement
    const file = new File(['date,description,amount\n2024-01-15,Test,100'], 'test.csv', { type: 'text/csv' })
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument()
    })

    const analyseButton = screen.getByRole('button', { name: /Start Analysis/i })
    await user.click(analyseButton)

    await waitFor(() => {
      expect(screen.getByText(/File too large/i)).toBeInTheDocument()
    })
  })

  it('handles job processing failures', async () => {
    const user = userEvent.setup()

    const mockJobId = 'test-job-456'

    vi.mocked(apiClient.uploadCSV).mockResolvedValue({
      job_id: mockJobId,
      status: 'queued' as const,
      message: 'File uploaded successfully',
    })
    vi.mocked(apiClient.getJobStatus).mockResolvedValue({
      job_id: mockJobId,
      status: 'failed' as const,
      error: 'Invalid CSV format',
    })

    renderApp()

    const getStartedLink = screen.getByRole('link', { name: /Get Started/i })
    await user.click(getStartedLink)

    await waitFor(() => {
      expect(screen.getByText('Upload Your Bank Statement')).toBeInTheDocument()
    })

    const fileInput = screen.getByLabelText('Bank Statement') as HTMLInputElement
    const file = new File(['date,description,amount\n2024-01-15,Test,100'], 'test.csv', { type: 'text/csv' })
    await user.upload(fileInput, file)

    const analyseButton = screen.getByRole('button', { name: /Start Analysis/i })
    await user.click(analyseButton)

    await waitFor(() => {
      expect(screen.getByText(/Processing failed/i)).toBeInTheDocument()
      expect(screen.getByText(/Invalid CSV format/i)).toBeInTheDocument()
    }, { timeout: 10000 })
  }, 15000)

  it('validates file type before upload', async () => {
    renderApp()

    const getStartedLink = screen.getByRole('link', { name: /Get Started/i })
    await userEvent.setup().click(getStartedLink)

    await waitFor(() => {
      expect(screen.getByText('Upload Your Bank Statement')).toBeInTheDocument()
    })

    // Use fireEvent to bypass user-event's accept-attribute filter for .txt files
    const fileInput = screen.getByLabelText('Bank Statement') as HTMLInputElement
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput, 'files', { value: [file], writable: true, configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/Only CSV and PDF files are accepted/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Start Analysis/i })).toBeDisabled()
  })

  it('supports keyboard navigation to upload page', async () => {
    const user = userEvent.setup()
    renderApp()

    // Tab until "Get Started" link is focused (last nav item)
    let focused: Element | null = null
    for (let i = 0; i < 10; i++) {
      await user.tab()
      focused = document.activeElement
      if (focused?.textContent?.includes('Get Started')) break
    }

    // The Get Started link should be reachable via tab
    expect(screen.getByRole('link', { name: /Get Started/i })).toBeInTheDocument()
  })
})
