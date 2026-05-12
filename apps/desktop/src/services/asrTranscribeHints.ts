/** 根据 ASR 返回的 engine / warnings 与语段正文生成面向用户的提示（不阻断操作）。 */

export interface SegmentLike {
  text?: string | null;
}

export function deriveTranscribeHints(engine: string, warnings: string[], segments: SegmentLike[]): string[] {
  const hints: string[] = [];
  const eng = engine.toLowerCase();
  if (eng === "stub" || eng.includes("stub")) {
    hints.push(
      "当前识别引擎为 stub（占位）：不会产生正常中文稿。请按说明安装本地 ASR 的 FunASR 扩展并重启服务；未设置 RUSHI_FUNASR_MODEL 时使用内置默认模型，首次 FunASR 转写需联网下载权重。",
    );
  }
  if (warnings.some((w) => w.includes("hotwords_ignored_stub"))) {
    hints.push("本地术语已作为热词提交，但 stub 不会使用；配置 FunASR 后重新拉取可生效。");
  }
  if (warnings.some((w) => w.includes("hotword_param_unsupported"))) {
    hints.push("当前 FunASR 未接受热词参数，已自动回退；可升级 rushi-asr 依赖或忽略。");
  }
  const allEmpty =
    segments.length > 0 && segments.every((s) => !String(s.text ?? "").trim());
  if (allEmpty) {
    hints.push(
      "本次拉取到的语段正文均为空：常见于 stub 或引擎未输出文本。请查看 ASR 日志，并确认 FunASR 已安装且模型权重已下载。",
    );
  }
  return hints;
}
