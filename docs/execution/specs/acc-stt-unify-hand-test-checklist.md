# ACC-STT-UNIFY 手测清单

> **前置**：术语库至少 1 条热词（如「制控」），且勾选 **纳入热词**。

## 本机 FunASR（可独立签收）

**环境**：**关闭**「启用在线 STT」（或未填在线 API Key，确保走本机 8741）。

1. **术语管理**：新增「制控」等词条 → 纳入热词 → 「本次转写将携带」非空。
2. **环境与 ASR → 本机**：模型 **Paraformer 长音频（推荐转写）** → **应用并重启侧车** → 已缓存。
3. 打开有音频的项目 → **从 ASR 拉取转写**（短音频 1～3 分钟即可）。
4. 项目面板 **转写提示条**（`TranscribeHintsBanner`）：
   - [x] **不应**出现 `hotwords_ignored_stub`（说明未走 FunASR 本机）
   - [x] **不应**出现「在线识别引擎不支持术语偏置」（说明误走在线）
   - [x] 能出语段（0 语段时先确认模型为 Paraformer、非 SenseVoice 短句 SKU）
5. （可选）术语拼接超 12k → hints 含截断提示 — 日常可跳过。

- [x] 本机 Paraformer 路径通过

## 在线（条件不足时可整段跳过）

> U2 能力矩阵 UI 已由 Vitest 覆盖；**端到端在线拉取**待有 OpenAI/AssemblyAI/Deepgram Key 后再补。

### OpenAI（有 API Key 时）

- [ ] 环境页启用 OpenAI；厂商卡片有 **术语偏置** 角标
- [ ] 说明区显示 prompt 映射摘要
- [ ] 拉取转写 → 无 `online_vocabulary_unsupported`

### AssemblyAI / Deepgram（可选各测一条）

- [ ] 同上；无 unsupported（配置正确时）

### 不支持厂商（如腾讯云）

- [ ] 启用该厂商并拉取 → hints 含「在线识别引擎不支持术语偏置」类文案

## 签收

| 日期 | 范围 | 结果 | 备注 |
|------|------|------|------|
| 2026-05-31 | 本机 only | ✅ | Paraformer 拉取语段正常；无 stub/在线 unsupported；热词 L2 偏置有限（预期）；在线 STT 延后 |
| | 全量 | ⏳ | 待在线 API Key |

**部分签收**：本机 U1 + 链路已闭合；在线端到端手测仍 ⏳。
