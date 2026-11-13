import React, { useEffect, useRef } from 'react';

/**
 * Accessible slide-out drawer panel with focus trap and scroll lock.
 *
 * Mirrors Modal's focus-management contract: focus enters the drawer on open
 * and returns to the triggering element on close (WCAG 2.1 §2.4.3).
 * Pressing Escape always closes the drawer.
 */
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
  position = 'right',
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
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const panelBase = 'absolute w-full sm:max-w-md h-full overflow-y-auto shadow-2xl transition-transform duration-300 ease-in-out';
  const panelPos  = position === 'right' ? 'right-0' : 'left-0';

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'drawer-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/75"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        className={`${panelBase} ${panelPos} bg-ink-950 border-l border-bone/[0.1]`}
        tabIndex={-1}
        data-lenis-prevent
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-ink-950/95 border-b border-bone/[0.1] px-[24px] h-[64px] flex items-center justify-between">
          {title && (
            <h2 id="drawer-title" className="font-display text-[24px] leading-none tracking-[-0.02em] text-bone">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto w-[36px] h-[36px] grid place-items-center rounded-full border border-bone/15 text-bone-400 hover:text-bone hover:border-bone/40 transition-colors"
            aria-label="Close drawer"
          >
            <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-[24px]">
          {children}
        </div>
      </div>
    </div>
  );
};
