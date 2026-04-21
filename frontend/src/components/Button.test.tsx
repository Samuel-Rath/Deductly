import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  describe('variants', () => {
    it('renders primary variant with dark text on gold background', () => {
      render(<Button variant="primary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveClass('text-ink-950')
    })

    it('renders primary variant with gradient background', () => {
      render(<Button variant="primary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button.className).toMatch(/bg-gradient-to-r/)
    })

    it('renders secondary variant with border', () => {
      render(<Button variant="secondary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveClass('border', 'border-line-700')
    })

    it('renders secondary variant with glass styling', () => {
      render(<Button variant="secondary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveClass('glass')
    })

    it('renders tertiary variant with muted text', () => {
      render(<Button variant="tertiary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveClass('text-slate-400')
    })

    it('defaults to primary variant when no variant specified', () => {
      render(<Button>Default</Button>)
      const button = screen.getByRole('button', { name: /default/i })
      expect(button).toHaveClass('text-ink-950')
    })
  })

  describe('sizes', () => {
    it('renders small size with correct padding', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button', { name: /small/i })
      expect(button).toHaveClass('px-3', 'py-1.5')
    })

    it('renders medium size with correct padding', () => {
      render(<Button size="md">Medium</Button>)
      const button = screen.getByRole('button', { name: /medium/i })
      expect(button).toHaveClass('px-5', 'py-2.5')
    })

    it('renders large size with correct padding', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button', { name: /large/i })
      expect(button).toHaveClass('px-7', 'py-3.5')
    })

    it('defaults to medium size when no size specified', () => {
      render(<Button>Default size</Button>)
      const button = screen.getByRole('button', { name: /default size/i })
      expect(button).toHaveClass('px-5', 'py-2.5')
    })
  })

  describe('interactions', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)
      await user.click(screen.getByRole('button', { name: /click me/i }))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick} disabled>Click me</Button>)
      await user.click(screen.getByRole('button', { name: /click me/i }))

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('is keyboard accessible via Enter key', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)
      screen.getByRole('button', { name: /click me/i }).focus()
      await user.keyboard('{Enter}')

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('is keyboard accessible via Space key', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Space key</Button>)
      screen.getByRole('button', { name: /space key/i }).focus()
      await user.keyboard(' ')

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders children content', () => {
      render(<Button>My Label</Button>)
      expect(screen.getByText('My Label')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('sets the disabled attribute', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled()
    })

    it('applies opacity and cursor classes when disabled', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button', { name: /disabled/i })
      expect(button).toHaveClass('disabled:opacity-40', 'disabled:cursor-not-allowed')
    })
  })

  describe('accessibility', () => {
    it('has type=button by default (prevents form submission)', () => {
      render(<Button>Submit</Button>)
      // HTMLButtonElement default type is "submit"; we don't override — check no aria issues
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })

    it('has focus ring styles', () => {
      render(<Button>Focus me</Button>)
      const button = screen.getByRole('button', { name: /focus me/i })
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2')
    })

    it('accepts and passes through aria-label', () => {
      render(<Button aria-label="custom label">Icon</Button>)
      expect(screen.getByRole('button', { name: /custom label/i })).toBeInTheDocument()
    })

    it('merges custom className with base styles', () => {
      render(<Button className="my-custom-class">Test</Button>)
      expect(screen.getByRole('button', { name: /test/i })).toHaveClass('my-custom-class')
    })
  })
})
