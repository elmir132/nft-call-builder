import { getTicker } from "./api.js";

function add(container, text, className) {
  const span = document.createElement("span");
  span.textContent = text;
  if (className) span.className = className;
  container.append(span);
}

export async function renderTicker(container) {
  try {
    const { sol, fearGreed } = await getTicker();
    container.textContent = "";
    if (sol) {
      const change = typeof sol.change24h === "number" ? ` (${sol.change24h >= 0 ? "+" : ""}${sol.change24h.toFixed(1)}%)` : "";
      add(container, `SOL $${sol.usd.toFixed(2)}${change}`, typeof sol.change24h === "number" ? (sol.change24h >= 0 ? "pos" : "neg") : "");
    }
    if (fearGreed) add(container, `Fear & Greed: ${fearGreed.value}${fearGreed.label ? ` · ${fearGreed.label}` : ""}`);
    if (!sol && !fearGreed) container.textContent = "Market ticker unavailable";
  } catch {
    container.textContent = "Market ticker unavailable";
  }
}
