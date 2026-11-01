import type { Metadata } from "next";
import { InboxIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { NewProductButton } from "@/components/product/new-product-dialog";
import { ProductSheetSlot, sheetParam } from "@/components/product/product-sheet-slot";
import { QueueGroup } from "@/components/queue/queue-list";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { getQueue } from "@/lib/server/queries/queue";

export const metadata: Metadata = { title: "My Queue" };

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const user = await requireUser();
  const [q, sp] = await Promise.all([getQueue(user), searchParams]);
  const total = q.overdue.length + q.today.length + q.upcoming.length + q.revision.length + q.review.length + q.unassigned.length;
  return (
    <>
      <PageHeader
        title="My Queue"
        description={total ? `${total} thing${total === 1 ? "" : "s"} waiting on you, ${user.name}.` : `Everything waiting on you, ${user.name}.`}
      />
      {total === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="You're all caught up"
          description={
            can(user.role, "product.create")
              ? "Nothing is waiting on you. Start researching the next product when you're ready."
              : "Nothing is waiting on you right now. New tasks and reviews will appear here, and you'll get a notification."
          }
          action={can(user.role, "product.create") ? <NewProductButton /> : undefined}
        />
      ) : (
        <div className="grid gap-6">
          <QueueGroup group="overdue" items={q.overdue} />
          <QueueGroup group="review" items={q.review} showAssignee />
          <QueueGroup group="revision" items={q.revision} />
          <QueueGroup group="today" items={q.today} />
          <QueueGroup group="upcoming" items={q.upcoming} />
          <QueueGroup group="unassigned" items={q.unassigned} />
        </div>
      )}
      <ProductSheetSlot productId={sheetParam(sp)} user={user} />
    </>
  );
}
