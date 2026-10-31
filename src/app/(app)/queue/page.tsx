import type { Metadata } from "next";
import { InboxIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { requireUser } from "@/lib/server/auth/current-user";

export const metadata: Metadata = { title: "My Queue" };

export default async function QueuePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My Queue" description={`Everything waiting on you, ${user.name}.`} />
      <EmptyState
        icon={InboxIcon}
        title="Nothing waiting on you"
        description="Tasks assigned to you will show up here, grouped by overdue, due today, upcoming and in revision."
      />
    </>
  );
}
