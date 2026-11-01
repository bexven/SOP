import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { AddMemberButton, TeamList } from "@/components/team/team-manager";
import { requireMaster } from "@/lib/server/auth/current-user";
import { getTeam } from "@/lib/server/queries/team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireMaster();
  const team = await getTeam();
  return (
    <>
      <PageHeader
        title="Team"
        description="Only you (Master Admin) can manage the team: add people, change names, roles, admin access and PINs."
        actions={<AddMemberButton />}
      />
      <TeamList team={team} currentUserId={user.id} />
    </>
  );
}
