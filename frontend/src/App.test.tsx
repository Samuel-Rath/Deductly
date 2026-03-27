import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    // App renders the landing page by default
    expect(screen.getByText(/Turn Bank Statements Into/i)).toBeInTheDocument()
  })

  it('renders navigation', () => {
    render(<App />)
    expect(screen.getByText('Deductly')).toBeInTheDocument()
  })
})
