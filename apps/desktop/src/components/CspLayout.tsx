import { useRef, type ComponentPropsWithoutRef, type ElementType, type Ref } from "react";
import { useCspLayout } from "../hooks/useCspLayout";
import {
  CSP_LAYOUT_OWNER_REACT,
  clearCspLayoutRules,
  setCspLayoutRules,
  type CspLayoutRules,
} from "../utils/cspElementLayout";

type CspLayoutProps<T extends ElementType> = {
  as?: T;
  layout: CspLayoutRules;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "style">;

export function CspLayout<T extends ElementType = "div">({
  as,
  layout,
  ref: forwardedRef,
  ...props
}: CspLayoutProps<T> & { ref?: Ref<HTMLElement> }) {
  const Tag: ElementType = as ?? "div";
  const localRef = useRef<HTMLElement | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  useCspLayout(localRef, layout);

  const setRef = (node: HTMLElement | null) => {
    const prev = localRef.current;
    localRef.current = node;
    if (node) {
      setCspLayoutRules(node, layoutRef.current, CSP_LAYOUT_OWNER_REACT);
    } else if (prev) {
      clearCspLayoutRules(prev, CSP_LAYOUT_OWNER_REACT);
    }
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef && typeof forwardedRef === "object") {
      (forwardedRef as { current: HTMLElement | null }).current = node;
    }
  };

  return <Tag ref={setRef} {...props} />;
}
