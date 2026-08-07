import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#020617',
        surface: '#111827',
        panel: '#0f172a',
        accent: '#3b82f6',
        border: '#334155',
        subtle: '#94a3b8',
      },
      boxShadow: {
        panel: '0 20px 80px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;
