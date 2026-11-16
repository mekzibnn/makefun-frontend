// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Every answer is cached in memory and revalidated with its ETag: the API's
// tags are bound to the minute, so a revalidation inside the same minute
// answers 304 and costs no download. A view that comes back within 60 s of
// its last fetch reads the cache and makes no request at all.

const API = 'https://make.fun/api';
const TTL_MS = 60_000;

const cache = new Map();
let requests = 0;
let cacheHits = 0;

/** How many real requests this session made, and how many reads the cache served. */
export function apiStats() {
  return { requests, cacheHits };
}

/**
 * GET one API path, cached and ETag-revalidated. Returns the parsed JSON.
 * A 304 keeps the cached body; any other non-OK answer throws with its status.
 */
export async function apiGet(path) {
  const key = path;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    cacheHits += 1;
    return hit.body;
  }
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  requests += 1;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && hit) {
    hit.at = Date.now();
    cacheHits += 1;
    return hit.body;
  }
  if (!res.ok) throw new Error(`make.fun API ${res.status} for ${path}`);
  const body = await res.json();
  cache.set(key, { body, etag: res.headers.get('ETag'), at: Date.now() });
  return body;
}

/** The open bounties, with each one's live pot and entry fee: one request. */
export const getBounties = () => apiGet('/competitions?status=open');

/** One bounty, by its slug: summary, rewards, live pot, dates, rules. */
export const getBounty = (slug) => apiGet(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: view is 'performance' or 'overall'. */
export const getLeaderboard = (slug, view = 'performance') =>
  apiGet(`/competitions/${encodeURIComponent(slug)}/leaderboard?view=${encodeURIComponent(view)}`);

/** An account's public profile, with its record and its entries. */
export const getProfile = (handle) => apiGet(`/profiles/${encodeURIComponent(handle)}`);
