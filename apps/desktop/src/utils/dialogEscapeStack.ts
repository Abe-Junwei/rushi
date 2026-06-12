export type DialogEscapeEntry = {
  close: () => void;
  canClose?: () => boolean;
};

const stack: DialogEscapeEntry[] = [];
let listenerAttached = false;

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;

  const top = stack[stack.length - 1];
  if (!top) return;
  if (top.canClose?.() === false) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  top.close();
}

/** Whether a floating / modal dialog is registered to consume Escape. */
export function hasOpenDialogEscapeHandler(): boolean {
  return stack.length > 0;
}

export function registerDialogEscape(entry: DialogEscapeEntry): () => void {
  stack.push(entry);

  if (!listenerAttached) {
    window.addEventListener("keydown", handleKeyDown, true);
    listenerAttached = true;
  }

  return () => {
    const index = stack.lastIndexOf(entry);
    if (index >= 0) stack.splice(index, 1);

    if (stack.length === 0 && listenerAttached) {
      window.removeEventListener("keydown", handleKeyDown, true);
      listenerAttached = false;
    }
  };
}

/** Test-only: reset stack and listener between cases. */
export function resetDialogEscapeStackForTests(): void {
  stack.length = 0;
  if (listenerAttached) {
    window.removeEventListener("keydown", handleKeyDown, true);
    listenerAttached = false;
  }
}
