import React, { useEffect, useRef } from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'right'
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      drawerRef.current?.focus();
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
  
  const positionStyles = position === 'right' 
    ? 'right-0 translate-x-full' 
    : 'left-0 -translate-x-full';
  
  const openStyles = position === 'right'
    ? 'translate-x-0'
    : 'translate-x-0';
  
  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'drawer-title' : undefined}
    >
      <div
        className="absolute inset-0 bg-black bg-opacity-75"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className={`
          absolute ${positionStyles}
          ${isOpen ? openStyles : ''}
          w-full max-w-md h-full
          bg-ink-900 border-l border-line-700
          shadow-2xl
          transition-transform duration-300 ease-in-out
          overflow-y-auto
        `}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between p-6 border-b border-line-700">
          {title && (
            <h2 id="drawer-title" className="text-h2 font-semibold">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-accent-secondary rounded"
            aria-label="Close drawer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
