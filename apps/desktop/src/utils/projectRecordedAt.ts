/** Hub / 导出共用：场次采集时间（ISO 片段或自由描述，见 project-hub-metadata-research）。 */

/** 输入框 placeholder：展示常见写法，不做强制校验。 */
export const RECORDED_AT_PLACEHOLDER = "2024-03、2024-03-15、约 1990 年代";

/** 字段下方说明：建议格式，用户可按实际情况自由填写。 */
export const RECORDED_AT_FORMAT_HINT =
  "建议格式：YYYY-MM（到月）、YYYY-MM-DD（到日），或自由描述如「约 1990 年代」。按实际掌握的信息填写即可。";

export function normalizeRecordedAtForSave(value: string | null | undefined): string {
  return (value ?? "").trim();
}
