import { loopbackFetch } from "../services/asr/loopbackFetch";

export const PREPARE_STATUS_POLL_MS = 1000;
export const PREPARE_STATUS_TIMEOUT_MS = 30_000;
export const PREPARE_STATUS_TRANSIENT_RETRIES = 5;
export const PREPARE_STATUS_RETRY_DELAY_MS = 2000;

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loopbackFetchWithRetries(
  url: string,
  init: Parameters<typeof loopbackFetch>[1] | undefined,
  retries: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await loopbackFetch(url, init);
    } catch (error) {
      lastError = error;
      if (init?.signal?.aborted) throw error;
      if (attempt < retries - 1) {
        await sleepMs(PREPARE_STATUS_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}
