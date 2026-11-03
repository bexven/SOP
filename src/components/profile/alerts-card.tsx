"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRingIcon, CheckCircle2Icon, Loader2Icon, SendIcon, SmartphoneIcon, SunriseIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createTelegramLinkAction,
  disconnectTelegramAction,
  removePushDeviceAction,
  savePushDeviceAction,
  sendMyDigestAction,
  sendTestAlertAction,
  setAlertPrefsAction,
} from "@/lib/server/actions/alerts";
import { deviceLabel, pushState, subscribe, unsubscribe, type PushState } from "@/lib/push-client";
import { cn } from "@/lib/utils";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M21.94 4.66 18.9 19.02c-.23 1.01-.83 1.26-1.68.79l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.72 8.6-7.77c.37-.33-.08-.52-.58-.19L7.12 13l-4.58-1.43c-1-.31-1.01-1 .21-1.47l17.9-6.9c.83-.31 1.56.19 1.29 1.46Z" />
    </svg>
  );
}

type Result = { ok: boolean; message?: string; error?: string; data?: unknown };

export function AlertsCard({
  vapidPublicKey,
  botUsername,
  telegramConnected,
  devices,
  instant,
  digest,
}: {
  vapidPublicKey: string;
  botUsername: string | null;
  telegramConnected: boolean;
  devices: number;
  instant: boolean;
  digest: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<PushState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
    // Coming back from Telegram after pressing Start: show the new status.
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  function run(fn: () => Promise<Result>, after?: (r: Result) => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        after?.(r);
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });
  }

  function turnOn() {
    startTransition(async () => {
      try {
        const sub = await subscribe(vapidPublicKey);
        const r = await savePushDeviceAction({ endpoint: sub.endpoint, keys: sub.keys, label: deviceLabel() });
        if (!r.ok) throw new Error(r.error);
        toast.success(r.message);
        setState("on");
        router.refresh();
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "denied") {
          setState("denied");
          toast.error("Notifications are blocked for this site. Allow them in the browser's site settings, then try again.");
        } else if (msg === "dismissed") toast.info("No problem — tap the button again when you're ready.");
        else toast.error(msg || "Couldn't turn on notifications on this device.");
      }
    });
  }

  function turnOff() {
    startTransition(async () => {
      const endpoint = await unsubscribe().catch(() => null);
      if (endpoint) await removePushDeviceAction({ endpoint });
      setState("off");
      toast.success("Notifications are off for this device");
      router.refresh();
    });
  }

  return (
    <section id="alerts" className="surface grid scroll-mt-24 gap-5 rounded-panel p-5" aria-labelledby="alerts-h">
      <div>
        <h2 id="alerts-h" className="text-section text-slate-900">
          Alerts on your phone
        </h2>
        <p className="mt-1 text-body text-slate-600">
          Get a ping when something needs you, and a short summary every morning at <span className="num font-medium">10:00</span>. Both are free.
        </p>
      </div>

      {/* Push on this device */}
      <div className="flex flex-col gap-3 rounded-control border border-slate-200/80 p-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-indigo-50 text-indigo-700">
          <SmartphoneIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-slate-900">Notifications on this device</p>
          <p className="text-meta font-normal text-slate-600">
            {state === null
              ? "Checking…"
              : state === "on"
                ? "On — alerts pop up on this device even when the app is closed."
                : state === "denied"
                  ? "Blocked in this browser. Open the site settings (padlock in the address bar), allow Notifications, then reload."
                  : state === "needs-install"
                    ? "On iPhone: tap Share → “Add to Home Screen”, open Product SOP from the home screen, then turn this on."
                    : state === "unsupported"
                      ? "This browser can't show notifications. Try Chrome, Edge or Firefox — or use Telegram below."
                      : "Off on this device."}
            {devices > 0 ? ` · ${devices} device${devices === 1 ? "" : "s"} on in total` : ""}
          </p>
        </div>
        {state === "on" ? (
          <Button variant="outline" disabled={pending} onClick={turnOff}>
            Turn off
          </Button>
        ) : state === "off" ? (
          <Button disabled={pending} onClick={turnOn}>
            {pending ? <Loader2Icon className="animate-spin" /> : <BellRingIcon />} Turn on
          </Button>
        ) : null}
      </div>

      {/* Telegram */}
      <div className="flex flex-col gap-3 rounded-control border border-slate-200/80 p-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-sky-50 text-sky-700">
          <TelegramIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-slate-900">Telegram</p>
          <p className="text-meta font-normal text-slate-600">
            {!botUsername
              ? "Not available yet — an Admin connects the team's bot in Settings → Notifications."
              : telegramConnected
                ? `Connected to @${botUsername}. Send /today to the bot any time to see what's waiting.`
                : `Tap Connect, then press Start in Telegram (@${botUsername}).`}
          </p>
        </div>
        {botUsername ? (
          telegramConnected ? (
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-meta text-emerald-700">
                <CheckCircle2Icon className="size-4" /> Connected
              </span>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => disconnectTelegramAction({}))}>
                Disconnect
              </Button>
            </span>
          ) : (
            <Button
              className="bg-sky-700 hover:bg-sky-800"
              disabled={pending}
              onClick={() =>
                run(
                  () => createTelegramLinkAction({}),
                  (r) => {
                    const url = (r.data as { url?: string } | undefined)?.url;
                    if (url) window.open(url, "_blank", "noopener");
                  },
                )
              }
            >
              <TelegramIcon className="size-4" /> Connect Telegram
            </Button>
          )
        ) : null}
      </div>

      {/* Preferences */}
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-meta text-slate-700">What to send</legend>
        <Pref
          checked={instant}
          disabled={pending}
          onChange={(v) => run(() => setAlertPrefsAction({ instant: v, digest }))}
          icon={BellRingIcon}
          title="Instant alerts"
          hint="New tasks, reviews, changes asked, mentions — as they happen."
        />
        <Pref
          checked={digest}
          disabled={pending}
          onChange={(v) => run(() => setAlertPrefsAction({ instant, digest: v }))}
          icon={SunriseIcon}
          title="Morning summary at 10:00"
          hint="Only on days something is waiting on you."
        />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => sendTestAlertAction({}))}>
          <SendIcon /> Send me a test
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => sendMyDigestAction({}))}>
          <SunriseIcon /> Send my summary now
        </Button>
      </div>
    </section>
  );
}

function Pref({
  checked,
  disabled,
  onChange,
  icon: Icon,
  title,
  hint,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  icon: typeof BellRingIcon;
  title: string;
  hint: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-control px-1 py-0.5", disabled && "cursor-wait")}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>
        <span className="flex items-center gap-1.5 text-body font-medium text-slate-900">
          <Icon className="size-4 text-slate-500" /> {title}
        </span>
        <span className="block text-meta font-normal text-slate-600">{hint}</span>
      </span>
    </label>
  );
}
