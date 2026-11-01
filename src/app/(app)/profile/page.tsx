import type { Metadata } from "next";
import Link from "next/link";
import { KeyRoundIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { RolePill } from "@/components/common/pill";
import { PhotoEditor } from "@/components/profile/photo-editor";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/server/auth/current-user";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My profile" description="Your photo appears on your tasks, comments and across the team's screens." />
      <div className="grid max-w-2xl gap-4">
        <section className="surface rounded-panel p-5" aria-labelledby="photo-h">
          <h2 id="photo-h" className="mb-4 text-section text-slate-900">
            Photo
          </h2>
          <PhotoEditor name={user.name} color={user.avatarColor} assetId={user.avatarAssetId} />
        </section>
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
                <RolePill role={user.role} />
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
