import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTrainingSessionData } from "@/lib/session-data";
import { Nav } from "@/components/nav";
import { SessionClient } from "./session-client";

export default async function SessionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?callbackUrl=/sessions/${params.id}`);

  const data = await getTrainingSessionData(params.id, session.user.id);
  if (!data) notFound();

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          {data.athlete ? (
            <Link href={`/athletes/${data.athlete.id}`} className="text-sm text-muted hover:text-foreground">
              ← {data.athlete.name}
            </Link>
          ) : data.team ? (
            <Link href={`/teams/${data.team.id}`} className="text-sm text-muted hover:text-foreground">
              ← {data.team.name}
            </Link>
          ) : (
            <span />
          )}
          {data.blocks.length > 0 && (
            <Link
              href={`/sessions/${data.id}/train`}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Avvia allenamento →
            </Link>
          )}
        </div>
      </div>
      <SessionClient initialData={data} />
    </main>
  );
}
