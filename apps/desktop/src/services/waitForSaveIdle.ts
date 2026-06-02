/** 等待语段保存飞行结束（自动保存与确认保存互斥用）。 */
export async function waitForSaveIdle(
  saveInFlightRef: { current: boolean },
  options?: { intervalMs?: number; maxMs?: number },
): Promise<boolean> {
  const intervalMs = options?.intervalMs ?? 50;
  const maxMs = options?.maxMs ?? 15_000;
  const start = Date.now();
  while (saveInFlightRef.current) {
    if (Date.now() - start > maxMs) return false;
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, intervalMs);
    });
  }
  return true;
}
