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
      colors: {
        mp: {
          eggplant: '#15003F',
          purple: { 200: '#1B0B3B', 150: '#5028C0', 100: '#7856FF', 40: '#B094FF', 20: '#E8DDFF' },
          lava: { 200: '#5B0237', 150: '#CC332B', 100: '#FF7557', 40: '#FFB0A3', 20: '#FFE1D6' },
          mint: { 200: '#122E29', 150: '#07B096', 100: '#80E1D9', 40: '#BCF0F0', 20: '#E0FAFA' },
          amber: { 200: '#A33B16', 150: '#DA6B16', 100: '#F8BC3B', 40: '#FEDE9B', 20: '#FFEFDB' },
          coral: '#FF8E75',
          ink: '#1F1F24',
          n: { 50: '#FBF9F9', 100: '#F5F2F2', 200: '#EAE7E7', 300: '#E9E9E9', 400: '#C0C0C0', 500: '#9B9B9B', 600: '#626266' },
        },
      },
      boxShadow: {
        'mp-card': '0 1px 2px rgba(27,11,59,.06), 0 8px 24px -8px rgba(27,11,59,.12)',
        'mp-float': '0 2px 4px rgba(27,11,59,.06), 0 24px 48px -12px rgba(27,11,59,.25)',
        'mp-glow': '0 0 0 1px rgba(176,148,255,.35), 0 0 48px -8px rgba(120,86,255,.55)',
        'mp-inset': 'inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.06)',
      },
      backgroundImage: {
        'mp-hero': 'radial-gradient(60% 80% at 20% 20%, #7856FF 0%, transparent 60%), radial-gradient(50% 70% at 80% 30%, #FF7557 0%, transparent 65%), radial-gradient(60% 80% at 60% 100%, #CC332B 0%, transparent 60%), #1B0B3B',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        grow: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        popIn: { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        spin360: { to: { transform: 'rotate(360deg)' } },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp .25s ease-out both',
        bar: 'grow .5s ease-out both',
        'pop-in': 'popIn .15s ease-out both',
        'fade-in': 'fadeIn .15s ease-out both',
        'spin-360': 'spin360 .9s linear infinite',
        shimmer: 'shimmer 2.4s cubic-bezier(0.16,1,0.3,1) infinite',
        float: 'float 6s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        'pulse-dot': 'pulseDot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
