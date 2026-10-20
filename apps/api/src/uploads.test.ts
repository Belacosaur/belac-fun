import { describe, expect, it } from "vitest";
import { uploadIntent } from "./uploads.js";

describe("upload intent", () => {
  it("stays unavailable without a bucket", () => {
    const result = uploadIntent({}, "thumb.png", () => "https://example/signed");
    expect(result.status).toBe(501);
  });

  it("returns a signed url when the bucket is configured", () => {
    const result = uploadIntent({ R2_BUCKET: "belac", R2_ACCOUNT_ID: "account" }, "thumb.png", (key: string) => `https://example/${key}`);
    expect(result).toEqual({ status: 200, url: "https://example/thumb.png", key: "thumb.png" });
  });
});
