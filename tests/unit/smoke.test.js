import { describe, expect, it } from "vitest";
import { bootstrapGallery } from "../../src/gallery.js";

describe("bootstrapGallery", () => {
  it("exports a callable initializer", () => {
    expect(typeof bootstrapGallery).toBe("function");
  });
});
