import { useCallback, useEffect, useRef, useState } from "react";
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
} from "../components/floatingPanelViewport";
import {
  resolveContentFitTargetHeight,
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
  contentFitHeight?: number;
  persistPhaseKey?: string;
  layoutRev?: number;
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
  contentFitHeight,
  persistPhaseKey,
  layoutRev = FLOATING_PANEL_LAYOUT_REV,
}: UseDraggablePanelControllerArgs) {
  const storageKey = `panel-state-${id}`;
  const viewportMargin = 16;

  const saved = persistState ? loadFloatingPanelPersistedState(storageKey) : null;
  const phasePersist = resolvePhasePersistedSize(saved, persistPhaseKey, layoutRev);

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
  });

  const fitTargetHeight = resolveContentFitTargetHeight({
    contentFitHeight,
    maxHeight,
    minHeight,
    viewportMargin,
  });

  const userSizedRef = useRef(phasePersist?.userSized === true);
  const userMovedRef = useRef(false);

  const [position, setPosition] = useState<PanelPosition>(() => {
    if (!userSizedRef.current && fitTargetHeight != null && initialState.size.height < fitTargetHeight) {
      return clampPanel(initialState.position, { ...initialState.size, height: fitTargetHeight }).position;
    }
    return initialState.position;
  });
  const [size, setSize] = useState<PanelSize>(() => {
    if (!userSizedRef.current && fitTargetHeight != null && initialState.size.height < fitTargetHeight) {
      return clampPanel(initialState.position, { ...initialState.size, height: fitTargetHeight }).size;
    }
    return initialState.size;
  });
  const [centerMode, setCenterMode] = useState(() =>
    isFloatingPanelCentered(initialState.position, initialState.size, readFloatingPanelViewport(), viewportMargin),
  );
  const panelStateRef = useRef({ position, size });

  useEffect(() => {
    panelStateRef.current = { position, size };
  }, [position, size]);

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

  useEffect(() => {
    userSizedRef.current = phasePersist?.userSized === true;
  }, [persistPhaseKey, phasePersist?.userSized]);

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
  });

  useDraggablePanelViewportSync({
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
  });

  const handleTitleDoubleClick = useCallback(() => {
    userSizedRef.current = false;
    userMovedRef.current = false;
    const targetHeight = resolveContentFitTargetHeight({
      contentFitHeight,
      maxHeight,
      minHeight,
      viewportMargin,
    });
    const nextSize =
      targetHeight != null
        ? clampPanel(position, { ...size, height: targetHeight }).size
        : defaultSize;
    const clamped = clampPanel(position, nextSize);
    setPosition(clamped.position);
    setSize(clamped.size);
    setCenterMode(true);
    persistSnapshot(clamped.position, clamped.size, false);
  }, [clampPanel, contentFitHeight, defaultSize, maxHeight, minHeight, persistSnapshot, position, size]);

  return {
    position,
    size,
    centerMode,
    startDrag,
    handleTitleDoubleClick,
  };
}
