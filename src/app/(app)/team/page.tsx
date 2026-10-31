import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { AddMemberButton, TeamList } from "@/components/team/team-manager";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getTeam } from "@/lib/server/queries/team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireCapability("team.manage");
  const team = await getTeam();
  return (
    <>
      <PageHeader
        title="Team"
        description="Add people, set their role, reset PINs and deactivate leavers."
        actions={<AddMemberButton />}
      />
      <TeamList team={team} currentUserId={user.id} />
    </>
  );
}
