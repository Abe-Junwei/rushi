/** 正文选区内右键：仅记忆入口；删/并/拆见 `segmentContextMenuModel`（行/波形）。 */
export type SegmentTextContextMenuKey = "addCorrectionMemory";

export type SegmentTextContextMenuItem = {
  key: SegmentTextContextMenuKey;
  label: string;
  disabled: boolean;
};

export function buildSegmentTextContextMenuItems(args: {
  selectionText: string;
  busy: boolean;
}): SegmentTextContextMenuItem[] {
  const hasSelection = args.selectionText.trim().length > 0;
  return [
    {
      key: "addCorrectionMemory",
      label: "纳入更正记忆…",
      disabled: args.busy || !hasSelection,
    },
  ];
}
