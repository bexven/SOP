import type { Metadata } from "next";
import { connection } from "next/server";
import { LoginFlow } from "@/components/auth/login-flow";
import { Logo } from "@/components/common/logo";
import { getLoginRoster } from "@/lib/server/queries/team";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  await connection(); // always render at request time: the roster changes
  const roster = await getLoginRoster();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />
      <LoginFlow roster={roster} />
      <p className="mt-8 text-meta text-slate-500">Forgot your PIN? Ask an Admin to reset it.</p>
    </main>
  );
}
