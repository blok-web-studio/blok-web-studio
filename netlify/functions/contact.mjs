// ── BLOK. Contact Form Function ─────────────────────────────
// POST   /api/contact   { name, email, company, phone, budget, timeline, services[], message }
// Public endpoint — no auth required.
// Stores submissions in the same blob store as leads.

import {
  handleOptions,
  ok,
  fail,
  tryGetStore,
  safeBlobGet,
  safeBlobSet,
} from './_shared.mjs';

const STORE_NAME = 'blok-leads';
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_PER_IP = 3;               // max submissions per IP per window

// In-memory rate-limit store (per-execution — resets if cold starts, acceptable for low traffic)
const ipHits = new Map();

export const handler = async (event, context) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return fail('Method not allowed.', 405);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { name, email, company, phone, budget, timeline, services, message } = body;

    // ── Validation ──────────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return fail('Please provide your name (at least 2 characters).');
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return fail('Please provide a valid email address.');
    }
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return fail('Please tell us more about your project (at least 10 characters).');
    }
    if (message.length > 5000) {
      return fail('Message is too long. Please keep it under 5000 characters.');
    }
    if (name.length > 200 || email.length > 320) {
      return fail('Name or email too long.');
    }

    // Validate services array if provided
    const validServices = ['web-design', 'web-dev', 'ecommerce', 'branding', 'redesign', 'consulting', 'other'];
    const selectedServices = Array.isArray(services)
      ? services.filter(function (s) { return validServices.includes(s); })
      : [];

    // Validate budget
    const validBudgets = ['under-1k', '1k-3k', '3k-5k', '5k-10k', '10k-25k', '25k+', 'not-sure', 'not-selected'];
    const safeBudget = validBudgets.includes(budget) ? budget : 'not-selected';

    // Validate timeline
    const validTimelines = ['asap', '1-month', '2-3-months', '3plus', 'flexible', ''];
    const safeTimeline = validTimelines.includes(timeline) ? timeline : '';

    // ── Rate limiting ───────────────────────────────────────────
    const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const hits = ipHits.get(ip) || [];
    const recent = hits.filter(function (t) { return now - t < RATE_LIMIT_WINDOW; });
    if (recent.length >= MAX_PER_IP) {
      return fail('Too many submissions. Please try again later.', 429);
    }
    recent.push(now);
    ipHits.set(ip, recent);

    // ── Store ───────────────────────────────────────────────────
    const store = tryGetStore(STORE_NAME, { context });
    const leads = await safeBlobGet(store, 'leads');

    const lead = {
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      email: email.trim(),
      company: (company || '').trim(),
      phone: (phone || '').trim(),
      budget: safeBudget,
      timeline: safeTimeline,
      services: selectedServices,
      message: message.trim(),
      notes: '',
      status: 'new',
      createdAt: new Date().toISOString(),
      source: 'web',
      userAgent: (event.headers['user-agent'] || '').slice(0, 300),
      referrer: (event.headers['referer'] || event.headers['referrer'] || ''),
    };

    leads.unshift(lead);
    await safeBlobSet(store, 'leads', leads);

    return ok({
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        createdAt: lead.createdAt,
        message: 'Your brief has been received. We\'ll be in touch within 1–4 hours.',
      },
    }, 201);
  } catch (err) {
    console.error('Contact function error:', err);
    return fail('Something went wrong. Please try again.', 500);
  }
};
