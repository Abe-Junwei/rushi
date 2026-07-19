# Windows release chain full audit (2026-07-19)

> Scope: Windows x64 release chain only. This is a static + documentation audit; no new release build, CDN upload, or VM install smoke was run in this pass.

## Read list

- `AI_QUICKSTART.md`
- `CONTEXT.md`
- `.github/workflows/release.yml`
- `package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/windows/rushi-offline-resources.nsh`
- `scripts/v1-windows-release-build.ps1`
- `scripts/upload-windows-release-cdn.ps1`
- `scripts/build-asr-sidecar-windows.ps1`
- `scripts/ci-pack-windows-offline-installer-zip.ps1`
- `scripts/ci-pack-windows-cuda-zip.ps1`
- `scripts/ci-upload-updater-cdn.sh`
- `scripts/ci-verify-updater-manifest.sh`
- `scripts/ci-measure-windows-bundle-size.ps1`
- `scripts/rushi-win-release-artifact-names.ps1`
- `scripts/rushi-win-release-artifact-names.sh`
- `scripts/rushi-resolve-git-sha.ps1`
- `docs/execution/windows-release-checklist.md`
- `docs/execution/specs/win-local-release-chain-audit-2026-07-18.md`
- `docs/execution/specs/win-release-assets-acceptance.md`
- `docs/execution/specs/win-nsis-cpu-cuda-cdn-opt-in-research.md`

## Current intended chain

The current product route is Route 3:

1. Build Windows CPU ASR sidecar onedir.
2. Remove any stale CUDA onedir before NSIS.
3. Prune sidecar deep license trees to avoid `makensis` MAX_PATH failures.
4. Ensure Plan B model weights are absent before NSIS.
5. Build thin NSIS installer with CPU sidecar only.
6. Normalize NSIS to Chinese release name.
7. Stage Plan B bundled models after NSIS.
8. Build offline installer zip containing:
   - Chinese NSIS setup exe
   - sibling `resources/bundled-asr-models/`
9. Upload offline zip and NSIS to CDN.
10. Soft-generate Windows OTA fragment if Tauri `.sig` exists.
11. Soft-build CUDA sidecar zip and runtime manifest for CDN opt-in.
12. `verify-cdn-release` merges `latest.json` only when both macOS and Windows OTA fragments are complete.

Main user distribution is:

`如是我闻_<version>_Windows_x64_离线安装包.zip`

Portable zip is retired as of the current docs and naming helpers.

## Findings

### P0 - Release status is hard to read because core and optional steps share one job

`tauri-windows` uploads the offline zip + NSIS before OTA and CUDA. CUDA build, CUDA signing, CUDA manifest, and CUDA CDN upload are intentionally best-effort. Windows OTA fragment is also soft when `.sig` is absent.

This means one Actions run can leave the real install CDN usable while still looking noisy or partially failed later. Conversely, a missing core offline zip can be visually buried by later CUDA/OTA annotations.

Recommendation: split Windows into three jobs:

- `windows-core-release`: CPU sidecar -> thin NSIS -> offline zip -> artifact/CDN. Hard fail.
- `windows-ota-fragment`: depends on core, soft if `.sig` missing.
- `windows-cuda-opt-in`: depends on core, soft and separately reported.

### P0 - Self-hosted runner is a release single point of failure

The official Windows job requires `[self-hosted, Windows, X64, rushi-release]`; comments note the runner must stay online or the job queues forever. The job also skips setup-node/setup-python and relies on local Node, Python, Git Bash, Rust tooling, `tar`, and PowerShell behavior.

This is operationally fragile: a runner PATH drift, Python Store stub, broken actions toolcache, stale venv, or service user ownership problem blocks the release chain before product code is involved.

Recommendation: add a preflight job or first Windows step that emits a compact machine readiness report and fails before expensive build work:

- runner identity and workspace
- Node/npm versions
- Python path/version/pip/venv
- Rust/cargo version
- Git Bash path
- tar implementation
- aws availability or bootstrap path
- free disk on workspace, temp, artifact drive

### P0 - Current local evidence does not validate the current Route 3 artifact

`win-local-release-chain-audit-2026-07-18.md` signed off a portable zip path, skipped sidecar rebuild, skipped signing, skipped CUDA, skipped CDN, and did not run GUI/seed/transcribe. Current Route 3 requires offline installer zip + POSTINSTALL CopyFiles behavior.

That older evidence is useful historically, but it is not a valid signoff for the current `*_离线安装包.zip` route.

Recommendation: create a fresh Route 3 evidence file after a real build:

- no skip flags for CPU sidecar
- offline zip contents verified
- bare setup abort verified
- extracted offline zip install verified
- first-launch seed verified
- one local transcription verified
- CDN HEAD checks verified

### P1 - Documentation still contains stale portable guidance

The current checklist and acceptance docs say portable is retired, but several execution docs and scripts still mention portable:

- `docs/execution/specs/win-local-release-chain-audit-2026-07-18.md`
- `docs/execution/specs/pre-release-full-audit-2026-07.md`
- `docs/execution/specs/rel-win-ota-signoff-runbook.md`
- `scripts/ci-upload-windows-release-assets.sh`
- deprecated but still present `scripts/ci-pack-windows-portable-zip.ps1`

The risk is not just wording: a human following stale runbooks can upload or verify the wrong artifact.

Recommendation: add a short `docs/execution/windows-release-current.md` as the single human runbook, then mark stale docs with a top warning rather than trying to rewrite all history.

### P1 - NSIS hook behavior is critical but not automatically tested

`rushi-offline-resources.nsh` implements the key Route 3 promise:

- sibling models present -> copy to install dir
- silent/OTA without sibling -> skip
- interactive bare setup without existing models -> abort

The packaging script verifies zip contents, but not installer behavior. The highest-risk user path is therefore only manually covered.

Recommendation: add a Windows VM smoke checklist as a required signoff for every public tag:

- offline zip extracted to ASCII path
- offline zip extracted to Chinese path
- install succeeds and models appear under `$INSTDIR/resources/bundled-asr-models`
- bare setup first install aborts with Chinese explanation
- silent upgrade path does not abort

### P1 - Network-heavy steps lack deterministic fallback boundaries

Windows release depends on downloading ffmpeg from GitHub and Plan B models from ModelScope/cache. There are retries for model staging, but the chain can still fail due to external availability after long build time.

Recommendation:

- cache or vendor the exact ffmpeg sidecar artifact used by Windows build, or preflight the download URL early
- keep ModelScope cache warm on the self-hosted machine
- record cache hit/miss in release evidence
- define whether a local fallback build can reuse an existing sidecar or must rebuild from zero

### P1 - Local fallback upload can create partial CDN states

`upload-windows-release-cdn.ps1` can upload offline zip only, OTA only if `.sig` exists, CUDA only if zip exists, and prints a note that Windows updater fragment must be merged with mac fragment elsewhere.

This is correct for emergency use, but risky as a normal operator path because it can leave install CDN and OTA manifest out of sync.

Recommendation: require a post-upload command in the runbook:

`bash scripts/ci-verify-updater-manifest.sh --tag vX.Y.Z`

For local fallback, also require an explicit table: offline uploaded, NSIS uploaded, latest.json changed or intentionally preserved, CUDA uploaded or intentionally skipped.

### P2 - Artifact naming is mostly centralized, but deprecated names remain callable

Chinese names are centralized in both Bash and PowerShell helpers. That is good. However, portable name helpers and portable pack/upload scripts still exist.

Recommendation: keep helpers for historical scripts if needed, but make deprecated portable pack/upload scripts fail unless an explicit `RUSHI_ALLOW_DEPRECATED_PORTABLE=1` is set.

### P2 - Tauri resource config includes models even though Windows removes them before NSIS

`tauri.conf.json` lists both `resources/bundled-asr` and `resources/bundled-asr-models`. Windows intentionally deletes model weight subtrees before NSIS, then stages them after NSIS for the offline zip. This is subtle and easy to break because the config alone suggests both resources belong in the bundle.

Recommendation: add a comment near release scripts/runbook explaining that `tauri.conf.json` is cross-platform truth, while Windows release mutates staged model content before NSIS by design.

### P2 - Verification script keys off package version, not tag input

`ci-verify-updater-manifest.sh` derives Windows artifact names from `apps/desktop/package.json`, while taking `--tag` separately. Release workflow guards tag/version match on tag push, so CI is safe. Manual fallback must not skip this invariant.

Recommendation: in `upload-windows-release-cdn.ps1`, fail if `-Tag vX.Y.Z` does not match `apps/desktop/package.json` unless an explicit override is set.

## Failure map

| Segment | Typical failure | Current guard | Gap |
|---|---|---|---|
| Runner startup | self-hosted offline, PATH drift | comments + local probes | no standalone readiness dashboard |
| npm install | native optional bindings missing | `ci-ensure-windows-npm-native-bindings.sh` | needs evidence in release report |
| Python | Store stub/toolcache broken | custom Python discovery | no pinned local install contract |
| CPU sidecar | network, pip, PyInstaller, AV-locked venv | checked command wrappers + stale move | slow failure, external download |
| NSIS | MAX_PATH, >2GB/mmap ICE | prune + model removal + size measure | no installer behavior automation |
| Offline zip | Unicode tar path, missing models | ASCII staging + extract verify | no install-time CopyFiles automation |
| CDN | Unicode local path, R2 creds | ASCII alias/staging + R2 env check | partial CDN states possible |
| OTA | missing `.sig`, one platform fragment | soft skip + double-platform gate | status easy to misread |
| CUDA | huge onedir, manifest signing, upload | best-effort | noisy unless split from core |

## Recommended next slice

Do not start by changing package contents again. First make the chain observable and separable:

1. Split `tauri-windows` into core / OTA / CUDA jobs.
2. Add a single Route 3 runbook and mark stale portable docs.
3. Add tag/version guard to local upload.
4. Add a required Route 3 evidence template.
5. Run one no-skip local or CI build and one clean Windows VM install smoke.

Only after those are green should deeper changes be considered.

## Follow-up implementation notes (2026-07-19)

- Renamed the Windows release workflow job to `windows-core-release` so the job status names the hard-gated path.
- Made Windows OTA upload, OTA fragment artifact upload, and CUDA artifact upload soft after core artifacts are produced.
- Added local fallback upload tag/version guard in `scripts/upload-windows-release-cdn.ps1`.
- Added `docs/execution/windows-release-current.md` as the current Route 3 operator entrypoint.
- Added `scripts/check-windows-release-runner.ps1` and wired it into `windows-core-release` before npm install / sidecar build.
- Split CUDA into `windows-cuda-opt-in`, which depends on `windows-core-release` but is not required by `verify-cdn-release`.
- Added a shared three-source version gate and applied it to tag builds, local builds/uploads, and historical artifact repair.
- Bound historical repair to the source workflow run SHA and restored the two-platform OTA publish gate.
- Prevented same-version reruns from reusing a stale normalized NSIS; ambiguous NSIS outputs now fail closed.
- Reworked local CUDA fallback to stage the actual external zip, generate a fresh signed runtime manifest, and upload only a complete zip/manifest pair.
- Replaced Windows OTA fragment `jq` dependency with Node and stripped CRLF from updater signatures.
- Expanded runner readiness with a real tar ZIP round trip, Git Bash Python resolution, curl/sha256sum, disk, and signing-path checks.
- Made configured CPU signing failures hard; added Tauri build-time Authenticode `signCommand` for the app and NSIS so updater signatures cover signed bytes.
- Made silent bare first install fail closed when sibling/existing models are absent.
- Added end-to-end CDN SHA256 verification for offline/NSIS and a post-CUDA manifest/version/URL/hash verifier in the optional CUDA job.
