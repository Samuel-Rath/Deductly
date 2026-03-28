/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm mahogany-charcoal dark backgrounds
        ink: {
          950: '#0D0B09',   // near-black, warmest
          900: '#171512',   // page body
          800: '#211E1A',   // card surface
          700: '#2C2824',   // elevated / hover
        },
        // Borders — warm brown-grey
        line: {
          700: '#363129',   // default
          600: '#46403A',   // hover / focus
        },
        // Text — warm slate (all pass WCAG AA on ink-900)
        slate: {
          50:  '#FBF7F2',   // warm white        14:1
          300: '#C4BAB0',   // secondary          7.2:1
          400: '#8C8078',   // muted              4.6:1 ✓
          500: '#605850',   // subtle (large text)
        },
        // Primary brand — Jewel Gold
        accent: {
          DEFAULT: '#C8900A',   // brand gold
          hover:   '#A67508',   // deeper on hover
          light:   '#F5C842',   // 10:1 on ink-900 — use for text
        },
        // Gold spectrum — gradients and highlights
        gold: {
          200: '#FEF3C7',
          300: '#FDE68A',
          400: '#F5C842',   // bright jewel gold (use for text)
          500: '#D4970A',   // mid gold
          600: '#C8900A',   // brand gold
          700: '#A67508',   // deep gold
          800: '#7C5606',   // darkest (decorative only)
        },
        // Trust / deep — hero gradients, logo shadows
        trust: {
          900: '#0A0800',
          800: '#130F02',
        },
        // Positive / income
        green: {
          400: '#4ADE80',
          700: '#15803D',
          800: '#166534',
        },
        // Alert / expense
        red: {
          400: '#F87171',
          700: '#DC2626',
          800: '#991B1B',
        },
        // Warning
        amber: {
          400: '#F59E0B',
          500: '#B45309',
        },
        // Charts
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
        'display': ['3rem',     { lineHeight: '1.1',  fontWeight: '700', letterSpacing: '-0.02em' }],
        'h1':      ['2rem',     { lineHeight: '1.3',  fontWeight: '600' }],
        'h2':      ['1.5rem',   { lineHeight: '1.4',  fontWeight: '600' }],
        'h3':      ['1.125rem', { lineHeight: '1.5',  fontWeight: '600' }],
        'body':    ['1rem',     { lineHeight: '1.65', fontWeight: '400' }],  // 1.65 > 1.5 ✓
        'small':   ['0.875rem', { lineHeight: '1.6',  fontWeight: '400' }],
        'micro':   ['0.75rem',  { lineHeight: '1.5',  fontWeight: '500' }],
      },
      // 8px base spacing
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
        // Touch-target helpers
        'touch': '44px',   // min touch target
      },
      backgroundImage: {
        'gradient-brand':      'linear-gradient(135deg, #C8900A 0%, #D4970A 55%, #F5C842 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, #A67508 0%, #C8900A 50%, #F5C842 100%)',
        'gradient-card':       'linear-gradient(135deg, rgba(200,144,10,0.08) 0%, rgba(212,151,10,0.03) 100%)',
        'gradient-positive':   'linear-gradient(135deg, #166534 0%, #15803D 50%, #4ADE80 100%)',
      },
      boxShadow: {
        'soft':        '0 2px 8px rgba(0,0,0,0.45)',
        'soft-lg':     '0 8px 24px rgba(0,0,0,0.55)',
        'glow':        '0 0 16px rgba(200,144,10,0.28)',
        'glow-lg':     '0 0 32px rgba(200,144,10,0.36)',
        'glow-violet': '0 0 20px rgba(212,151,10,0.22)',
        'glow-green':  '0 0 16px rgba(21,128,61,0.22)',
        'card':        '0 1px 4px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.03)',
        // Focus ring — high-visibility amber, meets WCAG 3:1 against dark bg
        'focus-ring':  '0 0 0 3px rgba(245,200,66,0.60)',
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
        'fade-in':      'fadeIn 0.2s ease-out',
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
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
