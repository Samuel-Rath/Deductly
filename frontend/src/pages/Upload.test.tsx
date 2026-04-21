import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import Upload from './Upload'

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
