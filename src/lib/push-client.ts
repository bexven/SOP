/** Browser helpers for Web Push (client only). */

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Asks permission and subscribes this browser. Returns the subscription to save on the server. */
export async function subscribe(vapidPublicKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "denied" : "dismissed");
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  return (await currentSubscription(reg, vapidPublicKey)).toJSON();
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/**
 * This browser's subscription for the server's current key. A subscription made with an older key
 * (e.g. before the app moved servers) can never receive anything, so it is replaced.
 */
async function currentSubscription(reg: ServiceWorkerRegistration, vapidPublicKey: string): Promise<PushSubscription> {
  const key = keyToBytes(vapidPublicKey);
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameKey(existing.options.applicationServerKey, key)) return existing;
  if (existing) await existing.unsubscribe().catch(() => {});
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/**
 * Keeps an already-allowed browser in step with the server on every visit (renews a stale
 * subscription, re-registers the service worker). Never asks for permission. Returns the
 * subscription to save, or null when this browser hasn't turned notifications on.
 */
export async function syncSubscription(vapidPublicKey: string): Promise<PushSubscriptionJSON | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  const had = await registration();
  if (!had || !(await had.pushManager.getSubscription())) return null;
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  return (await currentSubscription(reg, vapidPublicKey)).toJSON();
}

export async function unsubscribe(): Promise<string | null> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

/** A readable name for this device, e.g. "Chrome on Android". */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : isIOS() ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}
