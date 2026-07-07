import { describe, it, expect } from "vitest";
import { APP_NAME, APP_TAGLINE } from "../config";

describe("config", () => {
  it("has the correct app name", () => {
    expect(APP_NAME).toBe("LabLab Onboarding");
  });

  it("has the correct tagline", () => {
    expect(APP_TAGLINE).toBe("Get ready to build");
  });
});