import * as Sentry from "@sentry/nextjs";

// Same graceful-degradation shape as isAiConfigured/isStripeConfigured: no DSN
// means Sentry.init runs disabled instead of throwing, so dev/preview
// environments without a DSN behave exactly as before this was added.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
});
