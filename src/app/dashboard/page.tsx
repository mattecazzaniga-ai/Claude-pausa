import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  return (
    <main className="min-h-screen">
      <Nav />
      <DashboardClient />
    </main>
  );
}
