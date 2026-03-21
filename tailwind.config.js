/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b', // Rich Black
        card: '#18181b', // Zinc 900
        primary: '#ffffff', // Pure White
        secondary: '#a1a1aa', // Zinc 400
        muted: '#27272a', // Zinc 800
        accent: {
          DEFAULT: '#ff4d4d', // Vibrant Red
          hover: '#ff6666',
          dark: '#cc0000',
          glow: 'rgba(255, 77, 77, 0.5)'
        },
        glass: 'rgba(24, 24, 27, 0.6)', // Glassmorphism base
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(255, 77, 77, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
        'card-hover': '0 10px 40px -10px rgba(0,0,0,0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #ff4d4d 0deg, #ff8c42 180deg, #ff4d4d 360deg)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}
