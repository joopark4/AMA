/**
 * AMA Tailwind 설정.
 *
 * 디자인 토큰의 정본은 `src/styles/tokens.css`의 CSS 변수.
 * 여기서는 Tailwind 유틸 클래스로 노출하기 위해 동일 값을 미러링한다.
 * 토큰 변경 시 두 파일을 함께 수정할 것.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'oklch(0.22 0.012 50)',
          2: 'oklch(0.42 0.012 50)',
          3: 'oklch(0.62 0.012 55)',
          4: 'oklch(0.78 0.010 60)',
        },
        accent: {
          DEFAULT: 'oklch(0.74 0.14 45)',
          2: 'oklch(0.82 0.11 50)',
          soft: 'oklch(0.93 0.05 50)',
          ink: 'oklch(0.32 0.10 40)',
        },
        bg: {
          DEFAULT: 'oklch(0.97 0.008 70)',
          2: 'oklch(0.94 0.012 70)',
          3: 'oklch(0.91 0.015 65)',
        },
        surface: {
          DEFAULT: 'oklch(1 0 0 / 0.62)',
          2: 'oklch(1 0 0 / 0.78)',
          3: 'oklch(1 0 0 / 0.92)',
        },
        glow: {
          DEFAULT: 'oklch(0.85 0.12 320)',
          2: 'oklch(0.88 0.10 25)',
        },
        ok: 'oklch(0.72 0.14 160)',
        warn: 'oklch(0.78 0.14 75)',
        danger: 'oklch(0.65 0.20 25)',
        hairline: {
          DEFAULT: 'oklch(0.20 0.01 50 / 0.10)',
          strong: 'oklch(0.20 0.01 50 / 0.18)',
        },
      },
      borderRadius: {
        sm: '10px',
        card: '16px',
        panel: '22px',
        xl: '28px',
        pill: '999px',
      },
      boxShadow: {
        'glass-sm':
          '0 1px 2px oklch(0.2 0.01 50 / 0.06), 0 4px 12px oklch(0.2 0.01 50 / 0.05)',
        glass:
          'inset 0 1px 0 oklch(1 0 0 / 0.7), inset 0 0 0 1px oklch(0.2 0.01 50 / 0.10), 0 2px 4px oklch(0.2 0.01 50 / 0.08), 0 12px 32px oklch(0.2 0.01 50 / 0.10)',
        'glass-lg':
          'inset 0 1px 0 oklch(1 0 0 / 0.7), inset 0 0 0 1px oklch(0.2 0.01 50 / 0.10), 0 6px 16px oklch(0.2 0.01 50 / 0.10), 0 30px 80px oklch(0.2 0.01 50 / 0.18)',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        body: '-0.011em',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        auraBreath: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        auraSpin: {
          to: { transform: 'rotate(360deg)' },
        },
        ringPulse: {
          '0%': { transform: 'scale(0.92)', opacity: '0.6' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        thinking: {
          '0%, 80%, 100%': { transform: 'scale(0.4)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translate(-50%, 8px)' },
          to: { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        panelIn: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        inputSlide: {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'aura-breath': 'auraBreath 4s ease-in-out infinite',
        'aura-spin': 'auraSpin 24s linear infinite',
        'ring-pulse': 'ringPulse 1.6s ease-out infinite',
        wave: 'wave 0.9s ease-in-out infinite',
        thinking: 'thinking 1.4s ease-in-out infinite',
        'slide-up': 'slideUp 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'panel-in': 'panelIn 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        'scale-in': 'scaleIn 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fadeIn 200ms ease-out',
        'input-slide': 'inputSlide 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};
