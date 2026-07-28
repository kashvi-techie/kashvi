import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './store/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          950: '#0B0B0F',
          900: '#121218',
          850: '#181820',
          800: '#20202A',
        },
        orbit: {
          text: '#F4F1EA',
          muted: '#AAA8B2',
          accent: '#A78BFA',
          success: '#78C6A3',
          warning: '#D7AE68',
          danger: '#E08282',
        },
      },
      boxShadow: {
        soft: '0 18px 70px rgba(0,0,0,0.28)',
        glow: '0 0 50px rgba(167,139,250,0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
