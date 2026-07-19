/**
 * Guard: scripts/*.ps1 with $ErrorActionPreference=Stop that invoke natives
 * must use rushi-resolve-git-sha.ps1 helpers (Invoke-RushiNativeChecked/Soft).
 * Prevents CI regressions from stderr → NativeCommandError under Stop.
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
    if (ALLOW_NO_NATIVE_HELPER.has(name)) continue;

    const full = path.join(scriptsDir, name);
    const source = fs.readFileSync(full, "utf-8");
    if (!/\$ErrorActionPreference\s*=\s*['"]Stop['"]/.test(source)) continue;
    if (!NATIVE_RE.test(source)) continue;

    const rel = `scripts/${name}`;
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
