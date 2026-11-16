// A make.fun frontend: the board, a bounty's page, its leaderboard and an
// account's public profile, on hash routes. Every surface is reachable by a
// link and by its own URL, and the board's search, sort and pages are links
// too, so any view has an address you can share.
//
//   #/                                the board
//   #/bounty/<slug>                   one bounty
//   #/bounty/<slug>/leaderboard       its leaderboard
//   #/profile/<handle>                an account's public profile
//
// window.__shotReady is false while a route loads and true once its data is
// on screen, so a screenshot script knows when to capture. Time-left labels
// tick every 30 s in place, with no new request and no rebuild of the page.

import { apiGet, apiStats, getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { timeLeft } from './format.js';
import { boardPage, bountyPage, errorPage, leaderboardPage, notFoundPage, profilePage } from './views.js';

const app = document.getElementById('app');
const netstat = document.getElementById('netstat');

/** The network line in the footer: real requests vs answers the cache served. */
function showStats() {
  const s = apiStats();
  netstat.textContent = `${s.requests} API request${s.requests === 1 ? '' : 's'} · ${s.cacheHits} served from cache`;
}

/** Parse '#/bounty/x/leaderboard?view=overall&page=2' into a route and query. */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { parts, query: new URLSearchParams(query ?? '') };
}

/** Re-render the time-left labels in place; no fetch, no rebuild. */
function tickTimes() {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.getAttribute('data-deadline'));
  });
}
setInterval(tickTimes, 30_000);

async function render() {
  window.__shotReady = false;
  app.innerHTML = '<p class="loading">Loading…</p>';
  const { parts, query } = parseHash();
  try {
    if (parts.length === 0) {
      const data = await getBounties();
      document.title = 'Open bounties | make.fun';
      app.innerHTML = boardPage(data, {
        q: query.get('q') ?? '',
        sort: query.get('sort') ?? 'deadline',
        page: Number(query.get('page')) || 1,
      });
    } else if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
      const data = await getLeaderboard(parts[1], query.get('view') ?? 'performance');
      document.title = `${data.competition?.title ?? parts[1]} leaderboard | make.fun`;
      app.innerHTML = leaderboardPage(data, {
        view: query.get('view') ?? 'performance',
        page: Number(query.get('page')) || 1,
      });
    } else if (parts[0] === 'bounty' && parts[1] && parts.length === 2) {
      const b = await getBounty(parts[1]);
      document.title = `${b.title} | make.fun`;
      app.innerHTML = bountyPage(b);
    } else if (parts[0] === 'profile' && parts[1] && parts.length === 2) {
      const p = await getProfile(parts[1]);
      document.title = `${p.display_name ?? p.handle} (@${p.handle}) | make.fun`;
      app.innerHTML = profilePage(p);
    } else {
      document.title = 'Not found | make.fun';
      app.innerHTML = notFoundPage('That page does not exist here.');
    }
  } catch (err) {
    document.title = 'Could not load that | make.fun';
    const missing = err instanceof Error && /404/.test(err.message);
    app.innerHTML = missing
      ? notFoundPage('That bounty or account does not exist on make.fun.')
      : errorPage(err instanceof Error ? err.message : 'The make.fun API did not answer.');
  }
  window.scrollTo(0, 0);
  showStats();
  window.__shotReady = true;
}

/** The header's account lookup: a handle typed here opens its profile route. */
document.getElementById('lookup').addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = new FormData(event.target).get('handle').toString().trim().replace(/^@/, '');
  if (handle) location.hash = `#/profile/${encodeURIComponent(handle)}`;
});

/** The board's search and sort are a plain form: submit navigates by URL. */
app.addEventListener('submit', (event) => {
  if (!event.target.matches('.controls')) return;
  event.preventDefault();
  const form = new FormData(event.target);
  const params = new URLSearchParams();
  const q = form.get('q').toString().trim();
  const sort = form.get('sort').toString();
  if (q) params.set('q', q);
  if (sort && sort !== 'deadline') params.set('sort', sort);
  const s = params.toString();
  location.hash = s ? `#/?${s}` : '#/';
});

/** A dead avatar or entry image hides itself instead of a broken icon. */
app.addEventListener(
  'error',
  (event) => {
    if (event.target instanceof HTMLImageElement) event.target.style.display = 'none';
  },
  true,
);

/** Prefetch a bounty's data when its board row is hovered or focused, so the
 *  page it opens to is already in the cache. */
app.addEventListener('mouseover', (event) => {
  const a = event.target.closest('a.row-title');
  if (a) apiGet(`/competitions/${a.href.split('/bounty/')[1]}`).catch(() => {});
});
app.addEventListener('focusin', (event) => {
  const a = event.target.closest('a.row-title');
  if (a) apiGet(`/competitions/${a.href.split('/bounty/')[1]}`).catch(() => {});
});

window.addEventListener('hashchange', render);
render();
