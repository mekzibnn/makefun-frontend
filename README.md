# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/mekzibnn/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/mekzibnn/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, easy make.fun frontend from static files on make.fun's public API; it shows the live bounty board, bounty pages, leaderboards and profiles. $0.50 to enter: an AI judge compares the apps two at a time, and the 20 best share $500 plus every entry fee paid.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no sign-in: the app reads only `https://make.fun/api` (GET, CORS). The board loads in one request; answers are cached and revalidated with ETags; time-left labels tick in place without a new request.

Routes: `#/` the board, `#/bounty/<slug>` a bounty, `#/bounty/<slug>/leaderboard` its leaderboard, `#/profile/<handle>` an account's public profile.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
