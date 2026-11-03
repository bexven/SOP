/**
 * The 10:00 morning summary (pure). Only people with something waiting get one.
 * Times are Asia/Dhaka (UTC+6, no daylight saving).
 */

export const DIGEST_HOUR_DHAKA = 10;
const DHAKA_OFFSET_MS = 6 * 3_600_000;

export type DigestCounts = {
  /** Open tasks assigned to them (to do), excluding product approvals. */
  todo: number;
  overdue: number;
  dueToday: number;
  /** Their tasks sent back for changes. */
  revision: number;
  /** Creative work waiting for their review (Seniors). */
  review: number;
  /** Products waiting for their approval (Product review). */
  approvals: number;
  /** Unread @mentions since yesterday's summary. */
  mentions: number;
};

export type Digest = { title: string; lines: string[]; total: number };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildDigest(name: string, c: DigestCounts): Digest | null {
  const lines: string[] = [];
  if (c.overdue) lines.push(`⏰ ${plural(c.overdue, "task")} overdue`);
  if (c.dueToday) lines.push(`📅 ${plural(c.dueToday, "task")} due today`);
  if (c.todo) lines.push(`📝 ${plural(c.todo, "task")} to do`);
  if (c.revision) lines.push(`🔁 ${plural(c.revision, "task")} sent back for changes`);
  if (c.review) lines.push(`👀 ${c.review} waiting for your review`);
  if (c.approvals) lines.push(`✅ ${plural(c.approvals, "product")} waiting for your approval`);
  if (c.mentions) lines.push(`💬 ${plural(c.mentions, "new mention")}`);
  const total = c.todo + c.revision + c.review + c.approvals + c.mentions;
  if (total === 0) return null;
  return { title: `Good morning, ${name.split(" ")[0]}`, lines, total };
}

/** Dhaka calendar date "YYYY-MM-DD" of an instant. */
export function dhakaDate(now: Date): string {
  return new Date(now.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The summary goes out once per Dhaka day, at or after 10:00. */
export function digestDue(now: Date, lastSentOn: string | null): boolean {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  if (local.getUTCHours() < DIGEST_HOUR_DHAKA) return false;
  return lastSentOn !== dhakaDate(now);
}
