import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { isStripeConfigured } from "@/lib/stripe";
import { OffersClient } from "./offers-client";

export default async function OffersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/payments/offers");

  return (
    <main className="min-h-screen">
      <Nav />
      <OffersClient stripeConfigured={isStripeConfigured} />
    </main>
  );
}
