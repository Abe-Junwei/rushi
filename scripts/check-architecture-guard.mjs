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

  // 结构 mutation 须读 segmentsRef，禁止 setSegments(prev => …) 做结构/正文合并
  const structureMutationFiles = [
    "apps/desktop/src/pages/segmentMutationMergeDelete.ts",
    "apps/desktop/src/pages/segmentMutationInsert.ts",
    "apps/desktop/src/pages/useSegmentSplitController.ts",
  ];
  if (structureMutationFiles.some((f) => rel === f)) {
    if (/setSegments\s*\(\s*\(\s*(?:prev|p)\s*\)\s*=>/.test(source)) {
      errors.push(`${rel}: 结构 mutation 须用 segmentsRef.current + publishSegmentStructureMutation，禁止 setSegments(prev => …)`);
    }
    if (!/segmentsRef\.current/.test(source)) {
      errors.push(`${rel}: 结构 mutation 须读取 segmentsRef.current`);
    }
  }

  // 防回归：检测 setState updater 内的 DOM 查询（error）
  // 匹配 setXxx(... => ... { ... querySelector/getElementById ... })
  const setStateUpdaterDom = /set\w+\s*\(\s*\([^)]*\)\s*=>[\s\S]{0,800}?(?:querySelector|getElementById)/;
  if (setStateUpdaterDom.test(source)) {
    errors.push(`${rel}: setState updater 内发现 DOM 查询（querySelector / getElementById）`);
  }

  if (
    (rel.includes("useWaveformPlayback.ts") || rel.includes("useWaveformZoomSync.ts")) &&
    /\.getDuration\(\)/.test(source)
  ) {
    errors.push(`${rel}: 使用 resolveLayoutDurationSec / layoutDurationSecRef，勿直接 ws.getDuration()`);
  }

  // 防回归：语段「可见性 / 重叠」判定必须经由 selectPackableSegments(单一真源)。
  // 仅 selector 本体可直接调用跨度启发式；persist sanitize 须用 isPlaceholderSegment（与 Rust 一致）。
  const dominantPredicateAllowlist = [
    "apps/desktop/src/utils/waveformSegmentBounds.ts",
  ];
  if (
    /\bisDominantWaveformSpanSegment\b/.test(source) &&
    !rel.endsWith(".test.ts") &&
    !dominantPredicateAllowlist.some((allowed) => rel.endsWith(allowed))
  ) {
    errors.push(
      `${rel}: 语段可见性/重叠判定须经由 selectPackableSegments / selectPackableSegmentIndices，勿直接调用 isDominantWaveformSpanSegment`,
    );
  }

  // 防回归：检测 Tailwind arbitrary value 颜色（warning，逐步收敛）
  const arbitraryColors = source.match(
    /(?:bg|text|border|ring|shadow|fill|stroke|outline)-\[#[0-9a-fA-F]{3,6}\]/g
  ) ?? [];
  if (arbitraryColors.length > 0) {
    warnings.push(`${rel}: 发现 ${arbitraryColors.length} 处 Tailwind arbitrary value 颜色，应收敛到 token`);
  }

  const usesLucide = /from\s+['"]lucide-react['"]/.test(source);
  if (usesLucide) {
    const hasIconSpecImport = /from\s+['"][./]+lucideIconSpec['"]/.test(source);
    if (!hasIconSpecImport) {
      errors.push(`${rel}: 使用 lucide-react 时必须引入 lucideIconSpec 统一尺寸与描边常量`);
    }

    const nonStandardStroke = source.match(/strokeWidth=\{(?!LUCIDE_ICON_STROKE_WIDTH\})[^}]+\}/g) ?? [];
    if (nonStandardStroke.length > 0) {
      errors.push(`${rel}: Lucide strokeWidth 必须使用 LUCIDE_ICON_STROKE_WIDTH（发现 ${nonStandardStroke.length} 处非规范写法）`);
    }

    const rawIconSizes = source.match(
      /<[A-Z][A-Za-z0-9]*[^>]*className=[^>]*(h-\[18px\]\s+w-\[18px\]|h-3\.5\s+w-3\.5|h-5\s+w-5)[^>]*strokeWidth=\{[^}]+\}[^>]*>/g
    ) ?? [];
    if (rawIconSizes.length > 0) {
      errors.push(`${rel}: Lucide 图标尺寸必须使用 LUCIDE_ICON_SIZE_SM/MD/LG（发现 ${rawIconSizes.length} 处硬编码尺寸）`);
    }
  }

  // Preflight 关闭：内联 button className 须显式 bg-* 或使用带背景的 CSS 组件类
  if (!rel.endsWith('.test.ts') && !rel.endsWith('.test.tsx')) {
    const inlineButtonClassRe = /<button\b[^>]*\bclassName="([^"]+)"/g;
    const safeButtonClassMarkers = [
      'bg-',
      'dropdown-item',
      'icon-btn',
      'region-action-btn',
      'waveform-playback',
      'waveform-minimap-switch',
    ];
    let bm;
    while ((bm = inlineButtonClassRe.exec(source))) {
      const cls = bm[1];
      if (safeButtonClassMarkers.some((m) => cls.includes(m))) continue;
      errors.push(
        `${rel}: <button className="…"> 须含 bg-* 或 dropdown-item/icon-btn 等组件类（Preflight 关闭；可用 CONTROL_BTN_* / CONTROL_BTN_LINK）`,
      );
    }
  }

  // compactDialog 成品壳：业务须用 CompactFloatingDialog（见 desktop-floating-dialog-panels.md）
  const compactDialogAllowlist = new Set([
    'apps/desktop/src/components/PanelTemplate.tsx',
    'apps/desktop/src/components/CompactFloatingDialog.tsx',
  ]);
  if (
    !rel.endsWith('.test.ts') &&
    !rel.endsWith('.test.tsx') &&
    /preset=["']compactDialog["']/.test(source) &&
    !compactDialogAllowlist.has(rel)
  ) {
    errors.push(
      `${rel}: compactDialog 须经由 CompactFloatingDialog / CompactConfirmDialog，禁止业务层直接 FloatingPanelTemplate`,
    );
  }
  if (
    !rel.endsWith('.test.ts') &&
    !rel.endsWith('.test.tsx') &&
    !rel.endsWith('config/controlStyles.ts') &&
    /CONTROL_BTN_DANGER_COMPACT/.test(source) &&
    /CONTROL_BTN_SECONDARY/.test(source)
  ) {
    errors.push(
      `${rel}: 页脚勿混用 CONTROL_BTN_DANGER_COMPACT（h-7）与 CONTROL_BTN_SECONDARY（h-8），危险操作用 CONTROL_BTN_DANGER`,
    );
  }
}

function checkRustFile(fullPath) {
  const rel = path.relative(ROOT, fullPath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(fullPath, 'utf-8');
  const lines = source.split('\n').length;

  if (lines > 600) warnings.push(`${rel}: ${lines} 行，建议拆分模块`);

  // 防回归：文件系统路径前缀校验（排除 error-code、URL path、引号剥除等）
  const rustStartsWithSkip = [
    'local_runtime/errors.rs',
    'project/asr_cache_cmd.rs',
    'asr_sidecar/loopback.rs',
    'project/glossary_bulk_parse.rs',
  ];
  const fsPathStartsWith =
    /starts_with\("(?:\/|[A-Za-z]:)/.test(source) ||
    (/\b(?:path|PathBuf|root|dest)\b[^\n]{0,80}\.starts_with\(/.test(source) &&
      !/error\.starts_with/.test(source));
  if (fsPathStartsWith && !rel.includes('test') && !rustStartsWithSkip.some((s) => rel.endsWith(s))) {
    warnings.push(`${rel}: 发现 starts_with 路径校验，建议改用 canonicalize + relative_to`);
  }

  // 安装验证在 local_runtime/installer 的 spawn_blocking 中调用，此处允许 blocking HTTP
  const blockingHttpAllowed =
    rel.includes('local_runtime/install_support/verify/') ||
    rel.includes('blocking_http/');
  if (/reqwest::blocking/.test(source) && !rel.includes('test') && !blockingHttpAllowed) {
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

function cspDirectiveHasUnsafeInline(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.includes("'unsafe-inline'");
  if (Array.isArray(value)) return value.some((entry) => entry.includes("'unsafe-inline'"));
  return false;
}

function checkTauriProductionCsp() {
  const confPath = path.join(ROOT, 'apps/desktop/src-tauri/tauri.conf.json');
  const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8'));
  const csp = conf?.app?.security?.csp;
  if (!csp || typeof csp === 'string') {
    errors.push('apps/desktop/src-tauri/tauri.conf.json: 生产 CSP 须为对象格式并分域声明 directive');
    return;
  }
  if (cspDirectiveHasUnsafeInline(csp['script-src'])) {
    errors.push('apps/desktop/src-tauri/tauri.conf.json: 生产 script-src 禁止 unsafe-inline（Tauri 构建时注入 hash/nonce）');
  }
  // CSP-HARDEN (Q-CSP-1, Step 6a)：Tauri 仅向 script-src / style-src 注入 nonce + hash（见 manager/mod.rs replace_csp_nonce）。
  // style-src 须去 unsafe-inline 改走 nonce；style-src-attr 的 unsafe-inline 保留（React 行内 style=；Tauri nonce 不覆盖 attr），故此处不检 style-src-attr。
  if (cspDirectiveHasUnsafeInline(csp['style-src'])) {
    errors.push('apps/desktop/src-tauri/tauri.conf.json: 生产 style-src 禁止 unsafe-inline（CSP-HARDEN：改走 Tauri nonce + cspNonce）');
  }
  // style-src-elem 不得声明：Tauri 不向该指令注入 nonce，一旦声明（无论是否含 unsafe-inline）会接管 <style>/<link>
  // 判定并拦掉 nonce'd 样式 → 生产白样式。须删除让其回退到带 nonce 的 style-src。
  if ('style-src-elem' in csp) {
    errors.push('apps/desktop/src-tauri/tauri.conf.json: 生产禁止声明 style-src-elem（Tauri nonce 仅注入 style-src；删除该指令回退到 style-src）');
  }
}

// CSP-HARDEN (Q-CSP-1, Step 6b)：硬化后生产产物 CSS 是外链 <link>，Tauri 仅给 <style> 注 nonce。
// index.html 的 style nonce probe 是承重件——被删则 readTauriStyleCspNonce 在生产找不到任何 style[nonce]，
// WaveSurfer shadow 样式会被拦。此处守住 probe（带 STYLE_NONCE token）存在。
function checkTauriStyleNonceProbe() {
  const htmlPath = path.join(ROOT, 'apps/desktop/index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const hasProbeId = /id=["']rushi-tauri-style-csp-nonce["']/.test(html);
  const hasNonceToken = /nonce=["']__TAURI_STYLE_NONCE__["']/.test(html);
  if (!hasProbeId || !hasNonceToken) {
    errors.push('apps/desktop/index.html: 缺少 style nonce probe（<style id="rushi-tauri-style-csp-nonce" nonce="__TAURI_STYLE_NONCE__">）— 硬化 CSP 下波形 nonce 会失效');
  }
}

function checkTauriInvokeAcl() {
  const tauriRoot = path.join(ROOT, 'apps/desktop/src-tauri');
  const appCommandsPath = path.join(tauriRoot, 'app_commands.rs');
  const libPath = path.join(tauriRoot, 'src/lib.rs');
  const capsPath = path.join(tauriRoot, 'capabilities/default.json');

  const appCommandsSource = fs.readFileSync(appCommandsPath, 'utf-8');
  const commands = [...appCommandsSource.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]);

  const libSource = fs.readFileSync(libPath, 'utf-8');
  const handlerBlock = libSource.match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? '';
  const handlerCommands = handlerBlock
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.length > 0)
    .map((line) => line.match(/::([a-z][a-z0-9_]*)$/)?.[1] ?? null)
    .filter(Boolean);
  const handlerSet = new Set(handlerCommands);

  for (const cmd of commands) {
    if (!handlerSet.has(cmd)) {
      errors.push(`apps/desktop/src-tauri: app_commands.rs 命令 "${cmd}" 未在 lib.rs generate_handler! 注册`);
    }
  }
  for (const cmd of handlerCommands) {
    if (!commands.includes(cmd)) {
      errors.push(`apps/desktop/src-tauri: lib.rs 命令 "${cmd}" 未列入 app_commands.rs APP_COMMANDS`);
    }
  }

  const allows = new Set();
  const permDir = path.join(tauriRoot, 'permissions');
  for (const file of fs.readdirSync(permDir).filter((name) => name.endsWith('.toml'))) {
    const text = fs.readFileSync(path.join(permDir, file), 'utf-8');
    for (const match of text.matchAll(/"(allow-[a-z0-9-]+)"/g)) {
      allows.add(match[1]);
    }
  }

  const toAllow = (cmd) => `allow-${cmd.replaceAll('_', '-')}`;
  const missingAcl = commands.filter((cmd) => !allows.has(toAllow(cmd)));
  if (missingAcl.length > 0) {
    errors.push(
      `apps/desktop/src-tauri/permissions: 缺少 invoke ACL: ${missingAcl.map(toAllow).join(', ')}`,
    );
  }

  const caps = JSON.parse(fs.readFileSync(capsPath, 'utf-8'));
  const perms = caps?.permissions ?? [];
  if (!perms.includes('main-window-full')) {
    errors.push('apps/desktop/src-tauri/capabilities/default.json: 主窗口须引用 main-window-full 域分组 ACL');
  }
  const domainSets = ['project', 'glossary', 'llm', 'asr', 'system'];
  for (const setId of domainSets) {
    const setPath = path.join(permDir, `${setId}.toml`);
    if (!fs.existsSync(setPath)) {
      errors.push(`apps/desktop/src-tauri/permissions: 缺少域分组 ${setId}.toml`);
    }
  }
}

checkTauriProductionCsp();
checkTauriStyleNonceProbe();
checkTauriInvokeAcl();

console.log(`\n架构守卫报告：${errors.length} 错误，${warnings.length} 警告\n`);
warnings.forEach(w => console.log(`⚠️  ${w}`));
errors.forEach(e => console.log(`❌ ${e}`));

if (errors.length > 0) process.exit(1);
