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
        "zen-ink": "#2C2C2C",
        "zen-paper": "#F2EFE8",
        "zen-saffron": "#C58A43",
        "zen-saffron-light": "#E5BC94",
        "zen-saffron-mid": "#D49A5B",
        "zen-saffron-deep": "#C69C6D",
        "zen-ochre": "#EAE0C5",
        "zen-stone": "#8E8E8E",
        "zen-cinnabar": "#963530",
        "zen-indigo": "#3D4F5D",
        "zen-success": "#4ADE80",
        "zen-gray-200": "#ECECEC",
        "zen-gray-300": "#E0E0E0",
        "zen-gray-400": "#8E8E8E",
        "zen-gray-500": "#555555",
        /** 欢迎页 A（Stitch 稿） */
        "app-bg": "#f3f1e8",
        "app-accent": "#d4a373",
        "app-accent-hover": "#bc8a5f",
        "app-text-main": "#333333",
        "app-text-muted": "#666666",
        "app-highlight": "#ede4d0",
        /** 确认创建项目（阶段 B） */
        "brand-bg": "#f7f3ed",
        "brand-orange": "#d9a066",
        "brand-gray": "#e5e2dd",
        "brand-input-border": "#e5c19d",
        "brand-input-bg": "#fdfcfb",
        "brand-secondary-bg": "#f0f1f3",
        "brand-secondary-text": "#5a5a5a",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif SC"', '"Noto Serif SC"', '"Songti SC"', '"SimSun"', "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
