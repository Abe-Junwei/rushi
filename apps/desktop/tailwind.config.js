/** @type {import('tailwindcss').Config} */
/**
 * Legacy stub for IDE hints — theme/animation/spacing live in src/zen-tailwind.css @theme.
 * PostCSS v4 entry does not load this file (no @config).
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    preflight: false,
  },
};
