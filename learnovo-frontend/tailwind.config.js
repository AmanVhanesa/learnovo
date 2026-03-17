/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50, #f0fdfa)',
          100: 'var(--color-primary-100, #ccfbf1)',
          200: 'var(--color-primary-200, #99f6e4)',
          300: 'var(--color-primary-300, #5eead4)',
          400: 'var(--color-primary-400, #2dd4bf)',
          500: 'var(--color-primary-500, #3EC4B1)',
          600: 'var(--color-primary-600, #0d9488)',
          700: 'var(--color-primary-700, #0f766e)',
          800: 'var(--color-primary-800, #115e59)',
          900: 'var(--color-primary-900, #134e4a)',
        },
        secondary: {
          50: 'var(--color-secondary-50, #eff6ff)',
          100: 'var(--color-secondary-100, #dbeafe)',
          200: 'var(--color-secondary-200, #bfdbfe)',
          300: 'var(--color-secondary-300, #93c5fd)',
          400: 'var(--color-secondary-400, #60a5fa)',
          500: 'var(--color-secondary-500, #2355A6)',
          600: 'var(--color-secondary-600, #2563eb)',
          700: 'var(--color-secondary-700, #1d4ed8)',
          800: 'var(--color-secondary-800, #1e40af)',
          900: 'var(--color-secondary-900, #1e3a8a)',
        },
        // Dark mode surface colors — Apple-style true black (OLED)
        dark: {
          bg: '#000000',
          card: '#1C1C1E',
          surface: '#2C2C2E',
          border: '#38383A',
          hover: '#2C2C2E',
          active: '#3A3A3C',
          'border-strong': '#48484A',
          'border-subtle': '#2C2C2E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'glass': '0 0 0 1px rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        'glass-md': '0 0 0 1px rgba(255,255,255,0.06), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        'glass-lg': '0 0 0 1px rgba(255,255,255,0.08), 0 4px 8px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.08)',
        'glass-inset': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
        'glow-primary': '0 0 20px -4px rgba(62,196,177,0.3)',
        'glow-sm': '0 0 12px -2px rgba(62,196,177,0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
