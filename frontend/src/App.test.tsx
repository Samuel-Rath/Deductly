import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    // App renders the landing page by default
    expect(screen.getByText(/Find Every Tax Deduction/i)).toBeInTheDocument()
  })

  it('renders navigation', () => {
    render(<App />)
    // Nav/footer contain the brand — there may be multiple occurrences
    expect(screen.getAllByText('Deductly').length).toBeGreaterThan(0)
  })
})
