/**
 * Guard: PowerShell release/CI footguns.
 *
 * 1) scripts/*.ps1 with $ErrorActionPreference=Stop that invoke natives
 *    must use rushi-resolve-git-sha.ps1 helpers (Invoke-RushiNativeChecked/Soft).
 * 2) Never pass a path containing * or ? to -LiteralPath (wildcards are not
 *    expanded; Copy-Item/Get-ChildItem look for a file literally named "*").
 *
 * Callable standalone (`node scripts/check-pwsh-native-safety.mjs`) or from
 * check-architecture-guard.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();

/** Pure .NET / helper / name-only — no native stderr footgun. */
const ALLOW_NO_NATIVE_HELPER = new Set([
  "rushi-resolve-git-sha.ps1",
  "rushi-win-release-artifact-names.ps1",
  "ci-measure-windows-bundle-size.ps1",
  "prune-windows-sidecar-for-nsis.ps1",
]);

const NATIVE_RE =
  /(?:^|[\s;&|(`])(?:npm|npx|node|python|pyinstaller|pip|bash|tar|git|cargo|aws|curl)\b|&\s*(?:npm|npx|node|python|pyinstaller|bash|tar|git|cargo|pwsh)\b|python\s+-|\$env:SIGNTOOL\b|signtool\.exe/im;

/** -LiteralPath argument that still embeds a glob (* or ?). */
const LITERAL_PATH_GLOB_RES = [
  /-LiteralPath\s+\(?\s*Join-Path[\s\S]{0,200}?[\*\?]/m,
  /-LiteralPath\s+["'][^"'\n]*[\*\?][^"'\n]*["']/m,
];

/**
 * Strip PowerShell line comments (# ...) outside simple quoted strings.
 * @param {string} source
 */
function stripPsLineComments(source) {
  return source
    .split("\n")
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) {
          inSingle = !inSingle;
          continue;
        }
        if (ch === '"' && !inSingle) {
          inDouble = !inDouble;
          continue;
        }
        if (ch === "#" && !inSingle && !inDouble) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

/**
 * @param {string} rel
 * @param {string} source
 * @param {string[]} errors
 */
function checkLiteralPathGlobs(rel, source, errors) {
  const code = stripPsLineComments(source);
  for (const re of LITERAL_PATH_GLOB_RES) {
    re.lastIndex = 0;
    if (re.test(code)) {
      errors.push(
        `${rel}: -LiteralPath 不得带 * / ?（不会展开通配；请用 Get-ChildItem 再按项 Copy-Item -LiteralPath）`,
      );
      return;
    }
  }
}

/**
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkPwshNativeSafety() {
  const errors = [];
  const warnings = [];
  const scriptsDir = path.join(ROOT, "scripts");
  if (!fs.existsSync(scriptsDir)) {
    return { errors, warnings };
  }

  for (const name of fs.readdirSync(scriptsDir)) {
    if (!name.endsWith(".ps1")) continue;
    const full = path.join(scriptsDir, name);
    const source = fs.readFileSync(full, "utf-8");
    const rel = `scripts/${name}`;

    checkLiteralPathGlobs(rel, source, errors);

    if (ALLOW_NO_NATIVE_HELPER.has(name)) continue;
    if (!/\$ErrorActionPreference\s*=\s*['"]Stop['"]/.test(source)) continue;
    if (!NATIVE_RE.test(source)) continue;

    if (!/rushi-resolve-git-sha\.ps1/.test(source)) {
      errors.push(
        `${rel}: $ErrorActionPreference=Stop + native command 须 dot-source rushi-resolve-git-sha.ps1`,
      );
    }
    if (!/Invoke-RushiNative(?:Checked|Soft)/.test(source)) {
      errors.push(
        `${rel}: $ErrorActionPreference=Stop + native command 须使用 Invoke-RushiNativeChecked 或 Invoke-RushiNativeSoft`,
      );
    }
  }

  const workflowsDir = path.join(ROOT, ".github", "workflows");
  if (fs.existsSync(workflowsDir)) {
    for (const name of fs.readdirSync(workflowsDir)) {
      if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
      const full = path.join(workflowsDir, name);
      const source = fs.readFileSync(full, "utf-8");
      checkLiteralPathGlobs(`.github/workflows/${name}`, source, errors);
    }
  }

  return { errors, warnings };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { errors, warnings } = checkPwshNativeSafety();
  for (const w of warnings) console.log(`⚠️  ${w}`);
  for (const e of errors) console.log(`❌ ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log("OK: pwsh native safety");
}
