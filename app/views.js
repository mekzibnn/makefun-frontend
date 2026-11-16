// The four surfaces, each a function from API data to HTML. Every value the
// API returns is escaped before it reaches the page; every <img> the API
// points at carries crossorigin="anonymous" before its src, as make.fun's
// avatar and entry images require.

import { date, esc, money, monthYear, num, stillOpen, timeLeft, winRate } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} fee` : 'no fee');

/** A status pill: decided by the deadline, never by the status alone. */
function pill(b) {
  if (!stillOpen(b.deadline)) return '<span class="pill ended">Ended</span>';
  const ms = new Date(b.deadline).getTime() - Date.now();
  if (ms < 86400000) return '<span class="pill soon">Closing soon</span>';
  return '<span class="pill open">Open</span>';
}

/** One fact in a definition list. */
const fact = (label, value) => `<dt>${label}</dt><dd>${value}</dd>`;

/** Pager links: pages are links, so any page has its own URL. */
function pager(base, page, pages) {
  if (pages <= 1) return '';
  const link = (p, label, cls = '') =>
    p === page
      ? `<span class="pg current" aria-current="page">${label}</span>`
      : `<a class="pg ${cls}" href="${base}${base.includes('?') ? '&' : '?'}page=${p}">${label}</a>`;
  let out = '<nav class="pager" aria-label="Pages">';
  if (page > 1) out += link(page - 1, '← Prev');
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out += link(p, String(p));
    else if (Math.abs(p - page) === 2) out += '<span class="pg dots">…</span>';
  }
  if (page < pages) out += link(page + 1, 'Next →');
  return `${out}</nav>`;
}

const BOARD_PAGE = 10;

/** The board: every open bounty, its live pot, fee, time left and entries. */
export function boardPage(data, q) {
  const all = data.items ?? [];
  const query = (q.q ?? '').toLowerCase();
  const filtered = all.filter(
    (b) =>
      !query ||
      b.title.toLowerCase().includes(query) ||
      b.slug.toLowerCase().includes(query) ||
      (b.category ?? '').toLowerCase().includes(query),
  );
  const sorted = [...filtered].sort((a, b) => {
    // Bounties still taking entries first, then ended ones: the API's open
    // list can hold bounties past their deadline, and a board that leads
    // with them looks broken even though its pills are honest.
    const ao = stillOpen(a.deadline) ? 0 : 1;
    const bo = stillOpen(b.deadline) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (q.sort === 'pot') return Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount);
    if (q.sort === 'entries') return (b.submissionCount ?? 0) - (a.submissionCount ?? 0);
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
  const pages = Math.max(1, Math.ceil(sorted.length / BOARD_PAGE));
  const page = Math.min(Math.max(1, q.page || 1), pages);
  const rows = sorted.slice((page - 1) * BOARD_PAGE, page * BOARD_PAGE);
  const totalPot = all.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const openCount = all.filter((b) => stillOpen(b.deadline)).length;
  const qs = (extra) => {
    const p = new URLSearchParams();
    if (q.q) p.set('q', q.q);
    if (q.sort && q.sort !== 'deadline') p.set('sort', q.sort);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    const s = p.toString();
    return s ? `#/?${s}` : '#/';
  };

  return `
    <h1>Open bounties</h1>
    <p class="lede">${num(openCount)} taking entries · ${num(all.length)} listed · ${money(totalPot)} in live pots · one request loads the board</p>
    <form class="controls" method="get" action="#/">
      <label class="visually-hidden" for="board-q">Search bounties</label>
      <input id="board-q" name="q" type="search" placeholder="Search title or category…" value="${esc(q.q ?? '')}" autocomplete="off">
      <label class="visually-hidden" for="board-sort">Sort by</label>
      <select id="board-sort" name="sort">
        <option value="deadline" ${q.sort !== 'pot' && q.sort !== 'entries' ? 'selected' : ''}>Closing soon</option>
        <option value="pot" ${q.sort === 'pot' ? 'selected' : ''}>Biggest pot</option>
        <option value="entries" ${q.sort === 'entries' ? 'selected' : ''}>Most entries</option>
      </select>
      <button type="submit">Apply</button>
    </form>
    ${filtered.length === 0 ? '<p class="empty">No bounties match that search.</p>' : ''}
    <ul class="board">
      ${rows
        .map(
          (b) => `
      <li>
        <a class="row-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
        <span class="row-cat">${esc(b.category ?? '')}</span>
        ${pill(b)}
        <span class="row-pot" title="Live pot: prize plus entry fees paid">${pot(b)}</span>
        <span class="row-fee">${fee(b)}</span>
        <span class="row-time" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
        <span class="row-entries">${num(b.submissionCount)} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
      </li>`,
        )
        .join('')}
    </ul>
    ${pager(qs({}), page, pages)}
    <p class="hint">Time left ticks every 30 seconds without a new request. Pots and fees refresh from the API at most once a minute.</p>`;
}

/** One bounty: summary, facts, the rewards table with the live pot, dates, rules. */
export function bountyPage(b) {
  const live = Array.isArray(b.rewardsNow) && b.rewardsNow.length > 0 ? b.rewardsNow : null;
  const rewardsRows = live
    ? live
        .map(
          (r) => `<tr><td>${num(r.place)}</td><td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td><td><strong>${money(r.amountUsd)}</strong></td></tr>`,
        )
        .join('')
    : Object.entries(b.rewards ?? {})
        .sort((a, c) => Number(a[0]) - Number(c[0]))
        .map(([place, amount]) => `<tr><td>${num(place)}</td><td>${money(amount)}</td><td>—</td><td><strong>${money(amount)}</strong></td></tr>`)
        .join('');
  const open = stillOpen(b.deadline);

  return `
    <p class="crumbs"><a href="#/">All bounties</a> · <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a></p>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary ?? '')}</p>
    <dl class="facts">
      ${fact('Live pot', `<strong>${pot(b)}</strong> <span class="muted">(prize ${money(b.rewardAmount)} + entry fees)</span>`)}
      ${fact('Entry fee', b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free to enter')}
      ${fact('Status', open ? '<span class="pill open">Open — taking entries</span>' : '<span class="pill ended">Ended</span>')}
      ${fact('Deadline', `${date(b.deadline)} (<span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>)`)}
      ${fact('Opened', date(b.opensAt ?? b.publishedAt))}
      ${fact('Entries', num(b.submissionCount))}
      ${fact('Category', esc(b.category ?? '—'))}
    </dl>
    <h2>Rewards</h2>
    <p class="muted">Live amounts: each place's prize plus its share of the entry fees paid so far.</p>
    <table class="rewards">
      <thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Total now</th></tr></thead>
      <tbody>${rewardsRows}</tbody>
    </table>
    <h2>Description</h2>
    <div class="description">${esc(b.description ?? '')}</div>
    <details class="rules">
      <summary>Rules (${num((b.rules ?? '').length)} characters)</summary>
      <div class="description">${esc(b.rules ?? '')}</div>
    </details>
    <p class="actions">
      <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">See the leaderboard</a>
      <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun ↗</a>
    </p>`;
}

const BOARD_LEADER = 25;

/** A bounty's leaderboard: rank, entrant, win rate, interval, size. */
export function leaderboardPage(data, q) {
  const comp = data.competition ?? {};
  const rows = data.entries ?? [];
  const view = q.view === 'overall' ? 'overall' : 'performance';
  const pages = Math.max(1, Math.ceil(rows.length / BOARD_LEADER));
  const page = Math.min(Math.max(1, q.page || 1), pages);
  const slice = rows.slice((page - 1) * BOARD_LEADER, page * BOARD_LEADER);
  const base = `#/bounty/${encodeURIComponent(comp.slug)}/leaderboard`;
  const viewLink = (v, label) =>
    v === view ? `<span class="pg current">${label}</span>` : `<a class="pg" href="${base}?view=${v}">${label}</a>`;

  return `
    <p class="crumbs"><a href="#/">All bounties</a> · <a href="#/bounty/${encodeURIComponent(comp.slug)}">${esc(comp.title ?? comp.slug)}</a></p>
    <h1>${esc(comp.title ?? comp.slug)} — leaderboard</h1>
    <p class="lede">${esc(data.phase?.title ?? '')} phase · ${num(rows.length)} entries · win rate with 90% interval</p>
    <p class="views">View: ${viewLink('performance', 'Performance')} ${viewLink('overall', 'Overall')}</p>
    <table class="leader">
      <thead><tr><th>Rank</th><th>Entrant</th><th>Win rate</th><th>Interval</th><th>Valid</th><th>Size</th></tr></thead>
      <tbody>
      ${slice
        .map((e) => {
          const v = e.values ?? {};
          // An entry image is a make.fun path ("/api/avatars/…") or a full
          // URL the API points at (a GitHub avatar): use it as it comes.
          const src = e.image ? (e.image.startsWith('http') ? e.image : `https://make.fun${e.image}`) : '';
          const img = src ? `<img crossorigin="anonymous" src="${esc(src)}" alt="" width="28" height="28" loading="lazy">` : '';
          return `<tr class="${e.rank <= 3 ? `top${e.rank}` : ''}">
          <td class="rank">${num(e.rank)}</td>
          <td class="entrant">${img}<a href="#/profile/${encodeURIComponent(e.handle ?? '')}">${esc(e.handle ?? '—')}</a><span class="entry-title">${esc(e.title ?? '')}</span></td>
          <td><strong>${winRate(v.judge)}</strong></td>
          <td class="muted">${winRate(v.judge_low)} – ${winRate(v.judge_high)}</td>
          <td>${v.valid === 1 ? '✓' : '—'}</td>
          <td class="muted">${num(v.bytes)} B</td>
        </tr>`;
        })
        .join('')}
      </tbody>
    </table>
    ${pager(`${base}?view=${view}`, page, pages)}
    <p class="hint">Development phase — provisional rates, judged against the house frontends. Handles link to each account's public profile.</p>`;
}

/** An account's public profile: avatar, bio, record, and its entries. */
export function profilePage(p) {
  const rec = p.record ?? {};
  const entries = p.solutions ?? [];
  return `
    <p class="crumbs"><a href="#/">All bounties</a></p>
    <div class="profile-head">
      ${p.image ? `<img crossorigin="anonymous" src="${esc(p.image)}" alt="Avatar of ${esc(p.handle)}" width="96" height="96">` : ''}
      <div>
        <h1>${esc(p.display_name ?? p.handle)}</h1>
        <p class="handle">@${esc(p.handle)}</p>
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
        <p class="muted">Joined ${monthYear(p.joined_at)}${p.github_login ? ` · GitHub <a href="https://github.com/${encodeURIComponent(p.github_login)}">${esc(p.github_login)}</a>` : ''}</p>
      </div>
    </div>
    <dl class="facts stats">
      ${fact('Bounties entered', num(rec.competitions_entered))}
      ${fact('Placed', num(rec.competitions_placed))}
      ${fact('Won', num(rec.competitions_won))}
      ${fact('Best placement', rec.best_placement ? `#${num(rec.best_placement)}` : '—')}
      ${fact('Prize money won', money(rec.prize_usd))}
    </dl>
    <h2>Entries (${num(entries.length)})</h2>
    ${
      entries.length === 0
        ? '<p class="empty">No entries yet.</p>'
        : `<ul class="entries">
      ${entries
        .map((s) => {
          const c = s.competition ?? {};
          return `<li>
        <a href="#/bounty/${encodeURIComponent(c.slug)}">${esc(c.title ?? c.slug)}</a>
        <span class="entry-title">${esc(s.title ?? '')}</span>
        <span>${s.score ? winRate(s.score.value) : '—'}</span>
        <span>${s.placement ? `Placed #${num(s.placement)}` : 'Unplaced'}</span>
        <span class="muted">${s.prize_usd ? money(s.prize_usd) : ''}</span>
      </li>`;
        })
        .join('')}
    </ul>`
    }`;
}

/** A missing route or handle, with a way back. */
export function notFoundPage(message) {
  return `<h1>Not found</h1><p>${esc(message)}</p><p><a href="#/">Back to the board</a></p>`;
}

/** A failed API call, with a retry that re-runs the same route. */
export function errorPage(message) {
  return `<h1>Could not load that</h1><p>${esc(message)}</p><p><a href="#/">Back to the board</a> · <a href="${esc(location.hash || '#/')}">Try again</a></p>`;
}
