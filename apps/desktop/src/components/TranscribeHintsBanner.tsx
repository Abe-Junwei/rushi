interface TranscribeHintsBannerProps {
  hints: string[];
}

/** 拉取语段后的非阻断说明（与 error 横幅区分）。 */
export function TranscribeHintsBanner({ hints }: TranscribeHintsBannerProps) {
  if (hints.length === 0) return null;
  return (
    <div
      className="mx-4 mt-3 shrink-0 rounded border border-zen-saffron/25 bg-zen-saffron/8 px-3 py-2 text-sm text-notion-text"
      role="status"
      aria-live="polite"
    >
      <ul className="list-disc space-y-1 pl-4">
        {hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
    </div>
  );
}
