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
  const baseStyles = 'font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-secondary focus:ring-offset-2 focus:ring-offset-ink-950 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-white text-ink-950 hover:bg-slate-300 active:bg-slate-500',
    secondary: 'bg-transparent text-white border border-line-700 hover:border-slate-500 hover:bg-ink-800 active:bg-ink-900',
    tertiary: 'bg-transparent text-white hover:text-slate-300 active:text-slate-500'
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-small rounded-input',
    md: 'px-4 py-2 text-body rounded-input',
    lg: 'px-6 py-3 text-h3 rounded-input'
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
