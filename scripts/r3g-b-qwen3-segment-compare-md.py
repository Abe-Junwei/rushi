#!/usr/bin/env python3
"""Emit segment-by-segment markdown from Qwen3 FunASR vs Sherpa spike JSON."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def fmt_time(sec: float | None) -> str:
    if sec is None:
        return "—"
    m = int(sec // 60)
    s = sec % 60
    return f"{m:02d}:{s:06.3f}"


def load_sherpa_segments(path: Path) -> list[dict]:
    d = json.loads(path.read_text(encoding="utf-8"))
    segs = d.get("segments") or []
    if segs:
        return segs
    text = (d.get("text") or "").strip()
    if not text:
        return []
    return [
        {
            "index": 0,
            "start_sec": 0.0,
            "end_sec": d.get("duration_sec"),
            "text": text,
        }
    ]


def load_funasr_segments(path: Path) -> tuple[list[dict], str]:
    d = json.loads(path.read_text(encoding="utf-8"))
    segs = d.get("segments") or []
    hyp = (d.get("full_text") or d.get("hypothesis") or "").strip()
    if not hyp:
        hyp = "".join((s.get("text") or "") for s in segs).strip()
    if not segs and hyp:
        segs = [
            {
                "index": 0,
                "start_sec": 0.0,
                "end_sec": d.get("duration_sec"),
                "text": hyp,
            }
        ]
    else:
        segs = [
            {
                "index": i,
                "start_sec": s.get("start_sec"),
                "end_sec": s.get("end_sec"),
                "text": s.get("text") or "",
            }
            for i, s in enumerate(segs)
        ]
    return segs, hyp


def table_rows(segs: list[dict]) -> list[str]:
    lines = [
        "| # | start | end | dur | chars | text |",
        "|---|-------|-----|-----|-------|------|",
    ]
    for s in segs:
        st, en = s.get("start_sec"), s.get("end_sec")
        dur = (en - st) if st is not None and en is not None else None
        text = (s.get("text") or "").replace("|", "\\|").replace("\n", " ")
        dur_s = f"{dur:.2f}s" if dur is not None else "—"
        lines.append(
            f"| {s.get('index', '—')} | {fmt_time(st)} | {fmt_time(en)} | "
            f"{dur_s} | {len(s.get('text') or '')} | {text} |"
        )
    return lines


def timeline(sherpa: list[dict], funasr: list[dict]) -> list[str]:
    rows: list[tuple[str, dict]] = [("Sherpa", s) for s in sherpa] + [
        ("FunASR", s) for s in funasr
    ]
    rows.sort(key=lambda x: (x[1].get("start_sec") or 0, 0 if x[0] == "Sherpa" else 1))
    lines = ["| engine | # | start | end | text |", "|--------|---|-------|-----|------|"]
    for eng, s in rows:
        text = (s.get("text") or "").replace("|", "\\|").replace("\n", " ")
        lines.append(
            f"| {eng} | {s.get('index', '—')} | {fmt_time(s.get('start_sec'))} | "
            f"{fmt_time(s.get('end_sec'))} | {text} |"
        )
    return lines


def segment_quality_notes(funasr: list[dict]) -> list[str]:
    if not funasr:
        return ["- FunASR 无可用语段。"]
    durs = []
    for s in funasr:
        st, en = s.get("start_sec"), s.get("end_sec")
        if st is not None and en is not None:
            durs.append(en - st)
    one_char = sum(1 for s in funasr if len(s.get("text") or "") <= 1)
    sub_100ms = sum(1 for d in durs if d < 0.1)
    lines = [
        f"- FunASR 语段数：**{len(funasr)}**；单字段 **{one_char}**；dur&lt;100ms **{sub_100ms}**",
    ]
    if one_char > len(funasr) * 0.5:
        lines.append(
            "- ⚠️ ForcedAligner 输出呈 **字级时间戳**，不适合直接作 Rushi 字幕语段；"
            "对照时请优先看 `full_text` 或合并后全文。"
        )
    if durs and max(durs) < 1.0 and len(funasr) > 1:
        lines.append("- ⚠️ 无长语段：时间轴与波形 **不可对齐抽检**。")
    return lines


def render_clip(
    *,
    duration: int,
    sherpa_path: Path,
    funasr_path: Path,
    quant_path: Path | None,
) -> list[str]:
    sherpa = load_sherpa_segments(sherpa_path)
    funasr, _hyp = load_funasr_segments(funasr_path) if funasr_path.is_file() else ([], "")
    quant = (
        json.loads(quant_path.read_text(encoding="utf-8"))
        if quant_path and quant_path.is_file()
        else {}
    )
    cross = quant.get("cross") or {}
    sherpa_q = quant.get("sherpa") or {}
    funasr_q = quant.get("funasr") or {}

    parts = [f"## {duration}s clip", ""]
    if sherpa_q or funasr_q:
        parts.append(
            f"- Sherpa: {sherpa_q.get('segment_count', len(sherpa))} 段，"
            f"{sherpa_q.get('char_count', '—')} 字，RTF {sherpa_q.get('rtf', '—')}"
        )
        parts.append(
            f"- FunASR: {funasr_q.get('segment_count', len(funasr))} 段，"
            f"{funasr_q.get('char_count', '—')} 字，RTF {funasr_q.get('rtf', '—')}"
        )
        if cross:
            parts.append(
                f"- CER（互相对照，无金标）：sherpa|funasr "
                f"**{cross.get('cer_sherpa_vs_funasr_ref', 0):.4f}**；"
                f"funasr|sherpa **{cross.get('cer_funasr_vs_sherpa_ref', 0):.4f}**"
            )
    parts.append("")
    parts.append("### 语段质量备注")
    parts.extend(segment_quality_notes(funasr))
    parts.append("")
    parts.append("### Sherpa ONNX（Silero VAD + Qwen3）")
    parts.append("")
    parts.extend(table_rows(sherpa) if sherpa else ["_无数据_"])
    parts.append("")
    parts.append("### FunASR PyTorch + ForcedAligner")
    parts.append("")
    parts.extend(table_rows(funasr) if funasr else ["_无数据_"])
    parts.append("")
    parts.append("### 时间轴合并（按 start 排序）")
    parts.append("")
    parts.extend(timeline(sherpa, funasr) if sherpa or funasr else ["_无数据_"])
    parts.append("")
    return parts


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: r3g-b-qwen3-segment-compare-md.py <out_dir> [30] [780]", file=sys.stderr)
        return 1

    out_dir = Path(sys.argv[1])
    durations = [int(x) for x in sys.argv[2:]] if len(sys.argv) > 2 else [30, 780]
    pipeline = "vad"

    header = [
        "# Qwen3-0.6B 语段对照（ForcedAligner + VAD pipeline）",
        "",
        "> **Spec**：[r3g-b-qwen3-sherpa-funasr-compare-report.md](../../execution/specs/r3g-b-qwen3-sherpa-funasr-compare-report.md)  ",
        "> **复现**：`RUSHI_FUNASR_FORCED_ALIGNER=Qwen/Qwen3-ForcedAligner-0.6B bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --pipeline vad --duration <sec>`",
        "",
        "## 结论摘要",
        "",
        "| 维度 | Sherpa ONNX | FunASR + ForcedAligner |",
        "|------|-------------|-------------------------|",
        "| 语段时间轴 | ✅ 短语级（~1–8s） | ❌ 字级或塌缩（dur≈0） |",
        "| 全文 | 与 FunASR 同档（互相对照 CER ~0.22–0.24） | `full_text` 可读 |",
        "| 速度 | RTF ~0.12–0.21 | RTF ~0.95–2.2 |",
        "| Rushi 语段契约 | **可抽检、可进编辑器** | **不可直接消费** |",
        "",
        "## Sherpa 双 SKU 含义（未来）",
        "",
        "- **Qwen3-0.6B**：本对照支持将 Sherpa 作为 **首选 Qwen SKU**（VAD 已验证）。",
        "- **Paraformer**：另需 P2 VAD-large + 标点/热词薄片；与本文 **不同 SKU**，勿混读结论。",
        "- FunASR Qwen 路径即使挂 ForcedAligner，**分段仍不合格** → 双 SKU 上 Sherpa 时 **不必复刻 ForcedAligner**。",
        "",
        "## 人工抽检清单",
        "",
        "- [ ] 30s：Sherpa 段 0–8 与听感一致",
        "- [ ] 30s：FunASR 仅 2 段时，以 `full_text` 对照 Sherpa 拼接",
        "- [ ] 780s：抽 10 段（开头/中段/结尾）听感",
        "- [ ] 专名：制控/质控/指控 等是否按 gold 审定",
        "- [ ] gold 就绪后：改算 **对金标 CER**（替换互相对照 CER）",
        "",
    ]

    body: list[str] = []
    for dur in durations:
        sherpa = out_dir / f"sherpa-qwen3-{pipeline}-{dur}s.json"
        funasr = out_dir / f"funasr-qwen3-{dur}s.json"
        quant = out_dir / f"quant-compare-qwen3-0.6b-{pipeline}-{dur}s.json"
        if not sherpa.is_file() and not funasr.is_file():
            continue
        body.extend(
            render_clip(
                duration=dur,
                sherpa_path=sherpa,
                funasr_path=funasr,
                quant_path=quant,
            )
        )

    dest = out_dir / "segment-compare-vad-forced-aligner.md"
    dest.write_text("\n".join(header + body), encoding="utf-8")
    print(dest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
