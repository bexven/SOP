import type { Metadata } from "next";
import { ChecklistTemplateEditor } from "@/components/settings/checklist-template-editor";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getChecklistTemplates } from "@/lib/server/queries/templates";

export const metadata: Metadata = { title: "Checklists" };

export default async function ChecklistsPage() {
  await requireCapability("settings.manage");
  return <ChecklistTemplateEditor groups={await getChecklistTemplates()} />;
}
