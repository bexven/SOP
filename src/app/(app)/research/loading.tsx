import { ListSkeleton } from "@/components/common/skeletons";

export default function Loading() {
  return <ListSkeleton groups={2} rows={3} />;
}
