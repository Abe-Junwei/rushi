import { TRANSCRIBE_PREFLIGHT_TYPO as T } from "./transcribePreflightTypography";

type Props = {
  lines: string[];
  tone?: "dialog" | "progress";
};

/** Shared ASR-VOC-1 vocabulary preflight copy (start dialog + in-progress banner). */
export function TranscribeVocabularyPreflightLines({ lines, tone = "dialog" }: Props) {
  if (lines.length === 0) return null;

  const align = tone === "progress" ? " text-center" : "";
  const titleClass = tone === "progress" ? T.progressSectionTitle : T.sectionTitle;
  const lineClass = T.body;

  return (
    <div className={[T.sectionDivider, T.captionStack, align].filter(Boolean).join(" ")}>
      <p className={titleClass}>术语偏置</p>
      {lines.map((line) => (
        <p key={line} className={lineClass}>
          {line}
        </p>
      ))}
    </div>
  );
}
