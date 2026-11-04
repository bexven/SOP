"use client";

import { useRef, useState, useTransition } from "react";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type MentionPerson = { id: string; name: string; avatarColor: string; avatarAssetId: string | null };

/** A comment box with @mention suggestions. `onSubmit` returns true when posted (the box then clears). */
export function MentionComposer({
  people,
  placeholder,
  onSubmit,
  label = "Comment",
}: {
  people: MentionPerson[];
  placeholder: string;
  onSubmit: (text: string) => Promise<boolean>;
  label?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState<{ start: number; q: string } | null>(null);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const matches = query ? people.filter((p) => p.name.toLowerCase().startsWith(query.q.toLowerCase())).slice(0, 6) : [];

  function detect(value: string, caret: number) {
    const m = /(^|\s)@([\p{L}\p{N} ]{0,24})$/u.exec(value.slice(0, caret));
    if (m && !m[2]!.includes("  ")) {
      setQuery({ start: caret - m[2]!.length - 1, q: m[2]! });
      setActive(0);
    } else setQuery(null);
  }

  function insert(p: MentionPerson) {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? text.length;
    setText(`${text.slice(0, query.start)}@${p.name} ${text.slice(caret)}`);
    const pos = query.start + p.name.length + 2;
    setQuery(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  function post() {
    if (!text.trim()) return;
    startTransition(async () => {
      if (await onSubmit(text)) setText("");
    });
  }

  return (
    <div className="surface relative rounded-panel p-2">
      <Textarea
        ref={ref}
        value={text}
        rows={2}
        placeholder={placeholder}
        aria-label={label}
        className="border-0 shadow-none focus-visible:ring-0"
        onChange={(e) => {
          setText(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (matches.length && query) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insert(matches[active]!);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setQuery(null);
              return;
            }
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
        }}
      />
      {matches.length && query ? (
        <ul role="listbox" aria-label="Mention someone" className="glass-strong absolute left-3 z-20 mt-1 w-56 rounded-control p-1">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(p);
                }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body", i === active ? "bg-slate-900/[0.06]" : "hover:bg-slate-900/[0.04]")}
              >
                <UserAvatar name={p.name} color={p.avatarColor} imageId={p.avatarAssetId} size="xs" /> {p.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="hidden text-meta font-normal text-slate-500 sm:inline">Use @ to mention · ⌘/Ctrl + Enter to post</span>
        <Button size="sm" className="ml-auto" disabled={pending || !text.trim()} onClick={post}>
          {label}
        </Button>
      </div>
    </div>
  );
}
