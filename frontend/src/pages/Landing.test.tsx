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
  it('renders hero section with headline', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText(/Turn Bank Statements Into/i)).toBeInTheDocument()
    expect(screen.getByText(/Tax-Ready/i)).toBeInTheDocument()
  })

  it('renders trust signals', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    // "No account needed" appears in both trust signals and stats strip
    expect(screen.getAllByText(/No account needed/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Data never stored/i)).toBeInTheDocument()
    expect(screen.getByText(/ATO-cited analysis/i)).toBeInTheDocument()
  })

  it('renders why Deductly features section', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText('Why Deductly')).toBeInTheDocument()
    expect(screen.getByText('Privacy First')).toBeInTheDocument()
    expect(screen.getByText('AI-Grounded')).toBeInTheDocument()
    expect(screen.getByText('Confidence Scores')).toBeInTheDocument()
    expect(screen.getByText('ATO Citations')).toBeInTheDocument()
  })

  it('renders how it works section with three steps', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText('How It Works')).toBeInTheDocument()
    expect(screen.getByText('Upload Your Statement')).toBeInTheDocument()
    expect(screen.getByText('AI Analyses Transactions')).toBeInTheDocument()
    expect(screen.getByText('Download Your Report')).toBeInTheDocument()
  })

  it('navigates to upload page when primary CTA is clicked', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    const buttons = screen.getAllByText('Analyse My Statement')
    await user.click(buttons[0])

    expect(mockNavigate).toHaveBeenCalledWith('/upload')
  })

  it('navigates to rules page when View ATO Rules is clicked', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    await user.click(screen.getByText('View ATO Rules'))

    expect(mockNavigate).toHaveBeenCalledWith('/rules')
  })

  it('renders stats strip with key metrics', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText('Deduction Categories')).toBeInTheDocument()
    expect(screen.getByText('Composite Confidence')).toBeInTheDocument()
  })
})
