import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { RolesMatrix } from "@/components/team/roles-matrix";
import { TeamNav } from "@/components/team/team-nav";
import { requireMaster } from "@/lib/server/auth/current-user";
import { getTeam } from "@/lib/server/queries/team";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  await requireMaster();
  const team = await getTeam();
  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Tick what each person can do, then Save their row. Admin access means everything. Changing someone's job role starts them on that role's defaults."
      />
      <TeamNav />
      <RolesMatrix team={team} />
      <p className="mt-3 text-meta font-normal text-slate-500">
        “Senior: approve creative” is the Senior role: they approve website images, Meta ad images and videos. Everyone can view every product and the pipeline.
      </p>
    </>
  );
}
