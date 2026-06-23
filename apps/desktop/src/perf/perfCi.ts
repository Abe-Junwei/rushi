/** True on GitHub Actions perf runs (see vitest.perf.config.ts `define`). */
export const isPerfCiRunner = typeof __PERF_CI__ !== "undefined" && __PERF_CI__;
