import type { ContextMenuItem } from "../components/SegmentContextMenu";
import type { SegmentDto } from "../tauri/projectApi";
import { resolveTranscriptFontDisplayLabel, transcriptFontFamilyCssStack } from "../components/editor/editorTranscriptAppearance";
import { listTranscriptFontPxOptions } from "./waveformPrefs";
import {
  buildSegmentContextMenuItems,
  type SegmentContextMenuOrigin,
} from "./segmentContextMenuModel";
import { segmentCanFinalize } from "../services/segmentConfirmEligible";
import { segmentAnnotationMenuLabel } from "./segmentAnnotation";
import { editorShortcutMenuHint } from "./editorShortcutMenuHint";
import { isSegmentFrozen } from "./frozenPlaybackSkip";

/** 正文选区内右键：剪贴板 + 记忆 + 文本外观（字体/字号/加粗/斜体）；删/并/拆见 segmentContextMenuModel。 */
export type SegmentTextContextMenuKey =
  | "copyText"
  | "cutText"
  | "pasteText"
  | "addCorrectionMemory"
  | "toggleBold"
  | "toggleItalic"
  | `font:${string}`
  | `fontSize:${number}`;

export type SegmentTextAppearanceBuildArgs = {
  appearanceDisabled: boolean;
  transcriptFontFamily: string;
  transcriptFontWeight: 500 | 700;
  transcriptFontItalic: boolean;
  transcriptFontPx: number;
  fontOptions: readonly string[];
  fontDisplayLabels?: Readonly<Record<string, string>>;
};

export function buildSegmentTextAppearanceMenuItem(args: SegmentTextAppearanceBuildArgs): ContextMenuItem {
  const fontChildren: ContextMenuItem[] = args.fontOptions.map((family) => ({
    key: `font:${family}`,
    label: resolveTranscriptFontDisplayLabel(family, args.fontDisplayLabels),
    disabled: false,
    checked: family === args.transcriptFontFamily,
    labelStyle: { fontFamily: transcriptFontFamilyCssStack(family) },
  }));

  const fontSizeChildren: ContextMenuItem[] = listTranscriptFontPxOptions().map((px) => ({
    key: `fontSize:${px}`,
    label: `${px}px`,
    disabled: false,
    checked: px === Math.round(args.transcriptFontPx),
    labelStyle: { fontSize: `${px}px` },
  }));

  return {
    key: "appearance",
    label: "文本外观",
    disabled: false,
    children: [
      {
        key: "fontMenu",
        label: "字体",
        disabled: false,
        children:
          fontChildren.length > 0
            ? fontChildren
            : [{ key: "font:__empty", label: "无可用字体", disabled: true }],
      },
      {
        key: "fontSizeMenu",
        label: "字号",
        disabled: false,
        children: fontSizeChildren,
      },
      {
        key: "toggleBold",
        label: "加粗",
        disabled: false,
        checked: args.transcriptFontWeight >= 700,
      },
      {
        key: "toggleItalic",
        label: "斜体",
        disabled: false,
        checked: args.transcriptFontItalic,
      },
    ],
  };
}

export type SegmentRowContextMenuBuildArgs = {
  segmentIdx: number;
  segments: SegmentDto[];
  busy: boolean;
  pointerTimeSec: number;
  origin: SegmentContextMenuOrigin;
  selectionText: string;
  /** Whether the system clipboard currently holds pasteable text (probed async). */
  hasClipboardText: boolean;
  appearance: SegmentTextAppearanceBuildArgs;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  /** Optional explicit multi-select indices (preferred for frozen checks). */
  selectedIndices?: readonly number[];
};

function selectionIncludesFrozen(args: SegmentRowContextMenuBuildArgs): boolean {
  const { segments, segmentIdx, selectedIndices, selectionLo, selectionHi, selectionCount } = args;
  if (selectedIndices && selectedIndices.length > 0) {
    return selectedIndices.some((i) => isSegmentFrozen(segments[i]));
  }
  if ((selectionCount ?? 1) > 1) {
    const lo = selectionLo ?? segmentIdx;
    const hi = selectionHi ?? segmentIdx;
    for (let i = lo; i <= hi; i++) {
      if (isSegmentFrozen(segments[i])) return true;
    }
  }
  return isSegmentFrozen(segments[segmentIdx]);
}

function freezeMenuItem(args: SegmentRowContextMenuBuildArgs, frozen: boolean): ContextMenuItem {
  const label = (() => {
    if ((args.selectionCount ?? 1) > 1) {
      const idxs =
        args.selectedIndices && args.selectedIndices.length > 0
          ? args.selectedIndices
          : Array.from(
              { length: (args.selectionHi ?? args.segmentIdx) - (args.selectionLo ?? args.segmentIdx) + 1 },
              (_, k) => (args.selectionLo ?? args.segmentIdx) + k,
            );
      const anyUnfrozen = idxs.some((i) => !isSegmentFrozen(args.segments[i]));
      return anyUnfrozen ? "冻结选中语段" : "解冻选中语段";
    }
    return frozen ? "解冻语段" : "冻结语段";
  })();
  return {
    key: "toggleFreeze",
    label,
    disabled: false,
    shortcutHint: editorShortcutMenuHint("segment.freezeToggle"),
  };
}

/**
 * 语段列表 / 波形区统一菜单。
 * 不可用项直接省略（不灰显）。
 *
 * 列表顺序：冻结 → 备注 → 剪贴板 → 更正记忆 → 结构 → 文本外观
 * 波形顺序：冻结 → 结构（定稿/合并/删除/拆分）
 */
export function buildSegmentRowContextMenuItems(args: SegmentRowContextMenuBuildArgs): ContextMenuItem[] {
  if (args.busy) return [];

  const hasSelection = args.selectionText.trim().length > 0;
  const segment = args.segments[args.segmentIdx];
  const frozen = isSegmentFrozen(segment);
  const frozenInSelection = selectionIncludesFrozen(args);
  const multi = (args.selectionCount ?? 1) > 1;

  const freezeItem = freezeMenuItem(args, frozen);

  const segmentItems: ContextMenuItem[] = buildSegmentContextMenuItems({
    segmentIdx: args.segmentIdx,
    segments: args.segments,
    busy: args.busy,
    pointerTimeSec: args.pointerTimeSec,
    origin: args.origin,
    canFinalize: segmentCanFinalize(args.segments, args.segmentIdx, args.busy),
    selectionLo: args.selectionLo,
    selectionHi: args.selectionHi,
    selectionCount: args.selectionCount,
    isContiguousSelection: args.isContiguousSelection,
    frozenInSelection,
  });

  if (args.origin !== "segmentList") {
    return [freezeItem, ...segmentItems];
  }

  const items: ContextMenuItem[] = [freezeItem];

  items.push({
    key: "editAnnotation",
    label: segment ? segmentAnnotationMenuLabel(segment) : "添加备注…",
    disabled: false,
    shortcutHint: editorShortcutMenuHint("workflow.segmentAnnotation"),
  });

  if (!multi) {
    if (hasSelection) {
      items.push({
        key: "copyText",
        label: "复制",
        disabled: false,
        shortcutHint: editorShortcutMenuHint("edit.copy"),
      });
      if (!frozen) {
        items.push({
          key: "cutText",
          label: "剪切",
          disabled: false,
          shortcutHint: editorShortcutMenuHint("edit.cut"),
        });
      }
    }
    if (!frozen && args.hasClipboardText) {
      items.push({
        key: "pasteText",
        label: "粘贴",
        disabled: false,
        shortcutHint: editorShortcutMenuHint("edit.paste"),
      });
    }
    if (hasSelection && !frozen) {
      items.push({
        key: "addCorrectionMemory",
        label: "纳入更正记忆…",
        disabled: false,
        shortcutHint: editorShortcutMenuHint("workflow.addCorrectionMemory"),
      });
    }
  }

  items.push(...segmentItems);

  if (!multi && !hasSelection && !frozen && !args.appearance.appearanceDisabled) {
    items.push(buildSegmentTextAppearanceMenuItem(args.appearance));
  }

  return items;
}

export function isSegmentTextContextMenuKey(key: string): key is SegmentTextContextMenuKey {
  return (
    key === "copyText" ||
    key === "cutText" ||
    key === "pasteText" ||
    key === "addCorrectionMemory" ||
    key === "toggleBold" ||
    key === "toggleItalic" ||
    key.startsWith("font:") ||
    key.startsWith("fontSize:")
  );
}

export function parseFontFamilyFromContextMenuKey(key: `font:${string}`): string {
  return key.slice("font:".length);
}

export function parseFontSizeFromContextMenuKey(key: string): number | null {
  if (!key.startsWith("fontSize:")) return null;
  const px = Number(key.slice("fontSize:".length));
  if (!Number.isFinite(px)) return null;
  return Math.round(px);
}
