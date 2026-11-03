import "server-only";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { can, canSeeBrand, type Capability } from "@/lib/domain/permissions";
import { db } from "./db";
import { getCurrentUser, type CurrentUser } from "./auth/current-user";
import { flushAlerts, rememberAppUrl } from "./services/alerts";

/**
 * Every mutation goes through defineAction, which enforces the pipeline:
 *   authenticate → authorise by role → validate with zod → run (handler does
 *   its Prisma transaction, ActivityEvent, notifications, revalidate).
 * Never trust the client for identity, role or permissions.
 */

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export class ActionError extends Error {}

type Options<S extends z.ZodType, T> = {
  /** Capability required; omit for "any signed-in user". */
  capability?: Capability;
  /** Only the Master Admin (team management). */
  masterOnly?: boolean;
  /** Allow users who still have to change their PIN (only the change-PIN action). */
  allowPendingPinChange?: boolean;
  schema: S;
  run: (input: z.infer<S>, ctx: { user: CurrentUser }) => Promise<ActionResult<T>>;
};

export function defineAction<S extends z.ZodType, T = undefined>(options: Options<S, T>) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
    if (user.mustChangePin && !options.allowPendingPinChange) {
      return { ok: false, error: "Please set a new PIN first." };
    }
    if (options.masterOnly && !user.isMaster) {
      return { ok: false, error: "Only the Master Admin can manage the team." };
    }
    if (options.capability && !can(user, options.capability)) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      return {
        ok: false,
        error: flat.formErrors[0] ?? "Please check the highlighted fields.",
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
      };
    }
    try {
      if (!(await brandAllowed(user, parsed.data))) return { ok: false, error: "You don't have access to this brand." };
      const result = await options.run(parsed.data, { user });
      if (result.ok) {
        // After the response: send any new notifications to phones / Telegram.
        after(async () => {
          try {
            const h = await headers();
            await rememberAppUrl(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"));
            await flushAlerts();
          } catch (e) {
            console.error("[alerts] flush failed", e);
          }
        });
      }
      return result;
    } catch (error) {
      unstable_rethrow(error); // let redirect()/notFound() through
      if (error instanceof ActionError) return { ok: false, error: error.message };
      console.error("[action] unexpected error", error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };
}

/**
 * Restricted brands (e.g. Bexven): an action that names a product, task or brand
 * the person may not see is refused here, for every action at once.
 */
async function brandAllowed(user: CurrentUser, input: unknown): Promise<boolean> {
  if (user.isMaster || !input || typeof input !== "object") return true;
  const { productId, taskId, brandId } = input as { productId?: unknown; taskId?: unknown; brandId?: unknown };
  const brandSel = { select: { id: true, restricted: true } } as const;
  const brands: ({ id: string; restricted: boolean } | null)[] = [];
  if (typeof productId === "string") brands.push((await db.product.findUnique({ where: { id: productId }, select: { brand: brandSel } }))?.brand ?? null);
  if (typeof taskId === "string") brands.push((await db.task.findUnique({ where: { id: taskId }, select: { product: { select: { brand: brandSel } } } }))?.product.brand ?? null);
  if (typeof brandId === "string" && brandId) brands.push(await db.brand.findUnique({ where: { id: brandId }, select: { id: true, restricted: true } }));
  return brands.every((b) => canSeeBrand(user, b));
}
