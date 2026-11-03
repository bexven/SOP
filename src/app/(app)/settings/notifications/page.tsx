import type { Metadata } from "next";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { requireCapability } from "@/lib/server/auth/current-user";
import { db } from "@/lib/server/db";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsSettingsPage() {
  await requireCapability("settings.manage");
  const [settings, people] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 }, select: { telegramBotUsername: true, lastDigestOn: true, appUrl: true } }),
    db.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarColor: true, avatarAssetId: true, telegramChatId: true, alertsDigest: true, alertsInstant: true, _count: { select: { pushDevices: true } } },
    }),
  ]);
  return (
    <NotificationSettings
      botUsername={settings?.telegramBotUsername ?? null}
      lastDigestOn={settings?.lastDigestOn ?? null}
      people={people.map((p) => ({
        id: p.id,
        name: p.name,
        avatarColor: p.avatarColor,
        avatarAssetId: p.avatarAssetId,
        telegram: Boolean(p.telegramChatId),
        devices: p._count.pushDevices,
        digest: p.alertsDigest,
        instant: p.alertsInstant,
      }))}
    />
  );
}
