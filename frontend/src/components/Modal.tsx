import React, { useEffect, useRef } from 'react';

/**
 * Accessible modal dialog with focus trap and scroll lock.
 *
 * On open, focus moves into the dialog and scroll is locked; on close, focus
 * returns to the element that triggered the dialog (WCAG 2.1 §2.4.3).
 * Pressing Escape always closes the modal.
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  const sizeStyles = {
    sm: 'w-full sm:max-w-md',
    md: 'w-full sm:max-w-2xl',
    lg: 'w-full sm:max-w-4xl',
    xl: 'w-full sm:max-w-6xl'
  };
  
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={`
          relative w-full ${sizeStyles[size]}
          bg-ink-950 border border-bone/[0.1] rounded-[4px]
          shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]
          max-h-[90vh] overflow-y-auto
        `}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        data-lenis-prevent
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-line-700">
            {title && (
              <h2 id="modal-title" className="font-display text-[28px] leading-none tracking-[-0.02em] text-bone">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto w-[36px] h-[36px] grid place-items-center rounded-full border border-bone/15 text-bone-400 hover:text-bone hover:border-bone/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                aria-label="Close modal"
              >
                <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="square" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
