import { ApiError } from "@google/genai";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 600;
// A 429 quota error tells us exactly how long to wait before it can possibly
// succeed (e.g. "retry in 10.5s") — respecting that beats guessing with a
// fixed backoff, but still cap it so one request can't stall the response
// past what's reasonable for a chat reply.
const MAX_RETRY_DELAY_MS = 12_000;

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

/**
 * A 429's body carries a `RetryInfo` detail with the server's own suggested
 * wait (e.g. `{"retryDelay": "10.532920472s"}`) — `ApiError.message` is that
 * raw JSON string, not a parsed object, so it has to be picked out by hand.
 * Returns null when absent or unparseable, so the caller can fall back to
 * exponential backoff.
 */
function extractSuggestedDelayMs(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 429) return null;
  try {
    const parsed = JSON.parse(err.message);
    const details: unknown[] = parsed?.error?.details ?? [];
    const retryInfo = details.find((d): d is { retryDelay: string } => {
      const type = (d as { "@type"?: string })?.["@type"];
      return typeof type === "string" && type.endsWith("RetryInfo");
    });
    const match = retryInfo?.retryDelay?.match(/^(\d+(?:\.\d+)?)s$/);
    if (!match) return null;
    return Math.min(Math.ceil(parseFloat(match[1]) * 1000), MAX_RETRY_DELAY_MS);
  } catch {
    return null;
  }
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
      const delayMs = extractSuggestedDelayMs(err) ?? BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`AI call failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${delayMs}ms…`, err);
      await sleep(delayMs);
    }
  }
  // Unreachable — the loop always returns or throws — but keeps TypeScript happy.
  throw lastErr;
}
