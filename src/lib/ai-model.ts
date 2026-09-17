/**
 * Single source of truth for which Gemini model each AI call uses — replaces
 * 18 separate hardcoded `const MODEL = "gemini-3.6-flash"` copies that had
 * drifted apart with no way to tell them apart.
 *
 * Two tiers, both defaulting to the same free-tier flash model today (zero
 * behavior change on deploy):
 * - FAST_MODEL: high-volume or mechanical calls where latency/cost matter
 *   more than squeezing out extra reasoning quality (tag extraction from a
 *   note, parsing a quick exercise description, importing a document).
 * - STRONG_MODEL: the calls that actually decide something for the coach —
 *   Next Best Action, bottleneck diagnosis, performance level, the gap
 *   engine, the weekly plan skeleton, competition/evaluation analysis, the
 *   coaching chat, Coach Brain synthesis, and sport-profile/taxonomy
 *   generation (rare, cached, and precision there is what prevents
 *   cross-sport contamination).
 *
 * Override either via env (e.g. once a higher-capability Gemini tier is
 * confirmed available on the account) without touching call sites.
 */
export const FAST_MODEL = process.env.GEMINI_MODEL_FAST || "gemini-3.6-flash";
export const STRONG_MODEL = process.env.GEMINI_MODEL_STRONG || FAST_MODEL;
