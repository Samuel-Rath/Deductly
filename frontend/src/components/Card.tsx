import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  elevated = false,
  padding = 'md'
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };
  
  return (
    <div
      className={`
        bg-ink-900 
        border border-line-700 
        rounded-xl
        ${elevated ? 'shadow-soft-lg' : 'shadow-soft'}
        ${paddingStyles[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
