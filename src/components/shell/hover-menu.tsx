"use client";

import { useEffect, useRef, useState } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

/**
 * A dropdown that opens on mouse hover (desktop) and still opens on click / tap / keyboard.
 * Leaving the trigger and the menu closes it after a short delay, so moving between them is easy.
 * Put `{...hover}` on both the trigger and the content.
 */
export function useHoverMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const hover = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      clear();
      setOpen(true);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      clear();
      timer.current = setTimeout(() => setOpen(false), 140);
    },
  };
  return { open, setOpen, hover };
}

export function HoverDropdown({ open, setOpen, children }: { open: boolean; setOpen: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      {children}
    </DropdownMenu>
  );
}
