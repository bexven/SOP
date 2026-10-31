import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { SlaSettingsForm } from "@/components/settings/sla-settings-form";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getGeneralSettings, getSlaSettings } from "@/lib/server/queries/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireCapability("settings.manage");
  const [general, sla] = await Promise.all([getGeneralSettings(), getSlaSettings()]);
  return (
    <>
      <PageHeader title="Settings" description="Exchange rates, margin thresholds and task SLAs." />
      <div className="grid gap-6">
        <GeneralSettingsForm initial={general} />
        <SlaSettingsForm initial={sla} />
      </div>
    </>
  );
}
