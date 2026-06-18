import { getWallet } from "./api.js";
import { isSolanaAddress, safeHttpUrl } from "./lib/format.js";
import { renderTicker } from "./ticker.js";

const $ = (id) => document.getElementById(id);
const KEY = "ncb.wallet";
const store = {
  get() { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } },
  set(value) { try { localStorage.setItem(KEY, value); } catch { /* storage unavailable */ } },
};

let address = "";
let offset = 0;
let total = 0;

function notice(message) {
  $("notice").hidden = !message;
  $("notice").textContent = message ?? "";
}

function card(token) {
  const box = document.createElement("div");
  box.className = "nft";
  const image = safeHttpUrl(token.image);
  const img = document.createElement("img");
  img.alt = token.name || "NFT";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  if (image) img.src = image;
  // Decentralised image hosts are often slow or gone; show a neutral tile instead of alt text.
  img.addEventListener("error", () => img.classList.add("broken"));
  const text = document.createElement("div");
  const name = document.createElement("div");
  name.className = "n";
  name.textContent = token.name || "Unnamed";
  name.title = token.name;
  const collection = document.createElement("div");
  collection.className = "c";
  collection.textContent = token.collectionName || token.collection || "";
  text.append(name, collection);
  box.append(img, text);
  return box;
}

async function load(reset) {
  notice("");
  if (reset) {
    $("grid").textContent = "";
    offset = 0;
    total = 0;
  }
  try {
    const data = await getWallet(address, offset);
    data.tokens.forEach((token) => $("grid").append(card(token)));
    total += data.tokens.length;
    offset += data.tokens.length;
    $("more").hidden = !data.hasMore;
    $("count").textContent = total ? `${total} shown` : "";
    if (!total) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No NFTs found for this address.";
      $("grid").append(empty);
    }
  } catch (error) {
    notice(error.message);
    $("more").hidden = true;
  }
}

$("wallet-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("address").value.trim();
  if (!isSolanaAddress(value)) return notice("That does not look like a Solana address.");
  address = value;
  store.set(value);
  load(true);
});
$("more").addEventListener("click", () => load(false));

renderTicker($("ticker"));
// ?address=... pre-fills and loads (shareable link); otherwise the last address used.
const fromUrl = new URLSearchParams(location.search).get("address") ?? "";
const start = isSolanaAddress(fromUrl) ? fromUrl.trim() : store.get();
if (start && isSolanaAddress(start)) {
  $("address").value = start;
  address = start;
  load(true);
}
