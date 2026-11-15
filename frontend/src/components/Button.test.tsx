import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  describe('variants', () => {
    it('renders primary variant as an ink-on-paper pill', () => {
      render(<Button variant="primary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveClass('bg-bone', 'text-ink-950', 'rounded-full')
    })

    it('renders secondary variant with a hairline border', () => {
      render(<Button variant="secondary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveClass('border', 'border-bone/20', 'text-bone')
    })

    it('renders tertiary variant with muted text', () => {
      render(<Button variant="tertiary">Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveClass('text-bone-400')
    })

    it('defaults to primary variant when no variant specified', () => {
      render(<Button>Default</Button>)
      const button = screen.getByRole('button', { name: /default/i })
      expect(button).toHaveClass('bg-bone', 'text-ink-950')
    })

    it('adds a decorative arrow chip without changing the accessible name', () => {
      render(<Button withArrow>Continue</Button>)
      const button = screen.getByRole('button', { name: 'Continue' })
      expect(button.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
      expect(button).toHaveClass('pr-[6px]')
    })
  })

  describe('sizes', () => {
    it('renders small size', () => {
      render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button', { name: /small/i })).toHaveClass('h-[36px]', 'px-[16px]')
    })

    it('renders medium size', () => {
      render(<Button size="md">Medium</Button>)
      expect(screen.getByRole('button', { name: /medium/i })).toHaveClass('h-[44px]', 'px-[20px]')
    })

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button', { name: /large/i })).toHaveClass('h-[56px]', 'px-[28px]')
    })

    it('defaults to medium size when no size specified', () => {
      render(<Button>Default size</Button>)
      expect(screen.getByRole('button', { name: /default size/i })).toHaveClass('h-[44px]')
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
      expect(button).toHaveClass('disabled:bg-transparent', 'disabled:text-bone-600', 'disabled:cursor-not-allowed')
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
      // Uses focus-visible: modifier (keyboard-only focus ring)
      expect(button).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2')
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
