"use client";

import { useEffect } from "react";
import { deviceLabel, syncSubscription } from "@/lib/push-client";
import { savePushDeviceAction } from "@/lib/server/actions/alerts";

/**
 * Once per browser tab: if this device turned notifications on, make sure the server still has its
 * current subscription (renewing a stale one). Silent; never asks for permission.
 */
export function PushSync({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  useEffect(() => {
    if (!vapidPublicKey) return;
    try {
      if (sessionStorage.getItem("sop-push-synced") === vapidPublicKey) return;
    } catch {
      /* storage blocked: sync anyway */
    }
    syncSubscription(vapidPublicKey)
      .then(async (sub) => {
        if (!sub?.endpoint || !sub.keys) return;
        const r = await savePushDeviceAction({ endpoint: sub.endpoint, keys: sub.keys, label: deviceLabel(), silent: true });
        if (r.ok) {
          try {
            sessionStorage.setItem("sop-push-synced", vapidPublicKey);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }, [vapidPublicKey]);
  return null;
}
