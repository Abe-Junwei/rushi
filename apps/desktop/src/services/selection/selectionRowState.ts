export const SELECTION_ROW_STATE = {
  none: { selected: false, inSelection: false },
  primary: { selected: true, inSelection: false },
  inSelection: { selected: false, inSelection: true },
} as const;

export type SelectionRowState = (typeof SELECTION_ROW_STATE)[keyof typeof SELECTION_ROW_STATE];
