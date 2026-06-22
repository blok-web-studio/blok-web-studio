// Shared utilities for BLOK. Netlify Functions
import crypto from 'node:crypto';

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
