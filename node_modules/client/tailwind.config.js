/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 60px rgba(116, 93, 255, 0.35)',
      },
      colors: {
        panel: 'rgba(18, 20, 45, 0.72)'
      }
    },
  },
  plugins: [],
}
