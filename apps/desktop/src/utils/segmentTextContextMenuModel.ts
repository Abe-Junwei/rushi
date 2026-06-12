import type { ContextMenuItem } from "../components/SegmentContextMenu";
import type { SegmentDto } from "../tauri/projectApi";
import { transcriptFontFamilyCssStack, resolveTranscriptFontDisplayLabel } from "../components/editor/editorTranscriptAppearance";
import {
  buildSegmentContextMenuItems,
  type SegmentContextMenuOrigin,
} from "./segmentContextMenuModel";
import { segmentCanFinalize } from "../services/segmentConfirmEligible";
import { segmentAnnotationMenuLabel } from "./segmentAnnotation";
import { editorShortcutMenuHint } from "./editorShortcutMenuHint";

/** 正文选区内右键：记忆 + 文本外观（字体/字号/加粗/斜体）；删/并/拆见 segmentContextMenuModel。 */
export type SegmentTextContextMenuKey =
  | "addCorrectionMemory"
  | "toggleBold"
  | "toggleItalic"
  | "fontSizeDecrease"
  | "fontSizeIncrease"
  | `font:${string}`;

export type SegmentTextAppearanceBuildArgs = {
  appearanceDisabled: boolean;
  transcriptFontFamily: string;
  transcriptFontWeight: 500 | 700;
  transcriptFontItalic: boolean;
  transcriptFontPx: number;
  fontSizeAtMin: boolean;
  fontSizeAtMax: boolean;
  fontOptions: readonly string[];
  fontDisplayLabels?: Readonly<Record<string, string>>;
};

export function buildSegmentTextAppearanceMenuItem(args: SegmentTextAppearanceBuildArgs): ContextMenuItem {
  const fontChildren: ContextMenuItem[] = args.fontOptions.map((family) => ({
    key: `font:${family}`,
    label: resolveTranscriptFontDisplayLabel(family, args.fontDisplayLabels),
    disabled: args.appearanceDisabled,
    checked: family === args.transcriptFontFamily,
    labelStyle: { fontFamily: transcriptFontFamilyCssStack(family) },
  }));

  return {
    key: "appearance",
    label: "文本外观",
    disabled: args.appearanceDisabled,
    children: [
      {
        key: "fontMenu",
        label: "字体",
        disabled: args.appearanceDisabled,
        children:
          fontChildren.length > 0
            ? fontChildren
            : [{ key: "font:__empty", label: "无可用字体", disabled: true }],
      },
      {
        key: "fontSizeDecrease",
        label: `减小字号 (${Math.round(args.transcriptFontPx)}px)`,
        disabled: args.appearanceDisabled || args.fontSizeAtMin,
      },
      {
        key: "fontSizeIncrease",
        label: "增大字号",
        disabled: args.appearanceDisabled || args.fontSizeAtMax,
      },
      {
        key: "toggleBold",
        label: "加粗",
        disabled: args.appearanceDisabled,
        checked: args.transcriptFontWeight >= 700,
      },
      {
        key: "toggleItalic",
        label: "斜体",
        disabled: args.appearanceDisabled,
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
  appearance: SegmentTextAppearanceBuildArgs;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
};

/**
 * 语段列表 / 波形区统一菜单构建。
 * - 列表 + 有刻意选区：纳入更正记忆 + 删/并/定稿（无文本外观）
 * - 列表 + 无选区：删/并/定稿 + 文本外观
 * - 波形：删/并/拆（无文本外观）
 */
export function buildSegmentRowContextMenuItems(args: SegmentRowContextMenuBuildArgs): ContextMenuItem[] {
  const hasSelection = args.selectionText.trim().length > 0;
  const segment = args.segments[args.segmentIdx];

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
  });

  if (args.origin !== "segmentList") {
    return segmentItems;
  }

  const annotationItem: ContextMenuItem = {
    key: "editAnnotation",
    label: segment ? segmentAnnotationMenuLabel(segment) : "添加备注…",
    disabled: args.busy,
    shortcutHint: editorShortcutMenuHint("workflow.segmentAnnotation"),
  };

  if ((args.selectionCount ?? 1) > 1) {
    return [annotationItem, ...segmentItems];
  }

  if (hasSelection) {
    return [
      annotationItem,
      {
        key: "addCorrectionMemory",
        label: "纳入更正记忆…",
        disabled: args.busy,
        shortcutHint: editorShortcutMenuHint("workflow.addCorrectionMemory"),
      },
      ...segmentItems,
    ];
  }

  return [annotationItem, ...segmentItems, buildSegmentTextAppearanceMenuItem(args.appearance)];
}

export function isSegmentTextContextMenuKey(key: string): key is SegmentTextContextMenuKey {
  return (
    key === "addCorrectionMemory" ||
    key === "toggleBold" ||
    key === "toggleItalic" ||
    key === "fontSizeDecrease" ||
    key === "fontSizeIncrease" ||
    key.startsWith("font:")
  );
}

export function parseFontFamilyFromContextMenuKey(key: `font:${string}`): string {
  return key.slice("font:".length);
}
