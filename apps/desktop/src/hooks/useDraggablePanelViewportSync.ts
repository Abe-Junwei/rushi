import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  readFloatingPanelViewport,
  reconcileFloatingPanelOnViewportResize,
} from "../components/floatingPanelViewport";
import {
  resolveContentFitTargetHeight,
  samePanelPosition,
  samePanelSize,
  type PanelPosition,
  type PanelSize,
} from "../components/draggablePanelGeometry";

type UseDraggablePanelViewportSyncArgs = {
  persistState: boolean;
  viewportMargin: number;
  contentFitHeight?: number;
  maxHeight?: number;
  minHeight: number;
  userSizedRef: React.MutableRefObject<boolean>;
  userMovedRef: React.MutableRefObject<boolean>;
  panelStateRef: React.MutableRefObject<{ position: PanelPosition; size: PanelSize }>;
  clampPanel: (nextPosition: PanelPosition, nextSize: PanelSize) => {
    position: PanelPosition;
    size: PanelSize;
  };
  persistSnapshot: (nextPosition: PanelPosition, nextSize: PanelSize, userSized: boolean) => void;
  position: PanelPosition;
  setPosition: Dispatch<SetStateAction<PanelPosition>>;
  setSize: Dispatch<SetStateAction<PanelSize>>;
  setCenterMode: (centered: boolean) => void;
};

export function useDraggablePanelViewportSync({
  persistState,
  viewportMargin,
  contentFitHeight,
  maxHeight,
  minHeight,
  userSizedRef,
  userMovedRef,
  panelStateRef,
  clampPanel,
  persistSnapshot,
  position,
  setPosition,
  setSize,
  setCenterMode,
}: UseDraggablePanelViewportSyncArgs) {
  useLayoutEffect(() => {
    if (contentFitHeight == null || userSizedRef.current) return;

    const targetHeight = resolveContentFitTargetHeight({
      contentFitHeight,
      maxHeight,
      minHeight,
      viewportMargin,
    });
    if (targetHeight == null) return;

    setSize((prev: PanelSize) => {
      if (prev.height === targetHeight) return prev;
      const clamped = clampPanel(position, { ...prev, height: targetHeight });
      setPosition(clamped.position);
      persistSnapshot(clamped.position, clamped.size, false);
      return clamped.size;
    });
  }, [clampPanel, contentFitHeight, maxHeight, minHeight, persistSnapshot, position, setPosition, setSize, userSizedRef, viewportMargin]);

  const trackedViewportRef = useRef(readFloatingPanelViewport());
  const clampPanelRef = useRef(clampPanel);
  clampPanelRef.current = clampPanel;
  const persistSnapshotRef = useRef(persistSnapshot);
  persistSnapshotRef.current = persistSnapshot;

  useLayoutEffect(() => {
    const reconcile = () => {
      const viewport = readFloatingPanelViewport();
      const prev = trackedViewportRef.current;
      const viewportChanged =
        prev.width !== viewport.width ||
        prev.height !== viewport.height ||
        prev.offsetX !== viewport.offsetX ||
        prev.offsetY !== viewport.offsetY;

      const current = panelStateRef.current;
      let pos = current.position;
      const sz = current.size;

      if (viewportChanged) {
        trackedViewportRef.current = viewport;
        const reconciled = reconcileFloatingPanelOnViewportResize({
          position: pos,
          size: sz,
          prevViewport: prev,
          nextViewport: viewport,
          margin: viewportMargin,
          userMoved: userMovedRef.current,
        });
        if (reconciled.recentered) {
          pos = reconciled.position;
          setCenterMode(true);
        }
      }

      const next = clampPanelRef.current(pos, sz);
      const changed =
        !samePanelPosition(current.position, next.position) || !samePanelSize(current.size, next.size);
      if (!samePanelPosition(current.position, next.position)) setPosition(next.position);
      if (!samePanelSize(current.size, next.size)) setSize(next.size);
      if (changed) {
        panelStateRef.current = next;
      }
      if (viewportChanged && persistState && changed) {
        persistSnapshotRef.current(next.position, next.size, userSizedRef.current);
      }
    };
    reconcile();
    const vv = window.visualViewport;
    window.addEventListener("resize", reconcile);
    vv?.addEventListener("resize", reconcile);
    vv?.addEventListener("scroll", reconcile);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => reconcile())
        : null;
    ro?.observe(document.documentElement);

    return () => {
      window.removeEventListener("resize", reconcile);
      vv?.removeEventListener("resize", reconcile);
      vv?.removeEventListener("scroll", reconcile);
      ro?.disconnect();
    };
  }, [panelStateRef, persistState, setCenterMode, setPosition, setSize, userMovedRef, userSizedRef, viewportMargin]);
}
