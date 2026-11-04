import { describe, expect, it } from "vitest";
import { nextCampaignNumber, overallCampaignStatus } from "./campaigns";

describe("overallCampaignStatus", () => {
  it("is running while any campaign runs", () => {
    expect(overallCampaignStatus(["STOPPED", "RUNNING", "PAUSED"])).toBe("RUNNING");
  });
  it("is paused when nothing runs but one is paused", () => {
    expect(overallCampaignStatus(["STOPPED", "PAUSED"])).toBe("PAUSED");
  });
  it("is stopped when every launched campaign has stopped", () => {
    expect(overallCampaignStatus(["STOPPED", "NOT_LAUNCHED"])).toBe("STOPPED");
  });
  it("is not launched / null before any launch", () => {
    expect(overallCampaignStatus(["NOT_LAUNCHED"])).toBe("NOT_LAUNCHED");
    expect(overallCampaignStatus([])).toBeNull();
  });
});

describe("nextCampaignNumber", () => {
  it("counts up from the highest number", () => {
    expect(nextCampaignNumber([])).toBe(1);
    expect(nextCampaignNumber([1, 3, 2])).toBe(4);
  });
});
