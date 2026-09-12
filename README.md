# Internet Wall

> Own a tiny piece of the internet. 100,000 squares. One giant wall.

A working MVP: a 100,000-square interactive wall where anyone can buy a square, customize it, and later resell it. Built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL, NextAuth, and a Stripe-ready payment layer with a safe mock flow for local development.

## 1. What was built

- **The wall**: a canvas-rendered (not DOM-per-square) grid of 100,000 squares (400×250) with smooth pan, wheel-zoom, pinch-zoom, click-to-open, hover tooltips, a live legend, and a boundary frame so the wall reads clearly at any zoom level. Performance holds at 100k cells because only the visible range is rasterized per frame, batched into per-color `Path2D` fills.
- **Pricing that reads visually**: four price tiers (€1 / €1.5 / €2 / €3) laid out as concentric "prime real estate" rings from the center outward, rendered as a genuine color gradient rather than a table.
- **Accounts**: register / log in / log out via NextAuth credentials + bcrypt, JWT sessions, a suspended-account gate.
- **Buying a square**: server-validated price and availability, a `Transaction` row created before any money moves, and a payment abstraction (`src/lib/payments.ts`) that uses real Stripe Checkout when `STRIPE_SECRET_KEY` is set, or an internal, clearly-labeled "test mode" checkout page otherwise. Both paths call the **same** `finalizePurchase()` function (`src/lib/purchase.ts`), which is the only place ownership ever changes — guarded by a conditional `UPDATE ... WHERE status = 'AVAILABLE'` so two simultaneous buyers can never both win the same square (verified under real concurrent requests, see "Known limitations" for the one edge case that remains).
- **Customization**: title, description, image URL, external link, and a background color swatch — owner-only, validated server-side.
- **Square detail**: a modal on the wall and a shareable `/square/[id]` page, both backed by the same component.
- **Resale marketplace**: list/cancel a listing, buy a listed square, 5% platform fee computed server-side and recorded on the transaction. Full data model + UI; payouts to sellers are out of scope for the MVP (see limitations).
- **Chapters**: a `Chapter` model with 90-day windows, stats (squares sold, users, transactions), and an admin action to end the current chapter and start the next.
- **Home page**: hero, stats, and a live embedded wall preview.
- **Profile page**: avatar, owned squares, total spent, active listings, joined date.
- **Admin dashboard**: users, squares sold/available, primary revenue, secondary volume, platform fees, active chapter, recent transactions, plus actions to moderate a square's content, suspend/unsuspend a user, and advance the chapter.
- **Analytics**: a `track()` helper and `AnalyticsEvent` table covering every event listed in the brief (`landing_page_view`, `wall_open`, `square_view`, `square_purchase_started/completed`, `square_customized`, `listing_created`, `resale_started/completed`, `signup`).
- **Security**: server-side price/authorization checks everywhere, Zod input validation, a simple in-memory rate limiter on auth/purchase routes, ownership checks before every mutation, and race-safe purchase settlement.

## 2. Key files

```
prisma/schema.prisma            Data model
prisma/seed.ts                  Bulk-seeds 100,000 squares via a single SQL generate_series insert (~2s)
src/lib/grid.ts                 Wall geometry + deterministic pricing (shared by server and client)
src/lib/auth.ts                 NextAuth config (credentials + JWT)
src/lib/payments.ts             Stripe / mock checkout abstraction
src/lib/purchase.ts             finalizePurchase() — the single source of truth for ownership changes
src/lib/analytics.ts            Server-side event tracking
src/components/wall-canvas.tsx  The canvas renderer (pan/zoom/pinch/click/hover)
src/components/square-detail.tsx  Buy / customize / list / cancel — used in modal and full page
src/app/wall/                   The wall page + client shell (search, legend, stats)
src/app/square/[id]/            Shareable square detail page
src/app/profile/[username]/     Public profile
src/app/admin/                  Admin dashboard
src/app/api/**                  All REST endpoints (wall state, squares, listings, payments, admin, search)
```

## 3. Database schema

`User`, `Square`, `Listing`, `Transaction`, `Chapter`, `AnalyticsEvent` — see `prisma/schema.prisma` for the full, exact schema (types, enums, indexes, relations). Every ownership change is recorded as a `Transaction`; there is no code path that sets `Square.ownerId` without one.

## 4. Environment variables

Copy `.env.example` to `.env` and fill in as needed:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (works with Supabase, Vercel Postgres, RDS, local Postgres, ...) |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | e.g. `http://localhost:3000` in dev |
| `STRIPE_SECRET_KEY` | No | Leave blank to use the built-in mock checkout flow |
| `STRIPE_WEBHOOK_SECRET` | No | Required once `STRIPE_SECRET_KEY` is set |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Not currently used client-side (Checkout redirect only), reserved for embedded Elements later |
| `NEXT_PUBLIC_APP_URL` | Yes | Used to build Stripe/mock redirect URLs |

## 5. Run locally

```bash
npm install
# Point DATABASE_URL at any Postgres instance, then:
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seeds 100,000 squares + an admin and a demo account
npm run dev
```

Demo accounts created by the seed script:
- Admin: `admin@internetwall.app` / `admin1234`
- Demo user (owns a few starter squares): `demo@internetwall.app` / `demo1234`

Since no Stripe keys are required for local dev, buying a square walks through an internal `/checkout/mock/[id]` page clearly labeled "Test mode" with "Simulate successful/failed payment" buttons. It calls the exact same finalize logic Stripe's webhook would call — there is no separate "fake success" code path in production logic, only a different trigger for the same function, and it hard-disables itself the moment `STRIPE_SECRET_KEY` is set.

## 6. Connecting Supabase / PostgreSQL

1. Create a Supabase project (or any Postgres instance).
2. Copy its connection string into `DATABASE_URL` (Supabase: Project Settings → Database → Connection string → URI; use the pooled connection string for serverless deploys).
3. Run `npm run db:migrate` (or `npx prisma migrate deploy` in production) and `npm run db:seed` once.

Supabase's Auth/Storage aren't used here — auth is self-contained via NextAuth + Prisma, and images are referenced by URL rather than uploaded, to keep the MVP's surface area small. Swapping in Supabase Storage for image uploads is a natural next step (see TODOs).

## 7. Connecting Stripe

1. Create a Stripe account and get your secret key.
2. Set `STRIPE_SECRET_KEY` (and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` if you later add Elements).
3. Add a webhook endpoint in the Stripe dashboard pointing to `/api/webhooks/stripe`, subscribed to `checkout.session.completed`, and set `STRIPE_WEBHOOK_SECRET` to its signing secret.
4. That's it — `createCheckoutSession()` in `src/lib/payments.ts` automatically switches from the mock flow to real Stripe Checkout the moment `STRIPE_SECRET_KEY` is present. No other code changes needed.

## 8. Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Set the environment variables from section 4 in the Vercel project settings.
3. Add a Postgres database (Vercel Postgres, Supabase, or Neon all work) and set `DATABASE_URL`.
4. Add a build step to run migrations, e.g. set the Vercel build command to `prisma migrate deploy && next build`, and run `npm run db:seed` once manually (e.g. via `vercel env pull && npm run db:seed` locally, or a one-off script) to seed the wall.
5. Configure the Stripe webhook URL to `https://<your-domain>/api/webhooks/stripe` once Stripe is connected.

## 9. Remaining TODOs

- Seller payouts for secondary sales (currently recorded as a `Transaction` with `platformFee`, but no Stripe Connect payout flow — money collection only).
- Image uploads (currently URL-only; wiring Supabase Storage or an S3-compatible bucket would let users upload directly instead of hot-linking).
- Real-time wall updates via WebSockets/SSE instead of the current 20s poll (fine at MVP scale; would matter once concurrent activity is high).
- Password reset / email verification flow.
- Refund handling for the "square sold to someone else while your Stripe Checkout was open" edge case (see below).
- Automated tests (this build was verified via manual + scripted end-to-end runs — see below — but has no CI test suite yet).

## 10. Known limitations

- **Rate limiting is in-memory**, per server instance — fine for a single-instance MVP, but should move to a shared store (e.g. Upstash Redis) before scaling horizontally.
- **Race protection covers ownership, not payment capture.** Two buyers can both open Stripe Checkout for the same square (each creates its own `Transaction`); the conditional update in `finalizePurchase()` guarantees only one of them actually receives the square, and the loser's transaction is marked `FAILED`. With real Stripe, the losing buyer's card will have been charged and needs a refund — that refund call is not yet wired up (a `TODO` for a Stripe Connect/refund integration). This was verified directly: two concurrent purchase confirmations for the same square resulted in exactly one `COMPLETED` transaction and one `square_no_longer_available` failure.
- **No email delivery** — registration doesn't verify email addresses.
- **Dark mode only** by design (the brief calls for dark as the primary experience); no light theme was built.
- **Secondary-sale customization is preserved across ownership transfer** (title/description/etc. carry over to the new owner rather than resetting) — a deliberate simplicity choice, easily changed if product feedback says otherwise.

## Verification performed

- `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean.
- Full manual + scripted pass over: register, login (including the seeded demo/admin accounts), wall state/meta endpoints (byte-exact 100,000-entry buffer), search by username/square id/coordinates, primary purchase through the mock flow, concurrent double-purchase race protection, customization, listing creation, secondary-sale purchase with fee calculation, and admin access gating.
- Verified in a real browser (Chromium via Playwright) at desktop (1280×800) and mobile (390×844) viewports: home page, wall pan/zoom/search/click-to-modal, and a zoomed-in grid view, with no console errors.
