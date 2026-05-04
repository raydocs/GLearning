# GLearning

GLearning is a game-dialogue English learning site. It turns familiar quest dialogue into a bilingual reader with game-specific themes, source-aware pairing, source-clip audio playback, mic-free shadow practice, glossary review, deterministic language help, and TSV export.

Live site: <https://glearning.pages.dev>

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md)

Architecture master plan: [docs/architecture-master-plan.md](./docs/architecture-master-plan.md)

## What Is Live Today

The production app has four launch surfaces:

- A multi-game landing page with per-game routes, palettes, decorative motifs, and launch-honest live/sample status copy.
- A production-safe static `/demo` reviewer walkthrough for the launch MVP scope and deferred claims.
- A real Wuthering Waves reader backed by live wiki/API data, not mock dialogue.
- A browser-local `/saved` library for cross-game saved lines, saved terms, and due review browsing.

Wuthering Waves is currently the only game with a live data connector. The other game pages are launch-honest sample readers with curated dialogue/glossary content, so bilingual reading, save, review, export, and language-help flows are usable without pretending that a live connector exists.

Connector readiness is now explicit metadata in `src/gameData.ts`: every game declares whether it can call the quest API, quest catalogue API, and source-audio connector. Today only Wuthering Waves has those live capabilities enabled; all non-Wuwa games explicitly declare sample-reader status and do not add any new external source.

Audio and voice practice at launch are honest, source-only MVPs: Wuthering Waves can play available source clips line by line, while sample readers intentionally show 0 playable clips until a real connector is added. The Voice tab offers mic-free shadow practice: users can select a dialogue line, listen only when a source clip exists, read deterministic chunks, and count private session repetitions. It does not request microphone access, record, upload, run speech recognition, generate TTS/new audio, or score/rate pronunciation.

## Supported Routes

The reviewer demo route is:

- `/demo` — static launch walkthrough covering the Wuwa live reader, non-Wuwa sample-reader honesty, browser-local saved/review library, TSV export, mic-free shadow practice, and deferred account/cloud/profile/share-card claims. It should not fetch quest APIs or write saved/review storage while rendering.

The local saved/review library route is:

- `/saved` — browser-local saved lines, glossary terms, and first-due review card across games. It reuses `glearning-saves-v1` and `glearning-review-v1`; there is no account or cloud sync.

Each game has its own route and visual system:

- `/games/wuwa` — Wuthering Waves / 鸣潮
- `/games/genshin` — Genshin Impact / 原神
- `/games/starrail` — Honkai: Star Rail / 崩坏：星穹铁道
- `/games/zzz` — Zenless Zone Zero / 绝区零
- `/games/arknights` — Arknights / 明日方舟
- `/games/honkai3` — Honkai Impact 3rd / 崩坏3
- `/games/cyberpunk` — Cyberpunk 2077 / 赛博朋克 2077
- `/games/witcher3` — The Witcher 3 / 巫师3：狂猎

The landing page and reader borrow the more immersive direction from the Glearning2 prototype: game tabs, large poster hero, atmospheric backdrops, floating notes/stars, hazard stripes, corner chrome, and per-game color palettes.

## Wuthering Waves Data Pipeline

The Wuthering Waves reader uses official/community source text on demand. It does not AI-translate dialogue.

The default pair is:

- English: `https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I`
- Chinese: `https://wiki.biligame.com/wutheringwaves/任务回顾/万象新声·上`

When a quest is selected from the main-quest catalogue, the client sends `zhUrl=auto`. The Cloudflare Function then:

- Fetches English quest wikitext from the Fandom MediaWiki API.
- Extracts the Simplified Chinese title from the Fandom language metadata.
- Searches Kuro Wiki catalogue `fid=1249` for the matching main-quest dialogue entry.
- Fetches Kuro story dialogue for the matched quest.
- Parses speakers, dialogue lines, choices, and Fandom audio references.
- Aligns English and Chinese lines with a dynamic-programming pass that can skip missing lines from either source.
- Prefers bundled local MP3 files when available, while preserving source audio URLs.
- Returns paired dialogue, terms, warnings, source URLs, counts, and audio metadata.

Explicit Chinese URLs still work for manual source pairing:

- BWIKI task-review pages.
- Kuro Wiki `wiki.kurobbs.com/mc/item/<id>` pages.

## Features

- Multi-game landing page with per-game theme tabs and live/sample honesty copy.
- Per-game reader route and palette selection.
- Wuthering Waves marked as the only live connector; non-live games are explicitly labeled sample readers with connector planned.
- Typed connector metadata/helpers in `src/gameData.ts` gate live quest/catalog API fetches so non-Wuwa routes render `createSampleQuest(activeGame)` and do not call Wuwa live APIs.
- Live Wuthering Waves quest catalogue from `/api/main-quests`.
- Wuthering Waves English/Fandom + Chinese/Kuro/BWIKI pairing through `/api/quest`.
- Dialogue stream with speaker labels, Chinese reveal mode, search, speaker filter, density controls, and audio-only mode.
- Browser-local per-line study progress: played, revealed, and mastered state persists per game/quest.
- Browser-local saved dialogue lines and glossary terms persist in `localStorage` key `glearning-saves-v1`, scoped by game and quest, with a compact recent list in the Study panel.
- Global Saved & Review Library MVP at `/saved`: browse saved lines/terms across games, search/filter by game/type/due status, see totals and due counts, review the first due item with Show answer → Again/Know, remove saved items plus associated review state, and open the relevant game reader. Quest/line restoration is not claimed yet.
- Mobile reader/saved ergonomics MVP: phone/tablet game routes are reader-first, the topbar can wrap without fixed-height clipping, the fixed reader dock reserves safe bottom space, and `/saved` filters/actions are touch-sized with no page-level horizontal overflow.
- Static reviewer demo at `/demo` and `/demo/`: summarizes the real Wuwa connector, honest non-Wuwa sample readers, browser-local saved/review library, TSV export, mic-free Voice shadow practice, and deferred account/cloud/profile/share-card features without adding live claims.
- Browser-local due review queue persists in `localStorage` key `glearning-review-v1`: saved lines/terms with no review state are due now, `Again` schedules about 10 minutes out, and `Know` grows a simple local interval.
- Audio playback with local MP3 preference for bundled Wuthering Waves voice files; sample games intentionally have no playable source clips unless a connector is added, and audio-only controls are disabled or labeled unavailable when the current quest/sample has no playable clips.
- Mic-free Voice tab / shadow practice MVP in the reader right rail: every dialogue card has a `Shadow practice` button, selected lines get deterministic chunking plus a session-only repetition counter, source audio can be replayed through the existing player when available, and no repetition count is persisted.
- Launch safety boundary for voice/pronunciation: no microphone permission, no recording, no uploads, no speech recognition, no TTS/generated audio, and no pronunciation score/rating/accuracy claim.
- Study panel with glossary terms, saved term toggles, and a lightweight saved line/term review card.
- Richer deterministic language help MVP: a dialogue-line button opens local source-term matches with `english` / `chinese` / `both` match labels, up to 8 local key words/chunks, up to 4 transparent grammar pattern cards, and one reading strategy in the Study panel.
- Source panel for manual Fandom/BWIKI/Kuro source swapping.
- TSV export is the current launch export/share MVP for Anki or spreadsheet review.
- Share cards, profiles, accounts, cloud sync, and public progress pages are explicitly deferred beyond launch.
- SPA redirects so direct game routes work on Cloudflare Pages.

## Tech Stack

- React 19
- TypeScript
- Vite
- Cloudflare Pages
- Cloudflare Pages Functions
- Wrangler

Important paths:

```text
src/App.tsx                  Main React app, routes, reader shell, landing page, saved library
src/styles.css               Visual system, themes, landing/reader styling
src/gameData.ts              Multi-game metadata, connector capabilities/helpers, palettes, sample dialogue, glossary
src/types.ts                 Shared client data types
functions/api/quest.js       Wuthering Waves quest parser and pairer
functions/api/main-quests.js Main-quest catalogue API
functions/api/audio.js       Audio helper endpoint
functions/audio-manifest.js  Bundled MP3 manifest for Functions
public/audio/manifest.json   Public audio manifest
public/_redirects            SPA route fallback for Cloudflare Pages
```

## Local Development

Install dependencies:

```bash
npm install
```

Run Vite only:

```bash
npm run dev
```

Use this when you only need the frontend shell. Cloudflare Pages Functions are not available in plain Vite dev mode.

Run the full Pages environment:

```bash
npm run pages:dev
```

Use `pages:dev` when testing `/api/quest`, `/api/main-quests`, audio playback availability, or direct `/saved` and game routes.

Build for production:

```bash
npm run build
```

## Deployment

The Wrangler deploy script targets the Cloudflare Pages project `glearning`:

```bash
npm run deploy
```

The production site is served from:

```text
https://glearning.pages.dev
```

If deploying from a fresh Cloudflare account, create the Pages project first:

```bash
npx wrangler pages project create glearning --production-branch main
npm run deploy
```

Cloudflare Pages settings for Git integration:

- Build command: `npm run build`
- Build output directory: `dist`
- Functions directory: `functions`
- Production branch: `main`

## API Examples

Main quest catalogue:

```text
GET /api/main-quests
```

Default Wuthering Waves pair through explicit default URLs:

```text
GET /api/quest?enUrl=https%3A%2F%2Fwutheringwaves.fandom.com%2Fwiki%2FUtterance_of_Marvels%3A_I&zhUrl=auto
```

Manual BWIKI pairing:

```text
GET /api/quest?enUrl=<fandom-url>&zhUrl=<bwiki-task-review-url>
```

Manual Kuro pairing:

```text
GET /api/quest?enUrl=<fandom-url>&zhUrl=<wiki.kurobbs.com-mc-item-url>
```

## Launch Smoke Checklist

Use this checklist for launch-closeout smoke validation.

### 1) Build

```bash
npm run build
```

### 2) Local Pages runtime (Functions + SPA routing)

```bash
npm run pages:dev
```

Expected: `pages:dev` should not emit the Wrangler `_redirects` infinite-loop warning, and `/api/*` function routes must remain unshadowed by SPA redirects.

In another terminal while `pages:dev` is running:

```bash
curl -i http://127.0.0.1:8788/
curl -i http://127.0.0.1:8788/demo
curl -i http://127.0.0.1:8788/demo/
curl -i http://127.0.0.1:8788/saved
curl -i http://127.0.0.1:8788/saved/
curl -i http://127.0.0.1:8788/games/wuwa
curl -i http://127.0.0.1:8788/games/cyberpunk
curl -s http://127.0.0.1:8788/api/main-quests | node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(0,'utf8'));console.log('quests',p.quests?.length)"
curl -s "http://127.0.0.1:8788/api/quest?enUrl=https%3A%2F%2Fwutheringwaves.fandom.com%2Fwiki%2FUtterance_of_Marvels%3A_I&zhUrl=auto" | node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(0,'utf8'));const clips=(p.lines||[]).filter(l=>l.audioUrl);console.log({paired:p.meta?.pairedCount,audioCount:p.meta?.audioCount,firstAudioUrl:clips[0]?.audioUrl||null,hasLocalAudio:clips.some(l=>String(l.audioUrl||'').startsWith('/audio/'))})"
```

### 3) API catalogue + live quest parse checks

- `/api/main-quests` should return a populated quest list.
- `Utterance of Marvels: I` with `zhUrl=auto` should return paired lines and audio metadata.
- Audio validation should be based on payload fields (`meta.audioCount`, line `audioUrl`, and whether any `audioUrl` starts with `/audio/`), not on a hard-coded filename.

### 4) Voice/pronunciation launch-safety checks

- Run `grep -RInE 'getUserMedia|MediaRecorder|SpeechRecognition|webkitSpeechRecognition' src functions`; it should return no matches.
- On `/games/wuwa`, open the Voice tab and confirm the default copy says no microphone, recording, upload, speech recognition, pronunciation score, TTS, or generated audio.
- Click `Shadow practice` on a Wuthering Waves line with a source clip; the Voice tab should select the line, show deterministic chunks, reuse the existing source audio player, and existing playback should still mark the line as played.
- On `/games/cyberpunk`, the Voice tab should show the same safety boundary; selected sample lines should say there is no source clip and no generated audio/scoring.
- Click `I repeated this line aloud`; the session reps number may increase, but it must not create a new localStorage key or change saved/review storage schemas.

### 5) Production Pages smoke after deploy

After `npm run deploy`, run the same route/API checks against the preview URL and the production alias:

```bash
BASE_URL=https://glearning.pages.dev
curl -i "$BASE_URL/"
curl -i "$BASE_URL/demo"
curl -i "$BASE_URL/demo/"
curl -i "$BASE_URL/saved"
curl -i "$BASE_URL/saved/"
curl -i "$BASE_URL/games/wuwa"
curl -i "$BASE_URL/games/cyberpunk"
curl -i "$BASE_URL/index.html"
curl -i "$BASE_URL/audio/manifest.json"
curl -s "$BASE_URL/api/main-quests" | node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(0,'utf8'));console.log('quests',p.quests?.length)"
curl -s "$BASE_URL/api/quest?enUrl=https%3A%2F%2Fwutheringwaves.fandom.com%2Fwiki%2FUtterance_of_Marvels%3A_I&zhUrl=auto" | node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(0,'utf8'));console.log({paired:p.meta?.pairedCount,audioCount:p.meta?.audioCount,lines:p.lines?.length})"
```

For the 2026-05-04 Plus closeout deploy, preview `https://6ef1b11f.glearning.pages.dev` and `https://glearning.pages.dev` both passed these checks.

### 6) Manual UI smoke

- Wuwa route shows live status; sample-game routes show honest sample/connector-planned status.
- Sample/status honesty copy is visible where expected.
- Audio controls behave honestly (available when clips exist; disabled/unavailable when clips do not).
- Study/save/review/language-help flows still work; language help remains fully local and deterministic with no dictionary API, AI parser, external lookup, or persistence side effects.
- `/saved` opens from the Home ★ control, shows local totals/due counts, can filter saved lines/terms across games, can Show answer → Again/Know on the first due review, and can remove a saved item plus its review state.
- `/saved` can download a versioned local JSON snapshot of existing browser-local GLearning data. The snapshot is export-only and explicitly claims no account, no cloud sync, no public profile, no share cards, and no restore/import yet.
- At phone/tablet widths, `/games/wuwa` and sample game routes show the reader before rail panels; the topbar wraps without clipping; the bottom reader dock stays within the viewport and does not cover the final reader content; `/saved` filters/cards/actions remain touch-friendly without horizontal page overflow.
- Export panel shows defer copy: TSV-only MVP; share cards/profiles/accounts/cloud sync/public pages deferred; saved/review data local to browser.
- No visible profile/account/share controls that silently no-op.

## Regression Checks

After UI or API changes, verify at least these production behaviors:

- `/` returns the landing page.
- `/demo` and `/demo/` return the static reviewer walkthrough through explicit Pages fallbacks, without reintroducing a broad `/*` redirect.
- `/saved` and `/saved/` return the SPA saved library route through explicit Pages fallbacks, without reintroducing a broad `/*` redirect.
- `/games/wuwa` returns the live Wuthering Waves reader route.
- `/games/cyberpunk` or another sample game route returns through the SPA fallback and is labeled as sample reader status (not live connector).
- `/api/main-quests` returns a populated quest list.
- `Utterance of Marvels: I` with `zhUrl=auto` resolves to Kuro `万象新声·上`, includes paired lines, and includes source/local audio URLs when available.
- `Utterance of Marvels: II` with `zhUrl=auto` resolves to Kuro `万象新声·下`, with paired lines and local/source audio URLs when available.
- Explicit BWIKI URLs still work for the default pair.
- Per-line study state persists locally: reveal or master a line, reload the route, and confirm `localStorage` contains a `glearning-study-v1:*` key with the same played/revealed/mastered counts. Progress is browser-local and not account-synced.
- Saved dialogue lines and glossary terms persist locally: save a line and a glossary term, change routes or reload, and confirm `localStorage.glearning-saves-v1` keeps those items separated by `gameId` and `questKey`. The ReaderDock saved count reflects the active game, while the Study panel list reflects the active quest.
- Global saved library works locally: open `/saved`, confirm saved items across games render with game/type/quest/source metadata when available and fallback quest labels for old saved items, search/filter by game/type/due, and use Open game without expecting exact quest/line restoration.
- Local snapshot export works without accounts or network calls: seed `localStorage` with `glearning-saves-v1`, `glearning-review-v1`, at least one `glearning-study-v1:*` key, `glearning-density`, and `glearning-palette-*`; open `/saved`; click `Download local JSON snapshot`; confirm the JSON has `app: "GLearning"`, `version: 1`, false claims for account/cloudSync/publicProfile/shareCards/restoreImport, expected saved/review/study/preference counts, no API calls, and no new `localStorage` keys created by export. There is no restore/import yet.
- Local saved-item review queue works without an account: after saving a line or glossary term, confirm it appears as due in the ReaderDock, Study panel, and `/saved` because it has no `glearning-review-v1` state; use `Show answer` → `Again` and confirm the item is scheduled about 10 minutes out; reload and confirm `glearning-review-v1` persists; un-save or remove the item and confirm its review-state entry is removed.
- Contextual language help is local and deterministic: click `Language help` on a dialogue card, confirm the Study panel opens with the selected speaker/context, EN/ZH snippets, source glossary matches labeled by match source (`english`, `chinese`, or `both`), up to 8 key words/chunks from quest terms plus the built-in local list, up to 4 grammar pattern cards, one reading strategy, and `Clear language help`; confirm it does not change played/revealed/mastered/saved/review local state and does not call fetch, AI, an external dictionary, or persistence APIs.
- Audio MVP honesty: on a Wuthering Waves quest with bundled/source clips, `Audio only` remains available and filters to playable dialogue lines; on sample games or any quest with `audioCount=0`, topbar/Study/ReaderDock audio-only controls are disabled or labeled unavailable, and the reader does not become blank from a stale audio-only setting. Empty reader states should explain no audio clips, no audio lines matching filters, no dialogue matching filters, or no loaded dialogue as applicable.
- Landing/reader honesty: Wuthering Waves is the only live source connector at launch; other games are sample-reader pages with real study-loop UX but no live source connector or playable source clips yet.
- Demo route honesty: `/demo` is a static overview; it must mention Wuwa-only live connector status, non-Wuwa sample-reader status, browser-local saved/review, TSV export, mic-free shadow practice, deferred account/cloud/share/profile claims, and no API or saved/review writes during render.
- Mobile ergonomics: at phone widths, game routes remain reader-first before source/study rails, the fixed reader dock has safe bottom clearance, and `/saved` filters/cards/actions do not create horizontal page overflow.
- Voice practice honesty: the reader Voice tab is mic-free shadow practice only; there is no recording, pronunciation scoring, TTS, generated audio, upload, or account-backed voice feature in the launch scope.
- Planned controls are explicitly disabled/labeled (for example: `Daily timer planned`, `Settings/profile planned`, and non-live chapter routing marked planned) so visible controls do not silently no-op. The Home ★ saved control is active and routes to `/saved`.

## Content And Rights Note

GLearning fetches source pages on demand for personal study. Fandom, Kuro Wiki, BWIKI, game dialogue, names, audio, and related assets belong to their respective communities and rights holders. Do not publish a copied full dialogue database as bundled app data. Keep live connectors source-aware and follow source-site terms, licences, and takedown requirements.

## Roadmap

- Add real connectors for more games after confirming source availability and rights constraints; once added, update each game page from sample-reader status to live connector status.
- Improve the `/saved` Global Saved & Review Library MVP with richer quiz modes, exact quest/line restoration, and better scheduling controls.
- Add cross-device sync only after accounts/cloud storage exist; current saved/review data remains browser-local.
- Keep launch export/share scope to TSV plus local JSON snapshot download; defer share cards, profiles, accounts, cloud sync, public progress pages, and restore/import until those systems exist.
- Add voice recording and pronunciation scoring only after playback coverage, privacy, rights, and evaluation constraints are clear; current launch scope remains mic-free shadow practice with source clips only when available.
- Expand contextual language help beyond the richer deterministic MVP with a full dictionary, AI grammar parser, or external lookup only after source, cost, privacy, and accuracy constraints are clear.
- Continue refining mobile reader ergonomics after the CSS-only reader/saved MVP.
- Add screenshots or short demo clips to the repository docs.
