// ── BLOK. Contact Form Function ─────────────────────────────
// POST   /api/contact   { name, email, budget, message }
// Public endpoint — no auth required.
// Stores submissions in the same blob store as leads.

import { getStore } from '@netlify/blobs';
import { handleOptions, ok, fail } from './_shared.mjs';

const STORE_NAME = 'blok-leads';

async function getLeadsBlob(store) {
  try {
    const blob = await store.get('leads');
    return blob ? JSON.parse(blob) : [];
  } catch {
    return [];
  }
}

export const handler = async (event, context) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return fail('Method not allowed.', 405);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { name, email, budget, message } = body;

    if (!name || !email || !message) {
      return fail('Name, email, and message are required.');
    }

    const store = getStore(STORE_NAME, { context });
    const leads = await getLeadsBlob(store);

    const lead = {
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      email: email.trim(),
      budget: budget || 'not-sure',
      message: message.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    leads.unshift(lead);
    await store.setJSON('leads', leads);

    return ok({ lead, message: 'Your brief has been received. We\'ll be in touch within 24 hours.' }, 201);
  } catch (err) {
    return fail('Invalid request body.', 400);
  }
};
