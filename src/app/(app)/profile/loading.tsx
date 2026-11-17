import { ListSkeleton } from "@/components/common/skeletons";

export default function Loading() {
  return <ListSkeleton groups={1} rows={4} />;
}
