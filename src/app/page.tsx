import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRightIcon, ImagesIcon, ListTodoIcon, MegaphoneIcon, SearchCheckIcon, TruckIcon } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth/session-token";

export const metadata: Metadata = { title: "eCom SOP system" };

const STEPS = [
  { icon: SearchCheckIcon, label: "Research & review" },
  { icon: ImagesIcon, label: "Image & video creative" },
  { icon: MegaphoneIcon, label: "Meta ads" },
  { icon: TruckIcon, label: "Orders" },
  { icon: ListTodoIcon, label: "Team tasks" },
];

/** The front door: what this is, and one button to sign in (or back to the dashboard if already signed in). */
export default async function Home() {
  const secret = process.env.SESSION_SECRET;
  const session = secret ? await verifySession((await cookies()).get(SESSION_COOKIE)?.value, secret) : null;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-15%] size-[30rem] rounded-full bg-sky-300/25 blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between py-5">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href={session ? "/dashboard" : "/login"}>{session ? "Dashboard" : "Log in"}</Link>
        </Button>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center pb-16 text-center">
        <p className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-full bg-white/70 px-3 py-1 text-meta text-indigo-700 ring-1 ring-indigo-100 duration-500 motion-reduce:animate-none">
          Bexven · internal tool
        </p>
        <h1 className="animate-in fade-in-0 slide-in-from-bottom-3 mt-5 text-[40px] leading-[1.1] font-semibold tracking-tight text-balance text-slate-900 duration-500 motion-reduce:animate-none sm:text-[56px]">
          eCom SOP system
        </h1>
        <p className="animate-in fade-in-0 slide-in-from-bottom-3 mt-4 max-w-xl text-[17px] leading-relaxed text-pretty text-slate-600 delay-75 duration-500 fill-mode-both motion-reduce:animate-none">
          Every product from first research to stock orders: who does what, what&apos;s waiting on whom, and what&apos;s due today.
        </p>
        <div className="animate-in fade-in-0 slide-in-from-bottom-3 mt-8 delay-150 duration-500 fill-mode-both motion-reduce:animate-none">
          <Button asChild size="lg" className="h-12 px-6 text-[15px]">
            <Link href={session ? "/dashboard" : "/login"}>
              {session ? "Open dashboard" : "Log in"} <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <ul className="animate-in fade-in-0 mt-12 flex flex-wrap justify-center gap-2 delay-300 duration-700 fill-mode-both motion-reduce:animate-none" aria-label="What it covers">
          {STEPS.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-meta text-slate-700 ring-1 ring-slate-900/[0.06]">
              <s.icon className="size-3.5 text-slate-500" aria-hidden /> {s.label}
            </li>
          ))}
        </ul>
      </section>

      <footer className="pb-6 text-center text-meta font-normal text-slate-500">Asia/Dhaka · Sign in with your name and PIN</footer>
    </main>
  );
}
