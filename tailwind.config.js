/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html,css}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '2px',
        md: '2px',
        lg: '2px',
        xl: '2px',
        '2xl': '2px',
        full: '9999px',
      },
      colors: {
        bg: {
          DEFAULT: '#0c0e12',
          raised: '#111318',
          sunken: '#08090c',
        },
        surface: {
          DEFAULT: '#111318',
          hover: '#161820',
          border: 'rgba(242, 241, 238, 0.11)',
          'border-strong': 'rgba(242, 241, 238, 0.25)',
          'border-subtle': 'rgba(242, 241, 238, 0.06)',
        },
        ink: {
          DEFAULT: '#ecebe8',
          strong: '#ffffff',
          muted: 'rgba(236, 235, 232, 0.68)',
          faint: 'rgba(236, 235, 232, 0.42)',
        },
        line: {
          DEFAULT: 'rgba(242, 241, 238, 0.11)',
          strong: 'rgba(242, 241, 238, 0.25)',
          subtle: 'rgba(242, 241, 238, 0.06)',
        },
        accent: {
          DEFAULT: '#173878', // Deep Industrial Navy
          hover: '#122c60',
          ink: '#5b8ae8',
          subtle: 'rgba(23, 56, 120, 0.22)',
          glow: 'rgba(23, 56, 120, 0.35)',
        },
      },
      fontFamily: {
        sans: ['Lato', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Lato', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      letterSpacing: {
        hud: '0.14em',
      },
    },
  },
  plugins: [],
}
