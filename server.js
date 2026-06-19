// A small zero-dependency Node server: serves the static UI and a narrow, allow-listed proxy
// to public market-data APIs. The proxy exists because browsers cannot call the Magic Eden API
// directly (it sends no CORS headers), which is why the 2023 version needed a public CORS relay.
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SYMBOL = /^[A-Za-z0-9_-]{1,100}$/;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createApp(options = {}) {
  const {
    fetchImpl = fetch,
    meBase = "https://api-mainnet.magiceden.dev",
    jupiterUrl = `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`,
    coingeckoUrl = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
    fngUrl = "https://api.alternative.me/fng/?limit=1",
    publicDir = path.join(HERE, "public"),
    cacheFile = null,
    pageSize = 500,
    pageDelayMs = 400,
    rateLimitWaitMs = 15000,
    maxOffset = 200000,
    statsTtlMs = 30000,
    tickerTtlMs = 60000,
    newTtlMs = 120000,
    launchpadTtlMs = 300000,
    now = Date.now,
  } = options;

  // ---- upstream helper and TTL cache --------------------------------------------------
  async function upstream(url) {
    let response;
    try {
      response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    } catch (error) {
      throw new UpstreamError(`upstream unreachable: ${error.message}`, 502);
    }
    if (!response.ok) throw new UpstreamError(`upstream returned ${response.status}`, response.status);
    try {
      return await response.json();
    } catch {
      throw new UpstreamError("upstream returned invalid JSON", 502);
    }
  }

  const cache = new Map();
  const inflight = new Map();
  async function cached(key, ttlMs, producer) {
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.value;
    if (inflight.has(key)) return inflight.get(key);
    const promise = producer()
      .then((value) => {
        cache.set(key, { value, expires: now() + ttlMs });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  // ---- collection list: loaded once, in the background, politely -----------------------
  const collections = [];
  const state = { loaded: 0, loading: false, done: false, error: null };

  const slim = (c) => ({
    symbol: c.symbol,
    name: c.name ?? c.symbol,
    description: c.description ?? "",
    image: c.image ?? "",
    twitter: c.twitter ?? "",
    website: c.website ?? "",
  });

  async function loadCollections() {
    if (state.loading || state.done) return;
    state.loading = true;
    state.error = null;
    try {
      if (cacheFile) {
        try {
          const saved = JSON.parse(await fs.readFile(cacheFile, "utf8"));
          if (Array.isArray(saved.items) && saved.savedAt && now() - saved.savedAt < 24 * 3600 * 1000) {
            collections.push(...saved.items);
            state.loaded = collections.length;
            state.done = true;
            return;
          }
        } catch {
          /* no usable cache file: fall through to the network */
        }
      }
      let offset = 0;
      let retries = 0;
      while (offset <= maxOffset) {
        let page;
        try {
          page = await upstream(`${meBase}/v2/collections?offset=${offset}&limit=${pageSize}`);
        } catch (error) {
          if (error.status === 429 && retries < 5) {
            retries += 1;
            await sleep(rateLimitWaitMs);
            continue;
          }
          // A 4xx past the end of the list is normal; anything else is reported.
          if (!(error.status >= 400 && error.status < 500 && collections.length > 0)) state.error = error.message;
          break;
        }
        retries = 0;
        if (!Array.isArray(page) || page.length === 0) break;
        for (const item of page) if (item?.symbol) collections.push(slim(item));
        state.loaded = collections.length;
        if (page.length < pageSize) break;
        offset += pageSize;
        await sleep(pageDelayMs);
      }
      state.done = !state.error;
      if (state.done && cacheFile && collections.length) {
        await fs.mkdir(path.dirname(cacheFile), { recursive: true });
        await fs.writeFile(cacheFile, JSON.stringify({ savedAt: now(), items: collections }));
      }
    } finally {
      state.loading = false;
    }
  }

  function searchCollections(query, limit) {
    const q = String(query ?? "").trim().toLowerCase();
    if (q.length < 2) return [];
    const starts = [];
    const contains = [];
    for (const c of collections) {
      const name = c.name.toLowerCase();
      const symbol = c.symbol.toLowerCase();
      if (name.startsWith(q) || symbol.startsWith(q)) starts.push(c);
      else if (name.includes(q) || symbol.includes(q)) contains.push(c);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit).map(({ symbol, name, image }) => ({ symbol, name, image }));
  }

  // ---- route handlers -----------------------------------------------------------------
  const lamports = (value) => (Number.isFinite(value) ? value / 1e9 : null);

  // Metadata for a symbol: the full list first, then collections seen in the new/launchpad feeds
  // (brand-new collections are not in the list yet).
  function findMeta(symbol) {
    const wanted = symbol.toLowerCase();
    const inList = collections.find((c) => c.symbol.toLowerCase() === wanted);
    if (inList) return inList;
    for (const key of ["new", "launchpad"]) {
      const feed = cache.get(`feed:${key}`)?.value ?? [];
      const hit = feed.find((c) => c.symbol.toLowerCase() === wanted);
      if (hit) return { symbol: hit.symbol, name: hit.name, description: hit.description ?? "", image: hit.image ?? "", twitter: hit.twitter ?? "", website: hit.website ?? "" };
    }
    return null;
  }

  async function collectionDetail(symbol) {
    const meta = findMeta(symbol);
    // Use the canonical symbol from the list when we have it: the marketplace API treats an
    // unknown symbol (for example a different capitalisation) as an empty collection.
    const canonical = meta?.symbol ?? symbol;
    let stats = null;
    let warning = null;
    try {
      stats = await cached(`stats:${canonical}`, statsTtlMs, () => upstream(`${meBase}/v2/collections/${encodeURIComponent(canonical)}/stats`));
    } catch (error) {
      warning = `Market stats unavailable (${error.message}).`;
    }
    const hasFloor = Number.isFinite(stats?.floorPrice);
    if (!meta && !hasFloor) return null;
    return {
      symbol: meta?.symbol ?? symbol,
      name: meta?.name ?? symbol.replace(/[_-]+/g, " "),
      description: meta?.description ?? "",
      image: meta?.image ?? "",
      twitter: meta?.twitter ?? "",
      website: meta?.website ?? "",
      floorSol: lamports(stats?.floorPrice),
      listed: Number.isFinite(stats?.listedCount) ? stats.listedCount : null,
      avg24hSol: lamports(stats?.avgPrice24hr),
      volume7dSol: lamports(stats?.volume7d),
      warning,
    };
  }

  const text = (v) => (typeof v === "string" ? v : "");

  // Newly created collections: the Magic Eden feed the old "Hot" page used. Newest first.
  async function newCollections(limit) {
    const items = await cached("feed:new", newTtlMs, async () => {
      const body = await upstream(`${meBase}/new_collections?edge_cache=true`);
      const rows = Array.isArray(body?.collections) ? body.collections : [];
      return rows
        .filter((c) => c?.symbol && (c.blockchain === undefined || c.blockchain === "solana"))
        .map((c) => ({
          symbol: c.symbol,
          name: text(c.name) || c.symbol,
          description: text(c.description),
          image: text(c.image),
          totalItems: Number.isFinite(c.totalItems) ? c.totalItems : null,
          createdAt: text(c.createdAt) || null,
          twitter: text(c.twitter),
          website: text(c.website),
          verified: c.isVerified === true,
        }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    });
    return items.slice(0, limit);
  }

  // Launchpad drops (upcoming and past mints), newest launch first.
  async function launchpad(limit) {
    const items = await cached("feed:launchpad", launchpadTtlMs, async () => {
      const rows = await upstream(`${meBase}/v2/launchpad/collections?offset=0&limit=40`);
      if (!Array.isArray(rows)) throw new UpstreamError("unexpected launchpad response", 502);
      return rows
        .filter((c) => c?.symbol)
        .map((c) => ({
          symbol: c.symbol,
          name: text(c.name) || c.symbol,
          description: text(c.description),
          image: text(c.image),
          priceSol: Number.isFinite(c.price) ? c.price : null,
          size: Number.isFinite(c.size) ? c.size : null,
          launchAt: text(c.launchDatetime) || null,
          featured: c.featured === true,
        }))
        .sort((a, b) => String(b.launchAt).localeCompare(String(a.launchAt)));
    });
    return items.slice(0, limit);
  }

  async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  async function watchlist(symbols) {
    return mapLimit(symbols, 4, async (symbol) => {
      try {
        const d = await collectionDetail(symbol);
        if (!d) return { symbol, error: "not found" };
        const { name, image, floorSol, listed, avg24hSol, volume7dSol } = d;
        return { symbol: d.symbol, name, image, floorSol, listed, avg24hSol, volume7dSol };
      } catch {
        return { symbol, error: "unavailable" };
      }
    });
  }

  async function wallet(address, offset, limit) {
    const tokens = await upstream(`${meBase}/v2/wallets/${address}/tokens?offset=${offset}&limit=${limit}`);
    if (!Array.isArray(tokens)) throw new UpstreamError("unexpected wallet response", 502);
    return {
      address,
      offset,
      hasMore: tokens.length === limit,
      tokens: tokens.map((t) => ({
        mint: t.mintAddress,
        name: t.name ?? "",
        collection: t.collection ?? "",
        collectionName: t.collectionName ?? "",
        image: t.image ?? "",
      })),
    };
  }

  async function ticker() {
    const result = { sol: null, fearGreed: null };
    try {
      const body = await upstream(jupiterUrl);
      const entry = body?.[SOL_MINT];
      if (Number.isFinite(entry?.usdPrice)) result.sol = { usd: entry.usdPrice, change24h: entry.priceChange24h ?? null, source: "jupiter" };
    } catch {
      /* fall back below */
    }
    if (!result.sol) {
      try {
        const body = await upstream(coingeckoUrl);
        if (Number.isFinite(body?.solana?.usd)) result.sol = { usd: body.solana.usd, change24h: body.solana.usd_24h_change ?? null, source: "coingecko" };
      } catch {
        /* leave null */
      }
    }
    try {
      const body = await upstream(fngUrl);
      const entry = body?.data?.[0];
      if (entry && Number.isFinite(Number(entry.value))) result.fearGreed = { value: Number(entry.value), label: entry.value_classification ?? "" };
    } catch {
      /* leave null */
    }
    return result;
  }

  // ---- HTTP plumbing ------------------------------------------------------------------
  function send(res, status, body, headers = {}) {
    const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
    const payload = isJson ? JSON.stringify(body) : body;
    res.writeHead(status, {
      "content-type": isJson ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
      ...headers,
    });
    res.end(payload);
  }

  async function serveStatic(req, res, pathname) {
    const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const target = path.resolve(publicDir, relative);
    const inside = target === publicDir || target.startsWith(publicDir + path.sep);
    const hidden = relative.split("/").some((part) => part.startsWith("."));
    if (!inside || hidden) return send(res, 404, "Not found");
    let data;
    try {
      data = await fs.readFile(target);
    } catch {
      return send(res, 404, "Not found");
    }
    const type = MIME[path.extname(target)] ?? "application/octet-stream";
    const headers = { "content-type": type, "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-cache" };
    if (type.startsWith("text/html")) {
      headers["content-security-policy"] = "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'";
    }
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : data);
  }

  async function handle(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method not allowed" }, { allow: "GET, HEAD" });
    const url = new URL(req.url, "http://localhost");
    const { pathname } = url;
    if (!pathname.startsWith("/api/")) return serveStatic(req, res, pathname);

    try {
      if (pathname === "/api/status") return send(res, 200, { ...state });

      if (pathname === "/api/collections") {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 1), 25);
        return send(res, 200, { results: searchCollections(url.searchParams.get("q"), limit), loaded: state.loaded, done: state.done });
      }

      let match = pathname.match(/^\/api\/collection\/([^/]+)$/);
      if (match) {
        const symbol = decodeURIComponent(match[1]);
        if (!SYMBOL.test(symbol)) return send(res, 400, { error: "invalid collection symbol" });
        const detail = await collectionDetail(symbol);
        return detail ? send(res, 200, detail) : send(res, 404, { error: "Collection not found" });
      }

      match = pathname.match(/^\/api\/wallet\/([^/]+)$/);
      if (match) {
        const address = decodeURIComponent(match[1]);
        if (!BASE58.test(address)) return send(res, 400, { error: "invalid Solana address" });
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 40);
        const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
        return send(res, 200, await wallet(address, offset, limit));
      }

      if (pathname === "/api/new") {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "24", 10) || 24, 1), 50);
        return send(res, 200, { results: await newCollections(limit) });
      }

      if (pathname === "/api/launchpad") {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "24", 10) || 24, 1), 40);
        return send(res, 200, { results: await launchpad(limit) });
      }

      if (pathname === "/api/watchlist") {
        const raw = String(url.searchParams.get("symbols") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
        const seen = new Set();
        const symbols = raw.filter((v) => !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()));
        if (symbols.length === 0) return send(res, 200, { results: [] });
        if (symbols.length > 20) return send(res, 400, { error: "at most 20 collections per request" });
        const bad = symbols.filter((v) => !SYMBOL.test(v));
        if (bad.length) return send(res, 400, { error: "invalid collection symbol" });
        return send(res, 200, { results: await watchlist(symbols) });
      }

      if (pathname === "/api/ticker") return send(res, 200, await cached("ticker", tickerTtlMs, ticker));

      return send(res, 404, { error: "not found" });
    } catch (error) {
      const status = error instanceof UpstreamError ? 502 : 500;
      return send(res, status, { error: status === 502 ? "Market data provider unavailable. Try again shortly." : "internal error" });
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => send(res, 500, { error: "internal error" }));
  });

  return { server, loadCollections, state, collections, handle };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "127.0.0.1";
  const app = createApp({ cacheFile: path.join(HERE, ".cache", "collections.json") });
  app.server.listen(port, host, () => {
    console.log(`NFT Call Builder: http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
    app.loadCollections().then(() => {
      console.log(`Collection list: ${app.state.loaded} collections${app.state.error ? ` (stopped: ${app.state.error})` : ""}`);
    });
  });
}
