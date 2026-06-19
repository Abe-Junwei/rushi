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
  /* eslint-disable react-hooks/exhaustive-deps -- `serialized` captures the content of `layout`; the object reference itself is not needed */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setCspLayoutRules(el, layout, CSP_LAYOUT_OWNER_REACT);
    return () => clearCspLayoutRules(el, CSP_LAYOUT_OWNER_REACT);
  }, [ref, serialized]);
  /* eslint-enable react-hooks/exhaustive-deps */
}
