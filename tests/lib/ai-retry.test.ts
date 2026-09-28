import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";

function apiError(status: number, message = "boom") {
  return new ApiError({ message, status });
}

function quotaError(retryDelay: string) {
  return apiError(
    429,
    JSON.stringify({
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }],
      },
    }),
  );
}

describe("withAiRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the result immediately on success", async () => {
    const call = vi.fn().mockResolvedValue("ok");
    await expect(withAiRetry(call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries a transient server error (5xx) and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    const call = vi.fn().mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce("ok");

    const promise = withAiRetry(call);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("retries a 429 (rate limit) and a network error, giving up only after the max attempts", async () => {
    vi.useFakeTimers();
    const call = vi
      .fn()
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(apiError(500));

    const promise = withAiRetry(call);
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("waits the server-suggested retryDelay from a 429's RetryInfo instead of the fixed backoff", async () => {
    vi.useFakeTimers();
    const call = vi.fn().mockRejectedValueOnce(quotaError("10.5s")).mockResolvedValueOnce("ok");

    const promise = withAiRetry(call);
    // The fixed backoff for attempt 1 would be 600ms — advancing just past
    // that must NOT be enough if the suggested 10.5s delay is being honored.
    await vi.advanceTimersByTimeAsync(700);
    expect(call).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("caps an absurdly long suggested retryDelay instead of waiting it out in full", async () => {
    vi.useFakeTimers();
    const call = vi.fn().mockRejectedValueOnce(quotaError("120s")).mockResolvedValueOnce("ok");

    const promise = withAiRetry(call);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(promise).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient client error (bad request / invalid key)", async () => {
    const call = vi.fn().mockRejectedValue(apiError(400));
    await expect(withAiRetry(call)).rejects.toBeInstanceOf(ApiError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not retry an auth error (401/403)", async () => {
    const call = vi.fn().mockRejectedValue(apiError(403));
    await expect(withAiRetry(call)).rejects.toBeInstanceOf(ApiError);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
