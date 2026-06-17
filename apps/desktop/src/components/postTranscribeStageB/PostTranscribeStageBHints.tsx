import { PANEL_TYPOGRAPHY } from "../../config/typography";

export function PendingStageAHint({ message }: { message: string }) {
  return (
    <p
      className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
    >
      {message}
    </p>
  );
}

export function PackTruncationHint({ message }: { message: string }) {
  return (
    <p
      className={`rounded-md bg-notion-callout-bg px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}
    >
      {message}
    </p>
  );
}
