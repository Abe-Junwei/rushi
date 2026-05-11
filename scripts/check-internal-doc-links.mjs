#!/usr/bin/env node
/**
 * Lightweight markdown link check for Rushi.
 * - Internal relative links must resolve to existing files (anchors ignored).
 * - Sibling ../Jieyu/... links are verified only when ../Jieyu exists locally and CI is unset.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const JIEYU_ROOT = path.resolve(REPO_ROOT, "..", "Jieyu");
const jieyuPresent = fs.existsSync(JIEYU_ROOT);
const inCi = process.env.CI === "true";

const LINK_RE = /\!?\[[^\]]*\]\(([^)]+)\)/g;

/** @param {string} dir */
function* walkMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === ".git" || ent.name === "node_modules" || ent.name === "dist" || ent.name === "target") {
        continue;
      }
      yield* walkMarkdownFiles(full);
    } else if (ent.name.endsWith(".md")) {
      yield full;
    }
  }
}

/**
 * @param {string} raw
 * @returns {{ pathPart: string, hasFile: boolean } | null}
 */
function parseMarkdownTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  // Strip optional <> wrappers
  let u = trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed.slice(1, -1) : trimmed;
  if (/^https?:\/\//i.test(u) || u.startsWith("mailto:")) return null;
  const [pathPart] = u.split("#");
  if (!pathPart) return null;
  return { pathPart, hasFile: pathPart.length > 0 };
}

/**
 * @param {string} fromFile
 * @param {string} pathPart
 */
function resolveLocalTarget(fromFile, pathPart) {
  const baseDir = path.dirname(fromFile);
  return path.resolve(baseDir, pathPart);
}

/**
 * @param {string} resolvedAbs
 */
function isUnderJieyu(resolvedAbs) {
  const j = path.resolve(JIEYU_ROOT);
  const r = path.resolve(resolvedAbs);
  if (r === j) return true;
  return r.startsWith(j + path.sep);
}

function main() {
  const errors = [];
  const warnings = [];

  for (const file of walkMarkdownFiles(REPO_ROOT)) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text)) !== null) {
      const raw = m[1];
      const parsed = parseMarkdownTarget(raw);
      if (!parsed) continue;
      const { pathPart } = parsed;
      const resolved = resolveLocalTarget(file, pathPart);

      if (isUnderJieyu(resolved)) {
        if (inCi || !jieyuPresent) {
          if (!jieyuPresent && !inCi) {
            warnings.push(`Optional sibling link (Jieyu not present): ${path.relative(REPO_ROOT, file)} → ${pathPart}`);
          }
          continue;
        }
        if (!fs.existsSync(resolved)) {
          errors.push(`Broken Jieyu link: ${path.relative(REPO_ROOT, file)} → ${pathPart}`);
        }
        continue;
      }

      if (!fs.existsSync(resolved)) {
        errors.push(`Broken link: ${path.relative(REPO_ROOT, file)} → ${pathPart}`);
      }
    }
  }

  for (const w of warnings) {
    console.warn(`WARN  ${w}`);
  }

  if (errors.length) {
    console.error("Doc link check failed:\n");
    for (const e of errors) console.error(`  ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log("Doc link check passed.");
}

main();
