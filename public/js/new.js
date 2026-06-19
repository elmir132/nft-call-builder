import { getNew, getLaunchpad } from "./api.js";
import { formatSol, safeHttpUrl } from "./lib/format.js";
import { formatLaunchDate, relativeTime, truncate } from "./lib/table.js";
import { renderTicker } from "./ticker.js";

const $ = (id) => document.getElementById(id);
let feed = "new";
let token = 0;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(item, kind) {
  const box = make("article", "feed-card");
  const image = safeHttpUrl(item.image);
  const img = make("img", "feed-img");
  img.alt = "";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  if (image) img.src = image;
  img.addEventListener("error", () => img.classList.add("broken"));
  const body = make("div", "feed-body");
  body.append(make("div", "feed-name", item.name));

  const facts = [];
  if (kind === "new") {
    const age = relativeTime(item.createdAt);
    if (age) facts.push(`Created ${age}`);
    if (item.totalItems) facts.push(`${item.totalItems.toLocaleString()} items`);
    if (item.verified) facts.push("Verified");
  } else {
    const date = formatLaunchDate(item.launchAt);
    if (date) facts.push(`Launch ${date}`);
    if (item.priceSol !== null) facts.push(`Mint ${formatSol(item.priceSol)} SOL`);
    if (item.size !== null) facts.push(`${item.size.toLocaleString()} items`);
    if (item.featured) facts.push("Featured");
  }
  body.append(make("div", "feed-meta", facts.join(" · ")));
  if (item.description) body.append(make("p", "feed-desc", truncate(item.description, 140)));

  const actions = make("div", "feed-actions");
  const build = make("a", "primary-link", "Build a call");
  build.href = `/?collection=${encodeURIComponent(item.symbol)}`;
  const market = make("a", "ghost-link", "Magic Eden ↗");
  market.href = `https://magiceden.io/marketplace/${encodeURIComponent(item.symbol)}`;
  market.target = "_blank";
  market.rel = "noopener noreferrer";
  actions.append(build, market);
  body.append(actions);
  box.append(img, body);
  return box;
}

async function load() {
  const mine = ++token;
  const cards = $("cards");
  cards.textContent = "";
  $("notice").hidden = true;
  $("footnote").textContent = "";
  cards.append(make("p", "empty", "Loading…"));
  try {
    const { results } = await (feed === "new" ? getNew() : getLaunchpad());
    if (mine !== token) return;
    cards.textContent = "";
    if (!results.length) cards.append(make("p", "empty", "Nothing to show right now."));
    results.forEach((item) => cards.append(card(item, feed)));
    $("footnote").textContent = feed === "new"
      ? "Unfiltered feed of user-created collections: many are spam, copies or scams, so check a project before you build a call. Brand-new collections often have no floor price yet."
      : "Launch dates and prices come from Magic Eden's launchpad listing.";
  } catch (error) {
    if (mine !== token) return;
    cards.textContent = "";
    $("notice").hidden = false;
    $("notice").textContent = error.message;
  }
}

document.querySelectorAll("[data-feed]").forEach((button) => {
  button.addEventListener("click", () => {
    feed = button.dataset.feed;
    document.querySelectorAll("[data-feed]").forEach((b) => b.setAttribute("aria-selected", String(b === button)));
    load();
  });
});

renderTicker($("ticker"));
load();
