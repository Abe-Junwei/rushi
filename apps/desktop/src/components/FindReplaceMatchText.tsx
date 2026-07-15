import type { ElementType } from "react";
import { CspLayout } from "./CspLayout";
import { segmentTextTypographyLayout, type SegmentRowTextStyle } from "./segmentRow/useSegmentRowTextStyle";

type Props = {
  text: string;
  charStart: number;
  charEnd: number;
  /** 浮窗单行预览：与左侧元信息同一行，超长截断。 */
  variant?: "block" | "inline" | "snippet";
  /** 语段列表等高亮镜像：与 `segmentTextTypographyLayout` 对齐，避免 text-sm 缩小正文。 */
  textStyle?: SegmentRowTextStyle;
  className?: string;
  /** 默认 saffron 高亮；预览改前可用删除线样式。 */
  highlightClassName?: string;
};

export function FindReplaceMatchText({
  text,
  charStart,
  charEnd,
  variant = "block",
  textStyle,
  className,
  highlightClassName = "rounded-sm bg-accent-action/20 px-0.5 text-inherit",
}: Props) {
  const safeStart = Math.max(0, Math.min(charStart, text.length));
  const safeEnd = Math.max(safeStart, Math.min(charEnd, text.length));
  const display = text || "（空）";
  const blockClass = "m-0 whitespace-pre-wrap break-words text-inherit";
  const inlineClass = "m-0 inline truncate whitespace-nowrap text-sm leading-snug text-notion-text";
  const snippetClass = "m-0 inline whitespace-nowrap text-sm leading-snug text-notion-text";
  const bodyClass = [
    variant === "snippet" ? snippetClass : variant === "inline" ? inlineClass : blockClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const Tag = (variant === "block" ? "p" : "span") as ElementType;

  const typographyLayout = textStyle ? segmentTextTypographyLayout(textStyle) : undefined;

  if (safeStart === safeEnd) {
    return typographyLayout ? (
      <CspLayout as={Tag} className={bodyClass} layout={typographyLayout}>
        {display}
      </CspLayout>
    ) : (
      <Tag className={bodyClass}>{display}</Tag>
    );
  }
  return typographyLayout ? (
    <CspLayout as={Tag} className={bodyClass} layout={typographyLayout}>
      {text.slice(0, safeStart)}
      <mark className={highlightClassName}>{text.slice(safeStart, safeEnd)}</mark>
      {text.slice(safeEnd)}
    </CspLayout>
  ) : (
    <Tag className={bodyClass}>
      {text.slice(0, safeStart)}
      <mark className={highlightClassName}>{text.slice(safeStart, safeEnd)}</mark>
      {text.slice(safeEnd)}
    </Tag>
  );
}
