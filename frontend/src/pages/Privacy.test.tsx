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

  const hasText = (pattern: RegExp | string) =>
    screen.queryAllByText(pattern).length > 0

  it('renders page title and effective date', () => {
    renderPrivacy()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
    expect(hasText(/Effective/i)).toBe(true)
  })

  it('covers the "What Data We Process" section', () => {
    renderPrivacy()
    // Section heading is "2. What Data We Process"
    expect(screen.getByRole('heading', { name: /What Data We Process/i })).toBeInTheDocument()
    expect(hasText(/Transaction dates/i)).toBe(true)
    expect(hasText(/Transaction descriptions/i)).toBe(true)
    expect(hasText(/Transaction amounts/i)).toBe(true)
  })

  it('explains ephemeral mode in detail', () => {
    renderPrivacy()
    // "Ephemeral Mode" appears in the section heading AND in body prose; use heading role to disambiguate
    expect(screen.getByRole('heading', { name: /Ephemeral Mode/i })).toBeInTheDocument()
    expect(screen.getByText('No persistent storage')).toBeInTheDocument()
    expect(screen.getByText('Memory-only processing')).toBeInTheDocument()
    expect(screen.getByText('Report generated then deleted')).toBeInTheDocument()
    expect(screen.getByText('No session linking')).toBeInTheDocument()
  })

  it('explains the data processing pipeline steps', () => {
    renderPrivacy()
    expect(screen.getByText(/How We Process Your Data/i)).toBeInTheDocument()
    expect(screen.getByText('Normalisation')).toBeInTheDocument()
    expect(screen.getByText('Redaction')).toBeInTheDocument()
    expect(screen.getByText('Exclusion')).toBeInTheDocument()
    expect(screen.getByText('Classification')).toBeInTheDocument()
    expect(screen.getByText('Report generation')).toBeInTheDocument()
    expect(screen.getByText('Deletion')).toBeInTheDocument()
  })

  it('documents automatic redaction of sensitive identifiers', () => {
    renderPrivacy()
    expect(screen.getByText(/Automatic Redaction/i)).toBeInTheDocument()
    expect(hasText(/Account numbers/i)).toBe(true)
    expect(hasText(/Card numbers/i)).toBe(true)
    expect(hasText(/Reference numbers/i)).toBe(true)
  })

  it('states no third-party analytics or tracking', () => {
    renderPrivacy()
    expect(screen.getByText(/Third-Party Services/i)).toBeInTheDocument()
    expect(hasText(/does not integrate with any third-party/i)).toBe(true)
  })

  it('states no cookies are used', () => {
    renderPrivacy()
    expect(screen.getByText(/Cookies and Tracking/i)).toBeInTheDocument()
    expect(hasText(/does not use cookies/i)).toBe(true)
  })

  it('lists user rights and security measures', () => {
    renderPrivacy()
    expect(screen.getByText(/Your Rights/i)).toBeInTheDocument()
    expect(screen.getByText(/^9\. Security$|Security$/)).toBeInTheDocument()
  })

  it('links to the Terms of Service page', () => {
    renderPrivacy()
    const termsLink = screen.getByRole('link', { name: /Terms of Service/i })
    expect(termsLink).toBeInTheDocument()
    expect(termsLink.getAttribute('href')).toBe('/terms')
  })
})
