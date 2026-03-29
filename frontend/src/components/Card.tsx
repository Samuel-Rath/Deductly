import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  glow?: boolean;
}

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
        'glass rounded-xl border transition-all duration-200',
        glow
          ? 'border-accent/30 shadow-glow'
          : 'border-line-700 hover:border-line-600',
        elevated ? 'shadow-soft-lg' : 'shadow-card',
        paddingStyles[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};
