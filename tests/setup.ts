import { loadTestEnv } from "./env";

loadTestEnv();

// Tests never depend on ambient AI/Stripe/email/monitoring config — each
// test stubs exactly what it needs instead of picking up whatever happens
// to be in the developer's .env.
process.env.GEMINI_API_KEY = "";
process.env.STRIPE_SECRET_KEY = "";
process.env.RESEND_API_KEY = "";
process.env.SENTRY_DSN = "";
