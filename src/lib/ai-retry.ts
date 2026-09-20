import { ApiError } from "@google/genai";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 600;

function isRetryable(err: unknown): boolean {
  // Transient server-side conditions (overload, rate limit, timeout, upstream
  // hiccup) — worth a retry. 4xx other than 408/429 means the request itself
  // is wrong (bad key, invalid schema, quota exhausted for good) and retrying
  // identically will only waste time before failing anyway.
  if (err instanceof ApiError) {
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  // Network-level failures (fetch throwing, DNS, connection reset) surface as
  // plain Error/TypeError without a status — also worth a retry.
  return err instanceof Error && !(err instanceof ApiError);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Master prompt: an AI call that fails once due to a transient blip (model
 * overloaded, rate limited, brief network error) must not immediately become
 * "riprova più tardi" for the coach. Retries a Gemini call up to
 * MAX_ATTEMPTS times with exponential backoff before giving up — the coach
 * only ever sees a failure if the problem persists across all attempts.
 */
export async function withAiRetry<T>(call: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await call();
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < MAX_ATTEMPTS && isRetryable(err);
      if (!canRetry) throw err;
      console.warn(`AI call failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`, err);
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  // Unreachable — the loop always returns or throws — but keeps TypeScript happy.
  throw lastErr;
}
