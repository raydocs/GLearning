# Launch Readiness Iterations: GLearning

**Metric:** Launch-readiness checklist score (passed / total critical items) + `npm run build` result.
**Stop criterion:** P0/P1 critical launch items pass, P2–P7 are either implemented to a usable MVP or explicitly deferred with user-facing/docs clarity, no known broken UI entry points, and `npm run build` passes.
**Scope:** `src/App.tsx`, `src/styles.css`, `src/gameData.ts`, `src/types.ts`, `functions/api/*`, docs under `README*`, and support checks/scripts if added.
**Baseline date:** 2026-05-04

## Checklist model

| Priority | Area | Launch requirement | Baseline |
|---|---|---|---|
| P0 | Learning state | Per-line played/revealed/mastered state persists per game/quest | Missing |
| P0 | No-op cleanup | Visible buttons must work or be removed/disabled honestly | Missing |
| P1 | Saved words/bookmarks | Saved terms/lines persist across routes | Missing |
| P1 | Review loop | Due review mode exists for saved words/lines | Missing |
| P2 | Word/grammar help | Click/inspect words, glossary context, basic grammar notes | Missing |
| P3 | Audio/voice MVP | Audio playback remains; voice practice is honest MVP or deferred | Partial |
| P4 | Multi-game reader polish | 8 routes have distinct, honest sample/live status and usable UX | Partial |
| P5 | Data connectors | Wuwa live connector stable; non-live games clearly labeled sample | Partial |
| P6 | Export/share/profile | TSV works; share/profile either MVP or clearly deferred | Partial |
| P7 | Launch QA/docs | Build passes; regression checklist and screenshots/docs are current | Partial |

## Runs

| # | Change | Score | Build | Notes |
|---|---|---:|---|---|
| baseline | Current repo before launch-readiness loop | 2.5 / 10 | pass (`npm run build`, 560ms Vite) | Wuwa live reader and themed 8-game shell exist; learning loop/SRS/no-op cleanup missing. |
| 1 | Persisted per-line learning-state MVP | 4.0 / 10 (+1.5) | pass (`npm run build`; Vite 559ms, exit 0) | P0 learning state now MVP pass: played/revealed/mastered persists locally per game/quest and is shown separately from source alignment confidence. P0 no-op cleanup and P1 saved/review remain missing. |
| 2 | Honest no-op cleanup for visible planned controls | 5.0 / 10 (+1.0 expected) | pass (`npm run build`; Vite 550ms) | Home topbar planned controls are disabled/labeled; non-live chapter cards are explicit current-sample/planned disabled states; disabled styling now communicates unavailable controls; README regression notes no visible control should silently no-op. |
| 3 | Persisted saved dialogue lines and glossary terms MVP | 6.2 / 10 (+1.2) | pass (`npm run build`; Vite 559ms, exit 0) | P1 saved/bookmarks now MVP pass: dialogue line saves and glossary term saves persist in `glearning-saves-v1`, scoped by game/quest, visible as a recent list in Study, counted by active game in ReaderDock, and honestly defer review mode/global saved page. |
| 4 | Local due review loop MVP for saved dialogue lines and glossary terms | 7.4 / 10 (+1.2 expected) | pass (`npm run build`; Vite 610ms, exit 0) | P1 review loop now MVP pass: saved line/term IDs drive `glearning-review-v1`; missing state is due now; Study has Show answer → Again/Know grading; Again schedules ~10m, Know grows a simple local interval; ReaderDock shows active-game due count; un-save prunes review state. |
| 5 | Local contextual word/grammar help MVP for selected dialogue lines | 8.2 / 10 (+0.8 expected) | pass (`npm run build`; Vite 613ms, exit 0) | P2 word/grammar help now MVP pass: dialogue cards open Study-side local language help without mutating save/reveal/mastered state; selected lines show speaker/context, EN/ZH snippets, deterministic glossary matches, up to 3 grammar/reading hints, honest local-only copy, and clear action. |
| 6 | P3 audio availability honesty and reader empty-state polish | 8.8 / 10 (+0.6 expected) | pass (`npm run build`; Vite 625ms, exit 0) | P3 audio/voice MVP now honest for launch: app derives quest audio availability, clears stale audio-only for no-audio samples, disables/labels audio-only controls when clips are unavailable, adds explanatory empty reader states, and documents playback-only audio with voice recording/pronunciation scoring deferred. |
| 7 | P4/P5 multi-game live/sample status honesty across landing and reader chrome | 9.2 / 10 (+0.4 expected) | pass (`npm run build`; Vite 586ms, real 1.80s, exit 0) | Added launch-honest live/sample copy and metadata: Home hero + stats now branch on Wuwa live vs sample readers; game-card metadata and sample-source/rail notes explicitly mark connectors as planned for non-live pages; README now states Wuwa-only live connector and sample-reader/audio limitations in features, roadmap, and regression checks. |
| 8 | P6/P7 launch closeout honesty + smoke checklist | 9.7 / 10 (+0.5 expected) | pass (`npm run build`; Vite 592ms, real 1.71s, exit 0) | Home disabled hints now explicitly mark settings/profile + global saved page as planned; Export panel heading/copy now states TSV-only launch MVP with share/profile/account/cloud/public pages deferred and local-only saved/review data; README adds launch smoke checklist (build, Pages runtime, routes, API, payload-based audio checks, and manual UI checks). Orchestrator local Pages smoke passed after the row was appended: `/`, `/games/wuwa`, `/games/starrail`, `/games/cyberpunk` returned 200; `/api/main-quests` returned 56 quests; live quest parse returned 314 lines / 220 audio. |
