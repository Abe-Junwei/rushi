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
        /** Notion Zen：notion-* 中性底 + zen-* 暖色强调 + zen-wf-* 波形 */
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
        "zen-success": "#1e463a",
        /** 环境面板成功态：操作/链接（刷新检测等） */
        "zen-success-action": "#2e6153",
        /** 环境面板成功态：banner 底 */
        "zen-success-surface": "#eff3f1",
        /** 环境面板成功态：banner 分隔/描边 */
        "zen-success-border": "#e2e9e6",
        /** Toast / banner 警告态：saffron 10% on notion-bg */
        "zen-saffron-surface": "#f9f3ec",
        "zen-saffron-border": "#eedcc7",
        /** Toast / banner 错误态：cinnabar 10% on notion-bg */
        "zen-cinnabar-surface": "#f5ebea",
        "zen-cinnabar-border": "#dab8b7",
        /** Notion 风格 surface 令牌 */
        "notion-bg": "#ffffff",
        "notion-sidebar": "#f7f7f5",
        "notion-sidebar-hover": "#efefef",
        "notion-sidebar-active": "#ebebea",
        "secondary-container": "#e7e2d9",
        "notion-divider": "#e3e2e0",
        "notion-border": "#e3e2e0",
        "notion-text": "#37352f",
        /** Stitch on-surface-variant：segmented 未选、表单辅助文案 */
        "notion-text-variant": "#514538",
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
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        "rushi-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "rushi-indeterminate": "rushi-indeterminate 1.5s linear infinite",
        "rushi-spin-slow": "spin 3s linear infinite",
        "toast-in": "toast-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
