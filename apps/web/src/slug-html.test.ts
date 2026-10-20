import { describe, expect, it } from "vitest";
import { crawlerHtml } from "./slug-html";

describe("crawler html", () => {
  it("does not put a dollar figure on illustrative pages", () => {
    const html = crawlerHtml({
      title: "Jupiter — Belac.fun",
      description: "Equity 10.20",
      canonical: "https://belac.fun/challenge/hold",
      asOf: "2026-10-20T00:00:00.000Z",
      illustrative: true,
    });
    expect(html).toContain("<title>Jupiter — Belac.fun</title>");
    expect(html).toContain("Sample data. Not a real result.");
    expect(html).not.toContain("10.20");
  });

  it("escapes title text", () => {
    const html = crawlerHtml({
      title: "A & B",
      description: "Plain",
      canonical: "https://belac.fun/episodes/a",
      illustrative: false,
    });
    expect(html).toContain("A &amp; B");
  });
});
