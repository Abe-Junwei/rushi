import { useCallback, useEffect, useRef, useState } from "react";

type HoverRevealTextProps = {
  text: string;
  className?: string;
  /** 由父级行 hover/focus 控制时为 true */
  revealed?: boolean;
};

/**
 * 单行文本：常态截断；revealed 且溢出时横向滚动展示全文。
 */
export function HoverRevealText({ text, className = "", revealed = false }: HoverRevealTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shiftPx, setShiftPx] = useState(0);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;
    setShiftPx(Math.max(0, inner.scrollWidth - container.clientWidth));
  }, []);

  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(container);

    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text, measure]);

  const scrollSec = shiftPx > 0 ? Math.min(8, Math.max(1.2, shiftPx / 52)) : 0;
  const active = revealed && shiftPx > 0;

  return (
    <span ref={containerRef} className={`block min-w-0 overflow-hidden ${className}`}>
      <span
        ref={textRef}
        className="inline-block max-w-none whitespace-nowrap"
        style={{
          transform: active ? `translateX(-${shiftPx}px)` : "translateX(0)",
          transition:
            shiftPx > 0 ? `transform ${scrollSec}s ${active ? "linear" : "ease-out"}` : undefined,
        }}
      >
        {text}
      </span>
    </span>
  );
}
