const EMPTY_SET: ReadonlySet<number> = new Set<number>();

export const SELECTION_ROW_STATE = {
  none: { selected: false, inSelection: false },
  primary: { selected: true, inSelection: false },
  inSelection: { selected: false, inSelection: true },
} as const;

export type SelectionRowState = (typeof SELECTION_ROW_STATE)[keyof typeof SELECTION_ROW_STATE];

export type SelectionChromeSnapshot = {
  primaryIdx: number;
  selectedSet: ReadonlySet<number>;
  version: number;
  fileId: string | null;
};

let snapshot: SelectionChromeSnapshot = {
  primaryIdx: -1,
  selectedSet: EMPTY_SET,
  version: 0,
  fileId: null,
};

/** User click published SC2 before React SC1 transition — reconcile may defer until counts match. */
let pendingUserSelection: { version: number; segmentCount: number } | null = null;

const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getSelectionChromeSnapshot(): SelectionChromeSnapshot {
  return snapshot;
}

export function subscribeSelectionChrome(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function commitSelectionChrome(input: {
  fileId: string | null;
  primaryIdx: number;
  selectedSet: ReadonlySet<number>;
}): SelectionChromeSnapshot {
  const primaryIdx = input.primaryIdx;
  const selectedSet =
    input.selectedSet.size > 0
      ? input.selectedSet
      : primaryIdx >= 0
        ? new Set([primaryIdx])
        : EMPTY_SET;
  snapshot = {
    primaryIdx,
    selectedSet,
    version: snapshot.version + 1,
    fileId: input.fileId,
  };
  notifyListeners();
  return snapshot;
}

export function resetSelectionChrome(fileId: string | null = null): void {
  pendingUserSelection = null;
  snapshot = {
    primaryIdx: -1,
    selectedSet: EMPTY_SET,
    version: snapshot.version + 1,
    fileId,
  };
  notifyListeners();
}

export function markUserSelectionChromePending(version: number, segmentCount: number): void {
  pendingUserSelection = { version, segmentCount };
}

export function clearUserSelectionChromePending(): void {
  pendingUserSelection = null;
}

export function isUserSelectionChromePending(
  snap: SelectionChromeSnapshot,
  segmentCount: number,
): boolean {
  if (pendingUserSelection === null) return false;
  if (pendingUserSelection.version !== snap.version) return false;
  if (pendingUserSelection.segmentCount !== segmentCount) return false;
  if (snap.primaryIdx < 0 || snap.primaryIdx >= segmentCount) return false;
  return true;
}

export function selectionRowState(
  idx: number,
  snap: SelectionChromeSnapshot = getSelectionChromeSnapshot(),
): SelectionRowState {
  if (idx === snap.primaryIdx) return SELECTION_ROW_STATE.primary;
  if (snap.selectedSet.has(idx) && idx !== snap.primaryIdx) {
    return SELECTION_ROW_STATE.inSelection;
  }
  return SELECTION_ROW_STATE.none;
}

export function selectionSetsEqual(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const idx of a) {
    if (!b.has(idx)) return false;
  }
  return true;
}

/** Test-only */
export function resetSelectionChromeStoreForTests(): void {
  pendingUserSelection = null;
  snapshot = {
    primaryIdx: -1,
    selectedSet: EMPTY_SET,
    version: 0,
    fileId: null,
  };
  listeners.clear();
}
