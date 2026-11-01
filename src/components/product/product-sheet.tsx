"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";
import { ExpandIcon, XIcon } from "lucide-react";

/** Large glass slide-over for a product, opened via `?product=<id>` so it is linkable and keeps list context. */
export function ProductSheet({ productId, title, children }: { productId: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduce = useReducedMotion();

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("product");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/15 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content asChild aria-describedby={undefined}>
          <motion.div
            initial={reduce ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
            className="glass-strong fixed inset-y-0 right-0 z-50 flex w-full flex-col outline-none sm:inset-y-3 sm:right-3 sm:w-[min(60rem,calc(100vw-1.5rem))] sm:rounded-[20px]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/60 px-4 py-2.5 sm:px-5">
              <DialogPrimitive.Title className="truncate text-meta text-slate-600">{title}</DialogPrimitive.Title>
              <div className="flex items-center gap-1">
                <Link
                  href={`/products/${productId}`}
                  className="inline-flex size-8 items-center justify-center rounded-control text-slate-600 hover:bg-slate-900/5"
                  aria-label="Open full page"
                  title="Open full page"
                >
                  <ExpandIcon className="size-4" />
                </Link>
                <DialogPrimitive.Close className="inline-flex size-8 items-center justify-center rounded-control text-slate-600 hover:bg-slate-900/5" aria-label="Close (Esc)">
                  <XIcon className="size-4" />
                </DialogPrimitive.Close>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
