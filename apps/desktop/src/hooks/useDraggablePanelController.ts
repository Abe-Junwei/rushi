import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FLOATING_PANEL_LAYOUT_REV,
  loadFloatingPanelPersistedState,
  mergePhaseIntoPersistedState,
  resolvePhasePersistedSize,
  saveFloatingPanelPersistedState,
} from "../components/floatingPanelPersist";
import {
  clampFloatingPanelToViewport,
  isFloatingPanelCentered,
  readFloatingPanelViewport,
  resolveFloatingPanelInitialState,
  snapshotFloatingPanelViewport,
  type FloatingPanelViewport,
} from "../components/floatingPanelViewport";
import {
  resolvePanelMaxHeightCap,
  type PanelHeightMode,
  type PanelPosition,
  type PanelSize,
} from "../components/draggablePanelGeometry";
import { useDraggablePanelPointerDrag } from "./useDraggablePanelPointerDrag";
import { useDraggablePanelViewportSync } from "./useDraggablePanelViewportSync";

export type UseDraggablePanelControllerArgs = {
  id: string;
  defaultPosition: PanelPosition;
  defaultSize: PanelSize;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  persistState?: boolean;
  persistPhaseKey?: string;
  layoutRev?: number;
  preferredDefaultPosition?: (size: PanelSize) => PanelPosition;
  /** true（autoFit / staticFit）：未手拖时随内容贴合（CSS auto 高度）；false（fill）：固定 px 高度。 */
  autoHeight?: boolean;
};

export function useDraggablePanelController({
  id,
  defaultPosition,
  defaultSize,
  minWidth = 320,
  minHeight = 200,
  maxWidth,
  maxHeight,
  persistState = true,
  persistPhaseKey,
  layoutRev = FLOATING_PANEL_LAYOUT_REV,
  preferredDefaultPosition,
  autoHeight = false,
}: UseDraggablePanelControllerArgs) {
  const storageKey = `panel-state-${id}`;
  const viewportMargin = 16;

  const saved = persistState ? loadFloatingPanelPersistedState(storageKey) : null;
  const phasePersist = resolvePhasePersistedSize(saved, persistPhaseKey, layoutRev);
  const persistedUserSized = phasePersist?.userSized === true;

  const clampPanel = useCallback(
    (nextPosition: PanelPosition, nextSize: PanelSize) => {
      const viewport = readFloatingPanelViewport();
      const viewportMaxWidth = Math.max(240, viewport.width - viewportMargin * 2);
      const viewportMaxHeight = Math.max(180, viewport.height - viewportMargin * 2);
      const effectiveMaxWidth = maxWidth != null ? Math.min(maxWidth, viewportMaxWidth) : viewportMaxWidth;
      const effectiveMaxHeight =
        maxHeight != null ? Math.min(maxHeight, viewportMaxHeight) : viewportMaxHeight;
      const clamped = clampFloatingPanelToViewport(nextPosition, nextSize, {
        minWidth,
        minHeight,
        margin: viewportMargin,
      });
      return {
        position: clamped.position,
        size: {
          width: Math.min(clamped.size.width, effectiveMaxWidth),
          height: Math.min(clamped.size.height, effectiveMaxHeight),
        },
      };
    },
    [maxHeight, maxWidth, minHeight, minWidth],
  );

  const resolvedDefaultSize = phasePersist?.size ?? defaultSize;
  const initialState = resolveFloatingPanelInitialState({
    saved: saved ? { ...saved, size: resolvedDefaultSize } : null,
    defaultPosition,
    defaultSize: resolvedDefaultSize,
    margin: viewportMargin,
    clamp: clampPanel,
    preferredDefaultPosition,
  });

  const userSizedRef = useRef(persistedUserSized);
  const userMovedRef = useRef(false);
  const panelElementRef = useRef<HTMLElement | null>(null);

  const [position, setPosition] = useState<PanelPosition>(initialState.position);
  const [size, setSize] = useState<PanelSize>(initialState.size);
  const [centerMode, setCenterMode] = useState(() =>
    isFloatingPanelCentered(initialState.position, initialState.size, readFloatingPanelViewport(), viewportMargin),
  );
  const [heightMode, setHeightMode] = useState<PanelHeightMode>(() =>
    autoHeight && !persistedUserSized ? "auto" : "manual",
  );
  const [viewport, setViewport] = useState<FloatingPanelViewport>(() => readFloatingPanelViewport());

  const panelStateRef = useRef({ position, size });
  useEffect(() => {
    panelStateRef.current = { position, size };
  }, [position, size]);

  const maxHeightCap = useMemo(
    () =>
      resolvePanelMaxHeightCap({
        viewport,
        margin: viewportMargin,
        centered: centerMode,
        top: position.y,
        maxHeight,
      }),
    [centerMode, maxHeight, position.y, viewport],
  );

  const persistSnapshot = useCallback(
    (nextPosition: PanelPosition, nextSize: PanelSize, userSized: boolean) => {
      if (!persistState) return;
      saveFloatingPanelPersistedState(
        storageKey,
        mergePhaseIntoPersistedState({
          prev: loadFloatingPanelPersistedState(storageKey),
          position: nextPosition,
          size: nextSize,
          viewport: snapshotFloatingPanelViewport(),
          userSized,
          phaseKey: persistPhaseKey,
          layoutRev,
        }),
      );
    },
    [layoutRev, persistPhaseKey, persistState, storageKey],
  );

  // 阶段切换（persistPhaseKey 变）或新载入：同步 userSized 与高度模式真源。
  useEffect(() => {
    userSizedRef.current = persistedUserSized;
    setHeightMode(autoHeight && !persistedUserSized ? "auto" : "manual");
  }, [autoHeight, persistPhaseKey, persistedUserSized]);

  const handleResizeStart = useCallback(() => {
    setHeightMode("manual");
  }, []);

  const { startDrag } = useDraggablePanelPointerDrag({
    position,
    size,
    minWidth,
    minHeight,
    maxWidth,
    viewportMargin,
    clampPanel,
    setPosition,
    setSize,
    setCenterMode,
    persistSnapshot,
    persistState,
    panelStateRef,
    userSizedRef,
    userMovedRef,
    panelElementRef,
    autoHeight,
    onResizeStart: handleResizeStart,
  });

  useDraggablePanelViewportSync({
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
  });

  const handleTitleDoubleClick = useCallback(() => {
    userSizedRef.current = false;
    userMovedRef.current = false;
    setCenterMode(true);
    if (autoHeight) {
      setHeightMode("auto");
      persistSnapshot(position, size, false);
      return;
    }
    setHeightMode("manual");
    const clamped = clampPanel(position, defaultSize);
    setSize(clamped.size);
    persistSnapshot(clamped.position, clamped.size, false);
  }, [autoHeight, clampPanel, defaultSize, persistSnapshot, position, size]);

  return {
    position,
    size,
    centerMode,
    heightMode,
    maxHeightCap,
    panelElementRef,
    startDrag,
    handleTitleDoubleClick,
  };
}
