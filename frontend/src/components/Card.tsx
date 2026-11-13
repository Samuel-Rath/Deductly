import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Brass hairline instead of the neutral one, for the card that matters most. */
  glow?: boolean;
}

/** The Ledger card: a flat ink panel with a hairline edge. No glass, no glow. */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  elevated = false,
  padding = 'md',
  glow = false,
}) => {
  const paddingStyles = {
    none: '',
    sm:   'p-3 sm:p-4',
    md:   'p-4 sm:p-6',
    lg:   'p-5 sm:p-8',
  };

  return (
    <div
      className={[
        'relative rounded-[4px] border bg-ink-900 transition-colors duration-300',
        glow ? 'border-brass/40' : 'border-bone/[0.09] hover:border-bone/[0.16]',
        elevated ? 'shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]' : '',
        paddingStyles[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};
