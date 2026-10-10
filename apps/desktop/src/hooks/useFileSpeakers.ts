import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FileSpeakerDto, SegmentDto } from "../tauri/projectTypes";
import * as fileApi from "../tauri/fileApi";

export function useFileSpeakers(
  fileId: string | null,
  segments: readonly SegmentDto[],
): {
  speakers: FileSpeakerDto[];
  setSpeakers: Dispatch<SetStateAction<FileSpeakerDto[]>>;
} {
  const [speakers, setSpeakers] = useState<FileSpeakerDto[]>([]);
  const speakerSignature = useMemo(
    () => segments.map((segment) => segment.speaker_id ?? "").join("|"),
    [segments],
  );

  useEffect(() => {
    setSpeakers([]);
  }, [fileId]);

  useEffect(() => {
    let cancelled = false;
    if (!fileId) return;
    void fileApi.loadFile(fileId).then((detail) => {
      if (!cancelled) setSpeakers(detail.speakers ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [fileId, speakerSignature]);

  return { speakers, setSpeakers };
}
