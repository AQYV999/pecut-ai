/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html,css}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0d14',
          subtle: '#121620',
          dark: '#07090e',
        },
        surface: {
          DEFAULT: '#111520',
          hover: '#181e2e',
          border: '#1f2639',
          'border-subtle': '#161c2b',
        },
        navy: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd3ff',
          300: '#8eb9ff',
          400: '#5894ff',
          500: '#1d4ed8', // classic navy/blue
          600: '#1e40af', // deep navy accent
          700: '#1d357d', // dark navy
          800: '#17275c',
          900: '#0f1738',
          950: '#090d24',
        },
        accent: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          subtle: 'rgba(37, 99, 235, 0.12)',
          glow: 'rgba(37, 99, 235, 0.22)',
        },
        text: {
          primary: '#e8edf5',
          secondary: '#94a3b8',
          tertiary: '#64748b',
        }
      },
      fontFamily: {
        sans: ['Lato', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'navy-sm': '0 2px 8px -1px rgba(15, 23, 56, 0.4)',
        'navy-md': '0 4px 16px -2px rgba(15, 23, 56, 0.5)',
        'navy-glow': '0 0 20px -3px rgba(37, 99, 235, 0.3)',
      }
    },
  },
  plugins: [],
}
