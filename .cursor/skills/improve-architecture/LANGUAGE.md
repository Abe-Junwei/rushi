# Architecture Review Language

与 Matt Pocock `improve-codebase-architecture` 对齐，适配 Rushi/Jieyu 用语。

## Core terms

| Term | Meaning |
|------|---------|
| **Module** | Anything with an interface and implementation |
| **Interface** | Everything a caller must know: types, invariants, errors, ordering — not just signatures |
| **Implementation** | Code inside the module |
| **Depth** | Leverage at the interface; deep = much behavior behind small interface |
| **Seam** | Where behavior can change without editing call sites |
| **Adapter** | Concrete implementation at a seam |
| **Locality** | Bugs and changes stay inside one module |
| **Leverage** | What callers gain from a deep module |

## Principles

1. **Deletion test** — Delete the module. If complexity vanishes, it was shallow. If it reappears across callers, it was earning its keep.
2. **The interface is the test surface** — Test through public API; survive refactors.
3. **One adapter = hypothetical seam. Two adapters = real seam.**

## Rushi-specific seams (examples)

| Domain term | Likely seam |
|-------------|-------------|
| ASR capability | `buildLocalAsrCatalogView`, `/health` + D1–D6 derivations |
| Close Gate | `useProjectCloseGateController` public callbacks |
| Export | `exportFormatters` / `buildDocxExportMetaLine` |
| Waveform scroll | `setTierScrollPx`, `resolveTierViewportMetrics` |

## Do not re-litigate

Check `docs/adr/` first. Only flag ADR conflicts when friction is real enough to reopen.
