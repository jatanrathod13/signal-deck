/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        editorial: {
          bg: '#0b0a08',
          surface: '#221c17',
          line: '#e2ccb433',
          text: '#f4ede2',
          muted: '#a7927b',
          accent: '#d5a46a',
          live: '#59d9b8',
          danger: '#f1837a',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        editorial: '0 24px 52px rgba(0, 0, 0, 0.44)',
      },
    },
  },
  plugins: [],
};
