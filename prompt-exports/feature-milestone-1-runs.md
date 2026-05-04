# Feature Milestone 1 Iterations: GLearning

**Metric:** Feature Milestone 1 checklist score across post-launch product expansion: non-Wuwa connector path, global saved page, share/profile/account/cloud scope, voice/pronunciation practice, richer dictionary/AI grammar, screenshots/demo, and deeper mobile polish.
**Stop criterion:** Oracle says Milestone 1 is satisfactory: at least one high-value feature ships as a usable, verified MVP without regressing Launch Candidate Plus; remaining items are ranked into a clear next backlog; `npm run build` passes; local/prod smoke is run when routing/API/deploy behavior changes.
**Scope:** `src/App.tsx`, `src/styles.css`, `src/gameData.ts`, `functions/api/*`, docs under `README*`, support scripts/assets if added, and prompt-export scoreboards.
**Baseline date:** 2026-05-04
**Baseline release:** `2c4a9d5` (`Prepare GLearning launch candidate plus`) deployed to `https://glearning.pages.dev`.

## Checklist model

| Area | Milestone target | Baseline |
|---|---|---|
| Non-Wuwa connectors | At least one non-Wuwa live connector prototype or connector-ready architecture with gated UI | Sample readers only |
| Global saved page | Cross-game saved/review browsing outside the active reader | Deferred; reader-scoped saved list only |
| Share/profile/account/cloud | Clear path from TSV/local data toward share/profile/cloud, with no unsafe fake account UX | TSV MVP only; account/cloud deferred |
| Voice/pronunciation | Safe local voice/pronunciation practice MVP or explicit privacy-gated prototype | Playback only |
| Dictionary/grammar | Richer deterministic dictionary/grammar help beyond basic hints | Basic glossary match + hints |
| Screenshots/demo | Repository docs include launch/demo visual proof | Smoke docs only |
| Mobile polish | Mobile reader ergonomics explicitly improved and smoke-checked | Responsive CSS exists, deeper polish pending |

## Runs

| # | Change | Score | Build / Smoke | Notes |
|---|---|---:|---|---|
| baseline | Launch Candidate Plus production release | 0 / 7 feature areas fully upgraded; LC+ remains 10 / 10 | deployed; production smoke passed on `https://glearning.pages.dev` | Feature milestone begins after stable release. Most requested expansion items remain post-launch backlog, with honest UI/docs deferrals. |
| 1 | Global Saved & Review Library MVP | 1 / 7 feature areas upgraded; LC+ route/API smoke preserved locally | `npm run build && echo BUILD_OK` passed. Local `npm run pages:dev` parsed 3 redirects, no infinite-loop warning; Node fetch smoke: `/`, `/saved`, `/saved/`, `/games/wuwa`, `/games/cyberpunk`, `/audio/manifest.json` all 200; `/api/main-quests` 200 with 56 quests; `/api/quest?...Utterance...&zhUrl=auto` 200 with paired=284, audioCount=220, lines=314. | Added local-only `/saved` route/page, active Home ★ control, explicit `/saved` redirects, cross-game saved/review browse/filter/remove/first-due review using existing `glearning-saves-v1` + `glearning-review-v1`. Account/cloud, exact quest restore, non-Wuwa connectors, voice/scoring, AI grammar, share cards, screenshots/demo, and broad mobile rewrite remain deferred. |
