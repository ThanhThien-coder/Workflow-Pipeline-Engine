const badgeColors = ['emerald', 'blue', 'sky', 'slate', 'red', 'amber', 'indigo', 'violet', 'rose']
const badgeShades = ['50', '100', '200', '300', '400', '500']

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    ...badgeColors.flatMap((color) => badgeShades.map((shade) => `bg-${color}-${shade}`)),
    'border-red-200',
    'border-amber-200',
    'border-emerald-200',
    'text-red-700',
    'text-red-800',
    'text-amber-700',
    'text-amber-800',
    'text-emerald-700',
    'text-emerald-800',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        grow: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        popIn: { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        spin360: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-up': 'fadeUp .25s ease-out both',
        bar: 'grow .5s ease-out both',
        'pop-in': 'popIn .15s ease-out both',
        'fade-in': 'fadeIn .15s ease-out both',
        'spin-360': 'spin360 .9s linear infinite',
      },
    },
  },
  plugins: [],
}
