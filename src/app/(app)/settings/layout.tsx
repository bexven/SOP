import { PageHeader } from "@/components/common/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireCapability } from "@/lib/server/auth/current-user";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("settings.manage");
  return (
    <>
      <PageHeader title="Settings" description="Rates, thresholds, SLAs and the SOP for every task type." />
      <SettingsNav />
      {children}
    </>
  );
}
