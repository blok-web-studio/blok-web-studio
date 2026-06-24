// ── BLOK. Leads Function ─────────────────────────────────────
// GET    /api/leads                     → List all leads (auth required)
// POST   /api/leads                     → Create a lead (auth required)
// PATCH  /api/leads                     → Update lead status (auth required)
// DELETE /api/leads?id=<id>             → Delete a lead (auth required)
//
// Data stored in Netlify Blob store: "blok-leads"

import {
  authenticateRequest,
  handleOptions,
  ok,
  fail,
  tryGetStore,
  safeBlobGet,
  safeBlobSet,
} from './_shared.mjs';

const STORE_NAME = 'blok-leads';

export const handler = async (event, context) => {
  // CORS preflight
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  // All mutations require auth
  const session = authenticateRequest(event);
  if (!session) {
    return fail('Unauthorized.', 401);
  }

  const store = tryGetStore(STORE_NAME, { context });
  const method = event.httpMethod;

  // ── GET: List all leads ────────────────────────────────────
  if (method === 'GET') {
    const leads = await safeBlobGet(store, 'leads');
    return ok({ leads });
  }

  // ── POST: Create a new lead ────────────────────────────────
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { name, email, budget, message } = body;

      if (!name || !email || !message) {
        return fail('Name, email, and message are required.');
      }

      const leads = await safeBlobGet(store, 'leads');
      const lead = {
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name,
        email,
        budget: budget || 'not-sure',
        message,
        status: 'new',
        createdAt: new Date().toISOString(),
      };

      leads.unshift(lead);
      await safeBlobSet(store, 'leads', leads);

      return ok({ lead }, 201);
    } catch (err) {
      return fail('Invalid request body.', 400);
    }
  }

  // ── PATCH: Update lead status or notes ─────────────────────
  if (method === 'PATCH') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { id, status, notes } = body;

      if (!id) {
        return fail('id is required.');
      }

      if (status && !['new', 'read', 'contacted', 'qualified', 'won', 'lost', 'archived'].includes(status)) {
        return fail('Invalid status. Must be: new, read, contacted, qualified, won, lost, or archived.');
      }

      const leads = await safeBlobGet(store, 'leads');
      const lead = leads.find((l) => l.id === id);
      if (!lead) {
        return fail('Lead not found.', 404);
      }

      if (status) {
        lead.status = status;
        lead.statusUpdatedAt = new Date().toISOString();
      }
      if (notes !== undefined) {
        lead.notes = notes;
        lead.notesUpdatedAt = new Date().toISOString();
      }

      await safeBlobSet(store, 'leads', leads);

      return ok({ lead });
    } catch (err) {
      return fail('Invalid request body.', 400);
    }
  }

  // ── DELETE: Remove a lead ──────────────────────────────────
  if (method === 'DELETE') {
    const id = event.queryStringParameters?.id;
    if (!id) {
      return fail('id query parameter is required.');
    }

    const leads = await safeBlobGet(store, 'leads');
    const idx = leads.findIndex((l) => l.id === id);
    if (idx === -1) {
      return fail('Lead not found.', 404);
    }

    leads.splice(idx, 1);
    await safeBlobSet(store, 'leads', leads);

    return ok({ deleted: true });
  }

  return fail('Method not allowed.', 405);
};
