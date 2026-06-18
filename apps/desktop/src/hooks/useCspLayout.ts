import { useLayoutEffect, type RefObject } from "react";
import {
  CSP_LAYOUT_OWNER_REACT,
  clearCspLayoutRules,
  setCspLayoutRules,
  type CspLayoutRules,
} from "../utils/cspElementLayout";

export function useCspLayout(
  ref: RefObject<HTMLElement | null>,
  layout: CspLayoutRules,
): void {
  const serialized = JSON.stringify(layout);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setCspLayoutRules(el, layout, CSP_LAYOUT_OWNER_REACT);
    return () => clearCspLayoutRules(el, CSP_LAYOUT_OWNER_REACT);
  }, [ref, serialized]);
}
