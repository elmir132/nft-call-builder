// Pure helpers for the New and Watchlist pages. No DOM access.

const SYMBOL = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Accepts a collection symbol or a Magic Eden marketplace URL (the old tool asked for
 * "Degods URL") and returns the lower-case symbol, or null if it is not usable.
 */
export function parseSymbolInput(text) {
  let value = String(text ?? "").trim();
  if (!value) return null;
  const fromUrl = value.match(/magiceden\.io\/(?:[a-z]{2}\/)?marketplace\/([^/?#\s]+)/i);
  if (fromUrl) value = decodeURIComponent(fromUrl[1]);
  return SYMBOL.test(value) ? value.toLowerCase() : null;
}

/** Adds a symbol to a watchlist without duplicates, up to `max` entries. */
export function addToList(list, symbol, max = 20) {
  const wanted = String(symbol ?? "").toLowerCase();
  if (!wanted) return { list, added: false, reason: "empty" };
  if (list.some((s) => s.toLowerCase() === wanted)) return { list, added: false, reason: "duplicate" };
  if (list.length >= max) return { list, added: false, reason: "full" };
  return { list: [...list, wanted], added: true, reason: null };
}

export function removeFromList(list, symbol) {
  const wanted = String(symbol ?? "").toLowerCase();
  return list.filter((s) => s.toLowerCase() !== wanted);
}

/** Sorts rows by a key. Missing values (null, undefined, error rows) always go last. */
export function sortRows(rows, key, direction = "desc") {
  const sign = direction === "asc" ? 1 : -1;
  const missing = (v) => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = a.row[key];
      const y = b.row[key];
      if (missing(x) && missing(y)) return a.index - b.index;
      if (missing(x)) return 1;
      if (missing(y)) return -1;
      const cmp = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y)) : x - y;
      return cmp === 0 ? a.index - b.index : cmp * sign;
    })
    .map(({ row }) => row);
}

/** "just now", "5 min ago", "3 h ago", "2 d ago"; empty string for a missing or invalid date. */
export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const seconds = Math.round((now - t) / 1000);
  if (seconds < 0) return "soon";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** A launch date as "Feb 20, 2026", or "" if missing. Uses UTC so the text is stable. */
export function formatLaunchDate(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Cuts text to `max` characters on a word boundary, adding an ellipsis. */
export function truncate(text, max = 140) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
