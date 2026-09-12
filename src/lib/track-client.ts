import type { AnalyticsEventName } from "@/lib/analytics";

export function trackClient(name: AnalyticsEventName, metadata?: Record<string, unknown>) {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, metadata }),
    keepalive: true,
  }).catch(() => {});
}
