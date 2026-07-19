# Windows release current runbook (Route 3)

> Current as of 2026-07-19. This is the operator entrypoint for Windows x64 releases. Older portable runbooks are historical evidence only.

## 2026-07-19 release reset status

Current public release status: **No-Go**.

Release namespace reset target: restart public v1 line from `v1.0.0` after the Windows chain is validated.

Historical failed/attempted tags `v1.0.0` through `v1.0.4` were treated as release-chain attempts and must be cleared before the next public attempt. Do not announce any of them unless a later CDN/signoff record explicitly says otherwise.

Observed failed attempts before reset:

- `v1.0.0`: draft GitHub Release existed before current reset.
- `v1.0.1`: historical tag already existed before the current Route 3 + native audio fixes.
- `v1.0.2`: tag push started release run `29687939378`; Windows failed before core artifacts, macOS/CDN did not complete.
- `v1.0.3`: tag push started release run `29688359339`; Windows runner readiness still failed before core artifacts.
- `v1.0.4`: tag push started release run `29688568896`; Windows checkout failed while fetching `refs/tags/v1.0.4` from GitHub after repeated network failures (`Recv failure: Connection was reset`, `Could not connect to server`, exit 128). macOS was cancelled and `verify-cdn-release` did not run.

Current known blockers before the next public tag:

- Self-hosted Windows runner `pc-office-win-release` must reliably fetch from GitHub. Validate runner networking before any new tag push.
- Windows ZIP packaging must be verified on the runner with the current fallback path (`tar -a`, then `tar --format zip`).
- The next attempt should be a non-public validation first (`workflow_dispatch` or local `npm run release:win` without CDN publish), then one clean public tag only after Windows core passes.

Recommended next release policy:

1. Keep `main` fixes, but do not push another release tag until Windows runner checkout and ZIP packaging are proven.
2. Use workflow dispatch only as a dry run. Treat tag-only CDN/OTA steps as not validated by workflow dispatch.
3. After Windows core passes in dry run, publish `v1.0.0` once from the validated source commit.
4. Record the successful run URL and CDN evidence in this file or a dedicated evidence file before announcement.

## Distribution truth

- Main download: `如是我闻_<version>_Windows_x64_离线安装包.zip`
- Zip layout:
  - `如是我闻_<version>_Windows_x64_安装包.exe`
  - `resources/bundled-asr-models/`
- NSIS payload: app shell + CPU ASR sidecar only.
- Plan B model weights are staged after NSIS and copied by the NSIS postinstall hook from sibling `resources/`.
- CUDA sidecar is CDN opt-in only. It must not enter NSIS or the offline installer zip.
- Portable zip is retired. Do not build, upload, or verify portable artifacts for a current public release.

## Remote-first path

1. Confirm `apps/desktop/package.json`, `apps/desktop/src-tauri/tauri.conf.json`, and `apps/desktop/src-tauri/Cargo.toml` versions all equal the release tag without leading `v` (`scripts/check-release-version-consistency.mjs`).
2. Confirm self-hosted runner `pc-office-win-release` is online with label `rushi-release`.
3. Confirm runner readiness with `scripts/check-windows-release-runner.ps1` (the workflow runs this before expensive build work).
4. Trigger `.github/workflows/release.yml` by pushing `vX.Y.Z` or using workflow dispatch for a dry run.
5. Treat Windows core as hard-gated:
   - CPU sidecar build
   - NSIS build
   - offline zip build
   - offline zip artifact upload
   - tag CDN upload for offline zip + NSIS
6. Treat OTA fragment as soft unless this release explicitly requires OTA:
   - Missing `.sig` keeps install CDN valid and leaves previous `latest.json`.
7. Treat CUDA as soft:
   - `windows-cuda-opt-in` runs after `windows-core-release`.
   - `verify-cdn-release` does not wait for CUDA.
   - Build/package/manifest/upload failures do not invalidate the core offline installer.
   - A successful CUDA upload is followed by an independent manifest/version/URL/CDN SHA256 verification.

## Manual fallback

Use this only when the self-hosted runner is unavailable or the Windows job is blocked after local diagnosis.

```powershell
npm run release:win
# set R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT [/ R2_BUCKET]
npm run release:win:upload -- --tag vX.Y.Z
```

Hard rule: `release:win:upload` must use a tag that matches `apps/desktop/package.json`, `tauri.conf.json`, and `Cargo.toml`. For an older CDN repair, first check out the source release commit/tag; mismatched-version upload has no override.

CUDA upload additionally requires `RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX`. Without it, the manual fallback skips both CUDA zip and runtime manifest so an old stable manifest is never presented as the new CUDA release.

When Authenticode credentials are configured, Tauri signs the application and NSIS during bundling through `bundle.windows.signCommand`; updater `.sig` is generated from those signed bytes. A configured signing failure is hard. An entirely unsigned release remains an explicit policy choice and is reported by runner readiness.

For historical artifact repair, use `.github/workflows/cdn-verify-from-artifacts.yml`. It resolves and checks out the source run commit, then refuses a tag that does not match that commit's three version sources.

## Required evidence

Create or update a release evidence file with:

- Command path: remote workflow run URL or local command flags.
- Version/tag/SHA.
- CPU sidecar built from zero, or explicitly explain any reuse.
- NSIS size under 2 GB.
- Offline zip contains setup exe and `resources/bundled-asr-models/modelscope/`.
- CDN HEAD checks:
  - offline zip
  - offline zip `.sha256`
  - NSIS `.sha256`
  - CUDA zip/runtime manifest if CUDA was expected
- CDN content checks:
  - offline zip bytes match its published `.sha256`
  - NSIS bytes match its published `.sha256` when OTA is published
  - CUDA manifest version/URLs match the tag and the primary CUDA object matches manifest SHA256
- OTA state:
  - `latest.json` updated with both macOS + Windows fragments, or intentionally preserved.

## Required Windows smoke

Before public announcement:

1. Download `*_离线安装包.zip` from CDN.
2. Fully extract to an ASCII path and install from the sibling setup exe.
3. Confirm `$INSTDIR/resources/bundled-asr-models/manifest.json` and `modelscope/` exist.
4. Launch app fresh, wait for first-launch seed, and transcribe one short file.
5. Repeat bare setup negative test: copy only `*_安装包.exe` to a clean first-install machine and confirm the installer aborts with the Chinese full-extract message.
6. Repeat the bare setup negative test with `/S`; confirm a clean first install exits non-zero instead of leaving a model-less installation.

## Historical docs

These are not current operator instructions:

- `docs/execution/specs/win-local-release-chain-audit-2026-07-18.md`
- `docs/execution/specs/pre-release-full-audit-2026-07.md`
- `docs/execution/specs/rel-win-ota-signoff-runbook.md`
- `scripts/ci-pack-windows-portable-zip.ps1`
- `scripts/ci-upload-windows-release-assets.sh`
