import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePinForm } from "@/components/auth/change-pin-form";
import { Logo } from "@/components/common/logo";
import { getCurrentUser } from "@/lib/server/auth/current-user";

export const metadata: Metadata = { title: "Set your PIN" };

export default async function ChangePinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />
      <ChangePinForm name={user.name} avatarColor={user.avatarColor} forced={user.mustChangePin} />
    </main>
  );
}
