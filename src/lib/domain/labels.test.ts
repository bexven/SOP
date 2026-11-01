import { describe, expect, it } from "vitest";
import { laneOf, submissionError } from "./labels";

describe("creative lanes", () => {
  it("splits image and video work", () => {
    expect(laneOf("WEBSITE_IMAGE")).toBe("images");
    expect(laneOf("STORE_LISTING")).toBe("images");
    expect(laneOf("VIDEO_SQUARE")).toBe("videos");
    expect(laneOf("CAMPAIGN_LAUNCH")).toBeNull();
  });
});

describe("submissionError", () => {
  it("image tasks need the lane's Drive folder (previews optional)", () => {
    expect(submissionError("AD_IMAGE_SQUARE", { images: 3, links: 0 })).not.toBeNull();
    expect(submissionError("AD_IMAGE_SQUARE", { images: 0, links: 1 })).toBeNull();
  });
  it("video tasks need a link", () => {
    expect(submissionError("VIDEO_MAIN", { images: 2, links: 0 })).not.toBeNull();
    expect(submissionError("VIDEO_MAIN", { images: 0, links: 1 })).toBeNull();
  });
  it("store listing needs the store URL", () => {
    expect(submissionError("STORE_LISTING", { images: 4, links: 0 })).not.toBeNull();
    expect(submissionError("STORE_LISTING", { images: 0, links: 1 })).toBeNull();
  });
});
