// ── BLOK. Portfolio Function ─────────────────────────────────
// GET    /api/portfolio                  → List all items (auth required)
// POST   /api/portfolio                  → Add item (auth required)
// PATCH  /api/portfolio                  → Update item (auth required)
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
  // Featured showcases
  { title: 'MORPH', tag: 'Showcase', desc: 'Browser-based 3D design tool concept. 22K scroll-driven particles, amber-on-dark.', url: 'https://blok-web-studio.github.io/demo-sites/morph/', featured: true },
  { title: 'Conserv 3D', tag: 'Showcase', desc: '3D botanical experience. Three.js particles, scroll-driven depth, glassmorphism.', url: 'https://blok-web-studio.github.io/conserv-3d/', featured: true },
  // Demos
  { title: 'Conserv', tag: 'Demo', desc: 'Greenhouse wellness tincture concept. Botanical glassmorphism.', url: 'https://blok-web-studio.github.io/demo-sites/conserv/index.html' },
  { title: 'Aurora Audio Systems', tag: 'Demo', desc: 'Premium audio hardware concept. CNC-machined precision.', url: 'https://blok-web-studio.github.io/demo-sites/audiosystem_aurora/index.html' },
  { title: "L'ambre", tag: 'Demo', desc: 'Mediterranean bistro concept. Wood-fired hearth.', url: 'https://blok-web-studio.github.io/demo-sites/cafe_lambre/index.html' },
  { title: 'Vanguard', tag: 'Demo', desc: 'Corporate law firm with cold precision.', url: 'https://blok-web-studio.github.io/demo-sites/lawfirm_vanguard/index.html' },
  // Clients — outbound concepts
  { title: 'Canvas Editor', tag: 'Client — Concept', desc: 'Rich text editor. The Loom — textile metaphor with spring physics.', url: 'https://blok-web-studio.github.io/canvas-editor-loom/' },
  { title: 'OmniRoute', tag: 'Client — Concept', desc: 'Developer tool. Network routing visualization with dark technical aesthetic.', url: 'https://blok-web-studio.github.io/omniroute/' },
  { title: 'OpenMontage', tag: 'Client — Concept', desc: 'Open-source video production. Film timeline concept with Factory dark palette.', url: 'https://blok-web-studio.github.io/openmontage/' },
  // Clients — Turkish businesses
  { title: 'Öyküm Pastanesi', tag: 'Client — Concept', desc: 'Artisan pastry shop. Warm cream and gold, scrollable timeline, poetic narrative.', url: 'https://blok-web-studio.github.io/oykum-pastanesi/' },
  { title: 'Dora Dondurma', tag: 'Client — Concept', desc: 'Dessert shop window. Neon pink/cyan, sundae glass metaphor, Fraunces serif.', url: 'https://blok-web-studio.github.io/dora-dondurma/' },
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

    // Seed defaults if empty (persist to blob if available)
    if (items.length === 0) {
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

  // ── PATCH: Update item ─────────────────────────────────────
  if (method === 'PATCH') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { id, title, tag, url, desc } = body;

      if (!id) {
        return fail('Item id is required.');
      }

      let items = await safeBlobGet(store, 'items');
      const idx = items.findIndex(item => item.id === id);
      if (idx === -1) {
        return fail('Item not found.', 404);
      }

      if (title !== undefined) items[idx].title = title.trim();
      if (tag !== undefined) items[idx].tag = tag;
      if (url !== undefined) items[idx].url = url;
      if (desc !== undefined) items[idx].desc = desc;
      items[idx].updatedAt = new Date().toISOString();

      await safeBlobSet(store, 'items', items);
      return ok({ item: items[idx] });
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
