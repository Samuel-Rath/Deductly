import React from 'react';

export type ChipVariant = 'category' | 'confidence' | 'flag' | 'neutral' | 'accent';
export type ChipSize = 'sm' | 'md' | 'small';

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  selected?: boolean;
  confidence?: number;
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
  onClick,
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200';

  const sizeStyles = {
    sm:    'px-2.5 py-0.5 text-micro',
    md:    'px-3 py-1 text-small',
    small: 'px-2.5 py-0.5 text-micro',
  };

  const variantStyles = {
    category: selected
      ? 'bg-accent/20 text-accent-light border border-accent/50'
      : 'bg-ink-700/60 text-slate-300 border border-line-700 hover:border-line-600',
    confidence: 'bg-ink-700/60 text-slate-300 border border-line-700',
    flag:    'bg-ink-700/60 text-slate-400 border border-line-700',
    neutral: 'bg-ink-700/60 text-slate-300 border border-line-700',
    accent:  'bg-accent/10 text-accent-light border border-accent/30',
  };

  const interactiveStyles = onClick ? 'cursor-pointer hover:bg-ink-700' : '';

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
          <span className="w-10 h-1.5 bg-ink-700 rounded-full overflow-hidden">
            <span
              className="block h-full bg-gradient-to-r from-gold-700 to-gold-400 transition-all duration-300"
              style={{ width: `${confidence * 100}%` }}
            />
          </span>
          <span className="text-micro text-slate-500">{Math.round(confidence * 100)}%</span>
        </span>
      )}
    </span>
  );
};
