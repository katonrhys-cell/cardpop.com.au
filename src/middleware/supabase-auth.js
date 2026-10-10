import { getUserForToken } from '../utils/authTokenCache.js';

export async function supabaseAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')?.[1];

  if (!token) {
    return next();
  }

  try {
    // Cached per token for a short window — see src/utils/authTokenCache.js.
    const { data, error } = await getUserForToken(token);
    if (!error && data?.user) {
      req.userId = data.user.id;
    }
    return next();
  } catch {
    // A failed token validation means "not authenticated", not "server error".
    // Propagating the error would surface a 500 (and leak the message in
    // non-prod) for what is simply an invalid/expired token. Continue
    // unauthenticated; downstream guards enforce access.
    return next();
  }
}
