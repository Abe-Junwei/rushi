import type { CorrectionExplicitPair } from "../tauri/fileApi";
import {
  normalizeCorrectionLearnPair,
  shouldLearnInferredReplacement,
} from "./correctionInferPair";

/** 单次「先删后输」替换（锚点在聚焦基线坐标系）。 */
export type LearnEditOp = {
  anchor: number;
  removed: string;
  inserted: string;
};

export type LearnEditState = {
  ops: LearnEditOp[];
  /** 正在进行的替换；与 ops 中最后一项可能重复引用 */
  activeIndex: number | null;
};

export function emptyLearnEditState(): LearnEditState {
  return { ops: [], activeIndex: null };
}

/** 从 beforeinput 的 textarea 状态截取将被删除的文本。 */
export function captureTextDeletedByBeforeInput(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  inputType: string,
): string {
  if (selectionStart !== selectionEnd) {
    return value.slice(selectionStart, selectionEnd);
  }
  // 中文无空格词界：deleteWord* 退化为单字删除，避免按英文空白切词。
  if (inputType === "deleteWordBackward" || inputType === "deleteWordForward") {
    if (!/\s/.test(value)) {
      return captureTextDeletedByBeforeInput(
        value,
        selectionStart,
        selectionEnd,
        inputType === "deleteWordBackward" ? "deleteContentBackward" : "deleteContentForward",
      );
    }
  }
  if (inputType === "deleteContentBackward" && selectionStart > 0) {
    return value.slice(selectionStart - 1, selectionStart);
  }
  if (inputType === "deleteContentForward" && selectionEnd < value.length) {
    return value.slice(selectionEnd, selectionEnd + 1);
  }
  if (inputType === "deleteWordBackward" && selectionStart > 0) {
    let i = selectionStart - 1;
    while (i > 0 && !/\s/.test(value[i - 1] ?? "")) i -= 1;
    return value.slice(i, selectionStart);
  }
  if (inputType === "deleteWordForward" && selectionEnd < value.length) {
    let i = selectionEnd;
    while (i < value.length && !/\s/.test(value[i] ?? "")) i += 1;
    return value.slice(selectionEnd, i);
  }
  return "";
}

/** 已落库的 op 使 live 相对 baseline 产生的净长度差（按 anchor 升序）。 */
function netLengthDeltaBeforeBaselineIndex(baselineIndex: number, ops: LearnEditOp[]): number {
  let delta = 0;
  for (const op of ops) {
    if (op.anchor < baselineIndex) {
      delta += op.inserted.length - op.removed.length;
    }
  }
  return delta;
}

/** 将当前 live 文档坐标映射到聚焦基线坐标（仅计已 finalize 的 ops）。 */
export function liveIndexToBaselineIndex(
  liveIndex: number,
  finalizedOps: LearnEditOp[],
): number {
  return liveIndex + netLengthDeltaBeforeBaselineIndex(liveIndex, finalizedOps);
}

function activeOp(state: LearnEditState): LearnEditOp | null {
  if (state.activeIndex === null) return null;
  return state.ops[state.activeIndex] ?? null;
}

function finalizeActive(state: LearnEditState): LearnEditState {
  return { ops: state.ops, activeIndex: null };
}

function isDeleteExtendingOp(op: LearnEditOp, deleteBaselineAnchor: number, chunk: string): boolean {
  const r0 = op.anchor;
  const r1 = op.anchor + op.removed.length;
  const len = chunk.length;
  if (len === 0) return false;
  if (deleteBaselineAnchor === r1) return true;
  if (deleteBaselineAnchor + len === r0) return true;
  if (deleteBaselineAnchor >= r0 && deleteBaselineAnchor + len <= r1) return true;
  return false;
}

function isInsertIntoOp(op: LearnEditOp, insertLiveIndex: number, finalizedBefore: LearnEditOp[]): boolean {
  const liveAnchor = op.anchor - netLengthDeltaBeforeBaselineIndex(op.anchor, finalizedBefore);
  const insertEnd = liveAnchor + Math.max(op.inserted.length, op.removed.length);
  return insertLiveIndex >= liveAnchor && insertLiveIndex <= insertEnd;
}

function finalizedBeforeOp(state: LearnEditState, opIndex: number): LearnEditOp[] {
  return state.ops.filter((_, i) => {
    if (i === opIndex) return false;
    if (state.activeIndex !== null && i === state.activeIndex) return false;
    return true;
  });
}

function insertedLiveRange(op: LearnEditOp, finalizedBefore: LearnEditOp[]): { start: number; end: number } {
  const liveStart = op.anchor - netLengthDeltaBeforeBaselineIndex(op.anchor, finalizedBefore);
  return { start: liveStart, end: liveStart + op.inserted.length };
}

/** 在已插入的新词内部删字：改 inserted，勿把 chunk 并入 removed。 */
function tryTrimInsertedOnDelete(
  state: LearnEditState,
  liveDeleteAnchor: number,
  chunk: string,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): LearnEditState | null {
  if (!chunk) return null;

  const opIndices =
    state.activeIndex !== null
      ? [state.activeIndex]
      : [...state.ops.keys()].reverse();

  for (const opIndex of opIndices) {
    const op = state.ops[opIndex];
    if (!op?.inserted.length) continue;

    const finBefore = finalizedBeforeOp(state, opIndex);
    const { start: liveStart, end: liveEnd } = insertedLiveRange(op, finBefore);
    const ops = [...state.ops];

    if (selectionStart !== selectionEnd) {
      const overlapStart = Math.max(selectionStart, liveStart);
      const overlapEnd = Math.min(selectionEnd, liveEnd);
      if (overlapStart >= overlapEnd) continue;
      const relStart = overlapStart - liveStart;
      const relEnd = overlapEnd - liveStart;
      const fromInserted = op.inserted.slice(relStart, relEnd);
      const fromValue = value.slice(overlapStart, overlapEnd);
      if (fromInserted !== fromValue) continue;
      ops[opIndex] = {
        ...op,
        inserted: op.inserted.slice(0, relStart) + op.inserted.slice(relEnd),
      };
      return { ops, activeIndex: state.activeIndex };
    }

    const relStart = liveDeleteAnchor - liveStart;
    if (relStart < 0 || relStart + chunk.length > op.inserted.length) continue;
    if (op.inserted.slice(relStart, relStart + chunk.length) !== chunk) continue;
    ops[opIndex] = {
      ...op,
      inserted: op.inserted.slice(0, relStart) + op.inserted.slice(relStart + chunk.length),
    };
    return { ops, activeIndex: state.activeIndex };
  }

  return null;
}

/** 选区落在上次 inserted 内：更新该 op 的 inserted，勿叠第二条同 anchor op。 */
function tryReplaceSelectionWithinInserted(
  state: LearnEditState,
  selectionStart: number,
  selectionEnd: number,
  removedFromValue: string,
  inserted: string,
): LearnEditState | null {
  if (!removedFromValue || selectionStart >= selectionEnd) return null;

  const opIndices =
    state.activeIndex !== null
      ? [state.activeIndex]
      : [...state.ops.keys()].reverse();

  for (const opIndex of opIndices) {
    const op = state.ops[opIndex];
    if (!op?.inserted.length) continue;

    const finBefore = finalizedBeforeOp(state, opIndex);
    const { start: liveStart, end: liveEnd } = insertedLiveRange(op, finBefore);
    if (selectionStart < liveStart || selectionEnd > liveEnd) continue;

    const relStart = selectionStart - liveStart;
    const relEnd = selectionEnd - liveStart;
    if (op.inserted.slice(relStart, relEnd) !== removedFromValue) continue;

    const ops = [...state.ops];
    ops[opIndex] = {
      ...op,
      inserted: op.inserted.slice(0, relStart) + inserted + op.inserted.slice(relEnd),
    };
    return { ops, activeIndex: null };
  }

  return null;
}

function startOp(state: LearnEditState, baselineAnchor: number, removed: string): LearnEditState {
  const op: LearnEditOp = { anchor: baselineAnchor, removed, inserted: "" };
  const ops = [...state.ops, op];
  return { ops, activeIndex: ops.length - 1 };
}

/** 已 finalize、可参与 live→baseline 坐标映射的 ops。 */
export function finalizedLearnEditOps(state: LearnEditState | undefined): LearnEditOp[] {
  if (!state) return [];
  if (state.activeIndex === null) return state.ops;
  return state.ops.filter((_, i) => i !== state.activeIndex);
}

/** live 文档坐标 → 聚焦基线坐标。 */
export function liveAnchorToBaselineAnchor(
  state: LearnEditState | undefined,
  liveAnchor: number,
): number {
  return liveIndexToBaselineIndex(liveAnchor, finalizedLearnEditOps(state));
}

/** 程序改字（popover / 查找替换等）追加一条完整替换 op。 */
export function appendProgrammaticLearnOp(
  state: LearnEditState | undefined,
  op: LearnEditOp,
): LearnEditState {
  let next = state ?? emptyLearnEditState();
  if (next.activeIndex !== null) {
    next = finalizeActive(next);
  }
  return { ops: [...next.ops, { ...op }], activeIndex: null };
}

function isSelectionReplaceInput(inputType: string, selectionStart: number, selectionEnd: number): boolean {
  if (selectionStart === selectionEnd) return false;
  return (
    inputType === "insertReplacementText" ||
    inputType === "insertFromPaste" ||
    inputType === "insertText"
  );
}

export type TextInputDomSnapshot = {
  value: string;
  start: number;
  end: number;
};

/** WebView 常缺 inputType；用 data / 选区推断。 */
export function normalizeInputEventType(
  inputType: string | undefined | null,
  selectionStart: number,
  selectionEnd: number,
  data: string | null,
): string {
  const t = typeof inputType === "string" ? inputType.trim() : "";
  if (t) return t;
  if (data != null && data !== "") {
    return selectionStart !== selectionEnd ? "insertReplacementText" : "insertText";
  }
  return "deleteContentBackward";
}

/** beforeinput 应用后的预期 live 全文（供聚焦基线 sync）。 */
export function projectLiveTextAfterBeforeInput(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  inputType: string,
  data: string | null,
): string {
  const type = normalizeInputEventType(inputType, selectionStart, selectionEnd, data);
  if (type.startsWith("delete")) {
    const chunk = captureTextDeletedByBeforeInput(value, selectionStart, selectionEnd, type);
    if (!chunk) return value;
    const liveDeleteAnchor =
      selectionStart !== selectionEnd
        ? selectionStart
        : type === "deleteContentBackward" || type === "deleteWordBackward"
          ? selectionStart - chunk.length
          : selectionStart;
    return value.slice(0, liveDeleteAnchor) + value.slice(liveDeleteAnchor + chunk.length);
  }
  if (
    type === "insertText" ||
    type === "insertReplacementText" ||
    type === "insertFromPaste" ||
    type === "insertCompositionText" ||
    type === "insertFromDrop"
  ) {
    const inserted = data ?? "";
    return value.slice(0, selectionStart) + inserted + value.slice(selectionEnd);
  }
  return value;
}

/** 从改前/改后全文推断单次 contiguous 替换（不扩词；仅 DOM 快照选区失准时的兜底）。 */
export function singleContiguousReplaceSpan(
  valueBefore: string,
  valueAfter: string,
): { selStart: number; selEnd: number; inserted: string } | null {
  if (valueBefore === valueAfter) return null;
  let prefix = 0;
  while (
    prefix < valueBefore.length &&
    prefix < valueAfter.length &&
    valueBefore[prefix] === valueAfter[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < valueBefore.length - prefix &&
    suffix < valueAfter.length - prefix &&
    valueBefore[valueBefore.length - 1 - suffix] === valueAfter[valueAfter.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const removed = valueBefore.slice(prefix, valueBefore.length - suffix);
  const inserted = valueAfter.slice(prefix, valueAfter.length - suffix);
  const expected = valueBefore.slice(0, prefix) + inserted + valueBefore.slice(valueBefore.length - suffix);
  if (expected !== valueAfter) return null;
  return { selStart: prefix, selEnd: prefix + removed.length, inserted };
}

/**
 * 追踪 op 的 removed 短于「聚焦基线→live」同一锚点的 contiguous 时，用基线对齐补全。
 * 典型：选区/IME 只记下「学→觉观」，基线相对 live 实为「学关→觉观」。
 */
export function refineLearnOpAgainstBaselineLive(
  focusBaseline: string,
  liveText: string,
  op: LearnEditOp,
  allOps: LearnEditOp[],
): LearnEditOp {
  const span = singleContiguousReplaceSpan(focusBaseline, liveText);
  if (!span || span.selStart !== op.anchor) return op;

  const spanRemoved = focusBaseline.slice(span.selStart, span.selEnd);
  const spanInserted = span.inserted;
  if (spanRemoved.length <= op.removed.length) return op;
  if (!spanRemoved.startsWith(op.removed)) return op;
  if (spanInserted !== op.inserted && !spanInserted.startsWith(op.inserted)) return op;

  const refined: LearnEditOp = {
    anchor: span.selStart,
    removed: spanRemoved,
    inserted: spanInserted,
  };
  if (!shouldLearnInferredReplacement(refined.removed, refined.inserted)) {
    return op;
  }
  const refinedOps = allOps.map((candidate) =>
    candidate === op ? refined : candidate,
  );
  if (
    !learnEditStateMatchesLive(
      { ops: refinedOps, activeIndex: null },
      focusBaseline,
      liveText,
    )
  ) {
    return op;
  }
  return refined;
}

/**
 * 从 input 前后 DOM 快照推断单步删/插（非整段 diff 推断；每 keystroke 一步）。
 * 供 Tauri/WebKit 在 beforeinput 缺 inputType 时的主追踪路径。
 */
export function applyInputEventToLearnEditState(
  state: LearnEditState | undefined,
  baseline: string,
  valueBefore: string,
  selStart: number,
  selEnd: number,
  valueAfter: string,
): LearnEditState {
  if (valueBefore === valueAfter) return state ?? emptyLearnEditState();

  const selLen = Math.max(0, selEnd - selStart);

  if (valueAfter.length === valueBefore.length - selLen) {
    const expected = valueBefore.slice(0, selStart) + valueBefore.slice(selEnd);
    if (expected === valueAfter) {
      return applyBeforeInputToLearnEditState(
        state,
        baseline,
        valueBefore,
        selStart,
        selEnd,
        "deleteContentBackward",
        null,
      );
    }
  }

  if (selLen === 0 && valueAfter.length === valueBefore.length - 1 && selStart > 0) {
    const expected = valueBefore.slice(0, selStart - 1) + valueBefore.slice(selStart);
    if (expected === valueAfter) {
      return applyBeforeInputToLearnEditState(
        state,
        baseline,
        valueBefore,
        selStart,
        selStart,
        "deleteContentBackward",
        null,
      );
    }
  }

  if (selLen === 0 && valueAfter.length === valueBefore.length - 1 && selStart < valueBefore.length) {
    const expected = valueBefore.slice(0, selStart) + valueBefore.slice(selStart + 1);
    if (expected === valueAfter) {
      return applyBeforeInputToLearnEditState(
        state,
        baseline,
        valueBefore,
        selStart,
        selStart,
        "deleteContentForward",
        null,
      );
    }
  }

  const insertedLen = valueAfter.length - valueBefore.length + selLen;
  if (insertedLen > 0) {
    const inserted = valueAfter.slice(selStart, selStart + insertedLen);
    const expected = valueBefore.slice(0, selStart) + inserted + valueBefore.slice(selEnd);
    if (expected === valueAfter) {
      const inputType = selLen > 0 ? "insertReplacementText" : "insertText";
      return applyBeforeInputToLearnEditState(
        state,
        baseline,
        valueBefore,
        selStart,
        selEnd,
        inputType,
        inserted,
      );
    }
  }

  const span = singleContiguousReplaceSpan(valueBefore, valueAfter);
  if (span) {
    if (span.inserted.length === 0 && span.selEnd > span.selStart) {
      return applyBeforeInputToLearnEditState(
        state,
        baseline,
        valueBefore,
        span.selStart,
        span.selEnd,
        "deleteContentBackward",
        null,
      );
    }
    if (span.inserted.length > 0) {
      const inputType = span.selEnd > span.selStart ? "insertReplacementText" : "insertText";
      return applyBeforeInputToLearnEditState(
        state,
        baseline,
        valueBefore,
        span.selStart,
        span.selEnd,
        inputType,
        span.inserted,
      );
    }
  }

  return state ?? emptyLearnEditState();
}

/**
 * 聚焦基线（最初正文）vs 当前 live：每步改字后把 session op 对齐为「最初→此刻」的 contiguous 替换。
 * 多处独立改词且多条增量 op 已能重放 live 时保留多条 op。
 */
function mergeLearnEditOpsByAnchor(ops: LearnEditOp[]): LearnEditOp[] {
  const grouped = new Map<number, { removed: string; inserted: string }>();
  for (const op of ops) {
    const cur = grouped.get(op.anchor) ?? { removed: "", inserted: "" };
    cur.removed += op.removed;
    cur.inserted += op.inserted;
    grouped.set(op.anchor, cur);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([anchor, { removed, inserted }]) => ({ anchor, removed, inserted }));
}

function learnablePairsFromMatchedState(
  state: LearnEditState,
  focusBaseline: string,
  liveText: string,
): CorrectionExplicitPair[] {
  if (!learnEditStateMatchesLive(state, focusBaseline, liveText)) return [];
  const pairs: CorrectionExplicitPair[] = [];
  for (const op of state.ops) {
    const refined = refineLearnOpAgainstBaselineLive(
      focusBaseline,
      liveText,
      op,
      state.ops,
    );
    const normalized = normalizeCorrectionLearnPair(refined.removed, refined.inserted);
    if (!normalized) continue;
    if (!shouldLearnInferredReplacement(refined.removed, refined.inserted)) continue;
    pairs.push({
      beforeText: normalized.beforeText,
      afterText: normalized.afterText,
    });
  }
  return pairs;
}

/**
 * 聚焦基线（最初正文）vs 当前 live：增量 ops 失步或无可学习对时，用「最初→此刻」contiguous 替换重建。
 */
export function syncLearnEditStateToBaselineLive(
  focusBaseline: string,
  liveText: string,
  state: LearnEditState | undefined,
): LearnEditState {
  if (focusBaseline === liveText) return emptyLearnEditState();
  if (!state || state.ops.length === 0) return emptyLearnEditState();

  const merged: LearnEditState = {
    ops: mergeLearnEditOpsByAnchor(state.ops),
    activeIndex: null,
  };
  if (learnEditStateMatchesLive(merged, focusBaseline, liveText)) {
    if (learnablePairsFromMatchedState(merged, focusBaseline, liveText).length > 0) {
      return merged;
    }
    const span = singleContiguousReplaceSpan(focusBaseline, liveText);
    if (span) {
      const removed = focusBaseline.slice(span.selStart, span.selEnd);
      const { inserted } = span;
      const rebuilt: LearnEditState = {
        ops: [{ anchor: span.selStart, removed, inserted }],
        activeIndex: removed.length > 0 && inserted.length === 0 ? 0 : null,
      };
      if (
        learnEditStateMatchesLive(rebuilt, focusBaseline, liveText) &&
        learnablePairsFromMatchedState(rebuilt, focusBaseline, liveText).length > 0
      ) {
        return rebuilt;
      }
    }
  }

  if (learnEditStateMatchesLive(state, focusBaseline, liveText)) {
    const learnable = learnablePairsFromMatchedState(state, focusBaseline, liveText);
    if (learnable.length > 0) {
      return state;
    }
  }

  const span = singleContiguousReplaceSpan(focusBaseline, liveText);
  if (span && !learnEditStateMatchesLive(state, focusBaseline, liveText)) {
    const removed = focusBaseline.slice(span.selStart, span.selEnd);
    const { inserted } = span;
    const rebuilt: LearnEditState = {
      ops: [{ anchor: span.selStart, removed, inserted }],
      activeIndex: removed.length > 0 && inserted.length === 0 ? 0 : null,
    };
    if (learnEditStateMatchesLive(rebuilt, focusBaseline, liveText)) {
      return rebuilt;
    }
  }

  return merged.ops.length > 0 ? merged : state;
}

export function applyBeforeInputToLearnEditState(
  state: LearnEditState | undefined,
  _baseline: string,
  value: string,
  selectionStart: number,
  selectionEnd: number,
  inputType: string,
  data: string | null,
): LearnEditState {
  let next = state ?? emptyLearnEditState();
  const type = normalizeInputEventType(inputType, selectionStart, selectionEnd, data);
  const finalized =
    next.activeIndex === null
      ? next.ops
      : next.ops.filter((_, i) => i !== next.activeIndex);

  if (type.startsWith("delete")) {
    const chunk = captureTextDeletedByBeforeInput(value, selectionStart, selectionEnd, type);
    if (!chunk) return next;

    const liveDeleteAnchor =
      selectionStart !== selectionEnd
        ? selectionStart
        : type === "deleteContentBackward" || type === "deleteWordBackward"
          ? selectionStart - chunk.length
          : selectionStart;

    const trimmed = tryTrimInsertedOnDelete(
      next,
      liveDeleteAnchor,
      chunk,
      value,
      selectionStart,
      selectionEnd,
    );
    if (trimmed) return trimmed;

    const baselineAnchor = liveIndexToBaselineIndex(liveDeleteAnchor, finalized);
    const cur = activeOp(next);

    if (cur && isDeleteExtendingOp(cur, baselineAnchor, chunk)) {
      const ops = [...next.ops];
      const idx = next.activeIndex!;
      const op = ops[idx]!;
      if (baselineAnchor + chunk.length === op.anchor) {
        ops[idx] = { ...op, anchor: baselineAnchor, removed: chunk + op.removed };
      } else {
        ops[idx] = { ...op, removed: op.removed + chunk };
      }
      return { ops, activeIndex: idx };
    }

    if (cur) {
      next = finalizeActive(next);
    }
    return startOp(next, baselineAnchor, chunk);
  }

  if (
    type === "insertText" ||
    type === "insertReplacementText" ||
    type === "insertFromPaste" ||
    type === "insertCompositionText" ||
    type === "insertFromDrop"
  ) {
    const inserted = data ?? "";
    if (!inserted) return next;

    // 选中后直接输入/粘贴/部分环境的 insertText：一次 beforeinput 须记录 removed。
    if (isSelectionReplaceInput(type, selectionStart, selectionEnd)) {
      const removed = value.slice(selectionStart, selectionEnd);
      if (removed) {
        const merged = tryReplaceSelectionWithinInserted(
          next,
          selectionStart,
          selectionEnd,
          removed,
          inserted,
        );
        if (merged) return merged;

        if (activeOp(next)) next = finalizeActive(next);
        const baselineAnchor = liveIndexToBaselineIndex(selectionStart, next.ops);
        const ops = [...next.ops, { anchor: baselineAnchor, removed, inserted }];
        return { ops, activeIndex: null };
      }
    }

    let cur = activeOp(next);
    if (!cur) {
      const baselineAnchor = liveIndexToBaselineIndex(selectionStart, finalized);
      next = startOp(next, baselineAnchor, "");
      cur = activeOp(next)!;
    }

    const fin =
      next.activeIndex === null
        ? next.ops
        : next.ops.filter((_, i) => i !== next.activeIndex);

    if (!isInsertIntoOp(cur, selectionStart, fin)) {
      next = finalizeActive(next);
      const baselineAnchor = liveIndexToBaselineIndex(selectionStart, next.ops);
      next = startOp(next, baselineAnchor, "");
      cur = activeOp(next)!;
    }

    const ops = [...next.ops];
    const idx = next.activeIndex!;
    ops[idx] = { ...ops[idx]!, inserted: ops[idx]!.inserted + inserted };
    return { ops, activeIndex: idx };
  }

  return next;
}

export type PendingCompositionSelection = {
  liveAnchor: number;
  removed: string;
};

/**
 * IME 组词结束：补全 active op 的 removed（选区在 compositionstart 记下），并 finalize。
 * 若 active op 仅删未插（先 Backspace 再 IME），保持 active，由 compositionEnd 的 DOM 快照续写 inserted。
 */
export function finalizeLearnEditAfterComposition(
  state: LearnEditState | undefined,
  pending: PendingCompositionSelection | null,
): LearnEditState {
  if (!state || state.ops.length === 0) return state ?? emptyLearnEditState();
  if (state.activeIndex === null) return state;

  const idx = state.activeIndex;
  const op = state.ops[idx];
  if (!op) return finalizeActive(state);

  if (op.removed.length > 0 && op.inserted.length === 0 && !pending?.removed) {
    return state;
  }

  const finalizedBefore = state.ops.filter((_, i) => i !== idx);
  const ops = [...state.ops];
  if (!op.removed && pending?.removed) {
    ops[idx] = {
      anchor: liveIndexToBaselineIndex(pending.liveAnchor, finalizedBefore),
      removed: pending.removed,
      inserted: op.inserted,
    };
  }
  return { ops, activeIndex: null };
}

/** 按 op 将 baseline 变换为期望 live（锚点均在聚焦基线坐标系）。 */
export function applyLearnEditOpsToText(baseline: string, ops: LearnEditOp[]): string {
  const sorted = [...ops].sort((a, b) => a.anchor - b.anchor);
  let text = baseline;
  let offset = 0;
  for (const op of sorted) {
    const anchor = op.anchor;
    const removed = op.removed;
    if (anchor < 0 || anchor > baseline.length) continue;
    if (removed.length > 0 && baseline.slice(anchor, anchor + removed.length) !== removed) {
      continue;
    }
    const liveAnchor = anchor + offset;
    if (liveAnchor < 0 || liveAnchor + removed.length > text.length) continue;
    if (removed.length > 0 && text.slice(liveAnchor, liveAnchor + removed.length) !== removed) {
      continue;
    }
    text = text.slice(0, liveAnchor) + op.inserted + text.slice(liveAnchor + removed.length);
    offset += op.inserted.length - removed.length;
  }
  return text;
}

/** 严格匹配下的可学习对；追踪 ops 与 live 一致时返回。 */
export function collectLearnablePairsForSession(
  state: LearnEditState | undefined,
  focusBaseline: string,
  liveText: string,
): CorrectionExplicitPair[] {
  const direct = explicitPairsFromLearnEditState(state, focusBaseline, liveText);
  if (direct.length > 0) return direct;
  if (!state || state.ops.length === 0) return [];
  const synced = syncLearnEditStateToBaselineLive(focusBaseline, liveText, state);
  return explicitPairsFromLearnEditState(synced, focusBaseline, liveText);
}

export function learnEditStateMatchesLive(
  state: LearnEditState | undefined,
  baseline: string,
  live: string,
): boolean {
  if (!state || state.ops.length === 0) return false;
  return applyLearnEditOpsToText(baseline, state.ops) === live;
}

export function explicitPairsFromLearnEditState(
  state: LearnEditState | undefined,
  baseline: string,
  live: string,
): CorrectionExplicitPair[] {
  if (!state || !learnEditStateMatchesLive(state, baseline, live)) return [];
  const pairs: CorrectionExplicitPair[] = [];
  for (const op of state.ops) {
    const refined = refineLearnOpAgainstBaselineLive(baseline, live, op, state.ops);
    const normalized = normalizeCorrectionLearnPair(refined.removed, refined.inserted);
    if (!normalized) continue;
    if (!shouldLearnInferredReplacement(refined.removed, refined.inserted)) continue;
    pairs.push({
      beforeText: normalized.beforeText,
      afterText: normalized.afterText,
    });
  }
  return pairs;
}

/** @deprecated 单条 delta；请用 LearnEditState */
export type LearnEditDelta = LearnEditOp;

export function emptyLearnEditDelta(anchor = 0): LearnEditDelta {
  return { anchor, removed: "", inserted: "" };
}

export function applyBeforeInputToLearnEditDelta(
  delta: LearnEditDelta | undefined,
  value: string,
  selectionStart: number,
  selectionEnd: number,
  inputType: string,
  data: string | null,
): LearnEditDelta {
  const state = applyBeforeInputToLearnEditState(
    delta ? { ops: [delta], activeIndex: 0 } : undefined,
    value,
    value,
    selectionStart,
    selectionEnd,
    inputType,
    data,
  );
  return state.ops[state.activeIndex ?? state.ops.length - 1] ?? emptyLearnEditDelta(selectionStart);
}

export function learnEditDeltaMatchesLive(delta: LearnEditDelta, live: string): boolean {
  return learnEditStateMatchesLive({ ops: [delta], activeIndex: 0 }, live, live);
}

export function explicitPairFromLearnEditDelta(
  delta: LearnEditDelta | undefined,
  live: string,
): { beforeText: string; afterText: string } | null {
  if (!delta) return null;
  return explicitPairsFromLearnEditState({ ops: [delta], activeIndex: 0 }, live, live)[0] ?? null;
}
