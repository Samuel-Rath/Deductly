import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.queryByText(/modal content/i)).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText(/modal content/i)).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByText(/test modal/i)).toBeInTheDocument();
  });

  describe('closing behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test">
          <p>Content</p>
        </Modal>
      );
      
      const closeButton = screen.getByLabelText(/close modal/i);
      await user.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose}>
          <p>Content</p>
        </Modal>
      );
      
      // Click the backdrop (the outer div with bg-black bg-opacity-75)
      const backdrop = container.querySelector('.bg-black.bg-opacity-75');
      if (backdrop) {
        await user.click(backdrop);
        expect(handleClose).toHaveBeenCalledTimes(1);
      }
    });

    it('does not close when modal content is clicked', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <p>Content</p>
        </Modal>
      );
      
      const content = screen.getByText(/content/i);
      await user.click(content);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <p>Content</p>
        </Modal>
      );
      
      await user.keyboard('{Escape}');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('size variants', () => {
    it('renders small size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          <p>Content</p>
        </Modal>
      );
      const modal = container.querySelector('.max-w-md');
      expect(modal).toBeInTheDocument();
    });

    it('renders medium size by default', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      const modal = container.querySelector('.max-w-2xl');
      expect(modal).toBeInTheDocument();
    });

    it('renders large size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          <p>Content</p>
        </Modal>
      );
      const modal = container.querySelector('.max-w-4xl');
      expect(modal).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper dialog role', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('associates title with dialog via aria-labelledby', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Content</p>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(screen.getByText(/test modal/i)).toHaveAttribute('id', 'modal-title');
    });

    it('prevents body scroll when open', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('close button visibility', () => {
    it('shows close button by default', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Modal>
      );
      expect(screen.getByLabelText(/close modal/i)).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} showCloseButton={false}>
          <p>Content</p>
        </Modal>
      );
      expect(screen.queryByLabelText(/close modal/i)).not.toBeInTheDocument();
    });
  });
});
