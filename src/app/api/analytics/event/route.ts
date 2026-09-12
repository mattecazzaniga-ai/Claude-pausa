import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { track, type AnalyticsEventName } from "@/lib/analytics";

const ALLOWED: AnalyticsEventName[] = [
  "landing_page_view",
  "wall_open",
  "square_view",
  "square_purchase_started",
  "square_purchase_completed",
  "square_customized",
  "listing_created",
  "resale_started",
  "resale_completed",
  "signup",
];

/** Thin endpoint for client-side analytics beacons (server-side flows call track() directly). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const body = await req.json().catch(() => null);
  const name = body?.name as AnalyticsEventName | undefined;
  if (!name || !ALLOWED.includes(name)) return NextResponse.json({ ok: false }, { status: 400 });

  track(name, session?.user?.id, body?.metadata);
  return NextResponse.json({ ok: true });
}
