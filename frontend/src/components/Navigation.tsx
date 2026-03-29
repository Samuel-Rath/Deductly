import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function Navigation() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { path: '/',        label: 'Home'    },
    { path: '/upload',  label: 'Upload'  },
    { path: '/rules',   label: 'Rules'   },
    { path: '/privacy', label: 'Privacy' },
  ]

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="glass border-b border-line-700/60 shadow-soft">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center group" onClick={() => setMenuOpen(false)}>
              <span className="font-display text-lg sm:text-xl font-bold text-gradient tracking-tight">
                Deductly
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={[
                    'relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                    isActive(path)
                      ? 'text-white bg-white/[0.07]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  {label}
                  {isActive(path) && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-px left-2 right-2 h-px rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <Link
              to="/upload"
              className="hidden md:block px-5 py-2 text-sm font-semibold text-ink-950 rounded-xl bg-gradient-brand shadow-soft hover:shadow-glow transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              Get Started
            </Link>

            {/* Mobile: CTA + hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <Link
                to="/upload"
                className="px-4 py-1.5 text-sm font-semibold text-ink-950 rounded-lg bg-gradient-brand shadow-soft"
                onClick={() => setMenuOpen(false)}
              >
                Get Started
              </Link>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                <motion.span
                  animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                  className="block w-5 h-px bg-slate-300 origin-center transition-all"
                />
                <motion.span
                  animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
                  className="block w-5 h-px bg-slate-300"
                />
                <motion.span
                  animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                  className="block w-5 h-px bg-slate-300 origin-center transition-all"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-line-700/60"
            >
              <div className="container mx-auto px-4 py-3 flex flex-col gap-1">
                {navLinks.map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      'px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200',
                      isActive(path)
                        ? 'text-white bg-white/[0.07]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}
