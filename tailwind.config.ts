import type { Config } from 'tailwindcss';

export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        pixel: '4px 4px 0 rgba(0, 0, 0, 0.45)'
      },
      backgroundImage: {
        metal: 'linear-gradient(135deg, #070707 0%, #1b1b1b 25%, #050505 50%, #222 75%, #0b0b0b 100%)',
        stone: 'linear-gradient(135deg, #505050 0%, #777 30%, #454545 65%, #696969 100%)',
        wood: 'linear-gradient(90deg, #5f351b 0%, #8b542b 35%, #4a2714 70%, #9a6132 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;

