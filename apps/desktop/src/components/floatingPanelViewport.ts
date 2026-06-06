export type FloatingPanelViewport = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export type FloatingPanelPersistedState = {
  position: { x: number; y: number };
  size: { width: number; height: number };
  viewport?: { width: number; height: number };
};

/** 浮动面板定位用的可视区域（Tauri 窗口模式 = 当前窗口客户区，而非物理全屏）。 */
export function readFloatingPanelViewport(): FloatingPanelViewport {
  const vv = window.visualViewport;
  return {
    width: Math.floor(vv?.width ?? document.documentElement.clientWidth),
    height: Math.floor(vv?.height ?? document.documentElement.clientHeight),
    offsetX: Math.floor(vv?.offsetLeft ?? 0),
    offsetY: Math.floor(vv?.offsetTop ?? 0),
  };
}

export function centerFloatingPanelPosition(
  size: { width: number; height: number },
  margin: number,
  viewport: FloatingPanelViewport = readFloatingPanelViewport(),
): { x: number; y: number } {
  const innerWidth = viewport.width - margin * 2;
  const innerHeight = viewport.height - margin * 2;
  return {
    x: viewport.offsetX + margin + Math.max(0, Math.round((innerWidth - size.width) / 2)),
    y: viewport.offsetY + margin + Math.max(0, Math.round((innerHeight - size.height) / 2)),
  };
}

const VIEWPORT_RECENTER_THRESHOLD_PX = 48;

export function isFloatingPanelCentered(
  position: { x: number; y: number },
  size: { width: number; height: number },
  viewport: FloatingPanelViewport,
  margin: number,
): boolean {
  const centered = centerFloatingPanelPosition(size, margin, viewport);
  return (
    Math.abs(position.x - centered.x) < VIEWPORT_RECENTER_THRESHOLD_PX &&
    Math.abs(position.y - centered.y) < VIEWPORT_RECENTER_THRESHOLD_PX
  );
}

/** Runtime resize/fullscreen: keep centered panels centered; clamp user-dragged panels. */
export function reconcileFloatingPanelOnViewportResize(args: {
  position: { x: number; y: number };
  size: { width: number; height: number };
  prevViewport: FloatingPanelViewport;
  nextViewport: FloatingPanelViewport;
  margin: number;
  userMoved: boolean;
}): { position: { x: number; y: number }; recentered: boolean } {
  const sameViewport =
    args.prevViewport.width === args.nextViewport.width &&
    args.prevViewport.height === args.nextViewport.height &&
    args.prevViewport.offsetX === args.nextViewport.offsetX &&
    args.prevViewport.offsetY === args.nextViewport.offsetY;
  if (sameViewport) {
    return { position: args.position, recentered: false };
  }
  const wasCentered = isFloatingPanelCentered(
    args.position,
    args.size,
    args.prevViewport,
    args.margin,
  );
  if (args.userMoved && !wasCentered) {
    return { position: args.position, recentered: false };
  }
  return {
    position: centerFloatingPanelPosition(args.size, args.margin, args.nextViewport),
    recentered: true,
  };
}

export function shouldRecenterFloatingPanel(
  saved: FloatingPanelPersistedState,
  viewport: FloatingPanelViewport = readFloatingPanelViewport(),
): boolean {
  if (!saved.viewport) {
    // 旧版未存视口指纹：若保存坐标明显偏离当前窗口居中，视为全屏时代残留
    const centered = centerFloatingPanelPosition(saved.size, 16, viewport);
    const dx = Math.abs(saved.position.x - centered.x);
    return dx >= VIEWPORT_RECENTER_THRESHOLD_PX;
  }
  const dw = Math.abs(saved.viewport.width - viewport.width);
  const dh = Math.abs(saved.viewport.height - viewport.height);
  return dw >= VIEWPORT_RECENTER_THRESHOLD_PX || dh >= VIEWPORT_RECENTER_THRESHOLD_PX;
}

export function resolveFloatingPanelInitialState(args: {
  saved: FloatingPanelPersistedState | null;
  defaultPosition: { x: number; y: number };
  defaultSize: { width: number; height: number };
  margin: number;
  clamp: (
    position: { x: number; y: number },
    size: { width: number; height: number },
  ) => { position: { x: number; y: number }; size: { width: number; height: number } };
  viewport?: FloatingPanelViewport;
}): { position: { x: number; y: number }; size: { width: number; height: number } } {
  const viewport = args.viewport ?? readFloatingPanelViewport();
  if (!args.saved) {
    return args.clamp(args.defaultPosition, args.defaultSize);
  }
  const size = args.saved.size;
  const position = shouldRecenterFloatingPanel(args.saved, viewport)
    ? centerFloatingPanelPosition(size, args.margin, viewport)
    : args.saved.position;
  return args.clamp(position, size);
}

export function snapshotFloatingPanelViewport(
  viewport: FloatingPanelViewport = readFloatingPanelViewport(),
): { width: number; height: number } {
  return { width: viewport.width, height: viewport.height };
}

export function clampFloatingPanelToViewport(
  nextPosition: { x: number; y: number },
  nextSize: { width: number; height: number },
  options: {
    minWidth: number;
    minHeight: number;
    margin?: number;
    viewport?: FloatingPanelViewport;
  },
): { position: { x: number; y: number }; size: { width: number; height: number } } {
  const margin = options.margin ?? 16;
  const viewport = options.viewport ?? readFloatingPanelViewport();
  const maxWidth = Math.max(240, viewport.width - margin * 2);
  const maxHeight = Math.max(180, viewport.height - margin * 2);
  const effectiveMinWidth = Math.min(options.minWidth, maxWidth);
  const effectiveMinHeight = Math.min(options.minHeight, maxHeight);
  const clampedSize = {
    width: Math.min(Math.max(nextSize.width, effectiveMinWidth), maxWidth),
    height: Math.min(Math.max(nextSize.height, effectiveMinHeight), maxHeight),
  };
  const maxX = Math.max(
    margin + viewport.offsetX,
    viewport.width + viewport.offsetX - clampedSize.width - margin,
  );
  const maxY = Math.max(
    margin + viewport.offsetY,
    viewport.height + viewport.offsetY - clampedSize.height - margin,
  );
  return {
    position: {
      x: Math.min(Math.max(nextPosition.x, margin + viewport.offsetX), maxX),
      y: Math.min(Math.max(nextPosition.y, margin + viewport.offsetY), maxY),
    },
    size: clampedSize,
  };
}
