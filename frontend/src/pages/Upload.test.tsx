import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import Upload from './Upload'
import * as client from '../api/client'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

describe('Upload Page', () => {
  const renderUpload = () => {
    const queryClient = createTestQueryClient()
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Upload />
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  const getFileInput = () =>
    screen.getByLabelText('Bank Statement') as HTMLInputElement

  it('renders upload form with all required elements', () => {
    renderUpload()

    expect(screen.getByText('Upload Your Bank Statement')).toBeInTheDocument()
    expect(screen.getByText(/Drop your file here/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Bank Statement')).toBeInTheDocument()
  })

  it('shows privacy notice', () => {
    renderUpload()
    expect(screen.getByText(/processed in memory/i)).toBeInTheDocument()
  })

  it('validates file type and shows error for non-CSV/PDF files', async () => {
    renderUpload()

    const input = getFileInput()
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })

    // Use fireEvent to bypass user-event's accept-attribute filtering
    Object.defineProperty(input, 'files', { value: [file], writable: true, configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText('Only CSV and PDF files are accepted')).toBeInTheDocument()
    })
  })

  it('validates file size and shows error for large files', async () => {
    const user = userEvent.setup()
    renderUpload()

    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.csv', { type: 'text/csv' })
    await user.upload(getFileInput(), largeFile)

    await waitFor(() => {
      expect(screen.getByText(/File size must be less than/i)).toBeInTheDocument()
    })
  })

  it('accepts valid CSV file', async () => {
    const user = userEvent.setup()
    renderUpload()

    const file = new File(['date,description,amount\n2024-01-01,Test,100'], 'test.csv', { type: 'text/csv' })
    await user.upload(getFileInput(), file)

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument()
    })
  })

  it('accepts valid PDF file', async () => {
    const user = userEvent.setup()
    renderUpload()

    const file = new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' })
    await user.upload(getFileInput(), file)

    await waitFor(() => {
      expect(screen.getByText('statement.pdf')).toBeInTheDocument()
    })
  })

  it('disables upload button when no file is selected', () => {
    renderUpload()

    const uploadButton = screen.getByText('Start Analysis')
    expect(uploadButton).toBeDisabled()
  })

  it('enables upload button after valid file is selected', async () => {
    const user = userEvent.setup()
    renderUpload()

    const file = new File(['date,description,amount\n2024-01-01,Test,100'], 'test.csv', { type: 'text/csv' })
    await user.upload(getFileInput(), file)

    await waitFor(() => {
      expect(screen.getByText('Start Analysis')).not.toBeDisabled()
    })
  })
})


// ---------------------------------------------------------------------------
// Progress + PDF-aware status messages
//
// These tests drive the upload mutation manually via a spy on `uploadCSV`
// so we can control when onUploadProgress fires and assert on the status
// text shown to the user.
// ---------------------------------------------------------------------------

describe('Upload progress and PDF-aware messaging', () => {
  const renderUpload = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Upload />
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  const selectFile = async (file: File) => {
    const input = screen.getByLabelText('Bank Statement') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file], writable: true, configurable: true })
    fireEvent.change(input)
    await waitFor(() => {
      expect(screen.getByText(file.name)).toBeInTheDocument()
    })
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows PDF-specific upload status when a PDF is uploaded', async () => {
    // Pending promise — keep the mutation in-flight so we can see the stage
    let resolveUpload: (v: client.UploadResponse) => void = () => {}
    let capturedOnProgress: ((pct: number) => void) | undefined
    const spy = vi.spyOn(client, 'uploadCSV').mockImplementation((req) => {
      capturedOnProgress = req.onUploadProgress
      return new Promise<client.UploadResponse>((resolve) => {
        resolveUpload = resolve
      })
    })

    renderUpload()
    const pdf = new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' })
    await selectFile(pdf)

    fireEvent.click(screen.getByText('Start Analysis'))

    await waitFor(() => {
      expect(screen.getByText('Uploading your PDF...')).toBeInTheDocument()
    })

    // Simulate upload phase completion → processing phase begins
    act(() => {
      capturedOnProgress?.(100)
    })

    await waitFor(() => {
      expect(screen.getByText(/Extracting transactions from PDF/i)).toBeInTheDocument()
    })

    // Advance timers enough to reach the classification stage (>= 78%)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    await waitFor(() => {
      expect(screen.getByText(/Classifying deductible items/i)).toBeInTheDocument()
    })

    // Resolve the upload so React Query settles cleanly
    act(() => {
      resolveUpload({ job_id: 'job-1', status: 'completed', message: 'ok' })
    })

    spy.mockRestore()
  })

  it('shows CSV-specific upload status when a CSV is uploaded', async () => {
    let resolveUpload: (v: client.UploadResponse) => void = () => {}
    let capturedOnProgress: ((pct: number) => void) | undefined
    const spy = vi.spyOn(client, 'uploadCSV').mockImplementation((req) => {
      capturedOnProgress = req.onUploadProgress
      return new Promise<client.UploadResponse>((resolve) => {
        resolveUpload = resolve
      })
    })

    renderUpload()
    const csv = new File(['date,description,amount'], 'test.csv', { type: 'text/csv' })
    await selectFile(csv)

    fireEvent.click(screen.getByText('Start Analysis'))

    await waitFor(() => {
      expect(screen.getByText('Uploading your file...')).toBeInTheDocument()
    })

    act(() => {
      capturedOnProgress?.(100)
    })

    await waitFor(() => {
      expect(screen.getByText(/Parsing transactions/i)).toBeInTheDocument()
    })

    act(() => {
      resolveUpload({ job_id: 'job-2', status: 'completed', message: 'ok' })
    })

    spy.mockRestore()
  })

  it('maps bytes-transferred progress to 0–40% during upload phase', async () => {
    let capturedOnProgress: ((pct: number) => void) | undefined
    const spy = vi.spyOn(client, 'uploadCSV').mockImplementation((req) => {
      capturedOnProgress = req.onUploadProgress
      return new Promise<client.UploadResponse>(() => {})
    })

    renderUpload()
    const csv = new File(['a,b,c'], 'test.csv', { type: 'text/csv' })
    await selectFile(csv)
    fireEvent.click(screen.getByText('Start Analysis'))

    await waitFor(() => expect(capturedOnProgress).toBeDefined())

    // 50% bytes transferred → bar should show 20% (50 * 0.4)
    act(() => {
      capturedOnProgress?.(50)
    })
    await waitFor(() => {
      const bar = screen.getByRole('progressbar')
      expect(bar.getAttribute('aria-valuenow')).toBe('20')
    })

    spy.mockRestore()
  })

  it('caps processing-phase progress below 100% before success', async () => {
    let resolveUpload: (v: client.UploadResponse) => void = () => {}
    let capturedOnProgress: ((pct: number) => void) | undefined
    const spy = vi.spyOn(client, 'uploadCSV').mockImplementation((req) => {
      capturedOnProgress = req.onUploadProgress
      return new Promise<client.UploadResponse>((resolve) => {
        resolveUpload = resolve
      })
    })

    renderUpload()
    const csv = new File(['a,b,c'], 'test.csv', { type: 'text/csv' })
    await selectFile(csv)
    fireEvent.click(screen.getByText('Start Analysis'))

    await waitFor(() => expect(capturedOnProgress).toBeDefined())

    // Finish upload phase, then let the processing timer run a long time
    act(() => {
      capturedOnProgress?.(100)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    const bar = screen.getByRole('progressbar')
    const shown = Number(bar.getAttribute('aria-valuenow'))
    expect(shown).toBeGreaterThan(40)
    expect(shown).toBeLessThanOrEqual(95)

    act(() => {
      resolveUpload({ job_id: 'job-3', status: 'completed', message: 'ok' })
    })
    spy.mockRestore()
  })

  it('shows cold-start warming-up message when a retry fires', async () => {
    let capturedOnRetry: ((attempt: number) => void) | undefined
    const spy = vi.spyOn(client, 'uploadCSV').mockImplementation((req) => {
      capturedOnRetry = req.onRetry
      return new Promise<client.UploadResponse>(() => {})
    })

    renderUpload()
    const csv = new File(['a,b,c'], 'test.csv', { type: 'text/csv' })
    await selectFile(csv)
    fireEvent.click(screen.getByText('Start Analysis'))

    await waitFor(() => expect(capturedOnRetry).toBeDefined())

    act(() => {
      capturedOnRetry?.(0)
    })

    await waitFor(() => {
      expect(screen.getByText(/Connecting to server \(attempt 1\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Server is warming up/i)).toBeInTheDocument()
    })

    spy.mockRestore()
  })

  it('navigates to the report page on successful upload', async () => {
    const spy = vi.spyOn(client, 'uploadCSV').mockResolvedValue({
      job_id: 'job-42',
      status: 'completed',
      message: 'ok',
      report_data: { dummy: true },
    } as client.UploadResponse)

    renderUpload()
    const csv = new File(['a,b,c'], 'test.csv', { type: 'text/csv' })
    await selectFile(csv)
    fireEvent.click(screen.getByText('Start Analysis'))

    // Advance past the 300ms post-success navigate delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/report/job-42',
        expect.objectContaining({ state: expect.objectContaining({ reportData: { dummy: true } }) }),
      )
    })

    spy.mockRestore()
  })

  it('surfaces a friendly error message on network failure', async () => {
    const spy = vi.spyOn(client, 'uploadCSV').mockRejectedValue(
      new client.APIError('No response from server', 0, 'network_error'),
    )

    renderUpload()
    const csv = new File(['a,b,c'], 'test.csv', { type: 'text/csv' })
    await selectFile(csv)
    fireEvent.click(screen.getByText('Start Analysis'))

    await waitFor(() => {
      expect(screen.getByText(/Could not reach the server/i)).toBeInTheDocument()
    })

    // Button should re-enable so the user can retry
    expect(screen.getByText('Start Analysis')).not.toBeDisabled()

    spy.mockRestore()
  })
})
