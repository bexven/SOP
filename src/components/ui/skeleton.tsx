import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-slate-900/[0.06]", className)} {...props} />;
}

export { Skeleton };
