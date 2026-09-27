import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        foreground: '#e2e8f0',
        surface: '#12121c',
        panel: '#0a0a0f',
        card: '#12121c',
        accent: '#3b82f6',
        border: '#25252f',
        subtle: '#94a3b8',
      },
    },
  },
  plugins: [],
} satisfies Config;
