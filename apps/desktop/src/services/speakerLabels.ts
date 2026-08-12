import type { FileSpeakerDto, SegmentDto } from "../tauri/projectTypes";

export function resolveSpeakerLabel(
  speakerId: string | null | undefined,
  speakers: readonly FileSpeakerDto[],
): string | null {
  if (!speakerId) return null;
  const row = speakers.find((speaker) => speaker.speaker_id === speakerId);
  if (!row) return "说话人";
  return row.display_name?.trim() || `说话人 ${row.ordinal}`;
}

export function buildSpeakerLabelMap(
  speakers: readonly FileSpeakerDto[],
): ReadonlyMap<string, string> {
  return new Map(
    speakers.map((speaker) => [
      speaker.speaker_id,
      speaker.display_name?.trim() || `说话人 ${speaker.ordinal}`,
    ]),
  );
}

export function activeSpeakerIds(segments: readonly SegmentDto[]): Set<string> {
  return new Set(segments.flatMap((segment) => (segment.speaker_id ? [segment.speaker_id] : [])));
}
