import { useRef } from "react";
import { useCspLayout } from "../hooks/useCspLayout";

type Props = {
  percent: number;
  className?: string;
};

/** Determinate progress fill without inline `style=` (CSP style-src-attr). */
export function CspProgressFill({ percent, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const ratio = Math.max(0, Math.min(1, percent / 100));
  useCspLayout(ref, {
    width: "100%",
    transformOrigin: "left",
    transform: `scaleX(${ratio})`,
  });
  return <div ref={ref} className={className} />;
}
