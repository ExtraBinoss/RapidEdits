/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep dark background similar to professional editors
        gray: {
          750: '#2d2d3a',
          850: '#1a1a24',
          950: '#0f0f16',
        },
        // Gemini-inspired accents
        gemini: {
          primary: '#4E75FF', // A rough approximation of Gemini Blue
          secondary: '#8E44AD', // Purple accent
          gradient: 'linear-gradient(135deg, #4E75FF 0%, #8E44AD 100%)',
        }
      },
      backgroundImage: {
        'gemini-gradient': 'linear-gradient(to right, #4E75FF, #8E44AD)',
        'gemini-sheen': 'linear-gradient(135deg, rgba(78, 117, 255, 0.1) 0%, rgba(142, 68, 173, 0.1) 100%)',
      }
    },
  },
  plugins: [],
}
