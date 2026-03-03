import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Cores principais ─────────────────────────────────────
        primary: {
          DEFAULT: '#475569',
          hover: '#334155',
        },
        'on-primary': '#FFFFFF',
        secondary: {
          DEFAULT: '#64748B',
        },
        'on-secondary': '#FFFFFF',
        accent: {
          DEFAULT: '#D4A574',
        },
        'on-accent': '#1C1917',

        // ── Superfícies ──────────────────────────────────────────
        background: '#FFFFFF',
        surface: '#F8FAFC',
        muted: '#F1F5F9',
        border: '#E2E8F0',

        // ── Texto ─────────────────────────────────────────────────
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
        'text-muted': '#94A3B8',

        // ── Semânticas ────────────────────────────────────────────
        success: {
          DEFAULT: '#059669',
        },
        'on-success': '#FFFFFF',
        warning: {
          DEFAULT: '#D97706',
        },
        'on-warning': '#FFFFFF',
        danger: {
          DEFAULT: '#DC2626',
        },
        'on-danger': '#FFFFFF',
        info: {
          DEFAULT: '#0284C7',
        },
        'on-info': '#FFFFFF',

        // ── Tokens de compatibilidade (shadcn/ui + componentes) ───
        foreground: '#0F172A',
        card: '#FFFFFF',
        destructive: {
          DEFAULT: '#DC2626',
        },
        ring: '#475569',
        'muted-foreground': '#94A3B8',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Courier New', 'monospace'],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}

export default config
