import type { Metadata } from "next";
import { PackageIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { requireUser } from "@/lib/server/auth/current-user";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Products" description="Search and filter every product, including killed ones." />
      <EmptyState
        icon={PackageIcon}
        title="No products yet"
        description="Products appear here as soon as research starts on them."
      />
    </>
  );
}
