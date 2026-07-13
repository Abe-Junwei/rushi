import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type SidebarFileDragPayload = {
  fileId: string;
  projectId: string;
  fileName: string;
};

export const SIDEBAR_FILE_DRAG_THRESHOLD_PX = 6;

/**
 * In-app pointer drag for sidebar file → project move.
 * Avoids HTML5 DnD, which Tauri disables while `dragDropEnabled` (OS file drop) is on.
 */
export function useSidebarFileProjectDrag(options: {
  busy: boolean;
  onMove: (args: {
    fileId: string;
    sourceProjectId: string;
    destProjectId: string;
  }) => void;
}) {
  const { busy, onMove } = options;
  const [dragging, setDragging] = useState<SidebarFileDragPayload | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const suppressOpenClickRef = useRef(false);
  const draggingRef = useRef<SidebarFileDragPayload | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const beginFilePointerDrag = useCallback(
    (e: ReactPointerEvent, payload: SidebarFileDragPayload) => {
      if (busy || e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      let started = false;

      const onMovePointer = (ev: PointerEvent) => {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (!started && dist >= SIDEBAR_FILE_DRAG_THRESHOLD_PX) {
          started = true;
          suppressOpenClickRef.current = true;
          draggingRef.current = payload;
          setDragging(payload);
          document.body.style.userSelect = "none";
        }
        if (!started) return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const projectEl = el?.closest("[data-sidebar-project-id]");
        const id = projectEl?.getAttribute("data-sidebar-project-id") ?? null;
        dropTargetRef.current = id;
        setDropTargetId(id);
      };

      const finish = () => {
        window.removeEventListener("pointermove", onMovePointer);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (started) document.body.style.userSelect = "";
        const drag = draggingRef.current;
        const dest = dropTargetRef.current;
        draggingRef.current = null;
        dropTargetRef.current = null;
        setDragging(null);
        setDropTargetId(null);
        if (!started || !drag || !dest || dest === drag.projectId) {
          if (!started) suppressOpenClickRef.current = false;
          return;
        }
        onMoveRef.current({
          fileId: drag.fileId,
          sourceProjectId: drag.projectId,
          destProjectId: dest,
        });
      };

      window.addEventListener("pointermove", onMovePointer);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [busy],
  );

  const consumeOpenClickSuppression = useCallback(() => {
    if (!suppressOpenClickRef.current) return false;
    suppressOpenClickRef.current = false;
    return true;
  }, []);

  return {
    dragging,
    dropTargetId,
    beginFilePointerDrag,
    consumeOpenClickSuppression,
  };
}
