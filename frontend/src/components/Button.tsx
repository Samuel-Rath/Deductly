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
    'relative inline-flex items-center justify-center',
    'font-medium transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-ink-950',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  ].join(' ');

  const variantStyles = {
    // Gradient fill button
    primary: [
      'text-ink-950 font-semibold',
      'bg-gradient-to-r from-gold-700 via-gold-500 to-gold-400',
      'bg-[length:200%_auto] hover:bg-right-center',
      'shadow-soft hover:shadow-glow',
      'hover:scale-[1.02] active:scale-[0.99]',
    ].join(' '),

    // Glass outlined button
    secondary: [
      'text-white glass border border-line-700',
      'hover:border-accent/40 hover:bg-white/[0.04]',
      'active:bg-white/[0.02] active:scale-[0.99]',
    ].join(' '),

    // Ghost text button
    tertiary: [
      'text-slate-400 hover:text-white',
      'active:text-slate-300',
    ].join(' '),
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-small rounded-lg gap-1.5',
    md: 'px-5 py-2.5 text-body rounded-xl gap-2',
    lg: 'px-7 py-3.5 text-h3 rounded-xl gap-2',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
