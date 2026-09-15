import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTrainingSessionData } from "@/lib/session-data";
import { TrainingModeClient } from "./training-mode-client";

export default async function TrainingModePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?callbackUrl=/sessions/${params.id}/train`);

  const data = await getTrainingSessionData(params.id, session.user.id);
  if (!data || data.blocks.length === 0) notFound();

  // Deliberately no <Nav /> here — Training Mode is meant to be used on the
  // pitch/court with one thing on screen at a time, not a page to navigate away from.
  return <TrainingModeClient initialData={data} />;
}
