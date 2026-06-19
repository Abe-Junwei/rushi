# Pre-release Full Code Scan 2026-06

Status: complete for code scan; release sign-off still requires manual L3 evidence

Scope: independent full-repository release scan for Rushi, covering frontend, Rust/Tauri, Python ASR sidecar, cross-boundary contracts, state interaction consistency, cross-cutting release risks, and integration gates.

## Decisions

- Output: findings report plus immediate P0/P1 remediation; P2 items are registered as backlog.
- Baseline: fresh independent scan; previous 2026-06-16 findings are not assumed.
- Evidence: run full machine gates and record command results.

## Severity

- P0: blocks release. Examples: crash, data loss, security issue, contract mismatch, state contradiction.
- P1: high risk with workaround or limited blast radius. Examples: missing error handling, concurrency hazard, architecture threshold breach.
- P2: low risk or follow-up. Examples: naming, dead code, doc drift, non-blocking test gap.

## Gate Evidence

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Frontend typecheck | `npm run typecheck -w @rushi/desktop` | Pass | rerun after fixes |
| Frontend tests/lint/guard | `npm run test && npm run lint && node scripts/check-architecture-guard.mjs` | Pass | 319 test files, 1558 tests; guard 0 errors / 0 warnings |
| Rust tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | Pass | 404 passed after fixes |
| Rust fmt/clippy | `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check && cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml -- -D warnings` | Pass | `cargo fmt` applied before final `--check` |
| ASR pytest | `npm run asr:test` | Pass | 129 passed, 2 skipped after Qwen3 ASR cleanup |
| Desktop perf | `npm run test:perf -w @rushi/desktop` | Pass | 2 files, 5 tests |
| E2E ASR | `npm run desktop:test:e2e:asr` | Pass | 2 Playwright tests |
| E2E desktop shell | `npm run desktop:test:e2e:desktop` | Pass | 7 Playwright tests, mocked Tauri shell |
| npm audit | `npm audit --audit-level=high` | Pass | 0 vulnerabilities |
| cargo audit | `cargo audit` | Pass with warnings | 17 RustSec warnings, all reported as allowed warnings by cargo-audit |
| pip audit (venv before lock refresh) | `pip-audit` in `services/asr/.venv` | Fail | 18 vulnerabilities in 8 packages; triggered lock refresh |
| pip audit (CPU sidecar lock after dropping `qwen-asr`) | `pip-audit -r services/asr/requirements-sidecar-cpu-macos-arm64.lock` | Pass | No known vulnerabilities found |
| pip audit (CUDA sidecar lock) | `pip-audit -r services/asr/requirements-sidecar-cuda-win_amd64.lock` | Not comparable on macOS | macOS resolver cannot install `torch==2.11.0+cu126`; requires Windows/CUDA/PyTorch index audit |
| Release postbuild verify | `bash scripts/release-postbuild-verify.sh` | Pass | Existing macOS `.app`, bundled sidecar stamp, ffmpeg/ffprobe, frontend bundle, waveform probe passed |
| codebase-memory impact | `detect_changes(project=Users-junwei-Rushi, scope=working_tree, since=HEAD, depth=2)` | Complete | 70 changed files in dirty working tree, impacted symbols empty; includes pre-existing user changes |

## Findings

### P0

#### P0-1: DB-backed audio paths could be consumed outside App Data

Status: fixed.

Affected paths:

- `apps/desktop/src-tauri/src/project/run_transcribe_cmd/sync.rs`
- `apps/desktop/src-tauri/src/project/run_transcribe_cmd/async_cmd.rs`
- `apps/desktop/src-tauri/src/project/waveform_peaks_cmd.rs`
- `apps/desktop/src-tauri/src/project/asset_scope.rs`
- `apps/desktop/src-tauri/src/project/utils.rs`

Risk: if `files.audio_path` is corrupted or tampered with, transcribe, waveform generation, or release `asset://` scope could read or expose a local file outside Rushi App Data.

Fix: added `resolve_audio_path_under_root(root, raw_path)` and required it before transcribe, async finalize, waveform peaks, and asset scope registration. It rejects empty paths, symlinks, files outside App Data, and non-files.

Verification: Rust test suite passes; new focused tests cover accepted/rejected paths.

#### P0-2: local ASR transcribe URL could target non-loopback hosts

Status: fixed.

Affected paths:

- `apps/desktop/src-tauri/src/project/local_transcribe_gate.rs`
- local transcribe callers through `project_run_transcribe` and `project_transcribe_async_start`

Risk: `asr_base_url` could point to a non-local HTTP server that mimics `/health`, causing audio upload outside the local sidecar boundary.

Fix: local ASR gate now validates the base URL with `is_asr_loopback_url`; only loopback `:8741` is accepted.

Verification: Rust test suite passes; new test rejects `example.com:8741` and `127.0.0.1:9999`.

#### P0-3: release process blockers remain outside code scan

Status: not fixed in code scan; manual release sign-off required.

Evidence:

- `docs/execution/release-parity-l3-hand-test-checklist-2026-06-14.md` is not signed off.
- `docs/execution/release-parity-evidence-2026-06-14.md` records L3 No-Go.
- fresh/upgrade profile evidence is still not recorded.
- copy-code-drift dynamic items 7-A through 7-D remain open.

Reason: these require installed package/manual UI evidence or release assets. They are not code defects and were explicitly outside the automated scan.

### P1

#### P1-1: find/replace could apply stale match offsets after drafts changed

Status: fixed.

Affected path: `apps/desktop/src/pages/useFindReplaceMutations.ts`

Risk: after a search is committed, editing draft text before replace could leave `matches[].charStart` stale, causing replacement at the wrong offset.

Fix: all write actions now flush drafts and recompute matches from `segmentPublish.getCurrentSegmentsSnapshot()` before applying current/next/replace-all operations.

Verification: frontend typecheck/test/lint/guard pass.

#### P1-2: async ASR upload failure leaked temporary job directories

Status: fixed.

Affected paths:

- `services/asr/rushi_asr/app.py`
- `services/asr/tests/test_transcribe.py`

Risk: `/v1/transcribe/async` created `rushi_asr_job_*` before upload; if upload failed before `start_transcribe_async`, no job thread owned cleanup.

Fix: async endpoint now cleans `tmp_path` unless handoff to the job succeeds.

Verification: full ASR pytest passes; new test covers oversized async upload cleanup.

#### P1-3: async ASR jobs had no active-job limit

Status: fixed.

Affected paths:

- `services/asr/rushi_asr/transcribe_job.py`
- `services/asr/tests/test_transcribe_job.py`

Risk: repeated async uploads could spawn multiple transcribe threads and accumulate temporary audio resources even though inference is single-worker.

Fix: added `RUSHI_MAX_TRANSCRIBE_JOBS` with default `1`; active overflow raises `transcribe_job_limit`, mapped to HTTP 429.

Verification: full ASR pytest passes; new unit test covers rejecting a second active job.

#### P1-4: ASR pytest depended on local FunASR availability

Status: fixed.

Affected path: `services/asr/tests/test_transcribe.py`

Risk: contract tests expected stub output but loaded the real FunASR path on this machine, causing release gate instability.

Fix: tests that assert stub contract now mock `transcribe_with_funasr` to the `funasr_model_not_configured` branch.

Verification: full ASR pytest passes.

#### P1-5: local sync transcribe did not pass cancel state to multipart helper

Status: fixed.

Affected path: `apps/desktop/src-tauri/src/project/run_transcribe_cmd/sync.rs`

Risk: local sync transcribe received `request_id` but called multipart with `cancel: None`, so cancellation could not abort before request send.

Fix: local path now passes `TranscribeCancelPoll` derived from `request_id`.

Verification: Rust test suite passes.

#### P1-6: selected-model state could be bypassed by global ASR readiness

Status: fixed for direct code paths found in this scan.

Affected paths:

- `apps/desktop/src/pages/usePrepareModelController.ts`
- `apps/desktop/src/services/asr/asrOneClickPrepareModelFlow.ts`
- `apps/desktop/src/pages/useAsrSetupHealthFlow.ts`
- `apps/desktop/src/pages/useProjectAsrBridgeStack.ts`

Risk: UI or preflight could trust stale coordinator/global `ready_for_transcribe` instead of current selected SKU state.

Fixes:

- prepare-model short-circuit now also requires `selected_model_ready !== false`.
- one-click prepare final checks trust selected model snapshot (`ready` + `sidecarMatchesSelection`).
- health flow final readiness no longer adds redundant global D5 condition.
- local transcribe preflight prefers real-time `asrPresentation.blockReason` before coordinator snapshot.

Verification: frontend typecheck/test/lint/guard pass.

#### P1-7: DashScope returned resource URLs were not domain-limited

Status: fixed.

Affected paths:

- `apps/desktop/src-tauri/src/stt_native/dashscope_upload.rs`
- `apps/desktop/src-tauri/src/stt_native/dashscope_file_asr.rs`

Risk: DashScope policy/result payloads supplied URLs that the client later POSTed/GETed. They were accepted without checking the host.

Fix: added HTTPS Aliyun/DashScope domain allowlist for upload host and transcription result URL.

Verification: Rust test suite passes; new tests cover allowed Aliyun domains and rejected non-Aliyun/non-HTTPS URLs.

#### P1-8: desktop log writes were not globally secret-redacted

Status: fixed.

Affected path: `apps/desktop/src-tauri/src/project/utils.rs`

Risk: individual logging sites could write raw vendor HTTP response snippets containing `sk-*`, bearer tokens, or JSON secret fields.

Fix: `append_desktop_log_line` now applies existing `redact_secrets_for_log` to all desktop log lines.

Verification: Rust test suite passes; existing log redaction tests cover token patterns.

#### P1-9: Python sidecar lock contained vulnerable `transformers` through `qwen-asr`

Status: fixed by dropping `qwen-asr` support from the release sidecar dependency set and removing the current runtime Qwen3 ASR / forced-aligner path.

Evidence:

- `npm audit --audit-level=high` passed.
- Installed `cargo-audit` and `pip-audit`, then reran audits.
- Regenerated `services/asr/requirements-sidecar-cpu-macos-arm64.lock` and `services/asr/requirements-sidecar-cuda-win_amd64.lock`.
- Lock refresh fixed `cryptography`, `idna`, `pillow`, `python-multipart`, `setuptools`, `starlette`, and CPU `torch`.
- Initial CPU lock audit still reported `transformers==4.57.6` advisories `PYSEC-2025-217` and `CVE-2026-1839`.
- Probing `transformers==5.0.0rc3` failed `pip check` because `qwen-asr==0.0.6` requires `transformers==4.57.6`.
- Product decision: drop official `qwen-asr` package support from release sidecar dependencies.
- Updated `services/asr/pyproject.toml` `funasr` extra to remove `qwen-asr`.
- Removed current Qwen3 ASR profile, `RUSHI_FUNASR_FORCED_ALIGNER` handling, forced-aligner prepare/download/load-plan fields, and Qwen-specific cache/load tests.
- Regenerated CPU/CUDA sidecar locks; CPU lock now uses `transformers==5.12.1`.
- `pip-audit -r services/asr/requirements-sidecar-cpu-macos-arm64.lock` now reports no known vulnerabilities.
- `npm run asr:test` passes after the dependency removal.
- CUDA lock still cannot be audited on macOS with default indexes because `torch==2.11.0+cu126` is Windows/CUDA-specific.

Recommendation: keep Qwen3 ASR experiments out of release sidecar locks unless a future research slice reintroduces them with a clean dependency graph and dedicated acceptance evidence. Audit CUDA lock on a Windows/CUDA runner.

#### P1-10: release postbuild verification was not captured in the first scan

Status: fixed for current macOS artifact.

Evidence:

- `bash scripts/release-postbuild-verify.sh` passed.
- Verified existing macOS `.app`, app binary, bundled `ffmpeg`/`ffprobe`, bundled ASR sidecar, sidecar build stamp, frontend bundle embedding, and waveform release probe.

### P2 / Backlog

- L3 manual UI sign-off, fresh/upgrade profile, and copy-code-drift dynamic rows remain release exit criteria.
- `asr_supervisor_snapshot`, `waveform_release_probe`, and `quality_save_report_from_json` are registered/permissioned commands with no TS callers. Decide whether to wire or deprecate.
- `useFindReplaceController.ts`, `useProjectLifecycleWiring.ts`, `useProjectCloseGateController.ts`, `usePrepareModelController.ts`, and `useExportController.ts` remain near architecture thresholds but do not currently fail the guard.
- `stt_read_api_key` still returns STT secrets to the WebView. It is not fixed in this scan because the current online STT flow appears to depend on the WebView bridge; it should be redesigned so Rust reads stored secrets server-side.
- `security-audit` is non-blocking in CI (`continue-on-error: true`); decide whether release workflows should fail on high-severity advisories. Local tools now exist, but CI should provision them explicitly.
- E2E desktop tests are mocked Tauri browser tests, not installed WKWebView/packaged-app tests.
- Python ASR still lacks ruff/mypy gates.
- CUDA sidecar lock still needs Windows/CUDA audit because macOS cannot resolve `torch==2.11.0+cu126` from the default/PyPI resolver.
- Historical Qwen3 / `qwen-asr` spike docs and `scripts/r3g-b-*` spike utilities remain archival. Current release sidecar dependencies and runtime paths no longer include the official `qwen-asr` package, Qwen3 ASR profile, or `RUSHI_FUNASR_FORCED_ALIGNER` path.

## Round Notes

### Round 0 - Baseline

- Initial frontend L0 passed: 319 test files / 1558 tests; lint passed; architecture guard 0 errors / 0 warnings.
- Initial Rust test suite passed: 399 tests.
- Initial ASR pytest failed 2 tests because real FunASR was loaded where tests expected stub. This was fixed by explicit mocking; final ASR pytest passes.

### Round 1 - Frontend

- Fixed P1 find/replace stale offset write risk.
- No P0 found in segmentPublish boundary, setState-DOM guard, CSP style usage, token CSS, or plugin loader.

### Round 2 - Rust/Tauri

- Fixed P0 App Data root enforcement for DB audio paths.
- Fixed P0 loopback-only ASR URL enforcement.
- Fixed P1 local sync transcribe cancellation wiring.
- Applied `cargo fmt`; full Rust tests and clippy pass.

### Round 3 - Python ASR

- Fixed async upload temp cleanup.
- Added active async job limit with HTTP 429 mapping.
- Stabilized stub contract tests.
- Full ASR pytest passes.

### Round 4 - Contracts

- Tauri command triangle remains guarded by architecture guard.
- Added DashScope resource URL allowlist for vendor-returned client fetch/upload URLs.
- Multipart transcribe remains Rust-only; loopback JSON proxy is unchanged.

### Round 5 - State Interaction

- Repaired direct D5/global-ready bypasses found in prepare/onboarding/preflight paths.
- Remaining selected-model state checks should continue to rely on `computeLocalAsrTranscribeReady` and selected model snapshots.

### Round 6 - Cross-cutting

- Desktop logs now globally redact secrets.
- npm audit passed.
- Installed `cargo-audit`; `cargo audit` passed with 17 allowed warnings.
- Installed `pip-audit`; ASR venv audit exposed vulnerable transitive sidecar packages.
- Dropped `qwen-asr` from release sidecar extras and regenerated CPU/CUDA sidecar locks via existing scripts.
- Removed current release runtime support for Qwen3 ASR profile / forced aligner env-only path; Qwen3 IDs now fall through to generic FunASR filtering rather than productized Qwen behavior.
- CPU sidecar lock audit now has no known vulnerabilities.
- Release parity postbuild verify was rerun on 2026-06-19 and passed; manual L3 evidence remains open.

### Round 7 - Integration

- E2E ASR: 2 passed.
- E2E desktop mock shell: 7 passed.
- Perf: 2 files / 5 tests passed.
- Release postbuild verify passed against the existing macOS `.app`.

### Round 8 - Remediation

- Code-level P0/P1 items identified as fixable in this scan were remediated and verified.
- Remaining P0/P1 items are release process/tooling blockers, not code defects fixed in this pass.

