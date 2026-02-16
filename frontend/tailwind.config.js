/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0A0A0A',
          900: '#111111',
          800: '#1A1A1A',
        },
        line: {
          700: '#2A2A2A',
        },
        slate: {
          500: '#8A8A8A',
          300: '#CFCFCF',
        },
        accent: {
          primary: '#FFFFFF',
          secondary: '#9BB2FF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'display': ['40px', { lineHeight: '1.2', fontWeight: '600' }],
        'h1': ['32px', { lineHeight: '1.3', fontWeight: '600' }],
        'h2': ['24px', { lineHeight: '1.4', fontWeight: '600' }],
        'h3': ['18px', { lineHeight: '1.5', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'small': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'micro': ['12px', { lineHeight: '1.5', fontWeight: '500' }],
      },
      spacing: {
        '18': '4.5rem',
      },
      borderRadius: {
        'card': '16px',
        'input': '12px',
        'pill': '999px',
      }
    },
  },
  plugins: [],
}
