/**
 * Deductly brand mark: a disc with one slice lifted out of it, the share of
 * what you spent that comes back at tax time. The disc takes `currentColor`;
 * the lifted slice is always brass.
 */
export function LogoMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      {/* Disc minus a 60° wedge (from -60° to 0°) */}
      <path d="M12 12 L22 12 A10 10 0 1 1 17 3.34 Z" fill="currentColor" />
      {/* The wedge, lifted outward along its bisector */}
      <path
        data-logo-slice
        d="M12 12 L17 3.34 A10 10 0 0 1 22 12 Z"
        fill="#D9A441"
        transform="translate(1.7 -1)"
      />
    </svg>
  )
}

/** Mark + wordmark lockup. */
export function Logo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = {
    sm: { mark: 18, text: 'text-[17px]', gap: 'gap-[8px]' },
    md: { mark: 22, text: 'text-[21px]', gap: 'gap-[10px]' },
    lg: { mark: 30, text: 'text-[28px]', gap: 'gap-[12px]' },
  }[size]
  return (
    <span className={`inline-flex items-center ${s.gap} text-bone ${className}`}>
      <LogoMark size={s.mark} />
      <span className={`font-display font-medium tracking-[-0.02em] leading-none ${s.text}`}>Deductly</span>
    </span>
  )
}
