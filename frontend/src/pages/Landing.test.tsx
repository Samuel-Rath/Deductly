import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Landing from './Landing'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Landing Page', () => {
  const renderLanding = () =>
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

  it('renders hero section with headline', () => {
    renderLanding()
    expect(screen.getByText(/Find Every Tax Deduction/i)).toBeInTheDocument()
    expect(screen.getByText(/You're Missing/i)).toBeInTheDocument()
  })

  it('renders trust signals next to the CTA', () => {
    renderLanding()
    expect(screen.getByText(/No data stored/i)).toBeInTheDocument()
    expect(screen.getByText(/ATO Aligned/i)).toBeInTheDocument()
    expect(screen.getByText(/Instant analysis/i)).toBeInTheDocument()
  })

  it('renders Why Deductly features section with four cards', () => {
    renderLanding()
    // "Why Deductly" is the section eyebrow in the editorial grid
    expect(screen.getByText(/Why Deductly/i)).toBeInTheDocument()
    // Feature card titles — the first one is embedded in a longer heading string
    expect(screen.getByText(/Privacy First/i)).toBeInTheDocument()
    expect(screen.getByText('ATO Rule Engine')).toBeInTheDocument()
    expect(screen.getByText('Confidence Scores')).toBeInTheDocument()
    expect(screen.getByText('Evidence Checklists')).toBeInTheDocument()
  })

  it('renders How It Works flow rollup card', () => {
    renderLanding()
    expect(screen.getByText('How It Works')).toBeInTheDocument()
    // Steps appear as a single tagline in the rollup card, and as pills on the thumb.
    expect(screen.getByText(/Upload Your Statement/)).toBeInTheDocument()
    expect(screen.getByText(/Rules Engine Analyses Transactions/)).toBeInTheDocument()
    expect(screen.getByText(/Download Your Report/)).toBeInTheDocument()
  })

  it('navigates to upload page when primary CTA is clicked', async () => {
    const user = userEvent.setup()
    renderLanding()

    // "Find My Deductions" appears in both hero and bottom CTA
    const buttons = screen.getAllByText('Find My Deductions')
    await user.click(buttons[0])

    expect(mockNavigate).toHaveBeenCalledWith('/upload')
  })

  it('renders stats strip with key metrics', () => {
    renderLanding()
    expect(screen.getByText('Deduction Categories')).toBeInTheDocument()
    expect(screen.getByText('Composite Confidence')).toBeInTheDocument()
  })
})
