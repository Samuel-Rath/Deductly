/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm charcoal dark backgrounds (dark mode as default)
        ink: {
          950: '#0C0E12',   // deepest background
          900: '#111318',   // body / section background
          800: '#1C2028',   // card surface
          700: '#242A35',   // elevated / hover state
        },
        // Borders — warm-tinted dark
        line: {
          700: '#2A2D38',   // default borders
          600: '#3A3F52',   // hover / focus borders
        },
        // Text — slightly warm slate
        slate: {
          50:  '#F4F1EC',
          300: '#C8C2B8',
          400: '#958E82',
          500: '#605A50',
        },
        // Primary brand accent — Warm Gold
        accent: {
          DEFAULT: '#B8860B',   // aged ledger gold
          hover:   '#9A6E09',   // deeper on hover
          light:   '#F0C04A',   // bright gold for text on dark bg
        },
        // Deep Trust — hero gradients, shadows
        trust: {
          900: '#0A0800',
          800: '#140F02',
        },
        // Gold spectrum — gradients and highlights
        gold: {
          300: '#F5D87A',
          400: '#F0C04A',
          500: '#D4970A',
          600: '#B8860B',
          700: '#9A6E09',
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
        sans:    ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
        mono:    ['Space Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        'display': ['3rem',     { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
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
        'gradient-brand':      'linear-gradient(135deg, #B8860B 0%, #D4970A 55%, #F0C04A 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, #9A6E09 0%, #B8860B 50%, #F0C04A 100%)',
        'gradient-card':       'linear-gradient(135deg, rgba(184,134,11,0.08) 0%, rgba(212,151,10,0.03) 100%)',
        'gradient-positive':   'linear-gradient(135deg, #166534 0%, #15803D 50%, #4ADE80 100%)',
      },
      boxShadow: {
        'soft':        '0 2px 8px rgba(0,0,0,0.40)',
        'soft-lg':     '0 8px 24px rgba(0,0,0,0.50)',
        'glow':        '0 0 16px rgba(184,134,11,0.22)',
        'glow-lg':     '0 0 32px rgba(184,134,11,0.28)',
        'glow-violet': '0 0 20px rgba(212,151,10,0.18)',
        'glow-green':  '0 0 16px rgba(21,128,61,0.2)',
        'card':        '0 1px 4px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)',
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
