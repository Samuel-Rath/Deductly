/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark backgrounds
        ink: {
          950: '#0a0a0f',
          900: '#13131a',
          800: '#1c1c26',
        },
        // Borders
        line: {
          700: '#2d2d3a',
        },
        // Text colors
        slate: {
          50: '#f8fafc',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
        },
        // Single accent color
        accent: {
          DEFAULT: '#06b6d4', // Cyan-500
          hover: '#0891b2',   // Cyan-600
          light: '#22d3ee',   // Cyan-400
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display': ['3rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        'h1': ['2rem', { lineHeight: '1.3', fontWeight: '600' }],
        'h2': ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        'h3': ['1.125rem', { lineHeight: '1.5', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'small': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'micro': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],
      },
      // 8px spacing system
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
        '6': '48px',
        '8': '64px',
        '12': '96px',
        '16': '128px',
        '20': '160px',
        '24': '192px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'full': '9999px',
      },
    },
  },
  plugins: [],
}
