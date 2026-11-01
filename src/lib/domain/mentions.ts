/**
 * @mentions (pure). Names are unique (enforced on the Team page), so "@Name"
 * resolves unambiguously; longer names win ("@Nusrat Jahan" over "@Nusrat").
 */

export type Mentionable = { id: string; name: string };

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMentions(body: string, people: Mentionable[]): string[] {
  const found = new Set<string>();
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length);
  let text = body;
  for (const person of sorted) {
    const re = new RegExp(`(^|[^\\w@])@${escapeRegExp(person.name)}(?![\\w])`, "gi");
    if (re.test(text)) {
      found.add(person.id);
      text = text.replace(re, "$1");
    }
  }
  return [...found];
}

/** Splits text into plain and mention segments for rendering. */
export function splitMentions(body: string, people: Mentionable[]): { text: string; mentionId?: string }[] {
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length);
  if (sorted.length === 0) return [{ text: body }];
  const re = new RegExp(`(^|[^\\w@])@(${sorted.map((p) => escapeRegExp(p.name)).join("|")})(?![\\w])`, "gi");
  const out: { text: string; mentionId?: string }[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    const start = m.index! + m[1]!.length;
    if (start > last) out.push({ text: body.slice(last, start) });
    const person = sorted.find((p) => p.name.toLowerCase() === m[2]!.toLowerCase())!;
    out.push({ text: `@${person.name}`, mentionId: person.id });
    last = start + 1 + m[2]!.length;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out;
}
