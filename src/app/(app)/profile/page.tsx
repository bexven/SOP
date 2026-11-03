import type { Metadata } from "next";
import Link from "next/link";
import { KeyRoundIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { RolePill } from "@/components/common/pill";
import { PhotoEditor } from "@/components/profile/photo-editor";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/server/auth/current-user";
import { db } from "@/lib/server/db";
import { vapidKeys } from "@/lib/server/services/alerts";
import { AlertsCard } from "@/components/profile/alerts-card";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [me, settings, keys] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { telegramChatId: true, alertsInstant: true, alertsDigest: true, _count: { select: { pushDevices: true } } },
    }),
    db.settings.findUnique({ where: { id: 1 }, select: { telegramBotUsername: true } }),
    vapidKeys(),
  ]);
  return (
    <>
      <PageHeader title="My profile" description="Your photo, alerts on your phone and Telegram, and your PIN." />
      <div className="grid max-w-2xl gap-4">
        <section className="surface rounded-panel p-5" aria-labelledby="photo-h">
          <h2 id="photo-h" className="mb-4 text-section text-slate-900">
            Photo
          </h2>
          <PhotoEditor name={user.name} color={user.avatarColor} assetId={user.avatarAssetId} />
        </section>
        <AlertsCard
          vapidPublicKey={keys.publicKey}
          botUsername={settings?.telegramBotUsername ?? null}
          telegramConnected={Boolean(me.telegramChatId)}
          devices={me._count.pushDevices}
          instant={me.alertsInstant}
          digest={me.alertsDigest}
        />
        <section className="surface rounded-panel p-5" aria-labelledby="acct-h">
          <h2 id="acct-h" className="text-section text-slate-900">
            Account
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-meta text-slate-500">Name</dt>
              <dd className="mt-0.5 text-body font-medium text-slate-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-meta text-slate-500">Role</dt>
              <dd className="mt-1">
                <RolePill role={user.jobRole} />
                {user.isMaster ? <span className="ml-1.5 text-meta text-indigo-700">Master Admin</span> : user.adminAccess ? <span className="ml-1.5 text-meta text-indigo-700">+ Admin access</span> : null}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-meta font-normal text-slate-500">Only an Admin can change your name or role.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/change-pin">
              <KeyRoundIcon /> Change my PIN
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
