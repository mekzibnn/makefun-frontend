// Hand in this make.fun frontend entry (Node 22, standard library only).
// The app itself is plain static files in app/ (index.html, ES modules, one
// stylesheet, no build step) that read make.fun's public API from the browser.
// This program copies app/ and screenshots/ beside it into /output and writes
// /output/dossier.json with the kit's vendored library, so the judge reads
// the same summary the scorer rebuilds. Leave vendor/makefun-frontend.ts
// untouched: the scorer requires dossier.json byte for byte.
//
// Run it locally with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app itself with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (reference/gate.json): text_max_bytes shapes
// the dossier text; the rest refuse an entry the scorer would refuse (more
// than 3 screenshots or one over 256 KiB; app/ over 993 files and
// directories or 16 MiB — app/ shares /output's 1000-entry cap with
// screenshots/ and dossier.json, so the app leaves them room).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
