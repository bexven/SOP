import { KanbanSquareIcon, ListIcon } from "lucide-react";
import { ViewTabs } from "@/components/common/list-view";

/** Products and Pipeline are two views of the same products: List and Board (ClickUp style). */
export function ProductViewTabs({ current, count }: { current: "list" | "board"; count: number }) {
  return (
    <ViewTabs
      tabs={[
        { key: "list", label: "List", href: "/products", icon: ListIcon, current: current === "list", count },
        { key: "board", label: "Board", href: "/pipeline", icon: KanbanSquareIcon, current: current === "board" },
      ]}
    />
  );
}
