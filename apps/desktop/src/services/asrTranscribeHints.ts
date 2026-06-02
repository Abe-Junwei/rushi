/** 根据 ASR 返回的 engine / warnings 与语段正文生成面向用户的提示（不阻断操作）。 */

import { parseDominantSpanFilteredCount } from "../utils/segmentMediaSanitize";

export interface SegmentLike {
  text?: string | null;
}

const CORRECTION_RULE_HINT_PREFIX = "correction_rule_hint:";

export function deriveTranscribeHints(engine: string, warnings: string[], segments: SegmentLike[]): string[] {
  const hints: string[] = [];
  const eng = engine.toLowerCase();
  if (eng === "stub" || eng.includes("stub")) {
    hints.push(
      "当前识别引擎为 stub（占位）：不会产生正常中文稿。请按说明安装本地 ASR 的 FunASR 扩展并重启服务；未设置 RUSHI_FUNASR_MODEL 时将使用内置 SenseVoiceSmall，并需先完成当前所选模型准备后再进行正式转写。",
    );
  }
  if (warnings.some((w) => w.includes("hotwords_ignored_stub"))) {
    hints.push("本地术语已作为热词提交，但 stub 不会使用；配置 FunASR 后重新拉取可生效。");
  }
  if (warnings.some((w) => w.startsWith("funasr_skipped:"))) {
    hints.push(
      "FunASR 未参与本次识别（侧车未就绪或模型未配置），已降级为 stub；请完成环境与 ASR 中的模型准备后重新拉取。",
    );
  }
  if (warnings.some((w) => w.includes("stub_no_placeholder_segment"))) {
    hints.push(
      "FunASR 未产出语段（未安装、模型未准备或运行失败）；可在波形上手动新建语段，或先完成本机 ASR 准备。",
    );
  }
  if (warnings.some((w) => w.includes("hotword_param_unsupported"))) {
    hints.push("当前 FunASR 未接受热词参数，已自动回退；可升级 rushi-asr 依赖或忽略。");
  }
  if (warnings.some((w) => w.includes("hotwords_truncated_12k"))) {
    hints.push(
      "术语热词超过 12,000 字符上限，已截断后提交；部分术语未进入识别。可在「术语库」查看「本次转写将携带」摘要。",
    );
  }
  if (warnings.some((w) => w === "online_vocabulary_unsupported")) {
    hints.push("当前在线识别引擎不支持术语偏置，术语表未传入厂商 API；专名依赖手改或换用本机 FunASR / 已支持词表的在线引擎。");
  }
  if (warnings.some((w) => w.startsWith("online_vocabulary_truncated_"))) {
    hints.push("术语表已传入在线引擎，但因厂商上限已截断；可在术语库减少条目或优先保留关键专名。");
  }
  const dominantRemoved = parseDominantSpanFilteredCount(warnings);
  if (dominantRemoved > 0) {
    hints.push(
      `已自动移除 ${dominantRemoved} 条整轨占位语段（与分句结果重复）；正文保留在分句语段中。`,
    );
  }
  if (warnings.some((w) => w.includes("funasr_whole_track_fallback"))) {
    hints.push(
      "识别完成，但模型未返回分句时间戳：已用整轨单语段承载全文。可在波形上拖选拆分，或换用带 sentence_info 的 FunASR 模型后重新拉取。",
    );
  } else if (warnings.some((w) => w.includes("funasr_long_audio_no_segments"))) {
    hints.push(
      "长音频未得到分句时间戳，未生成整轨占位语段。建议换用「Paraformer 长音频（推荐转写）」并确认 VAD/标点权重已缓存，然后重新拉取。",
    );
  } else if (warnings.some((w) => w.includes("transcribe_windowed"))) {
    hints.push(
      "长音频已按固定时间窗在侧车内分段识别并合并时间轴；若语段在窗边界被切断，可在波形上微调段界。",
    );
  } else if (warnings.some((w) => w.includes("funasr_no_timestamps"))) {
    hints.push(
      "识别有全文输出，但无分句时间戳且无法估算时长，未写入语段。请在波形空白处拖选新建语段，或检查 ASR 日志后重试。",
    );
  } else if (warnings.some((w) => w.includes("funasr_no_sentence_segments"))) {
    hints.push(
      "本次未识别到可写入的文本（语段列表为空）。请确认音频有清晰人声，并查看「环境与 ASR」中 FunASR 是否就绪。",
    );
  }
  const allEmpty =
    segments.length > 0 && segments.every((s) => !String(s.text ?? "").trim());
  if (allEmpty) {
    hints.push(
      "本次拉取到的语段正文均为空：常见于 stub 或引擎未输出文本。请查看 ASR 日志，并确认 FunASR 已安装且模型权重已下载。",
    );
  } else if (
    segments.length === 0 &&
    !eng.includes("stub") &&
    !warnings.some(
      (w) =>
        w.includes("funasr_no_timestamps") ||
        w.includes("funasr_no_sentence_segments") ||
        w.includes("funasr_long_audio_no_segments"),
    )
  ) {
    hints.push(
      "拉取已完成，但未生成任何语段。请查看桌面日志（应用数据目录下的 desktop.log）或重试；若使用 SenseVoice，可尝试换用 paraformer-zh 等带分句的模型。",
    );
  }
  for (const w of warnings) {
    if (!w.startsWith(CORRECTION_RULE_HINT_PREFIX)) continue;
    const pair = w.slice(CORRECTION_RULE_HINT_PREFIX.length);
    const [beforeText, afterText] = pair.split("->");
    if (!beforeText || !afterText) continue;
    hints.push(`检测到历史错词：建议将“${beforeText}”修正为“${afterText}”。`);
  }
  return hints;
}
