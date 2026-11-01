import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("handles bold, italic, code and links", () => {
    expect(parseInline("A **big** *idea* `x` [Drive](https://drive.google.com/x)")).toEqual([
      { type: "text", text: "A " },
      { type: "strong", children: [{ type: "text", text: "big" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "idea" }] },
      { type: "text", text: " " },
      { type: "code", text: "x" },
      { type: "text", text: " " },
      { type: "link", href: "https://drive.google.com/x", children: [{ type: "text", text: "Drive" }] },
    ]);
  });
  it("autolinks bare URLs without trailing punctuation", () => {
    expect(parseInline("See https://loom.com/a.")).toEqual([
      { type: "text", text: "See " },
      { type: "link", href: "https://loom.com/a", children: [{ type: "text", text: "https://loom.com/a" }] },
      { type: "text", text: "." },
    ]);
  });
  it("drops unsafe link targets", () => {
    expect(parseInline("[click](javascript:alert(1))")).not.toContainEqual(expect.objectContaining({ type: "link" }));
  });
});

describe("parseMarkdown", () => {
  it("builds headings, paragraphs and lists", () => {
    const blocks = parseMarkdown("# Hook\nFirst line\nsecond line\n\n- one\n- two\n1. a\n\nEnd");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "paragraph"]);
    expect(blocks[1]).toMatchObject({ type: "paragraph", lines: [[{ text: "First line" }], [{ text: "second line" }]] });
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ text: "one" }], [{ text: "two" }]] });
    expect(blocks[3]).toMatchObject({ ordered: true });
  });
  it("treats raw HTML as text", () => {
    expect(parseMarkdown("<script>x</script>")).toEqual([
      { type: "paragraph", lines: [[{ type: "text", text: "<script>x</script>" }]] },
    ]);
  });
});
