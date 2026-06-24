// Shared utilities for BLOK. Netlify Functions
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

// ── Auth ────────────────────────────────────────────────────────

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getSecret() {
  return process.env.TOKEN_SECRET || 'dev-secret-change-me';
}

export function getAdminCreds() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
  };
}

/**
 * Create a signed session token: base64(payload).hmac
 */
export function createToken(username) {
  const secret = getSecret();
  const payload = JSON.stringify({
    user: username,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  });
  const encoded = Buffer.from(payload).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('hex');
  return `${encoded}.${hmac}`;
}

/**
 * Verify a session token. Returns null if invalid/expired.
 */
export function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encoded, providedHmac] = parts;
    const secret = getSecret();

    // Verify HMAC
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));

    // Check expiry
    if (Date.now() > payload.exp) return null;

    return { user: payload.user, exp: payload.exp };
  } catch {
    return null;
  }
}

/**
 * Extract and verify token from Authorization header.
 * Returns the session on success, null on failure.
 */
export function authenticateRequest(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyToken(token);
}

/**
 * Wrap a handler with CORS headers.
 */
export function corsResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Handle CORS preflight.
 */
export function handleOptions(event) {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse({ ok: true });
  }
  return null;
}

// ── Response helpers ────────────────────────────────────────────

export function ok(data) {
  return corsResponse({ ok: true, ...data });
}

export function fail(message, statusCode = 400) {
  return corsResponse({ ok: false, error: message }, statusCode);
}

// ── Blob store helpers ──────────────────────────────────────────

/**
 * Try to get a Netlify Blob store. Returns null (rather than throwing)
 * if blobs aren't configured so callers can fall back gracefully.
 *
 * Tries in order:
 * 1. Automatic via Lambda context (works when deployed on Netlify)
 * 2. Manual via NETLIFY_BLOBS_SITE_ID / NETLIFY_BLOBS_TOKEN env vars
 */
export function tryGetStore(storeName, context) {
  // Attempt 1: automatic via context
  try {
    return getStore(storeName, { context });
  } catch (err1) {
    // Attempt 2: manual via env vars
    try {
      const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID;
      const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_ACCESS_TOKEN;
      if (siteID && token) {
        return getStore({ name: storeName, siteID, token });
      }
    } catch (err2) {
      console.warn(`[blob] ${storeName} manual fallback failed:`, err2.message);
    }
    console.warn(`[blob] ${storeName} not available:`, err1.message);
    return null;
  }
}

/**
 * Safe blob read — returns [] on any error.
 */
export async function safeBlobGet(store, key) {
  if (!store) return [];
  try {
    const raw = await store.get(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Safe blob write — returns false on any error.
 */
export async function safeBlobSet(store, key, data) {
  if (!store) return false;
  try {
    await store.setJSON(key, data);
    return true;
  } catch {
    return false;
  }
}
