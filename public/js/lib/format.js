// Pure helpers used by the browser UI and covered by tests. No DOM access in this file.

export function capitalize(text) {
  const s = String(text ?? "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** SOL amount for display: fewer decimals as the number grows, no trailing zeros. */
export function formatSol(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  const n = Number(value);
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : n >= 1 ? 2 : 3;
  return String(Number(n.toFixed(digits)));
}

/**
 * Suggested entry range around the floor price: +/- `pct` of the floor (default 20%).
 * The 2023 version used a fixed +/- 2 SOL, which made no sense for cheap collections.
 */
export function entryRange(floor, pct = 0.2) {
  const fp = Number(floor);
  if (!Number.isFinite(fp) || fp <= 0) return null;
  const round = (x) => Number(x.toFixed(fp >= 10 ? 1 : fp >= 1 ? 2 : 3));
  return { low: round(fp * (1 - pct)), high: round(fp * (1 + pct)) };
}

export function formatRange(range) {
  return range ? `${formatSol(range.low)} to ${formatSol(range.high)}` : "";
}

/** The wording the original tool used for the upper RSI bound. */
export function rsiVerdict(upper) {
  const u = Number(upper);
  if (u < 25) return "Perfect Entry !!!";
  if (u < 50) return "Good Entry !!!";
  if (u < 75) return "Medium Entry !!!";
  return "Bad Entry !!!";
}

export function rsiText(low, high) {
  const lo = Math.min(Number(low), Number(high));
  const hi = Math.max(Number(low), Number(high));
  return `RSI is above ${lo} and below ${hi}. ${rsiVerdict(hi)}`;
}

export function marketplaceUrl(symbol) {
  return symbol ? `https://magiceden.io/marketplace/${encodeURIComponent(symbol)}` : "";
}

export function twitterSearchUrl(name) {
  const q = String(name ?? "").trim();
  return q ? `https://twitter.com/search?q=${encodeURIComponent(q)}&src=typed_query&f=top` : "";
}

/** Only http(s) URLs may be used as image or link targets; anything else becomes "". */
export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

const CHAPTERS = {
  rocket: { label: "Rocket 🚀", emoji: "🚀" },
  reinvest: { label: "Re-invest ♻️", emoji: "♻️" },
};

export function chapterInfo(chapter) {
  return CHAPTERS[chapter] ?? CHAPTERS.rocket;
}

/**
 * The text of the post, in the Markdown flavour used by the Telegram channel this tool was
 * made for. Sections with no content are left out.
 */
export function buildCall({ chapter = "rocket", name, fp, listed, ep, risks, description, charts, link, footer } = {}) {
  const { label, emoji } = chapterInfo(chapter);
  const has = (v) => String(v ?? "").trim() !== "";
  const lines = [`__From the ${label} chapter:__`, "", `**${emoji} ${capitalize(String(name ?? "").trim())}**`, ""];

  const stats = [];
  if (has(fp)) stats.push(`**Fp: ${String(fp).trim()}**`);
  if (has(listed)) stats.push(`**Listed: ${String(listed).trim()}**`);
  if (has(ep)) stats.push(`**EP: ${String(ep).trim()}**`);
  if (stats.length) lines.push(...stats, "");

  if (has(risks)) lines.push(`**📍Risks:** ${String(risks).trim()}`, "");
  if (has(description)) lines.push(`**🗞Project Description:** ${String(description).trim()}`, "");
  if (has(charts)) lines.push(`**📈Charts:** ${String(charts).trim()}`, "");

  lines.push("_As always DYOR, touch the grass and feel progressed_ #calls");
  if (has(link)) lines.push("", `**🔗Link:** ${String(link).trim()}`);
  if (has(footer)) lines.push("", String(footer).trim());
  return lines.join("\n");
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isSolanaAddress = (value) => BASE58.test(String(value ?? "").trim());
