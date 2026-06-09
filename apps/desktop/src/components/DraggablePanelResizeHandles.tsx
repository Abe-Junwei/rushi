type ResizeHandleProps = {
  onPointerDown: (mode: string, e: React.PointerEvent) => void;
};

export function DraggablePanelResizeHandles({ onPointerDown }: ResizeHandleProps) {
  return (
    <>
      <div
        className="absolute -top-1 left-5 right-5 h-2 cursor-n-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("n", e)}
      />
      <div
        className="absolute -bottom-1 left-5 right-5 h-2 cursor-s-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("s", e)}
      />
      <div
        className="absolute -left-1 top-5 bottom-5 w-2 cursor-w-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("w", e)}
      />
      <div
        className="absolute -right-1 top-5 bottom-5 w-2 cursor-e-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("e", e)}
      />
      <div
        className="absolute -top-1 -left-1 h-5 w-5 cursor-nw-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("nw", e)}
      />
      <div
        className="absolute -top-1 -right-1 h-5 w-5 cursor-ne-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("ne", e)}
      />
      <div
        className="absolute -bottom-1 -left-1 h-5 w-5 cursor-sw-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("sw", e)}
      />
      <div
        className="absolute -bottom-1 -right-1 h-5 w-5 cursor-se-resize touch-none select-none"
        onPointerDown={(e) => onPointerDown("se", e)}
      />
    </>
  );
}
