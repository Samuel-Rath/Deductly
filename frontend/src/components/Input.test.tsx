import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders input field', () => {
      render(<Input placeholder="Enter text" />);
      const input = screen.getByPlaceholderText(/enter text/i);
      expect(input).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Username" />);
      const label = screen.getByText(/username/i);
      const input = screen.getByLabelText(/username/i);
      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<Input helperText="Enter your email address" />);
      const helperText = screen.getByText(/enter your email address/i);
      expect(helperText).toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('displays error message', () => {
      render(<Input error="This field is required" />);
      const errorMessage = screen.getByText(/this field is required/i);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('applies error styles to input', () => {
      render(<Input error="Invalid input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not show helper text when error is present', () => {
      render(<Input error="Error message" helperText="Helper text" />);
      expect(screen.getByText(/error message/i)).toBeInTheDocument();
      expect(screen.queryByText(/helper text/i)).not.toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('handles onChange event', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();
      
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');
      expect(handleChange).toHaveBeenCalled();
      expect(input).toHaveValue('test');
    });

    it('respects disabled state', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('keyboard navigation', () => {
    it('is focusable', async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole('textbox');
      
      await user.tab();
      expect(input).toHaveFocus();
    });

    it('shows focus styles when focused', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-accent-secondary');
    });
  });

  describe('accessibility', () => {
    it('associates label with input', () => {
      render(<Input label="Email" id="email-input" />);
      const input = screen.getByLabelText(/email/i);
      expect(input).toHaveAttribute('id', 'email-input');
    });

    it('associates error message with input via aria-describedby', () => {
      render(<Input error="Invalid email" id="email-input" />);
      const input = screen.getByRole('textbox');
      const errorId = input.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();
      expect(screen.getByText(/invalid email/i)).toHaveAttribute('id', errorId);
    });

    it('associates helper text with input via aria-describedby', () => {
      render(<Input helperText="Enter valid email" id="email-input" />);
      const input = screen.getByRole('textbox');
      const helperId = input.getAttribute('aria-describedby');
      expect(helperId).toBeTruthy();
      expect(screen.getByText(/enter valid email/i)).toHaveAttribute('id', helperId);
    });
  });
});
