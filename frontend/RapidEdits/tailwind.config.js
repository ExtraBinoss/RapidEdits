/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colors (The new requested gradient)
        brand: {
          primary: '#316ea0ff', 
          secondary: '#2a5298',
          accent: '#4facfe', // Lighter accent for hover states
        },
        // Pro "Deep Night" Theme (Not dull gray)
        canvas: {
          DEFAULT: 'var(--color-canvas-default)',
          light: 'var(--color-canvas-light)',
          lighter: 'var(--color-canvas-lighter)',
          border: 'var(--color-canvas-border)',
        },
        text: {
          main: 'var(--color-text-main)',
          muted: 'var(--color-text-muted)',
        }
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        'brand-sheen': 'linear-gradient(135deg, rgba(30, 60, 114, 0.1) 0%, rgba(42, 82, 152, 0.1) 100%)',
      },
      animation: {
        'scale-in': 'scaleIn 0.15s ease-out forwards',
        'fade-in': 'fadeIn 0.15s ease-out forwards',
      },
      keyframes: {
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}