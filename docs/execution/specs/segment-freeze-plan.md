# Plan：语段冻结（Freeze）

> **Research**：[segment-freeze-research.md](./segment-freeze-research.md)  
> **Intent**：[segment-freeze-intent.md](./segment-freeze-intent.md) · **Acceptance**：[segment-freeze-acceptance.md](./segment-freeze-acceptance.md)

## 薄片顺序

| # | 薄片 | 交付 |
|---|------|------|
| S1 | 数据 | `SegmentDto.frozen` + SQLite + load/save + dirty/fingerprint + `segmentMeta.frozen` |
| S2 | 锁与视觉 | 右键+快捷键 toggle；CM 拒写；结构拒；文本/波形 **斜纹** |
| S3 | 播放与导出 | 全局 seek-jump 跳过；导出过滤 `frozen` |

## 关键改动（预告）

- Rust：`SegmentDto`、`segment_cmd` / `file_cmd`、schema migration `frozen INTEGER NOT NULL DEFAULT 0`
- TS：`projectTypes`、`segmentListHelpers`、`segmentMetaField`、`segmentDtoToMeta`
- CM：`frozenLineGuard`（transactionFilter）；line decoration hatch
- UI：`segmentTextContextMenuModel`；shortcut registry `segment.freezeToggle`
- 播放：`frozenPlaybackSkip.ts` + 挂全局播帧（非 scoped bound）
- 导出：DOCX/SRT/文本路径 filter `!frozen`
- 波形：band canvas 冻结段斜纹 fill

## 快捷键（v1）

| Action | 建议绑定 | 说明 |
|--------|----------|------|
| `segment.freezeToggle` | `Mod-Shift-F` | 对 primary（或选区）toggle；全冻结→解冻，否则冻结未冻段 |

## 验证

`npm run typecheck && npm run test`（定向：helpers / guard / skip / export）+ `node scripts/check-architecture-guard.mjs` + acceptance 手测。
