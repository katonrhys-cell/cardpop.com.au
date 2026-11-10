/**
 * Mark a successful answer as cacheable by the browser and the CDN.
 *
 * Every API response is `no-store` by default (noCacheHeaders in src/app.js),
 * which is right for anything per-user. A few public GETs answer the same for
 * every visitor and are read far more often than they change: search
 * suggestions (one request per keystroke), the leaderboard, categories,
 * seller ratings, and catalogue / pricing lookups that each spend a paid
 * provider's quota. For those, this sets
 *
 *   Cache-Control: public, max-age=<browser>, s-maxage=<edge>, stale-while-revalidate=<swr>
 *
 * A function's own Cache-Control wins over the vercel.json `/api/*` rule, so
 * Vercel's CDN (and Cloudflare, where a Cache Rule covers the path) serves
 * repeats without invoking the function. Only a 2xx answer is marked; an error
 * keeps `no-store`, and a handler that degrades to a fallback body on failure
 * sets `res.locals.uncacheable = true` so the fallback isn't cached either.
 *
 * Only for routes whose answer cannot depend on who is asking: never mount it
 * on a route that reads req.user, a cookie or a bearer token.
 */
export function publicCache({ browser = 60, edge = 300, swr = 600 } = {}) {
  const value = `public, max-age=${browser}, s-maxage=${edge}, stale-while-revalidate=${swr}`;
  return (_req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && !res.locals.uncacheable) {
        res.removeHeader('Pragma');
        res.removeHeader('Expires');
        res.setHeader('Cache-Control', value);
      }
      return json(body);
    };
    next();
  };
}

// Durations shared by the routes that use it (seconds).
export const CACHE_SHORT = { browser: 60, edge: 120, swr: 300 };     // can change minute to minute
export const CACHE_MEDIUM = { browser: 300, edge: 600, swr: 1800 };  // changes a few times a day
export const CACHE_PRICING = { browser: 900, edge: 3600, swr: 3600 }; // paid market-price lookups
export const CACHE_CATALOGUE = { browser: 3600, edge: 86400, swr: 86400 }; // card catalogues
