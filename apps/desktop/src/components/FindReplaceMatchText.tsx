import type { CSSProperties, ElementType } from "react";
import { CspLayout } from "./CspLayout";
import type { CspLayoutRules } from "../utils/cspElementLayout";

type Props = {
  text: string;
  charStart: number;
  charEnd: number;
  /** 浮窗单行预览：与左侧元信息同一行，超长截断。 */
  variant?: "block" | "inline";
  /** 语段列表等高亮镜像：与 `useSegmentRowTextStyle` 对齐，避免 text-sm 缩小正文。 */
  textStyle?: CSSProperties;
  className?: string;
};

export function FindReplaceMatchText({
  text,
  charStart,
  charEnd,
  variant = "block",
  textStyle,
  className,
}: Props) {
  const safeStart = Math.max(0, Math.min(charStart, text.length));
  const safeEnd = Math.max(safeStart, Math.min(charEnd, text.length));
  const display = text || "（空）";
  const blockClass = "m-0 whitespace-pre-wrap break-words text-inherit";
  const inlineClass = "m-0 inline truncate whitespace-nowrap text-sm leading-snug text-notion-text";
  const bodyClass = [variant === "inline" ? inlineClass : blockClass, className].filter(Boolean).join(" ");
  const Tag = (variant === "inline" ? "span" : "p") as ElementType;

  if (safeStart === safeEnd) {
    return textStyle ? (
      <CspLayout as={Tag} className={bodyClass} layout={textStyle as CspLayoutRules}>
        {display}
      </CspLayout>
    ) : (
      <Tag className={bodyClass}>{display}</Tag>
    );
  }
  return textStyle ? (
    <CspLayout as={Tag} className={bodyClass} layout={textStyle as CspLayoutRules}>
      {text.slice(0, safeStart)}
      <mark className="rounded-sm bg-accent-action/30 px-0.5 text-inherit">{text.slice(safeStart, safeEnd)}</mark>
      {text.slice(safeEnd)}
    </CspLayout>
  ) : (
    <Tag className={bodyClass}>
      {text.slice(0, safeStart)}
      <mark className="rounded-sm bg-accent-action/30 px-0.5 text-inherit">{text.slice(safeStart, safeEnd)}</mark>
      {text.slice(safeEnd)}
    </Tag>
  );
}
