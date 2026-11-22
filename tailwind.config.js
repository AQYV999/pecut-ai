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
          DEFAULT: '#101115',
          raised: '#15171d',
          sunken: '#0b0c0e',
        },
        surface: {
          DEFAULT: '#13151b',
          hover: '#191c24',
          border: 'rgba(242, 241, 238, 0.12)',
          'border-strong': 'rgba(242, 241, 238, 0.28)',
          'border-subtle': 'rgba(242, 241, 238, 0.07)',
        },
        ink: {
          DEFAULT: '#ecebe8',
          strong: '#ffffff',
          muted: 'rgba(236, 235, 232, 0.62)',
          faint: 'rgba(236, 235, 232, 0.38)',
        },
        line: {
          DEFAULT: 'rgba(242, 241, 238, 0.12)',
          strong: 'rgba(242, 241, 238, 0.28)',
          subtle: 'rgba(242, 241, 238, 0.07)',
        },
        accent: {
          DEFAULT: '#2563eb', // navy/cobalt precision
          hover: '#1d4ed8',
          ink: '#74aaff',
          subtle: 'rgba(37, 99, 235, 0.14)',
          glow: 'rgba(37, 99, 235, 0.28)',
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
