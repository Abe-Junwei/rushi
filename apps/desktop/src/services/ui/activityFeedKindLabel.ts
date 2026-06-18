import type { ActivityFeedKind } from "./activityFeed";

export function activityFeedKindLabel(kind: ActivityFeedKind | undefined): string | null {
  switch (kind) {
    case "batch_transcribe":
      return "批量转写";
    case "transcribe":
      return "转写";
    case "export":
      return "导出";
    case "edit_history":
      return "编辑历史";
    default:
      return null;
  }
}
