"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ExternalLinkIcon, Loader2Icon, PlugIcon, SunriseIcon, UnplugIcon } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectTelegramBotAction, disconnectTelegramBotAction, sendMyDigestAction } from "@/lib/server/actions/alerts";
import { SettingsCard } from "./settings-card";

type Person = { id: string; name: string; avatarColor: string; avatarAssetId: string | null; telegram: boolean; devices: number; digest: boolean; instant: boolean };

export function NotificationSettings({ botUsername, lastDigestOn, people }: { botUsername: string | null; lastDigestOn: string | null; people: Person[] }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        after?.();
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Telegram bot"
        description="One bot for the whole team. Each person then connects their own Telegram from My profile."
      >
        {botUsername ? (
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-body text-slate-800">
              <CheckCircle2Icon className="size-5 text-emerald-600" /> Connected to
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline">
                @{botUsername} <ExternalLinkIcon className="size-3.5" />
              </a>
            </p>
            <p className="text-meta font-normal text-slate-600">Tell the team: open My profile → Connect Telegram → press Start.</p>
            <Button variant="outline" className="w-fit" disabled={pending} onClick={() => run(() => disconnectTelegramBotAction({}))}>
              <UnplugIcon /> Disconnect bot
            </Button>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => connectTelegramBotAction({ token }), () => setToken(""));
            }}
          >
            <ol className="grid list-decimal gap-1 pl-5 text-body text-slate-700">
              <li>
                In Telegram, open{" "}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 hover:underline">
                  @BotFather
                </a>{" "}
                and send <span className="num">/newbot</span>.
              </li>
              <li>Give it a name (e.g. “Product SOP”) and a username ending in “bot”.</li>
              <li>Copy the token BotFather sends and paste it here.</li>
            </ol>
            <label htmlFor="bot-token" className="text-meta text-slate-700">
              Bot token
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="bot-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="1234567890:AA…"
                className="num"
              />
              <Button type="submit" disabled={pending || token.trim().length < 20}>
                {pending ? <Loader2Icon className="animate-spin" /> : <PlugIcon />} Connect bot
              </Button>
            </div>
            <p className="text-meta font-normal text-slate-500">The token is stored on the server only and never shown again.</p>
          </form>
        )}
      </SettingsCard>

      <SettingsCard title="Morning summary" description="Every day at 10:00 (Dhaka), people with something waiting get a short summary on their phone and Telegram.">
        <div className="grid gap-3">
          <p className="flex items-center gap-2 text-body text-slate-700">
            <SunriseIcon className="size-4 text-amber-600" /> Last sent: <span className="num font-medium">{lastDigestOn ?? "not yet"}</span>
          </p>
          <Button variant="outline" className="w-fit" disabled={pending} onClick={() => run(() => sendMyDigestAction({}))}>
            Send me my summary now
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Who gets alerts" description="People turn these on themselves in My profile.">
        <ul className="divide-y divide-slate-100">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <UserAvatar name={p.name} color={p.avatarColor} imageId={p.avatarAssetId} size="sm" />
              <span className="min-w-0 flex-1 text-body font-medium text-slate-900">{p.name}</span>
              <Tag on={p.devices > 0}>{p.devices > 0 ? `Push · ${p.devices}` : "No push"}</Tag>
              <Tag on={p.telegram}>{p.telegram ? "Telegram" : "No Telegram"}</Tag>
              <Tag on={p.digest}>{p.digest ? "Morning summary" : "No summary"}</Tag>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  );
}

function Tag({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={on ? "rounded-full bg-emerald-50 px-2 py-0.5 text-meta text-emerald-800 ring-1 ring-emerald-100" : "rounded-full bg-slate-100 px-2 py-0.5 text-meta text-slate-600"}>
      {children}
    </span>
  );
}
