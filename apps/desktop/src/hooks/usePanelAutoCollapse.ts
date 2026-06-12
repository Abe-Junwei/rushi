import { useEffect } from "react";

type UsePanelAutoCollapseParams = {
  enabled: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  boundaryRef: React.RefObject<HTMLElement | null>;
  panelSelector: string;
  toggleSelector?: string;
  ignoreSelectors?: string[];
};

function matchesClosestSelector(target: Element, selectors: Array<string | undefined>): boolean {
  return selectors.some((selector) => {
    if (!selector) return false;
    return Boolean(target.closest(selector));
  });
}

/** 面板展开时，在 boundary 内点击面板/toggle 以外区域自动收起（解语同构）。 */
export function usePanelAutoCollapse({
  enabled,
  isCollapsed,
  setIsCollapsed,
  boundaryRef,
  panelSelector,
  toggleSelector,
  ignoreSelectors = [],
}: UsePanelAutoCollapseParams) {
  useEffect(() => {
    if (!enabled || isCollapsed) return;

    const root = boundaryRef.current;
    if (!root) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (
        matchesClosestSelector(target, [
          panelSelector,
          toggleSelector,
          ...ignoreSelectors,
        ])
      ) {
        return;
      }

      setIsCollapsed(true);
    };

    // 捕获阶段：波形/语段等常在冒泡阶段 stopPropagation，document 冒泡监听会失效
    root.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [
    boundaryRef,
    enabled,
    ignoreSelectors,
    isCollapsed,
    panelSelector,
    setIsCollapsed,
    toggleSelector,
  ]);
}
