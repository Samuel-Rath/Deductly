import { Link } from 'react-router-dom'
import { Logo } from './Logo'

const YEAR = new Date().getFullYear()

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/upload', label: 'Analyse a statement' },
      { to: '/rules', label: 'Deduction rules' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink-950 border-t border-bone/[0.08]">
      <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px] pt-[72px] pb-[32px]">
        <div className="grid gap-[48px] md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo size="md" />
            <p className="mt-[20px] max-w-[34ch] text-[15px] leading-[1.6] text-bone-400">
              Australian tax deduction analysis. General information only, not tax advice. Confirm claims with a registered tax agent.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={`${col.title} navigation`} className="md:col-span-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-600 mb-[16px]">{col.title}</h2>
              <ul className="space-y-[10px]">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-[15px] text-bone-200 hover:text-brass transition-colors duration-300">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-[64px] flex flex-col sm:flex-row gap-[8px] justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-bone-600">
          <p>&copy; {YEAR} Deductly. All rights reserved.</p>
          <p>Made for Australian taxpayers</p>
        </div>
      </div>

      {/* Oversized wordmark, cropped by the page edge */}
      <div aria-hidden="true" className="pointer-events-none select-none -mb-[0.22em] px-[12px] text-center">
        <span className="block font-display italic leading-[0.8] tracking-[-0.04em] text-[22vw] text-bone/[0.05]">
          Deductly
        </span>
      </div>
    </footer>
  )
}
