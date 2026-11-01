import type { Metadata } from "next";
import { StepGuideEditor } from "@/components/settings/step-guide-editor";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getStepGuides } from "@/lib/server/queries/templates";

export const metadata: Metadata = { title: "Step guides" };

export default async function GuidesPage() {
  await requireCapability("settings.manage");
  return <StepGuideEditor guides={await getStepGuides()} />;
}
