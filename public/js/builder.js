import { getCollection, searchCollections, getStatus } from "./api.js";
import {
  buildCall, entryRange, formatRange, formatSol, marketplaceUrl, rsiText, safeHttpUrl, twitterSearchUrl,
} from "./lib/format.js";
import { renderTicker } from "./ticker.js";

const $ = (id) => document.getElementById(id);
const FOOTER_KEY = "ncb.footer";
const store = {
  get(key) { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};

const el = {
  name: $("name"), suggestions: $("suggestions"), selected: $("selected"), notice: $("notice"),
  fp: $("fp"), listed: $("listed"), epLow: $("ep-low"), epHigh: $("ep-high"), ep: $("ep"),
  rsiLow: $("rsi-low"), rsiHigh: $("rsi-high"), rsiLowOut: $("rsi-low-out"), rsiHighOut: $("rsi-high-out"),
  risks: $("risks"), description: $("description"), charts: $("charts"), link: $("link"),
  footer: $("footer"), preview: $("preview"), copy: $("copy"), copyStatus: $("copy-status"), listStatus: $("list-status"),
  descLink: $("desc-link"),
};

let symbol = "";
let chartsEdited = false;
let epEdited = false;

function chapter() {
  return document.querySelector('input[name="chapter"]:checked')?.value ?? "rocket";
}

function render() {
  el.preview.textContent = buildCall({
    chapter: chapter(), name: el.name.value, fp: el.fp.value, listed: el.listed.value,
    ep: el.ep.value, risks: el.risks.value, description: el.description.value, charts: el.charts.value,
    link: el.link.value, footer: el.footer.value,
  });
  el.descLink.href = twitterSearchUrl(el.name.value) || "#";
}

function showNotice(message, isError = false) {
  el.notice.hidden = !message;
  el.notice.textContent = message ?? "";
  el.notice.classList.toggle("error", isError);
}

function syncEp() {
  const lo = el.epLow.value.trim();
  const hi = el.epHigh.value.trim();
  el.ep.value = lo && hi ? `${lo} to ${hi}` : lo || hi;
}

function applyEntryRange() {
  const range = entryRange(el.fp.value);
  if (!range) return;
  el.epLow.value = formatSol(range.low);
  el.epHigh.value = formatSol(range.high);
  epEdited = false;
  syncEp();
}

// The sliders only write into "Charts" once the user moves one (the defaults are just a
// starting position, not a recommendation), and never over text the user typed.
function syncRsi(fillCharts = true) {
  el.rsiLowOut.textContent = el.rsiLow.value;
  el.rsiHighOut.textContent = el.rsiHigh.value;
  if (fillCharts && !chartsEdited) el.charts.value = rsiText(el.rsiLow.value, el.rsiHigh.value);
}

function renderSelected(data) {
  el.selected.textContent = "";
  if (!data) return;
  const image = safeHttpUrl(data.image);
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    el.selected.append(img);
  }
  const box = document.createElement("div");
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = data.name;
  const meta = document.createElement("div");
  meta.className = "meta";
  const parts = [];
  if (data.floorSol !== null) parts.push(`Floor ${formatSol(data.floorSol)} SOL`);
  if (data.listed !== null) parts.push(`${data.listed} listed`);
  if (data.avg24hSol !== null) parts.push(`24h avg ${formatSol(data.avg24hSol)} SOL`);
  if (data.volume7dSol !== null) parts.push(`7d volume ${formatSol(data.volume7dSol)} SOL`);
  meta.textContent = parts.join(" · ") || "No market stats";
  box.append(name, meta);
  el.selected.append(box);
}

async function selectCollection(sym) {
  showNotice("");
  hideSuggestions();
  try {
    const data = await getCollection(sym);
    symbol = data.symbol;
    el.name.value = data.name;
    el.fp.value = data.floorSol !== null ? formatSol(data.floorSol) : "";
    el.listed.value = data.listed !== null ? String(data.listed) : "";
    el.description.value = data.description ?? "";
    el.link.value = marketplaceUrl(data.symbol);
    renderSelected(data);
    if (data.floorSol === null) showNotice(data.warning ?? "This collection has no floor price right now (nothing is listed).");
    else if (data.warning) showNotice(data.warning);
    applyEntryRange();
    const url = new URL(location.href);
    url.searchParams.set("collection", data.symbol);
    history.replaceState(null, "", url);
  } catch (error) {
    renderSelected(null);
    showNotice(error.status === 404 ? "No collection with that name or symbol was found." : error.message, true);
  }
  render();
}

// ---- autocomplete -------------------------------------------------------------------------
let suggestionItems = [];
let activeIndex = -1;
let searchTimer;
let searchToken = 0;

function hideSuggestions() {
  el.suggestions.hidden = true;
  el.name.setAttribute("aria-expanded", "false");
  activeIndex = -1;
}

function setActive(index) {
  activeIndex = index;
  [...el.suggestions.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === index)));
  el.suggestions.children[index]?.scrollIntoView({ block: "nearest" });
}

function showSuggestions(results) {
  suggestionItems = results;
  el.suggestions.textContent = "";
  results.forEach((item) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");
    const image = safeHttpUrl(item.image);
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      li.append(img);
    }
    const label = document.createElement("span");
    label.textContent = item.name;
    const small = document.createElement("small");
    small.textContent = item.symbol;
    li.append(label, small);
    li.addEventListener("mousedown", (event) => { event.preventDefault(); selectCollection(item.symbol); });
    el.suggestions.append(li);
  });
  el.suggestions.hidden = results.length === 0;
  el.name.setAttribute("aria-expanded", String(results.length > 0));
  activeIndex = -1;
}

async function runSearch() {
  const query = el.name.value.trim();
  if (query.length < 2) return hideSuggestions();
  const token = ++searchToken;
  try {
    const { results, done } = await searchCollections(query);
    if (token !== searchToken) return; // a newer keystroke superseded this request
    showSuggestions(results);
    if (!results.length) showNotice(done ? "" : "The collection list is still loading. Try again in a moment, or type the exact symbol and press Enter.");
  } catch (error) {
    if (token === searchToken) showNotice(error.message, true);
  }
}

el.name.addEventListener("input", () => {
  symbol = "";
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 200);
  render();
});
el.name.addEventListener("keydown", (event) => {
  const open = !el.suggestions.hidden;
  if (event.key === "ArrowDown" && open) { event.preventDefault(); setActive(Math.min(activeIndex + 1, suggestionItems.length - 1)); }
  else if (event.key === "ArrowUp" && open) { event.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
  else if (event.key === "Escape") hideSuggestions();
  else if (event.key === "Enter") {
    event.preventDefault();
    if (open && activeIndex >= 0) selectCollection(suggestionItems[activeIndex].symbol);
    else if (el.name.value.trim()) selectCollection(el.name.value.trim());
  }
});
el.name.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

// ---- other controls -----------------------------------------------------------------------
el.fp.addEventListener("input", () => { if (!epEdited) applyEntryRange(); render(); });
[el.epLow, el.epHigh].forEach((input) => input.addEventListener("input", () => { epEdited = true; syncEp(); render(); }));
[el.rsiLow, el.rsiHigh].forEach((input) => input.addEventListener("input", () => { syncRsi(); render(); }));
el.charts.addEventListener("input", () => { chartsEdited = el.charts.value.trim() !== ""; render(); });
[el.listed, el.risks, el.description, el.link].forEach((input) => input.addEventListener("input", render));
document.querySelectorAll('input[name="chapter"]').forEach((input) => input.addEventListener("change", render));
el.footer.addEventListener("input", () => { store.set(FOOTER_KEY, el.footer.value); render(); });

el.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.preview.textContent);
    el.copyStatus.textContent = "Copied";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(el.preview);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    el.copyStatus.textContent = "Select and copy manually (clipboard blocked)";
  }
  setTimeout(() => { el.copyStatus.textContent = ""; }, 2500);
});

$("reset").addEventListener("click", () => {
  document.getElementById("builder").reset();
  el.footer.value = store.get(FOOTER_KEY);
  symbol = ""; chartsEdited = false; epEdited = false;
  renderSelected(null);
  showNotice("");
  syncRsi(false);
  render();
});

// ---- startup ------------------------------------------------------------------------------
async function pollListStatus() {
  try {
    const status = await getStatus();
    el.listStatus.textContent = status.done
      ? `${status.loaded.toLocaleString()} collections searchable`
      : status.error ? `Collection list incomplete: ${status.error}` : `Loading collection list… ${status.loaded.toLocaleString()}`;
    if (!status.done && !status.error) setTimeout(pollListStatus, 2000);
  } catch {
    el.listStatus.textContent = "";
  }
}

el.footer.value = store.get(FOOTER_KEY);
syncRsi(false);
render();
renderTicker($("ticker"));
pollListStatus();
const initial = new URLSearchParams(location.search).get("collection");
if (initial) selectCollection(initial);
