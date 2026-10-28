// Ofrenda — the shelf.
// Cards live in localStorage: the same place a browser keeps a bookmark, which
// is the right size of promise for a keepsake. No account, no sync, no server.

const KEY = 'ofrenda.shelf.v1';
const LIMIT = 12;

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function loadShelf() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id) : [];
  } catch (error) {
    return [];
  }
}

export function saveMemory(memory) {
  const entry = {
    id: memory.id || makeId(),
    created: memory.created || new Date().toISOString(),
    name: String(memory.name ?? '').trim(),
    years: String(memory.years ?? '').trim(),
    relationship: String(memory.relationship ?? '').trim(),
    place: String(memory.place ?? '').trim(),
    subtitle: String(memory.subtitle ?? '').trim(),
    title: String(memory.title ?? '').trim(),
    quote: String(memory.quote ?? '').trim(),
    remembrance: String(memory.remembrance ?? '').trim(),
  };

  const rest = loadShelf().filter((item) => item.id !== entry.id);
  const next = [entry, ...rest].slice(0, LIMIT);

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    // A full or blocked store is not worth losing the card over; the caller
    // still has the PNG.
  }
  return next;
}

export function removeMemory(id) {
  const next = loadShelf().filter((item) => item.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    // ignore
  }
  return next;
}

export function clearShelf() {
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    // ignore
  }
  return [];
}

export function shelfCount() {
  return loadShelf().length;
}

export { LIMIT as SHELF_LIMIT };
