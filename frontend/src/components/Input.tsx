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
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-small text-slate-300 mb-2"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-4 py-2 
          bg-ink-900 text-white 
          border ${error ? 'border-red-500' : 'border-line-700'}
          rounded-input
          focus:outline-none focus:ring-2 focus:ring-accent-secondary focus:border-transparent
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
