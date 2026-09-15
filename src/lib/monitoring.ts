import * as Sentry from "@sentry/nextjs";

/** The rest of the app can check this to know whether errors are actually reported anywhere besides the server logs. */
export const isMonitoringConfigured = Boolean(process.env.SENTRY_DSN);

/**
 * Logs an error the way the app always has (so `vercel logs` still shows it)
 * and, when Sentry is configured, also reports it there with searchable
 * context — the difference between "buried in logs" and "you get an alert."
 */
export function captureError(message: string, err: unknown, context?: Record<string, unknown>) {
  console.error(message, err);
  if (!isMonitoringConfigured) return;
  Sentry.captureException(err, { extra: { message, ...context } });
}
