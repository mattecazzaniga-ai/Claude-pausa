import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { PaymentsClient } from "./payments-client";

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/payments");

  return (
    <main className="min-h-screen">
      <Nav />
      <PaymentsClient />
    </main>
  );
}
