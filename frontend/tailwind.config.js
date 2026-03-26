/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep navy backgrounds — fintech premium
        ink: {
          950: '#03071e',   // body background
          900: '#060d28',   // section backgrounds
          800: '#0c1840',   // card backgrounds
          700: '#152050',   // elevated / hover state
        },
        // Borders
        line: {
          700: '#1b2d5a',   // default borders
          600: '#2a4278',   // hover / focus borders
        },
        // Text
        slate: {
          50:  '#f8fafc',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
        },
        // Accent: indigo (solid fallback for gradient system)
        accent: {
          DEFAULT: '#6366f1',   // indigo-500
          hover:   '#4f46e5',   // indigo-600
          light:   '#818cf8',   // indigo-400
        },
        // Gradient palette stops (used in custom utilities)
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        blue: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display': ['3rem',     { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.03em' }],
        'h1':      ['2rem',     { lineHeight: '1.3', fontWeight: '600' }],
        'h2':      ['1.5rem',   { lineHeight: '1.4', fontWeight: '600' }],
        'h3':      ['1.125rem', { lineHeight: '1.5', fontWeight: '600' }],
        'body':    ['1rem',     { lineHeight: '1.6', fontWeight: '400' }],
        'small':   ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'micro':   ['0.75rem',  { lineHeight: '1.5', fontWeight: '500' }],
      },
      spacing: {
        '1':  '8px',
        '2':  '16px',
        '3':  '24px',
        '4':  '32px',
        '5':  '40px',
        '6':  '48px',
        '8':  '64px',
        '12': '96px',
        '16': '128px',
        '20': '160px',
        '24': '192px',
      },
      backgroundImage: {
        'gradient-brand':      'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #60a5fa 100%)',
        'gradient-card':       'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(59,130,246,0.03) 100%)',
      },
      boxShadow: {
        'soft':        '0 2px 12px rgba(0,0,0,0.25)',
        'soft-lg':     '0 4px 32px rgba(0,0,0,0.35)',
        'glow':        '0 0 24px rgba(99,102,241,0.3)',
        'glow-lg':     '0 0 48px rgba(99,102,241,0.45)',
        'glow-violet': '0 0 32px rgba(124,58,237,0.4)',
        'card':        '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(99,102,241,0.08)',
      },
      borderRadius: {
        'sm':   '6px',
        'md':   '8px',
        'lg':   '12px',
        'xl':   '16px',
        '2xl':  '24px',
        'full': '9999px',
      },
      animation: {
        'shimmer':      'shimmer 2.5s infinite linear',
        'float':        'float 6s ease-in-out infinite',
        'pulse-slow':   'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
