import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

  it('renders upload form with all required elements', () => {
    renderUpload()

    expect(screen.getByText('Upload your bank CSV')).toBeInTheDocument()
    expect(screen.getByText('Drop your CSV here')).toBeInTheDocument()
    expect(screen.getByLabelText('Income year')).toBeInTheDocument()
    expect(screen.getByLabelText(/Ephemeral mode/i)).toBeInTheDocument()
  })

  it('has ephemeral mode enabled by default', () => {
    renderUpload()

    const ephemeralCheckbox = screen.getByLabelText(/Ephemeral mode/i) as HTMLInputElement
    expect(ephemeralCheckbox.checked).toBe(true)
  })

  it('displays current income year by default', () => {
    renderUpload()

    const incomeYearSelect = screen.getByLabelText('Income year') as HTMLSelectElement
    expect(incomeYearSelect.value).toMatch(/\d{4}-\d{4}/)
  })

  it('validates file type and shows error for non-CSV files', async () => {
    const user = userEvent.setup()
    renderUpload()

    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const input = screen.getByLabelText('Bank statement CSV').parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('Only CSV files are accepted')).toBeInTheDocument()
    })
  })

  it('validates file size and shows error for large files', async () => {
    const user = userEvent.setup()
    renderUpload()

    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Bank statement CSV').parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, largeFile)

    await waitFor(() => {
      expect(screen.getByText(/File size must be less than/i)).toBeInTheDocument()
    })
  })

  it('accepts valid CSV file', async () => {
    const user = userEvent.setup()
    renderUpload()

    const file = new File(['date,description,amount\n2024-01-01,Test,100'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Bank statement CSV').parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument()
    })
  })

  it('disables upload button when no file is selected', () => {
    renderUpload()

    const uploadButton = screen.getByText('Start Analysis')
    expect(uploadButton).toBeDisabled()
  })

  it('shows upload progress when processing', async () => {
    const user = userEvent.setup()
    renderUpload()

    const file = new File(['date,description,amount\n2024-01-01,Test,100'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Bank statement CSV').parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    
    const uploadButton = screen.getByText('Start Analysis')
    await user.click(uploadButton)

    await waitFor(() => {
      expect(screen.getByText(/Uploading and processing/i)).toBeInTheDocument()
    })
  })

  it('navigates to report page after successful upload', async () => {
    const user = userEvent.setup()
    renderUpload()

    const file = new File(['date,description,amount\n2024-01-01,Test,100'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Bank statement CSV').parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    
    const uploadButton = screen.getByText('Start Analysis')
    await user.click(uploadButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/report\//))
    }, { timeout: 3000 })
  })
})
