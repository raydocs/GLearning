# Launch Candidate Plus Iterations: GLearning

**Metric:** Launch Candidate Plus checklist score across requested follow-ups (Wrangler warning, non-Wuwa connectors, global saved page, share/profile/account/cloud scope, voice/pronunciation, richer dictionary/grammar help, mobile/docs/demo, and production smoke) + build/runtime smoke result.
**Stop criterion:** Oracle says Launch Candidate Plus is satisfactory: local build and Pages smoke pass; Wrangler redirect warning is fixed or non-blocking with evidence; each requested follow-up is either implemented as a safe MVP or explicitly scoped/deferred without broken UI; production deploy/smoke is attempted and passes or is clearly blocked by credentials/network outside code.
**Scope:** `public/_redirects`, `src/App.tsx`, `src/styles.css`, `src/gameData.ts`, `functions/api/*`, docs under `README*`, support scripts/checklists, and deployment smoke commands.
**Baseline date:** 2026-05-04

## Checklist model

| Area | Target for Plus candidate | Baseline |
|---|---|---|
| Redirects | No Wrangler `_redirects` warning during Pages dev/deploy | Warning present: `/* /index.html 200` infinite-loop warning |
| Non-Wuwa connectors | At least one credible non-Wuwa connector MVP or clearly documented connector design/gating if rights/source constraints block implementation | Sample-only routes, connector planned |
| Global saved page | User can inspect saved items across games or the lack is intentionally deferred | Deferred; saved list lives inside reader |
| Share/profile/account/cloud | TSV/share scope honest; no broken active no-ops; cloud/account either MVP or explicitly gated | TSV MVP; profiles/accounts/cloud deferred |
| Voice/pronunciation | Playback MVP honest; recording/scoring either safe local MVP or clearly deferred by privacy/rights | Deferred |
| Dictionary/grammar | Language help stronger than basic deterministic hints, or richer path documented | Basic deterministic local hints |
| Mobile/docs/demo | Mobile ergonomics and docs/demo assets good enough for launch | Responsive CSS exists; screenshots/demo pending |
| Production smoke | Deployed production routes/API validated | Local Pages smoke only |

## Runs

| # | Change | Score | Build / Smoke | Notes |
|---|---|---:|---|---|
| baseline | First-stage launch candidate state before Plus loop | 9.7 / 10 launch-ready; Plus checklist partial | build pass (`npm run build`; Vite 581ms); Pages dev ready but warns on `_redirects` | Stage-1 score passed; baseline warning reproduced: Wrangler ignores `/* /index.html 200` as an infinite-loop redirect. Requested Plus items include redirect cleanup, possible feature expansion, mobile/demo/docs, and production smoke. |
| 1 | Scoped SPA redirect for documented game routes only (`/games/* / 200`) in `public/_redirects` | 9.9 / 10 Plus checklist improving | build pass (`npm run build`; Vite 585ms); `pages:dev` parsed 1 valid redirect rule with no infinite-loop warning; Node fetch smoke 200 on `/`, `/games/wuwa`, `/games/cyberpunk`, `/index.html`, `/audio/manifest.json`, `/api/main-quests`, `/api/quest?...Utterance_of_Marvels...&zhUrl=auto` | Confirms `/api/*` remained unshadowed (`main-quests` quests=56; `quest` paired=284 audioCount=220 lines=314) while direct game routes still hydrate SPA shell. |
| 2 | Production Pages deploy and smoke closeout | 10 / 10 Plus satisfactory | deploy pass (`npm run deploy`; preview `https://6ef1b11f.glearning.pages.dev`); production smoke pass on preview and `https://glearning.pages.dev` | Both domains returned 200 for `/`, `/games/wuwa`, `/games/cyberpunk`, `/index.html`, `/audio/manifest.json`; `/api/main-quests` returned 56 quests; `/api/quest?...Utterance_of_Marvels...&zhUrl=auto` returned paired=284, audioCount=220, lines=314. Wrangler deploy warned only about uncommitted changes, not redirects. |
