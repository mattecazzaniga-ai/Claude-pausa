import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse bundles pdfjs-dist, which breaks when webpack tries to bundle
  // it into the server/RSC layer (top-level Object.defineProperty on a
  // non-object during module init) — keep it a real CJS require at runtime
  // instead. mammoth has the same class of native/dynamic-require issues.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
    instrumentationHook: true,
  },
};

// Source map upload needs a Sentry auth token; without one (e.g. this repo's
// own dev/CI environments) just ship the app without it instead of failing
// the build — same graceful-degradation shape as the rest of the app's
// optional integrations.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    })
  : nextConfig;
