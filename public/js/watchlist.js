import { getWatchlist, getCollection } from "./api.js";
import { formatSol, safeHttpUrl } from "./lib/format.js";
import { addToList, parseSymbolInput, removeFromList, sortRows } from "./lib/table.js";
import { renderTicker } from "./ticker.js";

const $ = (id) => document.getElementById(id);
const KEY = "ncb.watchlist";
const MAX = 20;

const store = {
  read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, MAX) : [];
    } catch {
      return [];
    }
  },
  write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ } },
};

// ?symbols=a,b,c seeds an empty watchlist (a shareable starting point); a saved list wins.
function seededFromUrl() {
  const raw = new URLSearchParams(location.search).get("symbols") ?? "";
  return raw.split(",").map(parseSymbolInput).filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).slice(0, MAX);
}

let symbols = store.read();
if (symbols.length === 0) symbols = seededFromUrl();
let rows = [];
let sortKey = "volume7dSol";
let sortDir = "desc";
let loadToken = 0;

function notice(message) {
  $("notice").hidden = !message;
  $("notice").textContent = message ?? "";
}

function cell(text, className) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

const num = (v) => (v === null || v === undefined ? "–" : formatSol(v));

function render() {
  const body = $("rows");
  body.textContent = "";
  $("empty").hidden = symbols.length > 0;
  $("table").hidden = symbols.length === 0;
  document.querySelectorAll("[data-sort]").forEach((button) => {
    const active = button.dataset.sort === sortKey;
    button.closest("th").setAttribute("aria-sort", active ? (sortDir === "asc" ? "ascending" : "descending") : "none");
  });

  for (const row of sortRows(rows, sortKey, sortDir)) {
    const tr = document.createElement("tr");
    const first = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "name-cell";
    const image = safeHttpUrl(row.image);
    if (image) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.alt = "";
      img.src = image;
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => img.classList.add("broken"));
      wrap.append(img);
    }
    const link = document.createElement("a");
    link.textContent = row.name || row.symbol;
    link.href = `/?collection=${encodeURIComponent(row.symbol)}`;
    link.title = "Build a call";
    wrap.append(link);
    first.append(wrap);
    tr.append(first);

    if (row.error) {
      const td = cell(row.error === "not found" ? "Not found" : "Data unavailable", "num muted");
      td.colSpan = 4;
      tr.append(td);
    } else {
      tr.append(cell(num(row.floorSol), "num"), cell(row.listed ?? "–", "num"), cell(num(row.avg24hSol), "num"), cell(num(row.volume7dSol), "num"));
    }
    const last = document.createElement("td");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost small";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${row.name || row.symbol}`);
    remove.addEventListener("click", () => {
      symbols = removeFromList(symbols, row.symbol);
      rows = rows.filter((r) => r.symbol !== row.symbol);
      store.write(symbols);
      render();
    });
    last.append(remove);
    tr.append(last);
    body.append(tr);
  }
}

async function refresh() {
  const mine = ++loadToken;
  notice("");
  if (!symbols.length) {
    rows = [];
    $("updated").textContent = "";
    return render();
  }
  $("updated").textContent = "Loading…";
  try {
    const { results } = await getWatchlist(symbols);
    if (mine !== loadToken) return;
    rows = results;
    $("updated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    if (mine !== loadToken) return;
    notice(error.message);
    $("updated").textContent = "";
  }
  render();
}

$("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const symbol = parseSymbolInput($("symbol").value);
  if (!symbol) return notice("Enter a collection symbol or a Magic Eden marketplace link.");
  const next = addToList(symbols, symbol, MAX);
  if (!next.added) {
    return notice(next.reason === "duplicate" ? "That collection is already on your watchlist." : `The watchlist is full (${MAX} collections).`);
  }
  try {
    await getCollection(symbol); // make sure it exists before saving it
  } catch (error) {
    return notice(error.status === 404 ? `No collection with the symbol "${symbol}" was found.` : error.message);
  }
  symbols = next.list;
  store.write(symbols);
  $("symbol").value = "";
  refresh();
});

$("refresh").addEventListener("click", refresh);
document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    if (sortKey === key) sortDir = sortDir === "desc" ? "asc" : "desc";
    else { sortKey = key; sortDir = key === "name" ? "asc" : "desc"; }
    render();
  });
});

renderTicker($("ticker"));
render();
refresh();
