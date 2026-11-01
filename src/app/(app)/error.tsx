"use client";

import { AlertTriangleIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangleIcon}
      title="Something went wrong"
      description="This page couldn't load. Try again — if it keeps happening, tell an Admin what you were doing."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
