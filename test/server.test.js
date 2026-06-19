import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../server.js";

const SOL = "So11111111111111111111111111111111111111112";
const WALLET = "Vote111111111111111111111111111111111111111"; // a well-known public address, used only as a valid example

function json(body, status = 200, headers = {}) {
  return { ok: status >= 200 && status < 300, status, headers, json: async () => body };
}

/** A fake upstream. `routes` maps a URL prefix to a handler returning a fake response. */
function fakeFetch(routes, log = []) {
  return async (url) => {
    log.push(String(url));
    for (const [prefix, handler] of routes) {
      if (String(url).startsWith(prefix)) return handler(String(url));
    }
    return json({ error: "no route" }, 404);
  };
}

async function run(options, fn) {
  const app = createApp({ pageDelayMs: 0, rateLimitWaitMs: 0, ...options });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    await fn({ app, get: (p, init) => fetch(base + p, init) });
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
  }
}

const me = "https://me.test";
const collectionRows = [
  { symbol: "degods", name: "DeGods", description: "d", image: "https://img/d.png", twitter: "t", website: "w", extra: "ignored" },
  { symbol: "okay_bears", name: "Okay Bears", description: "o", image: "https://img/o.png" },
  { symbol: "bear_market", name: "Bear Market", description: "", image: "" },
];

test("collection list loads page by page and stops at a short page", async () => {
  const log = [];
  const pages = { 0: collectionRows.slice(0, 2), 2: collectionRows.slice(2) };
  const fetchImpl = fakeFetch([[`${me}/v2/collections?`, (u) => json(pages[new URL(u).searchParams.get("offset")] ?? [])]], log);
  await run({ fetchImpl, meBase: me, pageSize: 2 }, async ({ app, get }) => {
    await app.loadCollections();
    assert.equal(app.state.loaded, 3);
    assert.equal(app.state.done, true);
    assert.equal(log.length, 2);
    const status = await (await get("/api/status")).json();
    assert.deepEqual([status.loaded, status.done, status.loading], [3, true, false]);
  });
});

test("search ranks prefix matches first, needs two characters, and limits results", async () => {
  const fetchImpl = fakeFetch([[`${me}/v2/collections?`, () => json(collectionRows)]]);
  await run({ fetchImpl, meBase: me, pageSize: 500 }, async ({ app, get }) => {
    await app.loadCollections();
    const result = await (await get("/api/collections?q=bear")).json();
    assert.deepEqual(result.results.map((r) => r.symbol), ["bear_market", "okay_bears"]);
    assert.deepEqual(Object.keys(result.results[0]).sort(), ["image", "name", "symbol"]);
    assert.deepEqual((await (await get("/api/collections?q=b")).json()).results, []);
    assert.equal((await (await get("/api/collections?q=bear&limit=1")).json()).results.length, 1);
    assert.equal((await (await get("/api/collections?q=DEGODS")).json()).results[0].symbol, "degods");
  });
});

test("rate limiting during the list load is retried", async () => {
  let calls = 0;
  const fetchImpl = fakeFetch([[`${me}/v2/collections?`, () => (++calls === 1 ? json({}, 429) : json(collectionRows))]]);
  await run({ fetchImpl, meBase: me }, async ({ app }) => {
    await app.loadCollections();
    assert.equal(app.state.loaded, 3);
    assert.equal(calls, 2);
  });
});

test("an upstream failure on the first page is reported, not hidden", async () => {
  const fetchImpl = fakeFetch([[`${me}/v2/collections?`, () => json({}, 500)]]);
  await run({ fetchImpl, meBase: me }, async ({ app }) => {
    await app.loadCollections();
    assert.equal(app.state.done, false);
    assert.match(app.state.error, /500/);
  });
});

test("collection detail merges list metadata with market stats, in SOL", async () => {
  const fetchImpl = fakeFetch([
    [`${me}/v2/collections?`, () => json(collectionRows)],
    [`${me}/v2/collections/degods/stats`, () => json({ symbol: "degods", floorPrice: 3711000000, listedCount: 461, avgPrice24hr: 5290822714.28, volume7d: 200608703478 })],
  ]);
  await run({ fetchImpl, meBase: me }, async ({ app, get }) => {
    await app.loadCollections();
    const body = await (await get("/api/collection/DeGods")).json();
    assert.equal(body.symbol, "degods");
    assert.equal(body.name, "DeGods");
    assert.equal(body.floorSol, 3.711);
    assert.equal(body.listed, 461);
    assert.equal(Math.round(body.avg24hSol * 100) / 100, 5.29);
    assert.equal(Math.round(body.volume7dSol), 201);
    assert.equal(body.warning, null);
    assert.equal("extra" in body, false);
  });
});

test("stats are cached for a short time", async () => {
  const log = [];
  const fetchImpl = fakeFetch([[`${me}/v2/collections/degods/stats`, () => json({ floorPrice: 1e9, listedCount: 1 })]], log);
  let clock = 1000;
  await run({ fetchImpl, meBase: me, now: () => clock, statsTtlMs: 30000 }, async ({ get }) => {
    await get("/api/collection/degods");
    await get("/api/collection/degods");
    assert.equal(log.length, 1);
    clock += 31000;
    await get("/api/collection/degods");
    assert.equal(log.length, 2);
  });
});

test("an unknown collection with no floor price is a 404", async () => {
  const fetchImpl = fakeFetch([[`${me}/v2/collections/ghost/stats`, () => json({ symbol: "ghost", listedCount: 0 })]]);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    const res = await get("/api/collection/ghost");
    assert.equal(res.status, 404);
    assert.match((await res.json()).error, /not found/i);
  });
});

test("known metadata still comes back, with a warning, when stats fail", async () => {
  const fetchImpl = fakeFetch([
    [`${me}/v2/collections?`, () => json(collectionRows)],
    [`${me}/v2/collections/degods/stats`, () => json({}, 503)],
  ]);
  await run({ fetchImpl, meBase: me }, async ({ app, get }) => {
    await app.loadCollections();
    const body = await (await get("/api/collection/degods")).json();
    assert.equal(body.name, "DeGods");
    assert.equal(body.floorSol, null);
    assert.match(body.warning, /unavailable/);
  });
});

test("bad collection symbols are rejected before any upstream call", async () => {
  const log = [];
  await run({ fetchImpl: fakeFetch([], log), meBase: me }, async ({ get }) => {
    for (const bad of ["a%20b", "a%2Fb", "x".repeat(101), "%3Cscript%3E"]) {
      assert.equal((await get(`/api/collection/${bad}`)).status, 400, bad);
    }
    assert.equal(log.length, 0);
  });
});

test("wallet endpoint validates the address and maps tokens", async () => {
  const log = [];
  const fetchImpl = fakeFetch([[`${me}/v2/wallets/${WALLET}/tokens`, () => json([
    { mintAddress: "m1", name: "Gatos #1", collection: "gatos", collectionName: "Gatos", image: "https://img/1.png", owner: "secret-field" },
    { mintAddress: "m2", name: "Gatos #2", collection: "gatos", collectionName: "Gatos", image: "" },
  ])]], log);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    assert.equal((await get("/api/wallet/not-an-address")).status, 400);
    assert.equal(log.length, 0);
    const body = await (await get(`/api/wallet/${WALLET}?limit=2`)).json();
    assert.equal(body.tokens.length, 2);
    assert.equal(body.hasMore, true);
    assert.deepEqual(Object.keys(body.tokens[0]).sort(), ["collection", "collectionName", "image", "mint", "name"]);
    assert.match(log[0], /limit=2/);
  });
});

test("wallet paging clamps limit and offset", async () => {
  const log = [];
  const fetchImpl = fakeFetch([[`${me}/v2/wallets/`, () => json([])]], log);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    const body = await (await get(`/api/wallet/${WALLET}?limit=9999&offset=-5`)).json();
    assert.equal(body.hasMore, false);
    assert.match(log[0], /offset=0&limit=40/);
  });
});

test("ticker uses Jupiter, falls back to CoinGecko, and tolerates a missing fear and greed index", async () => {
  const jup = "https://jup.test/price";
  const cg = "https://cg.test/price";
  const fng = "https://fng.test/fng";
  const opts = { jupiterUrl: jup, coingeckoUrl: cg, fngUrl: fng, tickerTtlMs: 0 };
  const ok = [[jup, () => json({ [SOL]: { usdPrice: 120.5, priceChange24h: -0.4 } })], [fng, () => json({ data: [{ value: "73", value_classification: "Greed" }] })]];
  await run({ ...opts, fetchImpl: fakeFetch(ok) }, async ({ get }) => {
    const body = await (await get("/api/ticker")).json();
    assert.deepEqual(body.sol, { usd: 120.5, change24h: -0.4, source: "jupiter" });
    assert.deepEqual(body.fearGreed, { value: 73, label: "Greed" });
  });
  const fallback = [[jup, () => json({}, 500)], [cg, () => json({ solana: { usd: 119, usd_24h_change: 1.2 } })], [fng, () => json({}, 500)]];
  await run({ ...opts, fetchImpl: fakeFetch(fallback) }, async ({ get }) => {
    const body = await (await get("/api/ticker")).json();
    assert.equal(body.sol.source, "coingecko");
    assert.equal(body.sol.usd, 119);
    assert.equal(body.fearGreed, null);
  });
  await run({ ...opts, fetchImpl: fakeFetch([]) }, async ({ get }) => {
    const res = await get("/api/ticker");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { sol: null, fearGreed: null });
  });
});

test("upstream outages become a clean 502 without leaking details", async () => {
  const fetchImpl = fakeFetch([[`${me}/v2/wallets/`, () => json({}, 500)]]);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    const res = await get(`/api/wallet/${WALLET}`);
    assert.equal(res.status, 502);
    assert.doesNotMatch(JSON.stringify(await res.json()), /500|me\.test/);
  });
});

test("a network failure upstream is also a 502", async () => {
  const fetchImpl = async () => { throw new Error("ECONNRESET"); };
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    assert.equal((await get(`/api/wallet/${WALLET}`)).status, 502);
  });
});

test("only GET and HEAD are allowed, and unknown API paths are 404", async () => {
  await run({ fetchImpl: fakeFetch([]), meBase: me }, async ({ get }) => {
    assert.equal((await get("/api/status", { method: "POST" })).status, 405);
    assert.equal((await get("/api/nope")).status, 404);
  });
});

test("static files are served with security headers and cannot escape the public folder", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ncb-"));
  await fs.writeFile(path.join(dir, "index.html"), "<h1>hi</h1>");
  await fs.writeFile(path.join(dir, ".secret"), "nope");
  await fs.writeFile(path.join(dir, "app.js"), "export {}");
  await fs.writeFile(path.join(path.dirname(dir), "outside.txt"), "outside");
  await run({ fetchImpl: fakeFetch([]), publicDir: dir }, async ({ get }) => {
    const home = await get("/");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);
    assert.match(home.headers.get("content-security-policy"), /default-src 'self'/);
    assert.equal(home.headers.get("x-content-type-options"), "nosniff");
    assert.match((await get("/app.js")).headers.get("content-type"), /javascript/);
    assert.equal((await get("/.secret")).status, 404);
    assert.equal((await get("/..%2Foutside.txt")).status, 404);
    assert.equal((await get("/%2e%2e/outside.txt")).status, 404);
    assert.equal((await get("/missing.html")).status, 404);
  });
});

test("the collection list is cached on disk and reused", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ncb-"));
  const cacheFile = path.join(dir, "collections.json");
  const log = [];
  const fetchImpl = fakeFetch([[`${me}/v2/collections?`, () => json(collectionRows)]], log);
  await run({ fetchImpl, meBase: me, cacheFile }, async ({ app }) => { await app.loadCollections(); });
  assert.equal(log.length, 1);
  await run({ fetchImpl, meBase: me, cacheFile }, async ({ app }) => {
    await app.loadCollections();
    assert.equal(app.state.loaded, 3);
  });
  assert.equal(log.length, 1, "second start must not hit the network");
});

test("a stale disk cache is ignored", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ncb-"));
  const cacheFile = path.join(dir, "collections.json");
  await fs.writeFile(cacheFile, JSON.stringify({ savedAt: 0, items: [{ symbol: "old", name: "Old" }] }));
  const log = [];
  const fetchImpl = fakeFetch([[`${me}/v2/collections?`, () => json(collectionRows)]], log);
  await run({ fetchImpl, meBase: me, cacheFile, now: () => 3 * 24 * 3600 * 1000 }, async ({ app }) => {
    await app.loadCollections();
    assert.equal(log.length, 1);
    assert.ok(app.collections.every((c) => c.symbol !== "old"));
  });
});

test("a collection missing from the list still works by symbol, with a readable name", async () => {
  const fetchImpl = fakeFetch([
    [`${me}/v2/collections?`, () => json(collectionRows)],
    [`${me}/v2/collections/okay_bears_2/stats`, () => json({ symbol: "okay_bears_2", floorPrice: 1419000000, listedCount: 629 })],
  ]);
  await run({ fetchImpl, meBase: me }, async ({ app, get }) => {
    await app.loadCollections();
    const body = await (await get("/api/collection/okay_bears_2")).json();
    assert.equal(body.name, "okay bears 2");
    assert.equal(body.image, "");
    assert.equal(body.floorSol, 1.419);
  });
});

// ---- new collections, launchpad, watchlist -------------------------------------------------
const newBody = {
  collections: [
    { symbol: "older", name: "Older", description: "o", image: "https://i/o.png", totalItems: 10, createdAt: "2026-10-05T10:00:00.000Z", blockchain: "solana", isVerified: true, junk: 1 },
    { symbol: "newest", name: "", description: null, image: "https://i/n.png", totalItems: 0, createdAt: "2026-10-05T12:00:00.000Z", blockchain: "solana" },
    { symbol: "eth_thing", name: "Eth", createdAt: "2026-10-05T13:00:00.000Z", blockchain: "ethereum" },
    { name: "no symbol" },
  ],
};

test("new collections: newest first, solana only, fields cleaned, cached", async () => {
  const log = [];
  const fetchImpl = fakeFetch([[`${me}/new_collections`, () => json(newBody)]], log);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    const body = await (await get("/api/new")).json();
    assert.deepEqual(body.results.map((r) => r.symbol), ["newest", "older"]);
    assert.equal(body.results[0].name, "newest", "empty name falls back to the symbol");
    assert.equal(body.results[0].description, "");
    assert.equal(body.results[1].verified, true);
    assert.equal("junk" in body.results[1], false);
    assert.equal((await (await get("/api/new?limit=1")).json()).results.length, 1);
    assert.equal(log.length, 1, "feed is cached");
  });
});

test("new collections: upstream failure is a 502", async () => {
  const fetchImpl = fakeFetch([[`${me}/new_collections`, () => json({}, 500)]]);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    assert.equal((await get("/api/new")).status, 502);
  });
});

test("launchpad: mapped and ordered by launch date, newest first", async () => {
  const rows = [
    { symbol: "a", name: "A", price: 1.5, size: 495, launchDatetime: "2026-02-20T09:30:00.000Z", featured: true, image: "https://i/a.png", description: "x" },
    { symbol: "b", name: "B", price: null, size: 10, launchDatetime: "2026-09-01T00:00:00.000Z" },
  ];
  const fetchImpl = fakeFetch([[`${me}/v2/launchpad/collections`, () => json(rows)]]);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    const body = await (await get("/api/launchpad")).json();
    assert.deepEqual(body.results.map((r) => r.symbol), ["b", "a"]);
    assert.equal(body.results[1].priceSol, 1.5);
    assert.equal(body.results[0].priceSol, null);
    assert.equal(body.results[1].featured, true);
  });
});

test("a collection that only appears in the new feed still opens in the builder", async () => {
  const fetchImpl = fakeFetch([
    [`${me}/new_collections`, () => json(newBody)],
    [`${me}/v2/collections/newest/stats`, () => json({ symbol: "newest", listedCount: 0 })],
  ]);
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    assert.equal((await get("/api/collection/newest")).status, 404, "unknown before the feed was seen");
    await get("/api/new");
    const res = await get("/api/collection/newest");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.image, "https://i/n.png");
    assert.equal(body.floorSol, null);
  });
});

test("watchlist: returns one row per symbol, dedupes, and marks problems per row", async () => {
  const fetchImpl = fakeFetch([
    [`${me}/v2/collections?`, () => json(collectionRows)],
    [`${me}/v2/collections/degods/stats`, () => json({ floorPrice: 2e9, listedCount: 5, avgPrice24hr: 3e9, volume7d: 4e9 })],
    [`${me}/v2/collections/okay_bears/stats`, () => json({}, 503)],
    [`${me}/v2/collections/ghost/stats`, () => json({ symbol: "ghost", listedCount: 0 })],
  ]);
  await run({ fetchImpl, meBase: me }, async ({ app, get }) => {
    await app.loadCollections();
    const body = await (await get("/api/watchlist?symbols=degods,ghost,DEGODS,okay_bears")).json();
    assert.deepEqual(body.results.map((r) => r.symbol), ["degods", "ghost", "okay_bears"]);
    assert.deepEqual([body.results[0].floorSol, body.results[0].listed, body.results[0].volume7dSol], [2, 5, 4]);
    assert.equal(body.results[1].error, "not found");
    assert.equal(body.results[2].floorSol, null, "stats failed but known metadata still returned");
    assert.equal(body.results[2].name, "Okay Bears");
  });
});

test("watchlist: validates input and limits the number of symbols", async () => {
  const log = [];
  await run({ fetchImpl: fakeFetch([], log), meBase: me }, async ({ get }) => {
    assert.deepEqual(await (await get("/api/watchlist")).json(), { results: [] });
    assert.equal((await get("/api/watchlist?symbols=ok,bad%20one")).status, 400);
    const many = Array.from({ length: 21 }, (_, i) => `c${i}`).join(",");
    assert.equal((await get(`/api/watchlist?symbols=${many}`)).status, 400);
    assert.equal(log.length, 0);
  });
});

test("watchlist: never runs more than four lookups at once", async () => {
  let active = 0;
  let peak = 0;
  const fetchImpl = async (url) => {
    if (String(url).includes("/stats")) {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 15));
      active -= 1;
      return json({ floorPrice: 1e9, listedCount: 1 });
    }
    return json([]);
  };
  const symbols = Array.from({ length: 12 }, (_, i) => `c${i}`).join(",");
  await run({ fetchImpl, meBase: me }, async ({ get }) => {
    const body = await (await get(`/api/watchlist?symbols=${symbols}`)).json();
    assert.equal(body.results.length, 12);
    assert.ok(peak <= 4 && peak > 1, `peak concurrency was ${peak}`);
  });
});
