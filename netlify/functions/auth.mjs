// ── BLOK. Auth Function ──────────────────────────────────────
// POST   /api/auth   { username, password }  → Login
// GET    /api/auth                          → Verify session (requires Bearer token)

import {
  getAdminCreds,
  createToken,
  authenticateRequest,
  handleOptions,
  ok,
  fail,
} from './_shared.mjs';

export const handler = async (event) => {
  // CORS preflight
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  const method = event.httpMethod;

  // ── POST: Login ────────────────────────────────────────────
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { username, password } = body;

      if (!username || !password) {
        return fail('Username and password are required.');
      }

      const admin = getAdminCreds();

      if (username !== admin.username || password !== admin.password) {
        return fail('Invalid credentials.', 401);
      }

      const token = createToken(username);

      return ok({
        token,
        user: username,
        expiresIn: '24h',
      });
    } catch (err) {
      return fail('Invalid request body.', 400);
    }
  }

  // ── GET: Verify session ────────────────────────────────────
  if (method === 'GET') {
    const session = authenticateRequest(event);
    if (!session) {
      return fail('Unauthorized — invalid or expired token.', 401);
    }

    return ok({
      valid: true,
      user: session.user,
    });
  }

  return fail('Method not allowed.', 405);
};
