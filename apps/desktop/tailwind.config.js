/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  /** 与既有 App.css 共存：不注入 Tailwind Preflight，避免全局 reset 冲掉壳层样式 */
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        /** Notion 风格 + Serene Scholar 暖色：暖白背景、saffron 主操作 */
        "zen-ink": "#2C2C2C",
        "zen-paper": "#F2EFE8",
        "zen-saffron": "#C58A43",
        "zen-saffron-light": "#ffddba",
        "zen-saffron-mid": "#85530f",
        "zen-saffron-deep": "#452800",
        "zen-ochre": "#EAE0C5",
        "zen-stone": "#8E8E8E",
        "zen-cinnabar": "#963530",
        "zen-indigo": "#3D4F5D",
        "zen-success": "#22c55e",
        /** Notion 风格 surface 令牌 */
        "notion-bg": "#ffffff",
        "notion-sidebar": "#f7f7f5",
        "notion-sidebar-hover": "#efefef",
        "notion-sidebar-active": "#ebebea",
        "notion-divider": "#e3e2e0",
        "notion-border": "#e3e2e0",
        "notion-text": "#37352f",
        "notion-text-muted": "#6b6b6b",
        "notion-text-light": "#9ca3af",
        "notion-callout-bg": "#f1f1ef",
        "notion-callout-border": "#e3e2e0",
        /** WaveSurfer（与 src/config/tokens.ts 同源） */
        "zen-wf-surface": "#ffffff",
        "zen-wf-wave": "#c4c4c8",
        "zen-wf-progress": "#8e8e93",
        "zen-wf-cursor": "#6a6a6f",
      },
      spacing: {
        "page-margin": "2rem",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif SC"', 'serif'],
        mono: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "rushi-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
      },
      animation: {
        "rushi-indeterminate": "rushi-indeterminate 1.5s linear infinite",
        "rushi-spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};
