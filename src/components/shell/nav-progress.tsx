"use client";

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Instant feedback while the next page loads: a thin bar at the top starts the moment a link is clicked
 * (or a router.push from `useNavRouter()`) and finishes once the new page has replaced its loading placeholder.
 * The menu reads `usePendingPath()` to highlight the clicked item straight away.
 */

type State = { pending: string | null; phase: "idle" | "loading" | "done" };
let state: State = { pending: null, phase: "idle" };
const subscribers = new Set<() => void>();
let safety: ReturnType<typeof setTimeout> | null = null;
let fade: ReturnType<typeof setTimeout> | null = null;

function set(next: State) {
  state = next;
  subscribers.forEach((f) => f());
}

function begin(path: string) {
  if (fade) clearTimeout(fade);
  if (safety) clearTimeout(safety);
  // Never leave it hanging (e.g. a link that ends up not changing the page).
  safety = setTimeout(finish, 12000);
  set({ pending: path, phase: "loading" });
}

function finish() {
  if (safety) clearTimeout(safety);
  if (state.phase !== "loading") return;
  set({ pending: null, phase: "done" });
  fade = setTimeout(() => set({ pending: null, phase: "idle" }), 320);
}

function subscribe(f: () => void) {
  subscribers.add(f);
  return () => {
    subscribers.delete(f);
  };
}

/** Call before `router.push(href)` / `router.replace(href)` so the bar starts on that action too. */
export function startNavigation(href: string) {
  if (typeof window === "undefined") return;
  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin) return;
  if (target.pathname + target.search === window.location.pathname + window.location.search) return;
  begin(target.pathname);
}

/** The path being navigated to (null when nothing is loading). */
export function usePendingPath() {
  return useSyncExternalStore(
    subscribe,
    () => state.pending,
    () => null,
  );
}

function linkTarget(e: MouseEvent): string | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement)) return null;
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download") || a.getAttribute("href")?.startsWith("#")) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return null;
  // Same page (or only the #hash changes): nothing to wait for.
  if (url.pathname + url.search === window.location.pathname + window.location.search) return null;
  return url.pathname;
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const phase = useSyncExternalStore(
    subscribe,
    () => state.phase,
    () => "idle" as const,
  );

  // Any same-site link click starts the bar.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = linkTarget(e);
      if (path) begin(path);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The URL changed. The new page is in place once its loading placeholder (if any) is gone.
  useEffect(() => {
    if (!document.querySelector("[data-skeleton]")) return finish();
    const main = document.getElementById("main") ?? document.body;
    const obs = new MutationObserver(() => {
      if (!document.querySelector("[data-skeleton]")) {
        obs.disconnect();
        finish();
      }
    });
    obs.observe(main, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [pathname, search]);

  if (phase === "idle") return null;
  return <div aria-hidden className="nav-progress" data-phase={phase} />;
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

/** `useRouter()` whose push / replace also start the loading bar. */
export function useNavRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        startNavigation(href);
        router.push(href, options);
      },
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
        startNavigation(href);
        router.replace(href, options);
      },
    }),
    [router],
  );
}
