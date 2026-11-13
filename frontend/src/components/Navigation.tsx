import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Logo } from './Logo'

const NAV_LINKS = [
  { path: '/',        label: 'Home'    },
  { path: '/upload',  label: 'Upload'  },
  { path: '/rules',   label: 'Rules'   },
  { path: '/privacy', label: 'Privacy' },
]

export default function Navigation() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Transparent over the hero; solid ink with a hairline once the page moves.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on route change, and lock the page behind it.
  useEffect(() => { setMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'   // SmoothScroll pauses Lenis while this is set
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const solid = scrolled || menuOpen

  return (
    <nav
      aria-label="Main"
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500',
        solid ? 'bg-ink-950/80 backdrop-blur-xl border-b border-bone/[0.08]' : 'bg-transparent border-b border-transparent',
      ].join(' ')}
    >
      <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px]">
        {/* Flex on mobile (centre links are hidden), 3-column grid on desktop so links stay centred */}
        <div className="flex justify-between md:grid md:grid-cols-[1fr_auto_1fr] items-center h-[64px]">

          <Link to="/" aria-label="Deductly home" className="justify-self-start rounded-md">
            <Logo size="sm" />
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-[4px]">
            {NAV_LINKS.map(({ path, label }) => (
              <li key={path}>
                <Link
                  to={path}
                  aria-current={isActive(path) ? 'page' : undefined}
                  className={[
                    'relative inline-flex items-center gap-[8px] px-[14px] h-[36px] rounded-full font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-300',
                    isActive(path) ? 'text-bone' : 'text-bone-400 hover:text-bone',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={`w-[5px] h-[5px] rounded-full bg-brass transition-transform duration-300 ${isActive(path) ? 'scale-100' : 'scale-0'}`}
                  />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="justify-self-end flex items-center gap-[8px]">
            <Link
              to="/upload"
              className="hidden md:inline-flex items-center h-[36px] px-[18px] rounded-full bg-bone text-ink-950 text-[13px] font-medium hover:bg-white transition-colors duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(0,0,0,0.18)]"
            >
              Get Started
            </Link>

            {/* Mobile */}
            <Link
              to="/upload"
              className="md:hidden inline-flex items-center h-[34px] px-[14px] rounded-full bg-bone text-ink-950 text-[13px] font-medium"
            >
              Get Started
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden relative w-[40px] h-[40px] rounded-full border border-bone/15 text-bone grid place-items-center"
            >
              <span aria-hidden="true" className={`absolute h-px w-[16px] bg-current transition-transform duration-300 ${menuOpen ? 'rotate-45' : '-translate-y-[3px]'}`} />
              <span aria-hidden="true" className={`absolute h-px w-[16px] bg-current transition-transform duration-300 ${menuOpen ? '-rotate-45' : 'translate-y-[3px]'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu: full-height editorial list */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            // Explicit height, not bottom-0: the nav's backdrop-filter makes it the
            // containing block for fixed children, so bottom-0 would mean "bottom of the nav".
            className="md:hidden fixed inset-x-0 top-[64px] h-[calc(100dvh-64px)] overflow-y-auto bg-ink-950 border-t border-bone/[0.08]"
          >
            <ul className="px-[20px] pt-[24px]">
              {NAV_LINKS.map(({ path, label }, i) => (
                <motion.li
                  key={path}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                  className="border-b border-bone/[0.08]"
                >
                  <Link
                    to={path}
                    aria-current={isActive(path) ? 'page' : undefined}
                    className="flex items-baseline justify-between py-[18px]"
                  >
                    <span className={`font-display text-[34px] leading-none tracking-[-0.02em] ${isActive(path) ? 'italic text-brass' : 'text-bone'}`}>
                      {label}
                    </span>
                    <span className="font-mono text-[11px] text-bone-600">0{i + 1}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
