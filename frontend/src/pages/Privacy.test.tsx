import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Privacy from './Privacy'

describe('Privacy Page', () => {
  const renderPrivacy = () =>
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

  // Helper to assert text appears at least once (avoids multiple-element errors)
  const hasText = (pattern: RegExp | string) =>
    screen.getAllByText(pattern).length > 0

  it('renders page title and description', () => {
    renderPrivacy()
    expect(screen.getByText('Privacy & Data Handling')).toBeInTheDocument()
    expect(hasText(/Understand how your data is processed/i)).toBe(true)
  })

  it('explains what data is processed', () => {
    renderPrivacy()
    expect(screen.getByText('What data is processed')).toBeInTheDocument()
    expect(hasText(/Transaction dates/i)).toBe(true)
    expect(hasText(/Transaction descriptions/i)).toBe(true)
    expect(hasText(/Transaction amounts/i)).toBe(true)
  })

  it('explains what is stored by default', () => {
    renderPrivacy()
    expect(screen.getByText('What is stored by default')).toBeInTheDocument()
    expect(hasText(/ephemeral mode/i)).toBe(true)
    expect(hasText(/Raw CSV data is never written to disk/i)).toBe(true)
  })

  it('explains ephemeral mode', () => {
    renderPrivacy()
    expect(screen.getByText('Ephemeral mode explained')).toBeInTheDocument()
    expect(screen.getByText('No persistent storage')).toBeInTheDocument()
    expect(screen.getByText('Memory-only processing')).toBeInTheDocument()
    expect(screen.getByText('Download and delete')).toBeInTheDocument()
  })

  it('explains how reports are generated', () => {
    renderPrivacy()
    expect(screen.getByText('How reports are generated')).toBeInTheDocument()
    expect(screen.getByText('Normalisation')).toBeInTheDocument()
    expect(screen.getByText('Exclusion')).toBeInTheDocument()
    expect(screen.getByText('Report Generation')).toBeInTheDocument()
  })

  it('provides redaction recommendations', () => {
    renderPrivacy()
    expect(screen.getByText('Redaction recommendations')).toBeInTheDocument()
    expect(screen.getByText('Account numbers and BSB codes')).toBeInTheDocument()
    expect(screen.getByText('Personal reference numbers')).toBeInTheDocument()
    expect(screen.getByText('Sensitive merchant names')).toBeInTheDocument()
  })

  it('mentions no authentication required', () => {
    renderPrivacy()
    expect(screen.getByText('No authentication required')).toBeInTheDocument()
    expect(hasText(/does not require account creation/i)).toBe(true)
  })

  it('mentions open source nature', () => {
    renderPrivacy()
    expect(screen.getByText('Open source')).toBeInTheDocument()
    expect(hasText(/review the code/i)).toBe(true)
  })
})
