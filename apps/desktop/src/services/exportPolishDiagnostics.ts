import type { CorrectionRuleRow } from "../tauri/correctionApi";
import {
  isPunctuationOnlyLineDiff,
  stripForPunctCompare,
  type ExportPolishLineChange,
} from "./exportPolishPipeline";
import { graphemeCount, splitGraphemes } from "./text/grapheme";
import type { ExportRuleApplyStats } from "./exportPolishFinalize";

export type ExportPolishLlmLineOutcome = "unchanged" | "adopted_punct" | "adopted_typo";

export type ExportPolishLineDiagnostic = {
  lineIndex: number;
  llmOutcome: ExportPolishLlmLineOutcome;
  llmHanEditRatio: number;
  ruleChanged: boolean;
};

export type ExportPolishDiagnosticSummary = {
  lines: ExportPolishLineDiagnostic[];
  llmTypoLines: number;
  llmPunctLines: number;
  llmRejectedLines: number;
  typoInFinal: number;
  punctInFinal: number;
  singleCharRulesSkipped: number;
  acceptedSingleCharRules: number;
};

function classifyLlmLine(before: string, llm: string): ExportPolishLlmLineOutcome {
  if (llm === before) return "unchanged";
  if (isPunctuationOnlyLineDiff(before, llm)) return "adopted_punct";
  return "adopted_typo";
}

export function countSingleCharRulesInHints(rules: CorrectionRuleRow[]): {
  acceptedSingleCharRules: number;
  singleCharRulesSkipped: number;
} {
  let acceptedSingleCharRules = 0;
  let singleCharRulesSkipped = 0;
  for (const r of rules) {
    if (splitGraphemes(r.wrong.trim()).length !== 1) continue;
    if (r.acceptedAsRule) acceptedSingleCharRules += 1;
    else singleCharRulesSkipped += 1;
  }
  return { acceptedSingleCharRules, singleCharRulesSkipped };
}

function llmHanEditRatioForLine(before: string, llm: string): number {
  const b = stripForPunctCompare(before);
  const a = stripForPunctCompare(llm);
  const maxLen = Math.max(graphemeCount(b), graphemeCount(a), 1);
  if (b === a) return 0;
  const ag = splitGraphemes(b);
  const bg = splitGraphemes(a);
  const n = ag.length;
  const m = bg.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= m; j += 1) dp[0]![j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = ag[i - 1] === bg[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return (dp[n]![m] ?? maxLen) / maxLen;
}

export function buildExportPolishDiagnosticSummary(args: {
  beforeLines: string[];
  llmLines: string[];
  llmMerged: string[];
  finalLines: string[];
  lineChanges: ExportPolishLineChange[];
  ruleStats: ExportRuleApplyStats;
  rules: CorrectionRuleRow[];
}): ExportPolishDiagnosticSummary {
  const { acceptedSingleCharRules, singleCharRulesSkipped } = countSingleCharRulesInHints(
    args.rules,
  );
  const lines: ExportPolishLineDiagnostic[] = [];
  let llmTypoLines = 0;
  let llmPunctLines = 0;
  const n = args.beforeLines.length;
  for (let i = 0; i < n; i += 1) {
    const before = args.beforeLines[i] ?? "";
    const llm = args.llmLines[i] ?? before;
    const merged = args.llmMerged[i] ?? before;
    const final = args.finalLines[i] ?? before;
    const outcome = classifyLlmLine(before, llm);
    if (outcome === "adopted_typo") llmTypoLines += 1;
    if (outcome === "adopted_punct") llmPunctLines += 1;
    lines.push({
      lineIndex: i,
      llmOutcome: outcome,
      llmHanEditRatio: llmHanEditRatioForLine(before, llm),
      ruleChanged: merged !== final,
    });
  }

  let typoInFinal = 0;
  let punctInFinal = 0;
  for (const row of args.lineChanges) {
    if (row.punctuationOnly) punctInFinal += 1;
    else typoInFinal += 1;
  }

  return {
    lines,
    llmTypoLines,
    llmPunctLines,
    llmRejectedLines: 0,
    typoInFinal,
    punctInFinal,
    singleCharRulesSkipped,
    acceptedSingleCharRules,
  };
}

export function formatExportPolishDiagnosticHint(summary: ExportPolishDiagnosticSummary): string | null {
  const parts: string[] = [];
  if (summary.typoInFinal === 0 && summary.llmTypoLines === 0) {
    parts.push("最终无错字修订");
  }
  if (summary.singleCharRulesSkipped > 0 && summary.acceptedSingleCharRules === 0) {
    parts.push(
      `${summary.singleCharRulesSkipped} 条单字记忆未「纳入规则」，导出不会自动替换（需在纠错记忆中点纳入规则）`,
    );
  }
  if (summary.acceptedSingleCharRules > 0) {
    parts.push(`已启用 ${summary.acceptedSingleCharRules} 条纳入规则的单字替换`);
  }
  if (summary.llmTypoLines === 0 && summary.typoInFinal === 0 && summary.llmPunctLines > 0) {
    parts.push("模型仅改标点；明显错字请在记忆库纳入规则或检查 LLM 配置");
  }
  if (summary.llmPunctLines === 0 && summary.llmTypoLines === 0 && summary.typoInFinal === 0) {
    parts.push("模型 lines 与语段未产生可展示修订，请检查 LLM 输出");
  }
  return parts.length > 0 ? parts.join("；") : null;
}

