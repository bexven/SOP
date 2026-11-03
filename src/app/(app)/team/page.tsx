import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { AddMemberButton, TeamList, TeamPinButton } from "@/components/team/team-manager";
import { TeamNav } from "@/components/team/team-nav";
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
        description="Only you (Master Admin) can manage the team: add people, change names and PINs. Use Roles & permissions to tick what each person can do."
        actions={
          <>
            <TeamPinButton />
            <AddMemberButton />
          </>
        }
      />
      <TeamNav />
      <TeamList team={team} currentUserId={user.id} />
    </>
  );
}
