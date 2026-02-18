import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does not render when isOpen is false', () => {
    render(
      <Drawer isOpen={false} onClose={() => {}}>
        <p>Drawer content</p>
      </Drawer>
    );
    expect(screen.queryByText(/drawer content/i)).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <Drawer isOpen={true} onClose={() => {}}>
        <p>Drawer content</p>
      </Drawer>
    );
    expect(screen.getByText(/drawer content/i)).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Drawer isOpen={true} onClose={() => {}} title="Test Drawer">
        <p>Content</p>
      </Drawer>
    );
    expect(screen.getByText(/test drawer/i)).toBeInTheDocument();
  });

  describe('closing behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      
      render(
        <Drawer isOpen={true} onClose={handleClose} title="Test">
          <p>Content</p>
        </Drawer>
      );
      
      const closeButton = screen.getByLabelText(/close drawer/i);
      await user.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      
      render(
        <Drawer isOpen={true} onClose={handleClose}>
          <p>Content</p>
        </Drawer>
      );
      
      const backdrop = screen.getByRole('dialog').previousElementSibling;
      if (backdrop) {
        await user.click(backdrop);
        expect(handleClose).toHaveBeenCalledTimes(1);
      }
    });

    it('calls onClose when Escape key is pressed', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      
      render(
        <Drawer isOpen={true} onClose={handleClose}>
          <p>Content</p>
        </Drawer>
      );
      
      await user.keyboard('{Escape}');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('position', () => {
    it('renders on right side by default', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Drawer>
      );
      const drawer = container.querySelector('.right-0');
      expect(drawer).toBeInTheDocument();
    });

    it('renders on left side when position is left', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={() => {}} position="left">
          <p>Content</p>
        </Drawer>
      );
      const drawer = container.querySelector('.left-0');
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper dialog role', () => {
      render(
        <Drawer isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Drawer>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <Drawer isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Drawer>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('associates title with drawer via aria-labelledby', () => {
      render(
        <Drawer isOpen={true} onClose={() => {}} title="Test Drawer">
          <p>Content</p>
        </Drawer>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'drawer-title');
      expect(screen.getByText(/test drawer/i)).toHaveAttribute('id', 'drawer-title');
    });

    it('prevents body scroll when open', () => {
      const { rerender } = render(
        <Drawer isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Drawer>
      );
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(
        <Drawer isOpen={false} onClose={() => {}}>
          <p>Content</p>
        </Drawer>
      );
      expect(document.body.style.overflow).toBe('');
    });

    it('has close button with proper aria-label', () => {
      render(
        <Drawer isOpen={true} onClose={() => {}}>
          <p>Content</p>
        </Drawer>
      );
      const closeButton = screen.getByLabelText(/close drawer/i);
      expect(closeButton).toBeInTheDocument();
    });
  });
});
