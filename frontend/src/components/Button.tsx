import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Trailing arrow chip that slides on hover. */
  withArrow?: boolean;
  children: React.ReactNode;
}

const Arrow = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="square" />
  </svg>
);

/**
 * The Ledger buttons.
 * - primary: bone paper pill, ink text. One per view.
 * - secondary: hairline outline pill.
 * - tertiary: quiet text button.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  withArrow = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = [
    'group relative inline-flex items-center justify-center cursor-pointer select-none whitespace-nowrap',
    'font-sans font-medium tracking-[-0.005em] touch-manipulation',
    'transition-[background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
    'disabled:cursor-not-allowed disabled:pointer-events-none',
  ].join(' ');

  const variantStyles: Record<ButtonVariant, string> = {
    primary: [
      'rounded-full bg-bone text-ink-950',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(0,0,0,0.18),0_10px_30px_-12px_rgba(0,0,0,0.8)]',
      'hover:bg-white active:scale-[0.98]',
      // Disabled: an empty outline, not a faded fill (a 40%-opacity bone pill reads as muddy grey on ink).
      'disabled:bg-transparent disabled:text-bone-600 disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-bone/15',
    ].join(' '),
    secondary: [
      'rounded-full text-bone border border-bone/20',
      'hover:border-bone/60 hover:bg-bone/[0.04] active:scale-[0.98]',
      'disabled:text-bone-600 disabled:border-bone/10',
    ].join(' '),
    tertiary: 'rounded-full text-bone-400 hover:text-bone hover:bg-bone/[0.05] disabled:text-bone-600',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-[36px] px-[16px] text-[13px] gap-[8px]',
    md: 'h-[44px] px-[20px] text-[15px] gap-[10px]',
    lg: 'h-[56px] px-[28px] text-[16px] gap-[14px]',
  };

  // With an arrow chip the right padding tightens so the chip sits inside the pill.
  const arrowPad: Record<ButtonSize, string> = {
    sm: 'pr-[5px]',
    md: 'pr-[6px]',
    lg: 'pr-[8px]',
  };
  const chipSize: Record<ButtonSize, string> = {
    sm: 'w-[26px] h-[26px]',
    md: 'w-[32px] h-[32px]',
    lg: 'w-[40px] h-[40px]',
  };
  const chipTone = disabled
    ? 'bg-bone/[0.08] text-bone-600'
    : variant === 'primary' ? 'bg-ink-950 text-bone' : 'bg-bone text-ink-950';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${withArrow ? arrowPad[size] : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
      {withArrow && (
        <span
          aria-hidden="true"
          className={`relative grid place-items-center overflow-hidden rounded-full shrink-0 ${chipSize[size]} ${chipTone}`}
        >
          <span className="absolute transition-transform duration-500 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:translate-x-[180%]">
            <Arrow />
          </span>
          <span className="absolute -translate-x-[180%] transition-transform duration-500 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:translate-x-0">
            <Arrow />
          </span>
        </span>
      )}
    </button>
  );
};
