import { useCallback, useEffect, useRef, useState } from "react";

export type DeferredRendererPersist<T> = {
  read: () => T | null;
  write: (value: T) => void;
  debounceMs?: number;
};

export type UseDeferredRendererStateConfig<T> = {
  initial: T;
  clamp: (value: T) => T;
  areEqual?: (a: T, b: T) => boolean;
  /** Debounce visual → render; omit or 0 to commit only via `flushRender`. */
  renderDelayMs?: number;
  /** Keep `committed` for paint/redraw ack (waveform height). */
  trackCommitted?: boolean;
  persist?: DeferredRendererPersist<T>;
};

export type DeferredRendererState<T> = {
  visual: T;
  render: T;
  committed: T;
  previewActive: boolean;
  dragging: boolean;
  setVisual: (next: T | ((prev: T) => T)) => void;
  /** Sync render (and committed when untracked) to current visual immediately. */
  flushRender: () => void;
  /** Acknowledge expensive renderer applied value (e.g. WaveSurfer redrawcomplete). */
  markCommitted: (value: T) => void;
  setDragging: (on: boolean) => void;
};

function resolveNext<T>(next: T | ((prev: T) => T), prev: T): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

export function useDeferredRendererState<T>(config: UseDeferredRendererStateConfig<T>): DeferredRendererState<T> {
  const {
    initial,
    clamp,
    areEqual = Object.is,
    renderDelayMs = 0,
    trackCommitted = false,
    persist,
  } = config;

  const clampRef = useRef(clamp);
  clampRef.current = clamp;
  const equalsRef = useRef(areEqual);
  equalsRef.current = areEqual;

  const initialValueRef = useRef<{ value: T } | null>(null);
  if (initialValueRef.current == null) {
    initialValueRef.current = { value: clampRef.current(initial) };
  }
  const initialValue = initialValueRef.current.value;

  const [visual, setVisualState] = useState(() => initialValue);
  const [render, setRenderState] = useState(() => initialValue);
  const [committed, setCommittedState] = useState(() => initialValue);
  const [dragging, setDraggingState] = useState(false);

  const visualRef = useRef(visual);
  visualRef.current = visual;
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;

  const skipPersistRef = useRef(true);
  useEffect(() => {
    if (!persist) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      persist.write(visual);
    }, persist.debounceMs ?? 180);
    return () => window.clearTimeout(timer);
  }, [persist, visual]);

  useEffect(() => {
    if (dragging) return;
    if (!renderDelayMs || renderDelayMs <= 0) return;
    if (equalsRef.current(render, visual)) return;
    const flush = () => {
      setRenderState((prev) => {
        const next = clampRef.current(visualRef.current);
        return equalsRef.current(prev, next) ? prev : next;
      });
      if (!trackCommitted) {
        setCommittedState((prev) => {
          const next = clampRef.current(visualRef.current);
          return equalsRef.current(prev, next) ? prev : next;
        });
      }
    };
    if (renderDelayMs <= 16) {
      const raf = window.requestAnimationFrame(flush);
      return () => window.cancelAnimationFrame(raf);
    }
    const timer = window.setTimeout(flush, renderDelayMs);
    return () => window.clearTimeout(timer);
  }, [dragging, render, renderDelayMs, trackCommitted, visual]);

  const setVisual = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = clampRef.current(resolveNext(next, visualRef.current));
    visualRef.current = resolved;
    setVisualState((prev) => (equalsRef.current(prev, resolved) ? prev : resolved));
  }, []);

  const flushRender = useCallback(() => {
    const next = clampRef.current(visualRef.current);
    setRenderState((prev) => (equalsRef.current(prev, next) ? prev : next));
    if (!trackCommitted) {
      setCommittedState((prev) => (equalsRef.current(prev, next) ? prev : next));
    }
  }, [trackCommitted]);

  const markCommitted = useCallback(
    (value: T) => {
      if (!trackCommitted) return;
      const next = clampRef.current(value);
      setCommittedState((prev) => (equalsRef.current(prev, next) ? prev : next));
    },
    [trackCommitted],
  );

  useEffect(() => {
    if (!trackCommitted || dragging) return;
    if (equalsRef.current(committed, render)) return;
    const timer = window.setTimeout(() => {
      if (draggingRef.current) return;
      const next = clampRef.current(visualRef.current);
      setCommittedState((prev) => (equalsRef.current(prev, next) ? prev : next));
      setRenderState((prev) => (equalsRef.current(prev, next) ? prev : next));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [committed, dragging, render, trackCommitted]);

  const setDragging = useCallback((on: boolean) => {
    draggingRef.current = on;
    setDraggingState(on);
  }, []);

  const previewActive = !equalsRef.current(visual, render);

  return {
    visual,
    render,
    committed,
    previewActive,
    dragging,
    setVisual,
    flushRender,
    markCommitted,
    setDragging,
  };
}
