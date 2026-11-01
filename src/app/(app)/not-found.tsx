import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Not found"
      description="That page or product doesn't exist (or was removed)."
      action={
        <Button asChild>
          <Link href="/queue">Back to My Queue</Link>
        </Button>
      }
    />
  );
}
