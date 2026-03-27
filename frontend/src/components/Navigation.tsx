import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Navigation() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

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
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center group">
              <span className="font-display text-xl font-bold text-gradient tracking-tight">
                Deductly
              </span>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-1">
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

            {/* CTA */}
            <Link
              to="/upload"
              className="px-5 py-2 text-sm font-semibold text-ink-950 rounded-xl bg-gradient-brand shadow-soft hover:shadow-glow transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}
