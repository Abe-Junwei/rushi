# Stitch 上传包 — 波形精修（Waveform Polish）

本文件夹包含上传到 Google Stitch 的素材。**设计真源：** 仓库根 [`DESIGN.md`](../../DESIGN.md)（Notion Zen）。

## 本轮上传（波形精修）

| 编号 | 文件名 | 类型 | 说明 |
|------|--------|------|------|
| 01 | `01-DESIGN.md` | 设计系统 | 由 `prepare-stitch-upload.sh` 从根 `DESIGN.md` 生成 |
| 19 | `19-stitch-waveform-polish-spec.md` | 页面 spec | 波形舞台 6 Frame 需求 + Stitch 提示词 |
| 20 | `20-stitch-waveform-polish-layout.html` | 静态原型 | 6 状态对照 HTML，浏览器可直接打开 |

### 上传组合

```text
01-DESIGN.md
19-stitch-waveform-polish-spec.md
20-stitch-waveform-polish-layout.html
```

### Stitch 使用方式

1. 上传上述三文件。
2. 主提示词：复制 `19-stitch-waveform-polish-spec.md` §7 英文块（或 §8 中文块）。
3. 要求 Stitch **对照 `20-stitch-waveform-polish-layout.html` 的 DOM 层级与比例**出图。
4. 定稿后按 spec §10 回写 `tokens.ts` / `waveform.css` 等。

本地预览 HTML：

```bash
open apps/desktop/stitch-waveform-polish-layout.html
# 或同步后：
open docs/stitch-upload/20-stitch-waveform-polish-layout.html
```

---

## 历史素材（Dense / Comfort 编辑页）

| 编号 | 文件名 | 说明 |
|------|--------|------|
| 15 | `15-stitch-editor-dense-spec.md` | 极限紧凑编辑页 spec |
| 16 | `16-stitch-editor-comfort-spec.md` | 平衡紧凑编辑页 spec |
| 17 | `17-stitch-editor-dense-layout.html` | Dense 静态原型 |
| 18 | `18-stitch-editor-comfort-layout.html` | Comfort 静态原型 |

---

## 通用工作页 / 欢迎页

| 编号 | 文件名 | 说明 |
|------|--------|------|
| 02 | `02-ui-redesign-parallel-dev.md` | UI 重设计流程 |
| 03 | `03-stitch-welcome-page-spec.md` | 欢迎页 spec |
| 04 | `04-stitch-work-page-spec.md` | 工作页 spec（波形细节见 19） |
| 05 | `05-stitch-welcome-page-full.png` | 欢迎页截图 |

---

## 刷新上传包

```bash
bash scripts/prepare-stitch-upload.sh
```

**只编辑：** 仓库根 `DESIGN.md`、`apps/desktop/docs/stitch-*.md`、`apps/desktop/stitch-*.html` — 勿长期单独改 `docs/stitch-upload/` 副本。
