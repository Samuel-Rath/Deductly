import React from 'react'

/**
 * Editorial page opener used by every inner page: a mono index label, a
 * Bodoni headline (optionally followed by an italic brass phrase), a lead
 * paragraph, and a hairline rule.
 *
 * `title` is rendered as the heading's own text node so tests and screen
 * readers see it intact; `accent` follows it as a separate <em>.
 */
export function PageHeader({
  index,
  label,
  title,
  accent,
  lead,
  aside,
}: {
  index: string
  label: string
  title: string
  accent?: string
  lead?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <header className="pt-[120px] sm:pt-[144px] pb-[40px] sm:pb-[56px]">
      <p className="flex items-center gap-[12px] font-mono text-[11px] uppercase tracking-[0.18em] text-bone-400">
        <span className="text-brass">({index})</span>
        {label}
      </p>
      <div className="mt-[20px] flex flex-col lg:flex-row lg:items-end lg:justify-between gap-[24px]">
        <div>
          <h1 className="font-display font-normal text-bone text-[44px] sm:text-[60px] lg:text-[72px] leading-[0.98] tracking-[-0.032em]">
            {title}
            {accent && <> <em className="text-brass">{accent}</em></>}
          </h1>
          {lead && (
            <p className="mt-[20px] max-w-[52ch] text-[17px] leading-[1.6] text-bone-400">{lead}</p>
          )}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className="rule mt-[40px] sm:mt-[48px]" />
    </header>
  )
}
