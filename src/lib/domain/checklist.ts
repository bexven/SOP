/** SOP checklist rules (pure). */

export type TemplateItem = { label: string; required: boolean; order: number; active: boolean };
export type ChecklistSnapshotItem = { label: string; required: boolean; order: number };
export type ChecklistState = { required: boolean; checked: boolean };

/** Copy active template items into a task (label snapshot, renumbered 0..n). */
export function snapshotChecklist(template: TemplateItem[]): ChecklistSnapshotItem[] {
  return template
    .filter((t) => t.active)
    .sort((a, b) => a.order - b.order)
    .map((t, i) => ({ label: t.label, required: t.required, order: i }));
}

export function missingRequiredCount(items: ChecklistState[]): number {
  return items.filter((i) => i.required && !i.checked).length;
}

export function isChecklistComplete(items: ChecklistState[]): boolean {
  return missingRequiredCount(items) === 0;
}

/** New order values after moving one item (used by the template editor). */
export function reorder<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  const from = items.findIndex((i) => i.id === fromId);
  const to = items.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
