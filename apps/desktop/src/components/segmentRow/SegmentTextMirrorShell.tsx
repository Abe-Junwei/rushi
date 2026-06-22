import type { ReactNode } from "react";
import { CspLayout } from "../CspLayout";
import { segmentTextAreaLayoutVars, type SegmentRowTextStyle } from "./useSegmentRowTextStyle";

type Props = {
  selected: boolean;
  textAreaMinHeight: number;
  textStyle: SegmentRowTextStyle;
  /** Find/replace 预览层禁用指针；纠错镜像未选中时需保留命中词点击。 */
  pointerEventsNone?: boolean;
  ariaHidden?: boolean;
  children: ReactNode;
};

/** 语段正文镜像壳：与 textarea.seg-text 共用 CSS 变量，避免透明 textarea + 叠层重影。 */
export function SegmentTextMirrorShell({
  selected,
  textAreaMinHeight,
  textStyle,
  pointerEventsNone = false,
  ariaHidden,
  children,
}: Props) {
  return (
    <CspLayout
      className={[
        "seg-text-layout-scope absolute inset-0 z-[2] px-4 py-2.5 font-[inherit]",
        pointerEventsNone || selected ? "pointer-events-none" : "",
        selected
          ? "overflow-hidden text-notion-text"
          : "seg-text-mirror-preview max-h-[4.5rem] overflow-x-hidden text-notion-text-muted",
      ]
        .filter(Boolean)
        .join(" ")}
      layout={segmentTextAreaLayoutVars(textStyle, textAreaMinHeight, selected)}
      aria-hidden={ariaHidden}
    >
      {children}
    </CspLayout>
  );
}
