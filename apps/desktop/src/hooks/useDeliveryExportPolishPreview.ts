import { useCallback, useEffect, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  fetchExportPolishResult,
  type ExportPolishResult,
} from "../services/exportDocxPolish";
import { postprocessCancelExportPolish } from "../tauri/postprocessApi";
import {
  clearExportPolishPreviewCache,
  fingerprintExportPolishSegments,
} from "../services/exportPolishPreviewCache";

export function useDeliveryExportPolishPreview(input: {
  open: boolean;
  busy: boolean;
  segments: SegmentDto[];
  llmPolish: boolean;
  canPreviewPolish: boolean;
}) {
  const { open, busy, segments, llmPolish, canPreviewPolish } = input;
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExportPolishResult | null>(null);
  const segmentsFingerprintRef = useRef("");
  const previewRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!llmPolish) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
    }
  }, [llmPolish]);

  useEffect(() => {
    if (!open) {
      clearExportPolishPreviewCache();
      setPreview(null);
      setPreviewError(null);
      segmentsFingerprintRef.current = "";
      return;
    }
    const fp = fingerprintExportPolishSegments(segments);
    if (segmentsFingerprintRef.current && segmentsFingerprintRef.current !== fp) {
      setPreview(null);
      setPreviewError(null);
      clearExportPolishPreviewCache();
    }
    segmentsFingerprintRef.current = fp;
  }, [open, segments]);

  const handleCancelPreview = useCallback(async () => {
    const id = previewRequestIdRef.current;
    if (id) {
      try {
        await postprocessCancelExportPolish(id);
      } catch {
        /* 忽略取消失败 */
      }
    }
    previewRequestIdRef.current = null;
    setPreviewLoading(false);
    setPreviewError("已取消预览生成。");
  }, []);

  const handleRefreshPreview = useCallback(async () => {
    if (!canPreviewPolish) return;
    const requestId = crypto.randomUUID();
    previewRequestIdRef.current = requestId;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await fetchExportPolishResult(segments, { requestId });
      setPreview(result);
    } catch (e) {
      setPreview(null);
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      previewRequestIdRef.current = null;
      setPreviewLoading(false);
    }
  }, [canPreviewPolish, segments]);

  const showPreviewSection =
    canPreviewPolish || previewLoading || preview != null || previewError != null;

  return {
    preview,
    previewLoading,
    previewError,
    showPreviewSection,
    handleCancelPreview,
    handleRefreshPreview,
    exportBusy: busy || previewLoading,
  };
}
