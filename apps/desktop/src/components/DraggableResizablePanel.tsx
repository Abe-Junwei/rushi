import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  FLOATING_PANEL_LAYOUT_REV,
  loadFloatingPanelPersistedState,
  mergePhaseIntoPersistedState,
  resolvePhasePersistedSize,
  saveFloatingPanelPersistedState,
} from "./floatingPanelPersist";
import {
  clampFloatingPanelToViewport,
  isFloatingPanelCentered,
  readFloatingPanelViewport,
  reconcileFloatingPanelOnViewportResize,
  resolveFloatingPanelInitialState,
  snapshotFloatingPanelViewport,
} from "./floatingPanelViewport";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface DraggableResizablePanelProps {
  id: string;
  title: string;
  defaultPosition: Position;
  defaultSize: Size;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  children: React.ReactNode;
  onClose: () => void;
  persistState?: boolean;
  zIndex?: number;
  /** 随内容自动调整高度；用户手动改尺寸后跨会话保留（userSized）。 */
  contentFitHeight?: number;
  persistPhaseKey?: string;
  layoutRev?: number;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function sameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height;
}

function resolveContentFitTargetHeight(args: {
  contentFitHeight?: number;
  maxHeight?: number;
  minHeight: number;
  viewportMargin: number;
}): number | null {
  if (args.contentFitHeight == null) return null;
  const viewport = readFloatingPanelViewport();
  const viewportMaxHeight = Math.max(180, viewport.height - args.viewportMargin * 2);
  const effectiveMinHeight = Math.min(args.minHeight, viewportMaxHeight);
  const cap = args.maxHeight != null ? Math.min(args.maxHeight, viewportMaxHeight) : viewportMaxHeight;
  return Math.min(cap, Math.max(effectiveMinHeight, args.contentFitHeight));
}

export function DraggableResizablePanel({
  id,
  title,
  defaultPosition,
  defaultSize,
  minWidth = 320,
  minHeight = 200,
  maxWidth,
  maxHeight,
  children,
  onClose,
  persistState = true,
  zIndex = 50,
  contentFitHeight,
  persistPhaseKey,
  layoutRev = FLOATING_PANEL_LAYOUT_REV,
}: DraggableResizablePanelProps) {
  const storageKey = `panel-state-${id}`;
  const viewportMargin = 16;

  const saved = persistState ? loadFloatingPanelPersistedState(storageKey) : null;
  const phasePersist = resolvePhasePersistedSize(saved, persistPhaseKey, layoutRev);

  const clampPanel = useCallback(
    (nextPosition: Position, nextSize: Size) => {
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

  const [position, setPosition] = useState<Position>(() => {
    if (!userSizedRef.current && fitTargetHeight != null && initialState.size.height < fitTargetHeight) {
      return clampPanel(initialState.position, { ...initialState.size, height: fitTargetHeight }).position;
    }
    return initialState.position;
  });
  const [size, setSize] = useState<Size>(() => {
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

  const resolveViewportBounds = useCallback(() => {
    const viewport = readFloatingPanelViewport();
    const viewportMaxWidth = Math.max(240, viewport.width - viewportMargin * 2);
    const viewportMaxHeight = Math.max(180, viewport.height - viewportMargin * 2);
    const effectiveMaxWidth = maxWidth != null ? Math.min(maxWidth, viewportMaxWidth) : viewportMaxWidth;
    return {
      effectiveMinWidth: Math.min(minWidth, effectiveMaxWidth),
      effectiveMaxWidth,
      effectiveMinHeight: Math.min(minHeight, viewportMaxHeight),
    };
  }, [maxWidth, minHeight, minWidth]);

  const persistSnapshot = useCallback(
    (nextPosition: Position, nextSize: Size, userSized: boolean) => {
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

  const clampToViewport = clampPanel;

  const dragRef = useRef<{
    mode: string;
    startX: number;
    startY: number;
    startPos: Position;
    startSize: Size;
  } | null>(null);
  const persistStateRef = useRef(persistState);
  const storageKeyRef = useRef(storageKey);

  useEffect(() => {
    persistStateRef.current = persistState;
    storageKeyRef.current = storageKey;
  }, [persistState, storageKey]);

  const finishDragSession = () => {
    if (!dragRef.current) return;
    if (dragRef.current.mode === "move") {
      userMovedRef.current = true;
    }
    if (persistStateRef.current) {
      persistSnapshot(
        panelStateRef.current.position,
        panelStateRef.current.size,
        userSizedRef.current,
      );
    }
    dragRef.current = null;
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("-webkit-user-select");
  };

  const startDrag = useCallback(
    (mode: string, e: React.PointerEvent) => {
      e.preventDefault();
      setCenterMode(false);
      if (mode !== "move") userSizedRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startPos: { ...position },
        startSize: { ...size },
      };
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
    },
    [position, size],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.mode === "move") {
        const clamped = clampToViewport(
          { x: d.startPos.x + dx, y: d.startPos.y + dy },
          { width: d.startSize.width, height: d.startSize.height },
        );
        setPosition(clamped.position);
        return;
      }

      let nextX = d.startPos.x;
      let nextY = d.startPos.y;
      let nextW = d.startSize.width;
      let nextH = d.startSize.height;
      const { effectiveMinWidth, effectiveMaxWidth, effectiveMinHeight } = resolveViewportBounds();

      if (d.mode.includes("e")) {
        nextW = Math.min(effectiveMaxWidth, Math.max(effectiveMinWidth, d.startSize.width + dx));
      }
      if (d.mode.includes("w")) {
        const newW = Math.min(effectiveMaxWidth, Math.max(effectiveMinWidth, d.startSize.width - dx));
        nextX = d.startPos.x + (d.startSize.width - newW);
        nextW = newW;
      }
      if (d.mode.includes("s")) {
        nextH = Math.max(effectiveMinHeight, d.startSize.height + dy);
      }
      if (d.mode.includes("n")) {
        const newH = Math.max(effectiveMinHeight, d.startSize.height - dy);
        nextY = d.startPos.y + (d.startSize.height - newH);
        nextH = newH;
      }

      const clamped = clampToViewport({ x: nextX, y: nextY }, { width: nextW, height: nextH });
      setPosition(clamped.position);
      setSize(clamped.size);
    };

    const onUp = () => {
      finishDragSession();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("-webkit-user-select");
    };
  }, [clampToViewport, persistSnapshot, resolveViewportBounds]);

  useEffect(() => {
    userSizedRef.current = phasePersist?.userSized === true;
  }, [persistPhaseKey, phasePersist?.userSized]);

  useEffect(() => {
    if (contentFitHeight == null || userSizedRef.current) return;

    const targetHeight = resolveContentFitTargetHeight({
      contentFitHeight,
      maxHeight,
      minHeight,
      viewportMargin,
    });
    if (targetHeight == null) return;

    setSize((prev) => {
      if (prev.height === targetHeight) return prev;
      const clamped = clampToViewport(position, { ...prev, height: targetHeight });
      setPosition(clamped.position);
      persistSnapshot(clamped.position, clamped.size, false);
      return clamped.size;
    });
  }, [clampToViewport, contentFitHeight, maxHeight, minHeight, persistSnapshot, position]);

  const trackedViewportRef = useRef(readFloatingPanelViewport());
  const clampToViewportRef = useRef(clampToViewport);
  clampToViewportRef.current = clampToViewport;
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

      const next = clampToViewportRef.current(pos, sz);
      const changed =
        !samePosition(current.position, next.position) || !sameSize(current.size, next.size);
      if (!samePosition(current.position, next.position)) setPosition(next.position);
      if (!sameSize(current.size, next.size)) setSize(next.size);
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
  }, [persistState]);

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
        ? clampToViewport(position, { ...size, height: targetHeight }).size
        : defaultSize;
    const clamped = clampToViewport(position, nextSize);
    setPosition(clamped.position);
    setSize(clamped.size);
    setCenterMode(true);
    persistSnapshot(clamped.position, clamped.size, false);
  }, [
    clampToViewport,
    contentFitHeight,
    defaultSize,
    maxHeight,
    minHeight,
    persistSnapshot,
    position,
    size,
  ]);

  return (
    <div
      id={id}
      data-panel-id={id}
      className="fixed"
      style={{
        left: centerMode ? `calc(50vw - ${size.width / 2}px)` : position.x,
        top: centerMode ? `calc(50vh - ${size.height / 2}px)` : position.y,
        width: size.width,
        height: size.height,
        zIndex,
      }}
    >
      {/* Resize handles — negative margins extend hit area outside the panel */}
      <div
        className="absolute -top-1 left-5 right-5 h-2 cursor-n-resize touch-none select-none"
        onPointerDown={(e) => startDrag("n", e)}
      />
      <div
        className="absolute -bottom-1 left-5 right-5 h-2 cursor-s-resize touch-none select-none"
        onPointerDown={(e) => startDrag("s", e)}
      />
      <div
        className="absolute -left-1 top-5 bottom-5 w-2 cursor-w-resize touch-none select-none"
        onPointerDown={(e) => startDrag("w", e)}
      />
      <div
        className="absolute -right-1 top-5 bottom-5 w-2 cursor-e-resize touch-none select-none"
        onPointerDown={(e) => startDrag("e", e)}
      />
      <div
        className="absolute -top-1 -left-1 h-5 w-5 cursor-nw-resize touch-none select-none"
        onPointerDown={(e) => startDrag("nw", e)}
      />
      <div
        className="absolute -top-1 -right-1 h-5 w-5 cursor-ne-resize touch-none select-none"
        onPointerDown={(e) => startDrag("ne", e)}
      />
      <div
        className="absolute -bottom-1 -left-1 h-5 w-5 cursor-sw-resize touch-none select-none"
        onPointerDown={(e) => startDrag("sw", e)}
      />
      <div
        className="absolute -bottom-1 -right-1 h-5 w-5 cursor-se-resize touch-none select-none"
        onPointerDown={(e) => startDrag("se", e)}
      />

      {/* Panel — z-10 确保标题栏关闭按钮在 resize 手柄之上 */}
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-lg border border-notion-divider bg-notion-bg font-sans antialiased text-notion-text shadow-2xl">
        {/* Title bar (draggable) — Notion/Zen */}
        <div
          className="flex shrink-0 cursor-move items-center justify-between border-b border-notion-divider bg-notion-sidebar px-6 py-4 select-none"
          onPointerDown={(e) => startDrag("move", e)}
          onDoubleClick={handleTitleDoubleClick}
          title="双击标题栏恢复自动高度"
        >
          <h2 className={`m-0 select-none ${PANEL_TYPOGRAPHY.dialogTitle}`}>{title}</h2>
          <button
            type="button"
            className="rounded border-0 bg-transparent p-1 text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="关闭面板"
          >
            <X className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
        </div>

        {/* Content：壳层不滚动，由对话框内部 flex 分区滚动，保留下方按钮可见 */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
