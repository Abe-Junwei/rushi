# Stitch 上传包 — 波形精修（Waveform Polish）

本文件夹包含上传到 Google Stitch 的素材。**设计真源：** 仓库根 [`DESIGN.md`](../../DESIGN.md)（Notion Zen）。

## 欢迎页 × 项目 Hub 统一重设计（本轮推荐）

| 编号 | 文件名 | 类型 | 说明 |
|------|--------|------|------|
| 01 | `01-DESIGN.md` | 设计系统 | 由 `prepare-stitch-upload.sh` 从根 `DESIGN.md` 生成 |
| 23 | `23-stitch-welcome-hub-unified-spec.md` | 页面 spec | Welcome + Hub 共享 Stage Card；8 Frame + 提示词 |
| 24 | `24-stitch-welcome-hub-layout.html` | 静态原型 | W1 / H1 / E1 三栏对照 HTML |

### 上传组合

```text
01-DESIGN.md
23-stitch-welcome-hub-unified-spec.md
24-stitch-welcome-hub-layout.html
```

### Stitch 使用方式

1. 上传上述三文件。
2. 主提示词：复制 `23-stitch-welcome-hub-unified-spec.md` §11 英文块（或 §12 中文块）。
3. 要求 Stitch **对照 `24-stitch-welcome-hub-layout.html` 的 Stage Card 与 FileRow 比例**出图。
4. 必出 **W1 与 H1 并排对照** Frame，验证两页文件行同构。
5. 定稿后按 spec §14 回写 `WelcomeView` / `ProjectFilesHubPanel` / 抽取共享组件。

本地预览 HTML：

```bash
open apps/desktop/stitch-welcome-hub-layout.html
```

---

## 波形精修（历史）

| 编号 | 文件名 | 类型 | 说明 |
|------|--------|------|------|
| 19 | `19-stitch-waveform-polish-spec.md` | 页面 spec | 波形舞台 6 Frame 需求 + Stitch 提示词 |
| 20 | `20-stitch-waveform-polish-layout.html` | 静态原型 | 6 状态对照 HTML，浏览器可直接打开 |

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
| 03 | `03-stitch-welcome-page-spec.md` | 欢迎页 spec（**旧**；见 23 统一稿） |
| 04 | `04-stitch-work-page-spec.md` | 工作页 spec（波形细节见 19） |
| 23 | `23-stitch-welcome-hub-unified-spec.md` | **Welcome × Hub 统一重设计** |
| 24 | `24-stitch-welcome-hub-layout.html` | Welcome/Hub/Empty 静态对照 |
| 05 | `05-stitch-welcome-page-full.png` | 欢迎页截图（历史） |

---

## 刷新上传包

```bash
bash scripts/prepare-stitch-upload.sh
```

**只编辑：** 仓库根 `DESIGN.md`、`apps/desktop/docs/stitch-*.md`、`apps/desktop/stitch-*.html` — 勿长期单独改 `docs/stitch-upload/` 副本。
