type Props = {
  lines: string[];
};

/** Shared ASR-VOC-1 vocabulary preflight copy (start dialog + in-progress banner). */
export function TranscribeVocabularyPreflightLines({ lines }: Props) {
  if (lines.length === 0) return null;

  return (
    <div className="w-full rounded-md bg-notion-sidebar/80 px-3 py-2 text-left">
      <p className="text-xs font-medium text-notion-text">本次术语偏置</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-notion-text-muted">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
