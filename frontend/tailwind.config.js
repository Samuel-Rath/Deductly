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
          950: '#0B0A08',   // near-black, warmest
          900: '#12100D',   // page body / card surface
          800: '#1A1714',   // inset surface (tracks, inputs)
          700: '#24201C',   // elevated / hover
        },
        // Borders — warm brown-grey
        line: {
          700: '#2A2622',   // default hairline (about bone at 10% on ink)
          600: '#3D3832',   // hover / focus
        },
        // The Ledger — paper, brass and pen ink
        bone: {
          DEFAULT: '#EFE8DC',  // paper / primary text on ink   15:1
          200:     '#E2D9C9',
          400:     '#A79D8F',  // secondary text on ink-950     7.4:1
          600:     '#6E665B',  // tertiary / captions (large)   3.6:1
        },
        brass: {
          DEFAULT: '#D9A441',  // single accent
          light:   '#EBC57A',
          deep:    '#9C7124',
        },
        highlighter: '#F2D35C',
        penink:      '#8E2F1C',  // red-brown pen used on the statement
        // Text — warm slate (all pass WCAG AA on ink-900)
        slate: {
          50:  '#EFE8DC',   // = bone
          300: '#D3CABB',   // secondary text   12:1 on ink-950
          400: '#A79D8F',   // muted            7.4:1
          500: '#6E665B',   // subtle / captions 3.6:1 (large or decorative)
          600: '#4A443D',   // low-confidence bar fill
        },
        // Legacy accent keys, re-pointed at brass (The Ledger)
        accent: {
          DEFAULT: '#D9A441',
          hover:   '#9C7124',
          light:   '#EBC57A',
        },
        // Gold spectrum — gradients and highlights
        gold: {
          200: '#FEF3C7',
          300: '#FDE68A',
          400: '#EBC57A',   // brass light (text)
          500: '#D9A441',   // brass
          600: '#C08F35',
          700: '#9C7124',   // deep brass
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
        sans:    ['Schibsted Grotesk', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Bodoni Moda', 'Didot', 'Georgia', 'serif'],
        mono:    ['IBM Plex Mono', 'ui-monospace', 'Menlo', 'monospace'],
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
        'gradient-brand':      'linear-gradient(90deg, #9C7124 0%, #D9A441 100%)',
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
