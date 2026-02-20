import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, BookOpen, Upload } from 'lucide-react'

export default function Navigation() {
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-ink-900/95 backdrop-blur-xl"
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="group">
            <span className="text-2xl font-bold text-white group-hover:text-accent transition-colors">Deductly</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className={`text-base font-medium transition-colors relative ${
                isActive('/') ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Home
              {isActive('/') && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-[21px] left-0 right-0 h-1 bg-accent rounded-full"
                />
              )}
            </Link>
            
            <Link
              to="/upload"
              className={`text-base font-medium transition-colors relative flex items-center gap-2 ${
                isActive('/upload') ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload size={18} />
              Upload
              {isActive('/upload') && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-[21px] left-0 right-0 h-1 bg-accent rounded-full"
                />
              )}
            </Link>
            
            <Link
              to="/rules"
              className={`text-base font-medium transition-colors relative flex items-center gap-2 ${
                isActive('/rules') ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen size={18} />
              Rules
              {isActive('/rules') && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-[21px] left-0 right-0 h-1 bg-accent rounded-full"
                />
              )}
            </Link>
            
            <Link
              to="/privacy"
              className={`text-base font-medium transition-colors relative flex items-center gap-2 ${
                isActive('/privacy') ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield size={18} />
              Privacy
              {isActive('/privacy') && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-[21px] left-0 right-0 h-1 bg-accent rounded-full"
                />
              )}
            </Link>

            {/* CTA Button */}
            <Link
              to="/upload"
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-base font-medium rounded-xl transition-all shadow-soft hover:shadow-soft-lg"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}
