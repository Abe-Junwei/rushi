/** 极快失败时仍保证 busy/checking UI 可见（连接拒绝、本地 loopback 等）。 */
export const MIN_VISIBLE_BUSY_MS = 400;

export async function waitMinVisibleBusy(
  startedAt: number,
  minMs: number = MIN_VISIBLE_BUSY_MS,
): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minMs) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, minMs - elapsed);
  });
}
