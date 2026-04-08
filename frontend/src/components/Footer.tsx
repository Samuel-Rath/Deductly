import { Link } from 'react-router-dom'

const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="border-t border-line-700/60 bg-ink-950/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-1">
            <span className="font-display text-base font-bold text-gradient tracking-tight">
              Deductly
            </span>
            <p className="text-xs text-slate-500 text-center sm:text-left">
              Australian tax deduction analysis &mdash; not tax advice.
            </p>
          </div>

          {/* Legal links */}
          <nav aria-label="Legal navigation" className="flex items-center gap-5">
            <Link
              to="/privacy"
              className="text-sm text-slate-400 hover:text-white transition-colors duration-150"
            >
              Privacy Policy
            </Link>
            <span className="text-slate-700 select-none">/</span>
            <Link
              to="/terms"
              className="text-sm text-slate-400 hover:text-white transition-colors duration-150"
            >
              Terms of Service
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-slate-600 text-center sm:text-right">
            &copy; {YEAR} Deductly. All rights reserved.
          </p>

        </div>
      </div>
    </footer>
  )
}
