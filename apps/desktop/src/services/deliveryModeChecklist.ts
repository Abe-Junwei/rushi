import type { SegmentDto } from "../tauri/projectApi";

export type DeliveryFinalCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
};

export type DeliveryFinalCheckInput = {
  segments: SegmentDto[];
  hasRecordedMetadata: boolean;
};

export type ProjectMetadataFields = {
  narrator?: string | null;
  recorded_at?: string | null;
  location?: string | null;
  subject?: string | null;
  transcriber?: string | null;
};

export function hasRecordedProjectMetadata(meta: ProjectMetadataFields): boolean {
  const fields = [meta.narrator, meta.recorded_at, meta.location, meta.subject, meta.transcriber];
  return fields.some((f) => (f ?? "").trim().length > 0);
}

export function buildDeliveryFinalChecklist(input: DeliveryFinalCheckInput): DeliveryFinalCheckItem[] {
  const nonEmpty = input.segments.filter((s) => (s.text ?? "").trim().length > 0);
  const hasSegments = input.segments.length > 0;
  const hasText = nonEmpty.length > 0;
  const emptyCount = input.segments.length - nonEmpty.length;

  const items: DeliveryFinalCheckItem[] = [
    {
      id: "has_segments",
      label: "已有语段",
      ok: hasSegments,
      hint: hasSegments ? undefined : "请先完成转写或手动添加语段。",
    },
    {
      id: "has_text",
      label: "至少一条语段含正文",
      ok: hasText,
      hint: hasText ? undefined : "语段均为空，无法导出交付稿。",
    },
  ];

  if (hasSegments && emptyCount > 0) {
    items.push({
      id: "empty_segments",
      label: `空语段 ${emptyCount} 条（导出时将跳过或留空）`,
      ok: true,
      hint: "建议在导出前检查空段。",
    });
  }

  items.push({
    id: "metadata",
    label: "场次信息已填写（建议）",
    ok: input.hasRecordedMetadata,
    hint: input.hasRecordedMetadata
      ? undefined
      : "可在项目信息中填写讲者、录制时间等，交付导出时可附带。",
  });

  return items;
}

export function deliveryFinalChecklistReady(items: DeliveryFinalCheckItem[]): boolean {
  return items.every((item) => item.ok || item.id === "metadata" || item.id === "empty_segments");
}

export function deliveryFinalChecklistBlockingReason(items: DeliveryFinalCheckItem[]): string | null {
  if (deliveryFinalChecklistReady(items)) return null;
  const block = items.find((i) => !i.ok && i.id !== "metadata" && i.id !== "empty_segments");
  return block?.hint ?? block?.label ?? "终检未通过";
}
