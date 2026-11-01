import { describe, expect, it } from "vitest";
import { extractMentions, splitMentions } from "./mentions";

const people = [
  { id: "1", name: "Nusrat" },
  { id: "2", name: "Nusrat Jahan" },
  { id: "3", name: "Rafiq" },
];

describe("extractMentions", () => {
  it("finds mentions case-insensitively", () => {
    expect(extractMentions("Hey @rafiq can you check?", people)).toEqual(["3"]);
  });
  it("prefers the longest name", () => {
    expect(extractMentions("@Nusrat Jahan please", people)).toEqual(["2"]);
    expect(extractMentions("@Nusrat Jahan and @Nusrat", people).sort()).toEqual(["1", "2"]);
  });
  it("ignores emails and partial words", () => {
    expect(extractMentions("mail rafiq@shop.com or @Rafiqul", people)).toEqual([]);
  });
});

describe("splitMentions", () => {
  it("splits into segments", () => {
    expect(splitMentions("Hi @rafiq, see this", people)).toEqual([
      { text: "Hi " },
      { text: "@Rafiq", mentionId: "3" },
      { text: ", see this" },
    ]);
  });
});
