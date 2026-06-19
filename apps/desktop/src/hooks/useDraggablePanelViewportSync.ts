import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  readFloatingPanelViewport,
  reconcileFloatingPanelOnViewportResize,
  isFloatingPanelCentered,
  type FloatingPanelViewport,
} from "../components/floatingPanelViewport";
import {
  samePanelPosition,
  samePanelSize,
  type PanelPosition,
  type PanelSize,
} from "../components/draggablePanelGeometry";

type UseDraggablePanelViewportSyncArgs = {
  persistState: boolean;
  viewportMargin: number;
  userSizedRef: React.MutableRefObject<boolean>;
  userMovedRef: React.MutableRefObject<boolean>;
  panelStateRef: React.MutableRefObject<{ position: PanelPosition; size: PanelSize }>;
  clampPanel: (nextPosition: PanelPosition, nextSize: PanelSize) => {
    position: PanelPosition;
    size: PanelSize;
  };
  persistSnapshot: (nextPosition: PanelPosition, nextSize: PanelSize, userSized: boolean) => void;
  setPosition: Dispatch<SetStateAction<PanelPosition>>;
  setSize: Dispatch<SetStateAction<PanelSize>>;
  setCenterMode: (centered: boolean) => void;
  /** 视口变化时上报新视口，供壳层重算 max-height 封顶。 */
  setViewport: (viewport: FloatingPanelViewport) => void;
  preferredDefaultPosition?: (size: PanelSize) => PanelPosition;
};

/**
 * 仅负责视口变化时的位置 reconcile（居中面板保持居中、已移动面板 clamp）与
 * 上报视口尺寸供 auto 高度封顶重算。不再读取任何内容高度。
 */
export function useDraggablePanelViewportSync({
  persistState,
  viewportMargin,
  userSizedRef,
  userMovedRef,
  panelStateRef,
  clampPanel,
  persistSnapshot,
  setPosition,
  setSize,
  setCenterMode,
  setViewport,
  preferredDefaultPosition,
}: UseDraggablePanelViewportSyncArgs) {
  const trackedViewportRef = useRef(readFloatingPanelViewport());
  const clampPanelRef = useRef(clampPanel);
  clampPanelRef.current = clampPanel;
  const persistSnapshotRef = useRef(persistSnapshot);
  persistSnapshotRef.current = persistSnapshot;
  const setViewportRef = useRef(setViewport);
  setViewportRef.current = setViewport;
  const preferredDefaultPositionRef = useRef(preferredDefaultPosition);
  preferredDefaultPositionRef.current = preferredDefaultPosition;

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
        setViewportRef.current(viewport);
        const reconciled = reconcileFloatingPanelOnViewportResize({
          position: pos,
          size: sz,
          prevViewport: prev,
          nextViewport: viewport,
          margin: viewportMargin,
          userMoved: userMovedRef.current,
          preferredDefaultPosition: preferredDefaultPositionRef.current,
        });
        if (reconciled.recentered) {
          pos = reconciled.position;
        }
        setCenterMode(isFloatingPanelCentered(pos, sz, viewport, viewportMargin));
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
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => reconcile()) : null;
    ro?.observe(document.documentElement);

    return () => {
      window.removeEventListener("resize", reconcile);
      vv?.removeEventListener("resize", reconcile);
      vv?.removeEventListener("scroll", reconcile);
      ro?.disconnect();
    };
  }, [panelStateRef, persistState, setCenterMode, setPosition, setSize, userMovedRef, userSizedRef, viewportMargin]);
}
