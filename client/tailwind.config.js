/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ferrari Racing Theme
        bg: {
          primary: '#0a0a0a',
          secondary: '#141414',
          tertiary: '#1e1e1e',
        },
        accent: {
          primary: '#ff2800',
          secondary: '#ffcc00',
          glow: 'rgba(255, 40, 0, 0.4)',
        },
        text: {
          primary: '#ffffff',
          secondary: '#a0a0a0',
        },
        status: {
          running: '#00ff88',
          idle: '#ffaa00',
          error: '#ff2800',
        },
        border: {
          subtle: '#2a2a2a',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
