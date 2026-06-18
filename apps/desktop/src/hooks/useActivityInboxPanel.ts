import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearActivityFeedHistory,
  markActivityFeedRead,
} from "../services/ui/activityFeed";
import {
  ACTIVITY_INBOX_CLOSE_EVENT,
  ACTIVITY_INBOX_TOGGLE_EVENT,
} from "../services/ui/activityInboxEvents";

type Args = {
  onPanelOpen?: () => void;
};

export function useActivityInboxPanel({ onPanelOpen }: Args = {}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);

  const openPanel = useCallback(() => {
    markActivityFeedRead();
    onPanelOpen?.();
    setOpen(true);
  }, [onPanelOpen]);

  const togglePanel = useCallback(() => {
    setOpen((prev) => {
      if (prev) return false;
      markActivityFeedRead();
      onPanelOpen?.();
      return true;
    });
  }, [onPanelOpen]);

  const markAllRead = useCallback(() => {
    markActivityFeedRead();
  }, []);

  const clearHistory = useCallback(() => {
    clearActivityFeedHistory();
  }, []);

  useEffect(() => {
    const onToggle = () => togglePanel();
    const onClose = () => closePanel();
    window.addEventListener(ACTIVITY_INBOX_TOGGLE_EVENT, onToggle);
    window.addEventListener(ACTIVITY_INBOX_CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(ACTIVITY_INBOX_TOGGLE_EVENT, onToggle);
      window.removeEventListener(ACTIVITY_INBOX_CLOSE_EVENT, onClose);
    };
  }, [closePanel, togglePanel]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const target = event.target;
      if (!(target instanceof Node) || root?.contains(target)) return;
      closePanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, closePanel]);

  const handleBellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Escape") {
        closePanel();
        return;
      }
      if (e.key === "ArrowDown" && !open) {
        e.preventDefault();
        openPanel();
      }
    },
    [closePanel, open, openPanel],
  );

  return {
    open,
    rootRef,
    closePanel,
    openPanel,
    togglePanel,
    markAllRead,
    clearHistory,
    handleBellKeyDown,
  };
}
