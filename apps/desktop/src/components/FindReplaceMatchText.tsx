type Props = {
  text: string;
  charStart: number;
  charEnd: number;
};

export function FindReplaceMatchText({ text, charStart, charEnd }: Props) {
  const safeStart = Math.max(0, Math.min(charStart, text.length));
  const safeEnd = Math.max(safeStart, Math.min(charEnd, text.length));
  if (safeStart === safeEnd) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-snug text-notion-text">{text || "（空）"}</p>
    );
  }
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-snug text-notion-text">
      {text.slice(0, safeStart)}
      <mark className="rounded-sm bg-zen-saffron/30 px-0.5 text-notion-text">{text.slice(safeStart, safeEnd)}</mark>
      {text.slice(safeEnd)}
    </p>
  );
}
