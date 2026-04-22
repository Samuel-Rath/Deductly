import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children content', () => {
    render(
      <Card>
        <p>Card content</p>
      </Card>
    );
    expect(screen.getByText(/card content/i)).toBeInTheDocument();
  });

  it('applies base styles', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    // Card uses glass + rounded-xl + border
    expect(card).toHaveClass('glass', 'rounded-xl', 'border');
  });

  it('applies elevated style when elevated prop is true', () => {
    const { container } = render(<Card elevated>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('shadow-soft-lg');
  });

  it('does not apply elevated shadow by default', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).not.toHaveClass('shadow-soft-lg');
  });

  describe('padding variants', () => {
    it('applies no padding when padding is "none"', () => {
      const { container } = render(<Card padding="none">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveClass('p-4', 'p-6', 'p-8');
    });

    it('applies small padding when padding is "sm"', () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      const card = container.firstChild as HTMLElement;
      // Responsive: tighter on mobile, larger on sm+ breakpoints
      expect(card).toHaveClass('p-3', 'sm:p-4');
    });

    it('applies medium padding by default', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('p-4', 'sm:p-6');
    });

    it('applies large padding when padding is "lg"', () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('p-5', 'sm:p-8');
    });
  });

  it('accepts custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('custom-class');
  });

  it('applies glow styles when glow prop is true', () => {
    const { container } = render(<Card glow>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('shadow-glow');
  });
});
