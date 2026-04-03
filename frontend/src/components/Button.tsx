import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = [
    'relative inline-flex items-center justify-center cursor-pointer select-none',
    'font-semibold tracking-[0.025em] transition-all duration-200 touch-manipulation',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  ].join(' ');

  const variantStyles: Record<ButtonVariant, string> = {
    // Premium gradient fill — shimmer shine + layered shadow
    primary: [
      'text-ink-950 overflow-hidden',
      'bg-gradient-brand',
      'shadow-[0_2px_14px_rgba(200,144,10,0.32),inset_0_1px_0_rgba(255,255,255,0.14)]',
      'hover:brightness-[1.08] hover:shadow-[0_4px_24px_rgba(200,144,10,0.52),inset_0_1px_0_rgba(255,255,255,0.18)]',
      'active:scale-[0.97] active:brightness-100',
    ].join(' '),

    // Glass outlined — frosted backdrop, glow on hover
    secondary: [
      'text-white backdrop-blur-sm',
      'bg-white/[0.04] border border-line-700',
      'hover:bg-white/[0.08] hover:border-gold-600/50 hover:shadow-[0_0_22px_rgba(200,144,10,0.18)]',
      'active:scale-[0.98] active:bg-white/[0.03]',
    ].join(' '),

    // Ghost — subtle hover fill, no border
    tertiary: [
      'text-slate-400 hover:text-white rounded-lg',
      'hover:bg-white/[0.05]',
      'active:text-slate-300 active:scale-[0.98]',
    ].join(' '),
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-small rounded-lg gap-1.5 min-h-[36px]',
    md: 'px-5 py-2.5 text-body rounded-xl gap-2 min-h-[44px]',
    lg: 'px-8 py-3.5 text-h3 rounded-xl gap-2.5 min-h-[52px]',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {/* Top-edge shine overlay — gives depth to primary */}
      {variant === 'primary' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/[0.11] to-transparent"
        />
      )}
      {children}
    </button>
  );
};
