// Thin wrappers over this app's own /api routes. Errors carry the server's message.
async function getJson(path) {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON error page */
  }
  if (!response.ok) {
    const error = new Error(body?.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export const searchCollections = (query) => getJson(`/api/collections?q=${encodeURIComponent(query)}&limit=10`);
export const getCollection = (symbol) => getJson(`/api/collection/${encodeURIComponent(symbol)}`);
export const getWallet = (address, offset = 0) => getJson(`/api/wallet/${encodeURIComponent(address)}?offset=${offset}&limit=20`);
export const getTicker = () => getJson("/api/ticker");
export const getStatus = () => getJson("/api/status");
