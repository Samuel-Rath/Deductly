import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Privacy from './Privacy'

describe('Privacy Page', () => {
  it('renders page title and description', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText('Privacy & Data Handling')).toBeInTheDocument()
    expect(screen.getByText(/Understand how your data is processed/i)).toBeInTheDocument()
  })

  it('explains what data is processed', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText('What data is processed')).toBeInTheDocument()
    expect(screen.getByText(/Transaction dates/i)).toBeInTheDocument()
    expect(screen.getByText(/Transaction descriptions/i)).toBeInTheDocument()
    expect(screen.getByText(/Transaction amounts/i)).toBeInTheDocument()
  })

  it('explains what is stored by default', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText('What is stored by default')).toBeInTheDocument()
    expect(screen.getByText(/ephemeral mode/i)).toBeInTheDocument()
    expect(screen.getByText(/Raw CSV data is never written to disk/i)).toBeInTheDocument()
  })

  it('explains ephemeral mode', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText('Ephemeral mode explained')).toBeInTheDocument()
    expect(screen.getByText(/No persistent storage/i)).toBeInTheDocument()
    expect(screen.getByText(/Memory-only processing/i)).toBeInTheDocument()
    expect(screen.getByText(/Download and delete/i)).toBeInTheDocument()
  })

  it('explains how reports are generated', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText('How reports are generated')).toBeInTheDocument()
    expect(screen.getByText(/Normalisation/i)).toBeInTheDocument()
    expect(screen.getByText(/Exclusion/i)).toBeInTheDocument()
    expect(screen.getByText(/Classification/i)).toBeInTheDocument()
    expect(screen.getByText(/Report Generation/i)).toBeInTheDocument()
  })

  it('provides redaction recommendations', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText('Redaction recommendations')).toBeInTheDocument()
    expect(screen.getByText(/Account numbers and BSB codes/i)).toBeInTheDocument()
    expect(screen.getByText(/Personal reference numbers/i)).toBeInTheDocument()
    expect(screen.getByText(/Sensitive merchant names/i)).toBeInTheDocument()
  })

  it('mentions no authentication required', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText(/No authentication required/i)).toBeInTheDocument()
    expect(screen.getByText(/does not require account creation/i)).toBeInTheDocument()
  })

  it('mentions open source nature', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    )

    expect(screen.getByText(/Open source/i)).toBeInTheDocument()
    expect(screen.getByText(/review the code/i)).toBeInTheDocument()
  })
})
