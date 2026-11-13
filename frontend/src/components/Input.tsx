import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  // Generate a stable-enough fallback ID so the <label> is always associated with
  // the <input> via htmlFor, which screen readers require. Callers should prefer
  // passing an explicit id when the component appears more than once on a page.
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={inputId}
          className="block font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 mb-[8px]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full h-[48px] px-[16px]
          bg-transparent text-bone
          border ${error ? 'border-red-500' : 'border-bone/[0.15] hover:border-bone/30'}
          rounded-[4px]
          focus:outline-none focus:ring-2 focus:ring-brass focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          placeholder:text-slate-500
          transition-all duration-200
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p 
          id={`${inputId}-error`}
          className="mt-1 text-small text-red-500 flex items-center gap-1"
          role="alert"
        >
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p 
          id={`${inputId}-helper`}
          className="mt-1 text-small text-slate-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
};
