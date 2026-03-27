/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Banking dark backgrounds (dark mode as default)
        ink: {
          950: '#0D1424',   // deepest background
          900: '#0F172A',   // body / section background
          800: '#1E2937',   // card surface
          700: '#243447',   // elevated / hover state
        },
        // Borders — desaturated so cards don't glow blue
        line: {
          700: '#1F2D3D',   // default borders (near-neutral dark)
          600: '#2A3F54',   // hover / focus borders
        },
        // Text
        slate: {
          50:  '#F1F5F9',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
        },
        // Primary brand accent — Corporate Blue
        accent: {
          DEFAULT: '#1E40AF',   // corporate blue
          hover:   '#1434A0',   // deeper on hover
          light:   '#60A5FA',   // bright blue for text on dark bg
        },
        // Deep Trust Blue — hero gradients, logo, CTA shadows
        trust: {
          900: '#0A2540',
          800: '#0D3060',
        },
        // Blue spectrum — gradients and chart lines
        blue: {
          400: '#93C5FD',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        // Positive / income / growth
        green: {
          400: '#4ADE80',
          700: '#15803D',
          800: '#166534',
        },
        // Negative / expense / alert
        red: {
          400: '#F87171',
          700: '#B91C1C',
          800: '#991B1B',
        },
        // Warning — credit card / mid-risk
        amber: {
          400: '#F59E0B',
          500: '#B45309',
        },
        // Chart category — loans / other
        teal: {
          400: '#2DD4BF',
          600: '#0F766E',
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
        'gradient-brand':      'linear-gradient(135deg, #1E40AF 0%, #2563EB 55%, #3B82F6 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #60A5FA 100%)',
        'gradient-card':       'linear-gradient(135deg, rgba(30,64,175,0.08) 0%, rgba(59,130,246,0.03) 100%)',
        'gradient-positive':   'linear-gradient(135deg, #166534 0%, #15803D 50%, #4ADE80 100%)',
      },
      boxShadow: {
        'soft':        '0 2px 8px rgba(0,0,0,0.35)',
        'soft-lg':     '0 8px 24px rgba(0,0,0,0.45)',
        'glow':        '0 0 16px rgba(30,64,175,0.18)',
        'glow-lg':     '0 0 32px rgba(30,64,175,0.22)',
        'glow-violet': '0 0 20px rgba(37,99,235,0.16)',
        'glow-green':  '0 0 16px rgba(21,128,61,0.2)',
        'card':        '0 1px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
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
