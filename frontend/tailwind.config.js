/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1917',
        brand: {
          50: '#fff4ed',
          100: '#ffedd5',
          200: '#fed7aa',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        surface: {
          cream: '#fffbf5',
          warm: '#fef3e2',
        },
      },
      maxWidth: {
        page: '90rem',
      },
      boxShadow: {
        glow: '0 0 60px -12px rgba(251, 146, 60, 0.35)',
      },
    },
  },
  plugins: [],
};
