# Feature Milestone 2 Iterations: GLearning

**Metric:** Feature Milestone 2 checklist score across the remaining post-launch expansion areas after `/saved`: non-Wuwa connector path, richer dictionary/grammar, deeper mobile polish, screenshots/demo, share/profile/account/cloud sync, and voice/pronunciation.
**Stop criterion:** Oracle says Milestone 2 is satisfactory: at least one remaining high-value expansion ships as a usable, verified MVP or connector-ready architecture without regressing Launch Candidate Plus / Feature Milestone 1; remaining items are prioritized into Milestone 3+; `npm run build` passes; local/prod smoke is run when routing/API/deploy behavior changes.
**Scope:** `src/App.tsx`, `src/styles.css`, `src/gameData.ts`, `functions/api/*`, docs under `README*`, support scripts/assets if added, and prompt-export scoreboards.
**Baseline date:** 2026-05-04
**Baseline release:** `448cfca` (`Record saved library production smoke`) deployed to `https://glearning.pages.dev`.

## Checklist model

| Area | Milestone target | Baseline |
|---|---|---|
| Non-Wuwa connector path | At least one non-Wuwa live connector prototype or a connector-ready architecture with gated UI and source/rights notes | Sample readers only |
| Dictionary/grammar | Richer deterministic dictionary/grammar help beyond basic hints, before any AI dependency | Basic glossary match + local hints |
| Mobile polish | Reader/saved-page mobile ergonomics explicitly improved and smoke-checked | Responsive CSS exists, deeper polish pending |
| Screenshots/demo | Repository docs include visual proof or reproducible demo capture path | Smoke docs only |
| Share/profile/account/cloud | Clear implementation path or safe local MVP without fake account/cloud UX | TSV export + local saved/review only |
| Voice/pronunciation | Safe local practice prototype or explicit privacy-gated technical plan | Playback only |

## Runs

| # | Change | Score | Build / Smoke | Notes |
|---|---|---:|---|---|
| baseline | Feature Milestone 1 production release | 0 / 6 Milestone 2 areas upgraded; FM1 remains released | build pass (`npm run build`; Vite 605ms) | `/saved` is live; remaining expansion areas should be tackled one attributed MVP at a time. |
| 1 | Richer deterministic Language Help MVP | 1 / 6 Milestone 2 areas upgraded; dictionary/grammar MVP improved | build pass (`npm run build`; `BUILD_EXIT:0`; Vite 595ms); local Pages smoke pass: `/`, `/saved`, `/games/wuwa`, `/games/genshin`, `/audio/manifest.json`, `/api/main-quests` (`quests=56`), `/api/quest` Utterance I (`paired=284`, `audioCount=220`, `lines=314`) all 200 | Added pure local `src/languageHelp.ts`; UI now shows matched-by source terms, up to 8 key chunks, up to 4 transparent grammar cards, and one reading strategy. No API/route/storage/schema changes; still no full dictionary, AI parser, external lookup, voice, account/cloud/share/profile, screenshot/demo, or non-Wuwa connector. |
