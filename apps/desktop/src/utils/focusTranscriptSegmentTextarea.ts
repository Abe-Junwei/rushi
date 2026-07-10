/**
 * Legacy textarea focus retries removed in P9a (CM6 is the only list editor).
 * Kept as a no-op cancel hook for keyboard/file-switch call sites.
 */

/** 测试 / 切文件时取消挂起的 focus 重试（P9a 后无挂起链，仍可安全调用）。 */
export function cancelTranscriptSegmentFocusAttempts(): void {
  /* no-op: textarea focus retry chain deleted with SegmentRowTextField */
}
