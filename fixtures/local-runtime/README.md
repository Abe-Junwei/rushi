# Local runtime hand-test fixtures

Large sidecar zips and signed manifests are **generated locally** and gitignored.

```bash
npm run asr:prepare-local-runtime-fixtures
```

Then point the desktop app at a manifest (debug / insecure policy only):

```bash
export RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST=1
export RUSHI_LOCAL_RUNTIME_MANIFEST_URL="file://$(pwd)/fixtures/local-runtime/darwin-arm64/healthy/rushi-runtime-manifest.json"
```

Use the `corrupt-missing-funasr-version` manifest to exercise missing FunASR marker recovery.
