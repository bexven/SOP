import type { Metadata } from "next";
import { BrandEditor } from "@/components/settings/brand-editor";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getBrands } from "@/lib/server/queries/product";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  const user = await requireCapability("settings.manage");
  return <BrandEditor brands={await getBrands(user)} canRestrict={user.isMaster} />;
}
