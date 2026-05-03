# GLearning

A personal Wuthering Waves quest reader that pairs a Fandom English quest page with matching Chinese wiki dialogue. Main-quest auto pairing uses the Kuro Wiki quest catalogue; explicit BWIKI task-review URLs still work for the default/manual source path. It uses the original wiki text and Fandom audio metadata; it does not AI-translate the dialogue.

Live deployment: <https://wuwa-bilingual-study.pages.dev>

## What It Does

- Fetches Fandom quest wikitext through the public MediaWiki API.
- Resolves auto Chinese matches from the Kuro Wiki quest catalogue and fetches Kuro story dialogue entries.
- Fetches explicit BWIKI task-review wikitext through the public raw page endpoint.
- Parses dialogue, player choices, speakers, and Fandom audio files.
- Aligns English and Chinese lines with a dynamic-programming pass that can skip lines missing from one source.
- Plays Fandom voice clips when the quest page exposes `{{A|...ogg}}` audio references.
- Exports an Anki-friendly TSV with English, Chinese, speaker, audio URL, and alignment confidence.

The default pair is:

- English: `https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I`
- Chinese: `https://wiki.biligame.com/wutheringwaves/任务回顾/万象新声·上`

Selecting a quest from the main-quest dropdown sends `zhUrl=auto`, which searches Kuro Wiki catalogue `fid=1249` and follows the matching quest-dialogue entry.

## Local Development

```bash
npm install
npm run pages:dev
```

Open the local URL printed by Wrangler. Use `pages:dev` instead of plain `npm run dev` when you need `/api/quest`, because the API is a Cloudflare Pages Function.

## Cloudflare Pages Deploy

### Git Integration

1. Push this directory to a GitHub repository.
2. In Cloudflare, create a Pages app from the repo.
3. Use `npm run build` as the build command.
4. Use `dist` as the build output directory.
5. Keep the `functions` directory at the project root so `/api/quest` deploys with the site.

### Wrangler Deploy

The existing Wrangler deploy script still targets the live Cloudflare Pages project `wuwa-bilingual-study`.

```bash
npm install
npm run deploy
```

Wrangler will ask you to log in if your Cloudflare account is not already authenticated.

## Content Note

This app fetches source pages on demand for personal study. Fandom, Kuro Wiki, and BWIKI content belongs to their respective communities and rights holders. If you publish the site publicly, avoid bundling or redistributing a copied full dialogue database; keep it as an on-demand reader and follow the source sites' terms and licenses.
