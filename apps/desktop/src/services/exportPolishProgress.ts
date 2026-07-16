import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const EXPORT_POLISH_PROGRESS_EVENT = "export-polish-progress";

export type ExportPolishProgress = {
  batch: number;
  total: number;
};

export function listenExportPolishProgress(
  onProgress: (progress: ExportPolishProgress) => void,
): Promise<UnlistenFn> {
  return listen<ExportPolishProgress>(EXPORT_POLISH_PROGRESS_EVENT, (event) => {
    const p = event.payload;
    if (
      typeof p?.batch !== "number" ||
      typeof p?.total !== "number" ||
      p.batch < 1 ||
      p.total < 1
    ) {
      return;
    }
    onProgress({ batch: p.batch, total: p.total });
  });
}
