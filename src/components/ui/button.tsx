import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control text-body font-medium transition-[background-color,box-shadow,color,transform,border-color] duration-150 ease-out outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(15_23_42/0.12),inset_0_1px_0_rgb(255_255_255/0.18)] hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_4px_12px_-2px_rgb(15_23_42/0.25),inset_0_1px_0_rgb(255_255_255/0.18)] active:translate-y-0",
        destructive: "bg-rose-600 text-white shadow-sm hover:-translate-y-px hover:bg-rose-700 hover:shadow-md active:translate-y-0",
        outline: "border border-slate-200 bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.04)] hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_2px_6px_-1px_rgb(15_23_42/0.1)]",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200/80",
        ghost: "text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900",
        link: "text-primary underline-offset-4 hover:underline",
        /** Soft tint of the primary (brand) colour, for secondary links. */
        brandSoft: "bg-accent text-accent-foreground ring-1 ring-primary/15 ring-inset hover:bg-primary/15",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-meta",
        lg: "h-11 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
