import React from 'react';

export type ChipVariant = 'category' | 'confidence' | 'flag';
export type ChipSize = 'sm' | 'md';

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  selected?: boolean;
  confidence?: number; // 0-1 for confidence variant
  className?: string;
  onClick?: () => void;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'category',
  size = 'md',
  selected = false,
  confidence,
  className = '',
  onClick
}) => {
  const baseStyles = 'inline-flex items-center gap-2 rounded-pill transition-all duration-200';
  
  const sizeStyles = {
    sm: 'px-2 py-1 text-micro',
    md: 'px-3 py-1.5 text-small'
  };
  
  const variantStyles = {
    category: selected 
      ? 'bg-accent-secondary text-ink-950 border border-accent-secondary'
      : 'bg-transparent text-slate-300 border border-line-700 hover:border-slate-500',
    confidence: 'bg-transparent text-slate-300 border border-line-700',
    flag: 'bg-ink-800 text-slate-300 border border-line-700'
  };
  
  const interactiveStyles = onClick ? 'cursor-pointer hover:bg-ink-800' : '';
  
  return (
    <span
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${interactiveStyles} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <span>{label}</span>
      {variant === 'confidence' && confidence !== undefined && (
        <span className="flex items-center gap-1">
          <span className="w-12 h-1.5 bg-ink-800 rounded-full overflow-hidden">
            <span 
              className="block h-full bg-accent-secondary transition-all duration-300"
              style={{ width: `${confidence * 100}%` }}
            />
          </span>
          <span className="text-micro text-slate-500">{Math.round(confidence * 100)}%</span>
        </span>
      )}
    </span>
  );
};
