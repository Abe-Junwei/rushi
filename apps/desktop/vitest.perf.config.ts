import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __PERF_CI__: JSON.stringify(Boolean(process.env.CI)),
  },
  test: {
    environment: "jsdom",
    include: ["src/perf/**/*.perf.ts"],
    coverage: {
      enabled: false,
    },
  },
});
