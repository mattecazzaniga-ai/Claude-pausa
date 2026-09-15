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

  // Baseline hardening applied to every response. Deliberately not a full
  // script/style-restricting Content-Security-Policy: getting that right
  // needs per-page testing (hydration scripts, chart rendering, the Stripe
  // redirect) that's worth doing as its own pass rather than risking a
  // silent regression here — frame-ancestors alone still blocks clickjacking.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
        ],
      },
    ];
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
