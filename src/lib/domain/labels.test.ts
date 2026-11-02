import { describe, expect, it } from "vitest";
import { boardGroupOf, laneOf, submissionError } from "./labels";

describe("creative lanes", () => {
  it("splits image and video work", () => {
    expect(laneOf("WEBSITE_IMAGE")).toBe("images");
    expect(laneOf("STORE_LISTING")).toBe("images");
    expect(laneOf("VIDEO_SQUARE")).toBe("videos");
    expect(laneOf("CAMPAIGN_LAUNCH")).toBeNull();
  });
});

describe("submissionError", () => {
  it("every creative task needs at least one link", () => {
    expect(submissionError("AD_IMAGE_VERTICAL", { links: 0 })).not.toBeNull();
    expect(submissionError("AD_IMAGE_VERTICAL", { links: 3 })).toBeNull();
    expect(submissionError("VIDEO_MAIN", { links: 0 })).not.toBeNull();
    expect(submissionError("VIDEO_MAIN", { links: 1 })).toBeNull();
  });
  it("website images need their image links; the store listing exactly one URL", () => {
    expect(submissionError("WEBSITE_IMAGE", { links: 0 })).not.toBeNull();
    expect(submissionError("WEBSITE_IMAGE", { links: 3 })).toBeNull();
    expect(submissionError("STORE_LISTING", { links: 2 })).not.toBeNull();
  });
  it("non-creative tasks aren't submitted this way", () => {
    expect(submissionError("CAMPAIGN_LAUNCH", { links: 1 })).not.toBeNull();
  });
});

describe("board groups", () => {
  it("puts website images, Meta ads and videos in their own sections", () => {
    expect(boardGroupOf("WEBSITE_IMAGE")).toBe("website");
    expect(boardGroupOf("AD_IMAGE_VERTICAL")).toBe("metaAds");
    expect(boardGroupOf("AD_IMAGE_SQUARE")).toBe("metaAds");
    expect(boardGroupOf("VIDEO_SQUARE")).toBe("videos");
    expect(boardGroupOf("RESEARCH")).toBeNull();
  });
});
