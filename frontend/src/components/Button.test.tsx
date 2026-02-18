import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  describe('variants', () => {
    it('renders primary variant with correct styles', () => {
      render(<Button variant="primary">Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('bg-white', 'text-ink-950');
    });

    it('renders secondary variant with correct styles', () => {
      render(<Button variant="secondary">Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('bg-transparent', 'border', 'border-line-700');
    });

    it('renders tertiary variant with correct styles', () => {
      render(<Button variant="tertiary">Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('bg-transparent', 'text-white');
    });
  });

  describe('sizes', () => {
    it('renders small size correctly', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button', { name: /small/i });
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-small');
    });

    it('renders medium size correctly', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button', { name: /medium/i });
      expect(button).toHaveClass('px-4', 'py-2', 'text-body');
    });

    it('renders large size correctly', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button', { name: /large/i });
      expect(button).toHaveClass('px-6', 'py-3', 'text-h3');
    });
  });

  describe('interactions', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick} disabled>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      
      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('is keyboard accessible', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      
      button.focus();
      expect(button).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled state', () => {
    it('applies disabled styles', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('accessibility', () => {
    it('has proper focus styles', () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole('button', { name: /focus me/i });
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-accent-secondary');
    });
  });
});
