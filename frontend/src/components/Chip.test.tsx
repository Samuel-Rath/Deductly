import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders label text', () => {
    render(<Chip label="Test Label" />);
    expect(screen.getByText(/test label/i)).toBeInTheDocument();
  });

  describe('variants', () => {
    it('renders category variant with default styles', () => {
      const { container } = render(<Chip label="Category" variant="category" />);
      const chip = container.firstChild as HTMLElement;
      expect(chip).toHaveClass('bg-transparent', 'border-line-700');
    });

    it('renders selected category variant', () => {
      const { container } = render(<Chip label="Category" variant="category" selected />);
      const chip = container.firstChild as HTMLElement;
      expect(chip).toHaveClass('bg-accent-secondary', 'text-ink-950');
    });

    it('renders confidence variant', () => {
      const { container } = render(<Chip label="High" variant="confidence" confidence={0.85} />);
      const chip = container.firstChild as HTMLElement;
      expect(chip).toHaveClass('bg-transparent', 'border-line-700');
    });

    it('renders flag variant', () => {
      const { container } = render(<Chip label="Method Required" variant="flag" />);
      const chip = container.firstChild as HTMLElement;
      expect(chip).toHaveClass('bg-ink-800', 'border-line-700');
    });
  });

  describe('confidence display', () => {
    it('shows confidence meter and percentage', () => {
      render(<Chip label="Confidence" variant="confidence" confidence={0.75} />);
      expect(screen.getByText(/75%/i)).toBeInTheDocument();
    });

    it('does not show confidence meter for non-confidence variants', () => {
      render(<Chip label="Category" variant="category" confidence={0.75} />);
      expect(screen.queryByText(/75%/i)).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders small size', () => {
      const { container } = render(<Chip label="Small" size="sm" />);
      const chip = container.firstChild as HTMLElement;
      expect(chip).toHaveClass('px-2', 'py-1', 'text-micro');
    });

    it('renders medium size by default', () => {
      const { container } = render(<Chip label="Medium" />);
      const chip = container.firstChild as HTMLElement;
      expect(chip).toHaveClass('px-3', 'py-1.5', 'text-small');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Chip label="Clickable" onClick={handleClick} />);
      const chip = screen.getByRole('button', { name: /clickable/i });
      
      await user.click(chip);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is keyboard accessible with Enter key', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Chip label="Clickable" onClick={handleClick} />);
      const chip = screen.getByRole('button', { name: /clickable/i });
      
      chip.focus();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is keyboard accessible with Space key', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Chip label="Clickable" onClick={handleClick} />);
      const chip = screen.getByRole('button', { name: /clickable/i });
      
      chip.focus();
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not have button role when not clickable', () => {
      render(<Chip label="Static" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has tabIndex when clickable', () => {
      render(<Chip label="Clickable" onClick={() => {}} />);
      const chip = screen.getByRole('button');
      expect(chip).toHaveAttribute('tabIndex', '0');
    });

    it('does not have tabIndex when not clickable', () => {
      const { container } = render(<Chip label="Static" />);
      const chip = container.firstChild as HTMLElement;
      expect(chip).not.toHaveAttribute('tabIndex');
    });
  });
});
