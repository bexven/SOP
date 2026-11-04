import type { Metadata } from "next";
import { AutoRefresh } from "@/components/common/auto-refresh";
import { PageHeader } from "@/components/common/page-header";
import { ManualBoard } from "@/components/tasks/manual-board";
import { requireUser } from "@/lib/server/auth/current-user";
import { getManualBoard } from "@/lib/server/queries/manual-tasks";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireUser();
  const sp = await searchParams;
  const board = await getManualBoard(user);
  const taskId = typeof sp.task === "string" ? sp.task : undefined;

  return (
    <>
      <PageHeader title="Tasks" description="Team tasks outside the product steps. Add one, assign someone, set a due time, and drag it across as it moves." />
      <ManualBoard board={board} viewer={{ id: user.id, role: user.role }} openTaskId={taskId} startNew={sp.new === "1"} />
      <AutoRefresh seconds={30} />
    </>
  );
}
