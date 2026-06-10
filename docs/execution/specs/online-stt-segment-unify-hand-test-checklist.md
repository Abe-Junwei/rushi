# 在线 STT 统一分段 — Hand-test Checklist

> **Acceptance**：[`online-stt-segment-unify-acceptance.md`](./online-stt-segment-unify-acceptance.md)

用于 Implement 后人工验证；每项记录 **日期 / 结果 / 备注**。

---

## 0. 准备

- [ ] `npm run tauri dev` 或已安装 desktop build
- [ ] 测试音频：
  - [ ] **A**：3–5min 中文访谈，句间明显停顿，wav **&lt; 17MB**
  - [ ] **B**：30s 英文短样本（OpenAI / Deepgram 可选）
- [ ] 各厂商 Key 已配置（百炼 sk- 必填本薄片）
- [ ] 日志路径：`~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log`

---

## 1. 百炼 Fun-ASR（SSE）— 主路径

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| HT-DS-01 | 新建项目 → 导入音频 A → 选 **百炼** 在线转写 | 转写成功 | |
| HT-DS-02 | 打开时间轴 / 分段列表 | **≥2** 个 segment | |
| HT-DS-03 | 抽查 segment 文本拼接 | 与全文一致 | |
| HT-DS-04 | 搜索 log `DashScope` / `SSE` / `sentence` | 见 SSE enable、sentence count ≥2 | |
| HT-DS-05 | 编辑某段文字 → 保存 | 正常持久化 | |
| HT-DS-06 | 若已配术语库 | 专有名词仍识别正确（回归 ALI） | |

**波形抽样（ACC-SEG-PREC-01）**

| segment # | 句首听感 vs 显示 start | 误差粗估 |
|-----------|------------------------|----------|
| 1 | | |
| 2 | | |
| … | | |

通过线：10 句中位误差 &lt; 300ms。

---

## 2. Deepgram（回归）

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| HT-DG-01 | 音频 A 或 B → Deepgram 转写 | 成功 | |
| HT-DG-02 | 分段数 | 与 Implement 前同音频 **相当**（允许 ±1 若 gap 统一） | |
| HT-DG-03 | 无 proportional hint（有 words 时） | | |

---

## 3. AssemblyAI（回归）

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| HT-AA-01 | 异步 Job 完成 | 成功 | |
| HT-AA-02 | 分段数 | 与 golden 相当 | |

---

## 4. OpenAI（若 P3 已交付）

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| HT-OAI-01 | whisper-1 路径转写 | ≥2 segments（有停顿样本） | |
| HT-OAI-02 | 无 silent 冒充 gpt-4o 词级 | | |

---

## 5. Tier C 降级（可选，需构造无词级 mock 或 stub）

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| HT-TIERC-01 | 触发 Tier C（见 plan 测试 hook 或故障注入） | ≥2 段 + **估算** hint | |

---

## 6. 边界

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| HT-EDGE-01 | &gt;17MB wav + 百炼 | 明确错误提示（非整轨单段） | |
| HT-EDGE-02 | 无效 Key | 转写失败，UI 错误可读 | |
| HT-EDGE-03 | 本机 Paraformer 转写 | 行为与改前一致 | |

---

## 7. 执行记录

| 轮次 | 日期 | 执行人 | P1–P4 范围 | 结论 |
|------|------|--------|------------|------|
| 1 | | | | |

**备注**

（记录 unrelated 测试失败、环境差异等）
