// ── BLOK. Portfolio Function ─────────────────────────────────
// GET    /api/portfolio                  → List all items (auth required)
// POST   /api/portfolio                  → Add item (auth required)
// DELETE /api/portfolio?id=<id>          → Remove item (auth required)
//
// Data stored in Netlify Blob store: "blok-portfolio"

import {
  authenticateRequest,
  handleOptions,
  ok,
  fail,
  tryGetStore,
  safeBlobGet,
  safeBlobSet,
} from './_shared.mjs';

const STORE_NAME = 'blok-portfolio';

const DEFAULT_PORTFOLIO = [
  { title: 'Aurora Audio Systems', tag: 'Demo', desc: 'Premium audio hardware concept. CNC-machined precision.', url: 'https://blok-web-studio.github.io/demo-sites/audiosystem_aurora/index.html' },
  { title: 'Iron & Shears', tag: 'Demo', desc: 'Traditional barbershop with a modern edge.', url: 'https://blok-web-studio.github.io/demo-sites/barbershop_ironnshears/index.html' },
  { title: "L'ambre", tag: 'Demo', desc: 'Mediterranean bistro concept. Wood-fired hearth.', url: 'https://blok-web-studio.github.io/demo-sites/cafe_lambre/index.html' },
  { title: 'Vanguard', tag: 'Demo', desc: 'Corporate law firm with cold precision.', url: 'https://blok-web-studio.github.io/demo-sites/lawfirm_vanguard/index.html' },
];

function withIds(items) {
  return items.map((item, i) => ({
    ...item,
    id: item.id || 'port_' + Date.now() + '_' + i,
    createdAt: item.createdAt || new Date().toISOString(),
  }));
}

export const handler = async (event, context) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  const session = authenticateRequest(event);
  if (!session) {
    return fail('Unauthorized.', 401);
  }

  const store = tryGetStore(STORE_NAME, { context });
  const method = event.httpMethod;

  // ── GET: List all items ────────────────────────────────────
  if (method === 'GET') {
    let items = await safeBlobGet(store, 'items');

    // Seed defaults if empty (only when blob storage works)
    if (items.length === 0 && store) {
      items = withIds(DEFAULT_PORTFOLIO);
      await safeBlobSet(store, 'items', items);
    }

    return ok({ portfolio: items });
  }

  // ── POST: Add new item ─────────────────────────────────────
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { title, tag, url, desc } = body;

      if (!title) {
        return fail('Title is required.');
      }

      const items = await safeBlobGet(store, 'items');
      const item = {
        id: 'port_' + Date.now(),
        title: title.trim(),
        tag: tag || 'Custom',
        url: url || '',
        desc: desc || '',
        createdAt: new Date().toISOString(),
      };

      items.push(item);
      await safeBlobSet(store, 'items', items);

      return ok({ item }, 201);
    } catch (err) {
      return fail('Invalid request body.', 400);
    }
  }

  // ── DELETE: Remove item ────────────────────────────────────
  if (method === 'DELETE') {
    const id = event.queryStringParameters?.id;
    if (!id) {
      return fail('id query parameter is required.');
    }

    let items = await safeBlobGet(store, 'items');
    const before = items.length;
    items = items.filter((item) => item.id !== id);

    if (items.length === before) {
      return fail('Item not found.', 404);
    }

    await safeBlobSet(store, 'items', items);
    return ok({ deleted: true });
  }

  return fail('Method not allowed.', 405);
};
