import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Rules from './Rules'

describe('Rules Page', () => {
  it('renders page title and description', () => {
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    expect(screen.getByText('Classification Rules')).toBeInTheDocument()
    expect(screen.getByText(/Understand how transactions are categorised/i)).toBeInTheDocument()
  })

  it('renders section tabs', () => {
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    expect(screen.getByText('Classification Rules')).toBeInTheDocument()
    expect(screen.getByText('Exclusion Rules')).toBeInTheDocument()
    expect(screen.getByText('Confidence Scoring')).toBeInTheDocument()
  })

  it('displays rule categories in classification section', () => {
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    expect(screen.getByText('Work Software')).toBeInTheDocument()
    expect(screen.getByText('Professional Memberships')).toBeInTheDocument()
    expect(screen.getByText('Training & Education')).toBeInTheDocument()
    expect(screen.getByText('Work Equipment')).toBeInTheDocument()
  })

  it('expands rule category when clicked', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    const workSoftwareCard = screen.getByText('Work Software').closest('div')?.parentElement
    await user.click(workSoftwareCard!)

    expect(screen.getByText('KEYWORDS')).toBeInTheDocument()
    expect(screen.getByText('KNOWN MERCHANTS')).toBeInTheDocument()
    expect(screen.getByText('BASE CONFIDENCE')).toBeInTheDocument()
  })

  it('shows rule version information', () => {
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    const versionChips = screen.getAllByText(/v\d+\.\d+/)
    expect(versionChips.length).toBeGreaterThan(0)
  })

  it('switches to exclusion rules tab', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    const exclusionTab = screen.getByText('Exclusion Rules')
    await user.click(exclusionTab)

    expect(screen.getByText('About Exclusions')).toBeInTheDocument()
    expect(screen.getByText('Transfer Between Accounts')).toBeInTheDocument()
    expect(screen.getByText('Cash Withdrawals')).toBeInTheDocument()
  })

  it('switches to confidence scoring tab', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    const confidenceTab = screen.getByText('Confidence Scoring')
    await user.click(confidenceTab)

    expect(screen.getByText('How Confidence is Computed')).toBeInTheDocument()
    expect(screen.getByText('Confidence Levels')).toBeInTheDocument()
    expect(screen.getByText('Fuzzy Merchant Matching')).toBeInTheDocument()
  })

  it('displays merchant matching examples', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    const workSoftwareCard = screen.getByText('Work Software').closest('div')?.parentElement
    await user.click(workSoftwareCard!)

    expect(screen.getByText('MATCHING EXAMPLES')).toBeInTheDocument()
  })
})
