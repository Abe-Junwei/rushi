#!/usr/bin/env bash
# npm ci on Windows often skips optional native bindings (npm/cli#4828).
# Install platform packages explicitly before vite/tauri build.
set -euo pipefail

npm install --no-save \
  @tauri-apps/cli-win32-x64-msvc@2.11.4 \
  @rolldown/binding-win32-x64-msvc@1.0.3 \
  lightningcss-win32-x64-msvc@1.32.0 \
  @tailwindcss/oxide-win32-x64-msvc@4.3.1
