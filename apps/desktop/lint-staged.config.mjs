export default {
  "*.{ts,tsx}": (filenames) => {
    if (filenames.length === 0) return [];
    const files = filenames.map((f) => JSON.stringify(f)).join(" ");
    return [`npx eslint --max-warnings=0 --no-warn-ignored ${files}`];
  },
  "*.css": () => [],
};
