import { correctionStableRulesList } from "../../tauri/correctionApi";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  buildSegmentCorrectionChanges,
  toRulePairs,
} from "../editor/segmentCorrectionRulesApply";

/** 阶段 B 启动前：若仍有稳定规则可匹配当前稿，提示用户先做规则纠错。 */
export async function resolvePendingStageAHint(segments: SegmentDto[]): Promise<string | null> {
  const rows = await correctionStableRulesList();
  const pairs = toRulePairs(rows);
  if (pairs.length === 0) return null;
  const changes = buildSegmentCorrectionChanges(segments, pairs);
  if (changes.length === 0) return null;
  return `检测到 ${changes.length} 条语段仍匹配稳定纠错规则，建议先使用「规则纠错」再智能改稿。`;
}
