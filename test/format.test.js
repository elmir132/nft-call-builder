import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCall, capitalize, chapterInfo, entryRange, formatRange, formatSol, isSolanaAddress,
  marketplaceUrl, rsiText, rsiVerdict, safeHttpUrl, twitterSearchUrl,
} from "../public/js/lib/format.js";

test("capitalize handles empty and non-string input", () => {
  assert.equal(capitalize("degods"), "Degods");
  assert.equal(capitalize(""), "");
  assert.equal(capitalize(undefined), "");
});

test("formatSol uses fewer decimals for bigger numbers and drops trailing zeros", () => {
  assert.equal(formatSol(3.711), "3.71");
  assert.equal(formatSol(0.05), "0.05");
  assert.equal(formatSol(0.0004), "0");
  assert.equal(formatSol(12.34), "12.3");
  assert.equal(formatSol(250.9), "251");
  assert.equal(formatSol(5), "5");
  assert.equal(formatSol(null), "");
  assert.equal(formatSol("abc"), "");
});

test("entryRange is a percentage band around the floor", () => {
  assert.deepEqual(entryRange(10), { low: 8, high: 12 });
  assert.deepEqual(entryRange(3.7), { low: 2.96, high: 4.44 });
  assert.deepEqual(entryRange(0.05), { low: 0.04, high: 0.06 });
  assert.deepEqual(entryRange(10, 0.5), { low: 5, high: 15 });
});

test("entryRange refuses a missing or non-positive floor", () => {
  for (const bad of [0, -1, NaN, null, undefined, "x"]) assert.equal(entryRange(bad), null);
  assert.equal(formatRange(null), "");
  assert.equal(formatRange({ low: 2.96, high: 4.44 }), "2.96 to 4.44");
});

test("rsiVerdict boundaries match the original wording", () => {
  assert.equal(rsiVerdict(0), "Perfect Entry !!!");
  assert.equal(rsiVerdict(24), "Perfect Entry !!!");
  assert.equal(rsiVerdict(25), "Good Entry !!!");
  assert.equal(rsiVerdict(49), "Good Entry !!!");
  assert.equal(rsiVerdict(50), "Medium Entry !!!");
  assert.equal(rsiVerdict(74), "Medium Entry !!!");
  assert.equal(rsiVerdict(75), "Bad Entry !!!");
  assert.equal(rsiVerdict(100), "Bad Entry !!!");
});

test("rsiText orders the bounds and uses the upper one for the verdict", () => {
  assert.equal(rsiText(40, 80), "RSI is above 40 and below 80. Bad Entry !!!");
  assert.equal(rsiText(80, 40), "RSI is above 40 and below 80. Bad Entry !!!");
  assert.equal(rsiText(10, 20), "RSI is above 10 and below 20. Perfect Entry !!!");
});

test("URL helpers encode their input", () => {
  assert.equal(marketplaceUrl("okay_bears"), "https://magiceden.io/marketplace/okay_bears");
  assert.equal(marketplaceUrl(""), "");
  assert.equal(twitterSearchUrl("Mad Lads"), "https://twitter.com/search?q=Mad%20Lads&src=typed_query&f=top");
  assert.equal(twitterSearchUrl("  "), "");
});

test("safeHttpUrl only lets http(s) through", () => {
  assert.equal(safeHttpUrl("https://example.com/a.png"), "https://example.com/a.png");
  assert.equal(safeHttpUrl("http://example.com"), "http://example.com/");
  for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "ftp://x", "not a url", "", null, undefined]) {
    assert.equal(safeHttpUrl(bad), "");
  }
});

test("chapterInfo falls back to rocket", () => {
  assert.equal(chapterInfo("reinvest").emoji, "♻️");
  assert.equal(chapterInfo("nope").emoji, "🚀");
});

test("buildCall produces the full post", () => {
  const text = buildCall({
    chapter: "rocket", name: "degods", fp: "3.71", listed: 461, ep: "2.96 to 4.44",
    risks: "Thin liquidity", description: "A collection.", charts: "RSI is above 40 and below 60. Medium Entry !!!",
    link: "https://magiceden.io/marketplace/degods",
  });
  assert.equal(text, [
    "__From the Rocket 🚀 chapter:__", "", "**🚀 Degods**", "",
    "**Fp: 3.71**", "**Listed: 461**", "**EP: 2.96 to 4.44**", "",
    "**📍Risks:** Thin liquidity", "", "**🗞Project Description:** A collection.", "",
    "**📈Charts:** RSI is above 40 and below 60. Medium Entry !!!", "",
    "_As always DYOR, touch the grass and feel progressed_ #calls", "",
    "**🔗Link:** https://magiceden.io/marketplace/degods",
  ].join("\n"));
});

test("buildCall leaves out empty sections and supports the re-invest chapter and a footer", () => {
  const text = buildCall({ chapter: "reinvest", name: " okay bears ", fp: "", risks: "   ", footer: "Join: example.org" });
  assert.equal(text, [
    "__From the Re-invest ♻️ chapter:__", "", "**♻️ Okay bears**", "",
    "_As always DYOR, touch the grass and feel progressed_ #calls", "", "Join: example.org",
  ].join("\n"));
  assert.ok(!text.includes("Fp:") && !text.includes("Risks"));
});

test("buildCall does not crash without arguments", () => {
  assert.match(buildCall(), /^__From the Rocket/);
});

test("isSolanaAddress accepts base58 of the right length only", () => {
  assert.ok(isSolanaAddress("Vote111111111111111111111111111111111111111"));
  assert.ok(isSolanaAddress("  So11111111111111111111111111111111111111112  "));
  for (const bad of ["", "abc", "0OIl" + "1".repeat(40), "x".repeat(50), null]) assert.equal(isSolanaAddress(bad), false);
});
