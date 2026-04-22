import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

// ── Mock report data (passed via navigation state = ephemeral mode) ──────────
const mockReportData = {
  income_year: '2023-24',
  generated_at: '2024-07-01T00:00:00Z',
  summary: {
    total_deductible: 749.94,
    total_needs_review: 200.0,
    total_excluded: 150.0,
    category_totals: {
      'Work Software': 79.99,
      'Work Equipment': 669.95,
    },
    confidence_distribution: {
      high: 2,
      medium: 1,
      low: 1,
    },
  },
  candidates: [
    {
      id: 'txn-1',
      merchant: 'Adobe',
      description: 'ADOBE SUBSCRIPTION',
      category: 'Work Software',
      confidence: 0.91,
      amount: 79.99,
      date: '2024-01-15',
      evidence: ['Receipt'],
    },
    {
      id: 'txn-2',
      merchant: 'Officeworks',
      description: 'OFFICEWORKS PTY LTD',
      category: 'Work Equipment',
      confidence: 0.85,
      amount: 89.95,
      date: '2024-02-10',
      evidence: ['Receipt'],
    },
    {
      id: 'txn-3',
      merchant: 'Telstra',
      description: 'TELSTRA MONTHLY ACCOUNT',
      category: 'Home Office Expenses',
      confidence: 0.72,
      amount: 120.0,
      date: '2024-03-01',
      evidence: ['Invoice'],
    },
  ],
  needs_review: [
    {
      id: 'txn-4',
      merchant: 'Unknown Merchant',
      description: 'UNKNOWN PURCHASE REF 12345',
      category: 'Work Equipment',
      confidence: 0.45,
      amount: 200.0,
      date: '2024-04-01',
      reason: 'Low confidence — unclear work nexus',
    },
  ],
  excluded: [
    {
      id: 'txn-5',
      merchant: 'Woolworths',
      description: 'WOOLWORTHS SUPERMARKET',
      category: null,
      confidence: 0,
      amount: 150.0,
      date: '2024-01-05',
      explanation: 'General groceries — not a deduction candidate',
    },
  ],
}

describe('Report Page', () => {
  const renderReport = () => {
    const queryClient = createTestQueryClient()
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/report/test-job-id',
              state: { reportData: mockReportData },
            },
          ]}
        >
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
    expect(screen.getByText('TOTAL ANALYSED')).toBeInTheDocument()
  })

  it('renders confidence distribution chart', () => {
    renderReport()

    expect(screen.getByText('Confidence Distribution')).toBeInTheDocument()
    // Labels are rendered as percentages, e.g. "High (80–100%)"
    expect(screen.getByText(/High \(80[–-]100%\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Medium \(60[–-]79%\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Low \(below 60%\)/i)).toBeInTheDocument()
  })

  it('renders category totals chart', () => {
    renderReport()

    expect(screen.getByText('Category Totals')).toBeInTheDocument()
    // Category names appear both in the chart and as Chip labels in the table
    expect(screen.getAllByText('Work Software').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Work Equipment').length).toBeGreaterThan(0)
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

    // 'MERCHANT' appears in both the table header and the drawer — assert at least 2
    expect(screen.getAllByText('MERCHANT').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('CLASSIFICATION REASON')).toBeInTheDocument()
  })
})
