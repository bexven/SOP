import { redirect } from "next/navigation";

/** The old "My Queue" address now lives at /dashboard. */
export default function QueueRedirect() {
  redirect("/dashboard");
}
