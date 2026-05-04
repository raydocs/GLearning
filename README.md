# GLearning

GLearning is a game-dialogue English learning site. It turns familiar quest dialogue into a bilingual reader with game-specific themes, source-aware pairing, audio playback, glossary review, and TSV export.

Live site: <https://glearning.pages.dev>

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md)

## What Is Live Today

The production app has two layers:

- A multi-game landing page with per-game routes, palettes, decorative motifs, and sample study content for eight games.
- A real Wuthering Waves reader backed by live wiki/API data, not mock dialogue.

Wuthering Waves is currently the only game with a live data connector. The other game pages use curated prototype dialogue and glossary data so the theme, route, reader, and export flows are already in place without pretending that a live connector exists.

## Supported Game Pages

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

- Multi-game landing page with per-game theme tabs.
- Per-game reader route and palette selection.
- Live Wuthering Waves quest catalogue from `/api/main-quests`.
- Wuthering Waves English/Fandom + Chinese/Kuro/BWIKI pairing through `/api/quest`.
- Dialogue stream with speaker labels, Chinese reveal mode, search, speaker filter, density controls, and audio-only mode.
- Audio playback with local MP3 preference for bundled Wuthering Waves voice files.
- Study panel with glossary terms.
- Source panel for manual Fandom/BWIKI/Kuro source swapping.
- TSV export for Anki or spreadsheet review.
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
src/App.tsx                  Main React app, routes, reader shell, landing page
src/styles.css               Visual system, themes, landing/reader styling
src/gameData.ts              Multi-game metadata, palettes, sample dialogue, glossary
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

Use `pages:dev` when testing `/api/quest`, `/api/main-quests`, audio behavior, or direct game routes.

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

## Regression Checks

After UI or API changes, verify at least these production behaviors:

- `/` returns the landing page.
- `/games/wuwa` returns the live Wuthering Waves reader route.
- `/games/cyberpunk` or another sample game route returns through the SPA fallback.
- `/api/main-quests` returns 56 quests.
- `Utterance of Marvels: I` with `zhUrl=auto` resolves to Kuro `万象新声·上`, includes local MP3 URLs, and keeps the first bundled MP3 at `/audio/vo-hlmq-xz-3-9.mp3`.
- `Utterance of Marvels: II` with `zhUrl=auto` resolves to Kuro `万象新声·下`, with paired lines and local MP3 URLs.
- Explicit BWIKI URLs still work for the default pair.

## Content And Rights Note

GLearning fetches source pages on demand for personal study. Fandom, Kuro Wiki, BWIKI, game dialogue, names, audio, and related assets belong to their respective communities and rights holders. Do not publish a copied full dialogue database as bundled app data. Keep live connectors source-aware and follow source-site terms, licences, and takedown requirements.

## Roadmap

- Add real connectors for more games after confirming source availability and rights constraints.
- Add persisted saved words/bookmarks across game routes.
- Add spaced review mode for glossary and saved lines.
- Improve mobile reader ergonomics.
- Add screenshots or short demo clips to the repository docs.
