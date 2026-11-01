import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("treats the custom type scale as font sizes, not colours", () => {
    expect(cn("text-primary-foreground", "text-meta")).toBe("text-primary-foreground text-meta");
    expect(cn("text-body", "text-meta")).toBe("text-meta");
    expect(cn("text-slate-900", "text-white")).toBe("text-white");
  });
});
