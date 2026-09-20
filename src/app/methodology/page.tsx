import { redirect } from "next/navigation";

/**
 * Product restructure §13/§30: this used to be its own page telling the
 * same story as /coach-brain ("how MENTATHLOS understands your coaching")
 * under a different name — merged there. Kept as a redirect, not deleted
 * outright, so any bookmark or old link still lands somewhere useful.
 */
export default function MethodologyPage() {
  redirect("/coach-brain");
}
