#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const packageVersion = readJson('apps/desktop/package.json').version;
const tauriVersion = readJson('apps/desktop/src-tauri/tauri.conf.json').version;
const cargoToml = fs.readFileSync(
  path.join(root, 'apps/desktop/src-tauri/Cargo.toml'),
  'utf8',
);
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  'apps/desktop/package.json': packageVersion,
  'apps/desktop/src-tauri/tauri.conf.json': tauriVersion,
  'apps/desktop/src-tauri/Cargo.toml': cargoVersion,
};

for (const [source, version] of Object.entries(versions)) {
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error(`Could not resolve release version from ${source}`);
  }
}

const distinct = new Set(Object.values(versions));
if (distinct.size !== 1) {
  const detail = Object.entries(versions)
    .map(([source, version]) => `${source}=${version}`)
    .join(', ');
  throw new Error(`Release version mismatch: ${detail}`);
}

const tagArg = process.argv.find((arg) => arg.startsWith('--tag='));
const tag = tagArg?.slice('--tag='.length) || process.env.RUSHI_RELEASE_TAG || '';
if (tag) {
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error(`Release tag must be vX.Y.Z semver-compatible (got ${tag})`);
  }
  const tagVersion = tag.slice(1);
  if (tagVersion !== packageVersion) {
    throw new Error(`Release tag ${tag} does not match application version ${packageVersion}`);
  }
}

console.log(`OK: release version ${packageVersion}${tag ? ` matches ${tag}` : ''}`);
