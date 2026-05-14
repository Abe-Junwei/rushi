/** 避免默认文件名含路径分隔符、控制字符、Windows 保留名等非法字符。 */
export function safeExportBasename(name: string, ext: "txt" | "srt" | "docx"): string {
  // 1) 控制字符与常见文件系统非法字符
  const illegalChars = new Set(["/", "\\", "?", "%", "*", ":", "|", '"', "<", ">"]);
  let base = Array.from(name, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || illegalChars.has(ch)) return "_";
    return ch;
  }).join("");
  // 2) 连续下划线压缩
  base = base.replace(/_+/g, "_");
  // 3) 首尾空格与句点（Windows 保留名/隐藏文件风险）
  base = base.replace(/^[.\s]+|[.\s]+$/g, "");
  // 4) Windows 保留名（大小写不敏感）
  const winReserved = new Set([
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
  ]);
  if (winReserved.has(base.toUpperCase())) {
    base = `${base}_`;
  }
  // 若处理后仅剩空或下划线，回退到默认名
  if (!base.replace(/_/g, "")) {
    base = "export";
  }
  return `${base}.${ext}`;
}
