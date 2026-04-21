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

    // "Classification Rules" appears in both the h1 and the first tab button
    expect(screen.getAllByText('Classification Rules').length).toBeGreaterThan(0)
    expect(screen.getByText(/Understand how transactions are categorised/i)).toBeInTheDocument()
  })

  it('renders section tabs', () => {
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    // "Classification Rules" appears in h1 + tab; check for at least one
    expect(screen.getAllByText('Classification Rules').length).toBeGreaterThan(0)
    expect(screen.getByText('Exclusion Rules')).toBeInTheDocument()
    expect(screen.getByText('Confidence Scoring')).toBeInTheDocument()
  })

  it('displays rule categories in classification section', () => {
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    expect(screen.getByText('Tools, Equipment & Technology')).toBeInTheDocument()
    expect(screen.getByText('Professional Memberships & Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Self-Education & Professional Development')).toBeInTheDocument()
    expect(screen.getByText('Home Office Expenses')).toBeInTheDocument()
  })

  it('expands rule category when clicked and shows detail sections', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    // Click the first category card button
    const categoryButton = screen.getByText('Work-Related Travel & Vehicles').closest('button')
    await user.click(categoryButton!)

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

    // Text appears in both h4 and its containing div — assert at least one match
    expect(screen.getAllByText('How Confidence is Computed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Confidence Levels').length).toBeGreaterThan(0)
  })

  it('displays matching examples when a rule is expanded', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Rules />
      </BrowserRouter>
    )

    const categoryButton = screen.getByText('Work-Related Travel & Vehicles').closest('button')
    await user.click(categoryButton!)

    expect(screen.getByText('MATCHING EXAMPLES')).toBeInTheDocument()
  })
})
