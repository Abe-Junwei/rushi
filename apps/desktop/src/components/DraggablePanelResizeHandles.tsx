type ResizeHandleProps = {
  onPointerDown: (mode: string, e: React.PointerEvent) => void;
};

const HANDLES = [
  { mode: "n", className: "floating-panel-resize-handle floating-panel-resize-handle--n" },
  { mode: "s", className: "floating-panel-resize-handle floating-panel-resize-handle--s" },
  { mode: "w", className: "floating-panel-resize-handle floating-panel-resize-handle--w" },
  { mode: "e", className: "floating-panel-resize-handle floating-panel-resize-handle--e" },
  { mode: "nw", className: "floating-panel-resize-handle floating-panel-resize-handle--nw" },
  { mode: "ne", className: "floating-panel-resize-handle floating-panel-resize-handle--ne" },
  { mode: "sw", className: "floating-panel-resize-handle floating-panel-resize-handle--sw" },
  { mode: "se", className: "floating-panel-resize-handle floating-panel-resize-handle--se" },
] as const;

export function DraggablePanelResizeHandles({ onPointerDown }: ResizeHandleProps) {
  return (
    <>
      {HANDLES.map(({ mode, className }) => (
        <div
          key={mode}
          className={className}
          aria-hidden
          onPointerDown={(e) => onPointerDown(mode, e)}
        />
      ))}
    </>
  );
}
