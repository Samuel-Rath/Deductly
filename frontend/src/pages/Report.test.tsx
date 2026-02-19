import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import Report from './Report'

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

describe('Report Page', () => {
  const renderReport = () => {
    const queryClient = createTestQueryClient()
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/report/test-job-id']}>
          <Routes>
            <Route path="/report/:jobId" element={<Report />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders summary cards with totals', () => {
    renderReport()

    expect(screen.getByText('LIKELY DEDUCTIBLE')).toBeInTheDocument()
    expect(screen.getByText('NEEDS REVIEW')).toBeInTheDocument()
    expect(screen.getByText('EXCLUDED')).toBeInTheDocument()
    expect(screen.getByText('TOTAL ANALYZED')).toBeInTheDocument()
  })

  it('renders confidence distribution chart', () => {
    renderReport()

    expect(screen.getByText('Confidence Distribution')).toBeInTheDocument()
    expect(screen.getByText(/High \(0\.80 - 1\.00\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Medium \(0\.60 - 0\.79\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Low \(< 0\.60\)/i)).toBeInTheDocument()
  })

  it('renders category totals chart', () => {
    renderReport()

    expect(screen.getByText('Category Totals')).toBeInTheDocument()
    expect(screen.getByText('Work Software')).toBeInTheDocument()
    expect(screen.getByText('Work Equipment')).toBeInTheDocument()
  })

  it('renders tabs for candidates, needs review, excluded, and audit trail', () => {
    renderReport()

    expect(screen.getByText(/Candidates \(\d+\)/)).toBeInTheDocument()
    expect(screen.getByText(/Needs Review \(\d+\)/)).toBeInTheDocument()
    expect(screen.getByText(/Excluded \(\d+\)/)).toBeInTheDocument()
    expect(screen.getByText('Audit Trail')).toBeInTheDocument()
  })

  it('displays candidates table with transaction data', () => {
    renderReport()

    expect(screen.getByText('Adobe')).toBeInTheDocument()
    expect(screen.getByText('Officeworks')).toBeInTheDocument()
    expect(screen.getByText('Telstra')).toBeInTheDocument()
  })

  it('switches between tabs when clicked', async () => {
    const user = userEvent.setup()
    renderReport()

    const needsReviewTab = screen.getByText(/Needs Review \(\d+\)/)
    await user.click(needsReviewTab)

    expect(screen.getByText('Unknown Merchant')).toBeInTheDocument()
  })

  it('highlights selected transaction row', async () => {
    const user = userEvent.setup()
    renderReport()

    const adobeRow = screen.getByText('Adobe').closest('tr')
    expect(adobeRow).toBeTruthy()
    
    await user.click(adobeRow!)

    expect(adobeRow).toHaveClass('bg-ink-800')
  })

  it('opens detail drawer when transaction is clicked', async () => {
    const user = userEvent.setup()
    renderReport()

    const adobeRow = screen.getByText('Adobe').closest('tr')
    await user.click(adobeRow!)

    expect(screen.getByText('Transaction Details')).toBeInTheDocument()
  })

  it('displays transaction details in drawer', async () => {
    const user = userEvent.setup()
    renderReport()

    const adobeRow = screen.getByText('Adobe').closest('tr')
    await user.click(adobeRow!)

    expect(screen.getByText('MERCHANT')).toBeInTheDocument()
    expect(screen.getByText('CLASSIFICATION REASON')).toBeInTheDocument()
    expect(screen.getByText('EVIDENCE REQUIRED')).toBeInTheDocument()
  })

  it('renders export buttons', () => {
    renderReport()

    expect(screen.getByText('Download PDF')).toBeInTheDocument()
    expect(screen.getByText('Download CSV')).toBeInTheDocument()
    expect(screen.getByText('Download JSON')).toBeInTheDocument()
  })

  it('shows download progress when export button is clicked', async () => {
    const user = userEvent.setup()
    renderReport()

    const pdfButton = screen.getByText('Download PDF')
    await user.click(pdfButton)

    expect(screen.getByText('Downloading...')).toBeInTheDocument()
  })
})
