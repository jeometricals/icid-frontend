/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        construction: {
          50: '#fef9ee',
          100: '#fef3d6',
          200: '#fce4ac',
          300: '#f9cf77',
          400: '#f6b040',
          500: '#f39619',
          600: '#e47a0f',
          700: '#bd5d0f',
          800: '#974814',
          900: '#7a3c14',
          950: '#421d08',
        },
        safety: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        }
      }
    },
  },
  plugins: [],
}
