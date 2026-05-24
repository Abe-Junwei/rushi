import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const warnings = [];

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', 'target', '.venv', '.git'].includes(entry.name)) {
      walk(p, cb);
    } else if (entry.isFile()) {
      cb(p);
    }
  }
}

function checkTsFile(fullPath) {
  const rel = path.relative(ROOT, fullPath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(fullPath, 'utf-8');
  const lines = source.split('\n').length;
  const useEffects = (source.match(/useEffect\(/g) ?? []).length;
  const useCallbacks = (source.match(/useCallback\(/g) ?? []).length;
  const useMemos = (source.match(/useMemo\(/g) ?? []).length;
  const hookTotal = useEffects + useCallbacks + useMemos;

  // 文件大小和 hook 数量：已知债务记 warning，增量拦截用 code review
  if (lines > 400) warnings.push(`${rel}: ${lines} 行，建议拆分到 ≤300 行`);
  else if (lines > 300) warnings.push(`${rel}: ${lines} 行，接近 300 行阈值`);

  if (hookTotal > 12) warnings.push(`${rel}: ${hookTotal} 个 hook，超过 12 个阈值`);

  // 防回归：检测 setState updater 内的 DOM 查询（error）
  // 匹配 setXxx(... => ... { ... querySelector/getElementById ... })
  const setStateUpdaterDom = /set\w+\s*\(\s*\([^)]*\)\s*=>[\s\S]{0,800}?(?:querySelector|getElementById)/;
  if (setStateUpdaterDom.test(source)) {
    errors.push(`${rel}: setState updater 内发现 DOM 查询（querySelector / getElementById）`);
  }

  // 防回归：检测 Tailwind arbitrary value 颜色（warning，逐步收敛）
  const arbitraryColors = source.match(
    /(?:bg|text|border|ring|shadow|fill|stroke|outline)-\[#[0-9a-fA-F]{3,6}\]/g
  ) ?? [];
  if (arbitraryColors.length > 0) {
    warnings.push(`${rel}: 发现 ${arbitraryColors.length} 处 Tailwind arbitrary value 颜色，应收敛到 token`);
  }
}

function checkRustFile(fullPath) {
  const rel = path.relative(ROOT, fullPath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(fullPath, 'utf-8');
  const lines = source.split('\n').length;

  if (lines > 600) warnings.push(`${rel}: ${lines} 行，建议拆分模块`);

  // 防回归：检测 starts_with 路径校验
  if (/starts_with\(".*"\)/.test(source) && !rel.includes('test')) {
    warnings.push(`${rel}: 发现 starts_with 路径校验，建议改用 canonicalize + relative_to`);
  }

  // 防回归：检测 reqwest::blocking 在命令函数中
  if (/reqwest::blocking/.test(source) && !rel.includes('test')) {
    warnings.push(`${rel}: 发现 reqwest::blocking，可能阻塞 Tauri 线程池`);
  }
}

function checkCssFile(fullPath) {
  const rel = path.relative(ROOT, fullPath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(fullPath, 'utf-8');
  const lines = source.split('\n').length;

  if (rel === 'apps/desktop/src/App.css' && lines > 100) {
    warnings.push(`${rel}: ${lines} 行，应仅保留 @import 入口`);
  }

  // 检测硬编码颜色（排除已知合理的如 #fff, #000, #f0f0f0）
  const hexColors = source.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
  const allowed = ['#fff', '#ffffff', '#000', '#000000', '#f0f0f0', '#f4f4f5'];
  const suspicious = hexColors.filter(c => !allowed.includes(c.toLowerCase()));
  if (suspicious.length > 0 && !rel.includes('tokens')) {
    warnings.push(`${rel}: 发现 ${suspicious.length} 处硬编码颜色，应收敛到 tailwind.config.js`);
  }
}

function checkPythonFile(fullPath) {
  const rel = path.relative(ROOT, fullPath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(fullPath, 'utf-8');
  const lines = source.split('\n').length;

  if (lines > 400) warnings.push(`${rel}: ${lines} 行，建议拆分到 ≤300 行`);
}

walk(path.join(ROOT, 'apps/desktop/src'), (p) => {
  if (/\.(ts|tsx)$/.test(p)) checkTsFile(p);
  if (/\.css$/.test(p)) checkCssFile(p);
});
walk(path.join(ROOT, 'apps/desktop/src-tauri/src'), (p) => {
  if (/\.rs$/.test(p)) checkRustFile(p);
});
walk(path.join(ROOT, 'services/asr/rushi_asr'), (p) => {
  if (/\.py$/.test(p)) checkPythonFile(p);
});

console.log(`\n架构守卫报告：${errors.length} 错误，${warnings.length} 警告\n`);
warnings.forEach(w => console.log(`⚠️  ${w}`));
errors.forEach(e => console.log(`❌ ${e}`));

if (errors.length > 0) process.exit(1);
