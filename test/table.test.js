import assert from "node:assert/strict";
import test from "node:test";
import { addToList, formatLaunchDate, parseSymbolInput, relativeTime, removeFromList, sortRows, truncate } from "../public/js/lib/table.js";

test("parseSymbolInput takes symbols and Magic Eden URLs", () => {
  assert.equal(parseSymbolInput("DeGods"), "degods");
  assert.equal(parseSymbolInput("  okay_bears "), "okay_bears");
  assert.equal(parseSymbolInput("https://magiceden.io/marketplace/mad_lads?activeTab=stats"), "mad_lads");
  assert.equal(parseSymbolInput("https://www.magiceden.io/marketplace/degods#x"), "degods");
  assert.equal(parseSymbolInput("magiceden.io/marketplace/Claynosaurz"), "claynosaurz");
});

test("parseSymbolInput rejects anything unusable", () => {
  for (const bad of ["", "   ", null, undefined, "two words", "a/b", "<script>", "x".repeat(101)]) {
    assert.equal(parseSymbolInput(bad), null, String(bad));
  }
});

test("addToList ignores duplicates in any case and stops at the maximum", () => {
  let r = addToList([], "DeGods");
  assert.deepEqual([r.added, r.list], [true, ["degods"]]);
  r = addToList(r.list, "degods");
  assert.deepEqual([r.added, r.reason], [false, "duplicate"]);
  r = addToList(["a", "b"], "c", 2);
  assert.deepEqual([r.added, r.reason], [false, "full"]);
  assert.equal(addToList([], "").reason, "empty");
});

test("removeFromList is case-insensitive and does not mutate", () => {
  const list = ["degods", "mad_lads"];
  assert.deepEqual(removeFromList(list, "DEGODS"), ["mad_lads"]);
  assert.deepEqual(list, ["degods", "mad_lads"]);
});

test("sortRows orders numbers and strings in both directions", () => {
  const rows = [{ n: "b", v: 2 }, { n: "a", v: 10 }, { n: "c", v: 5 }];
  assert.deepEqual(sortRows(rows, "v", "desc").map((r) => r.n), ["a", "c", "b"]);
  assert.deepEqual(sortRows(rows, "v", "asc").map((r) => r.n), ["b", "c", "a"]);
  assert.deepEqual(sortRows(rows, "n", "asc").map((r) => r.n), ["a", "b", "c"]);
  assert.deepEqual(rows.map((r) => r.n), ["b", "a", "c"], "input is not mutated");
});

test("sortRows puts missing values last in either direction and keeps ties stable", () => {
  const rows = [{ n: "x", v: null }, { n: "a", v: 1 }, { n: "y" }, { n: "b", v: 1 }, { n: "z", v: NaN }];
  assert.deepEqual(sortRows(rows, "v", "desc").map((r) => r.n), ["a", "b", "x", "y", "z"]);
  assert.deepEqual(sortRows(rows, "v", "asc").map((r) => r.n), ["a", "b", "x", "y", "z"]);
});

test("relativeTime", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  assert.equal(relativeTime("2026-10-05T11:59:40Z", now), "just now");
  assert.equal(relativeTime("2026-10-05T11:55:00Z", now), "5 min ago");
  assert.equal(relativeTime("2026-10-05T09:00:00Z", now), "3 h ago");
  assert.equal(relativeTime("2026-10-03T12:00:00Z", now), "2 d ago");
  assert.equal(relativeTime("2026-10-06T12:00:00Z", now), "soon");
  assert.equal(relativeTime("nope", now), "");
  assert.equal(relativeTime(null, now), "");
});

test("formatLaunchDate is stable (UTC) and tolerant", () => {
  assert.equal(formatLaunchDate("2026-02-20T09:30:00.000Z"), "Feb 20, 2026");
  assert.equal(formatLaunchDate("2026-12-31T23:59:59Z"), "Dec 31, 2026");
  assert.equal(formatLaunchDate(""), "");
  assert.equal(formatLaunchDate("garbage"), "");
});

test("truncate cuts on a word boundary and collapses whitespace", () => {
  assert.equal(truncate("short text", 50), "short text");
  assert.equal(truncate("one two three four five six", 15), "one two three…");
  assert.equal(truncate("a\n\n  b   c"), "a b c");
  assert.equal(truncate("x".repeat(300), 10), "xxxxxxxxxx…");
  assert.equal(truncate(null), "");
});
