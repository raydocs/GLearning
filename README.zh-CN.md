# GLearning 中文文档

GLearning 是一个面向游戏剧情的英语学习站点。它把玩家熟悉的任务台词做成双语阅读器，支持游戏专属主题、真实来源配对、语音播放、术语表学习和 TSV 导出。

线上地址：<https://glearning.pages.dev>

英文文档：[README.md](./README.md)

## 当前已经上线的内容

生产站点现在分成两层：

- 多游戏落地页：每个游戏都有自己的路由、配色、装饰元素和示例学习内容。
- 鸣潮真实阅读器：使用实时 wiki/API 数据，不是 mock 数据。

目前只有鸣潮接入了真实数据源。其他游戏页面先使用原型里的示例台词和术语表，用来承载完整的页面主题、路由、阅读器和导出流程；这些页面不会伪装成已经有真实 API。

## 支持的游戏页面

每个游戏都有独立路由和视觉风格：

- `/games/wuwa` — Wuthering Waves / 鸣潮
- `/games/genshin` — Genshin Impact / 原神
- `/games/starrail` — Honkai: Star Rail / 崩坏：星穹铁道
- `/games/zzz` — Zenless Zone Zero / 绝区零
- `/games/arknights` — Arknights / 明日方舟
- `/games/honkai3` — Honkai Impact 3rd / 崩坏3
- `/games/cyberpunk` — Cyberpunk 2077 / 赛博朋克 2077
- `/games/witcher3` — The Witcher 3 / 巫师3：狂猎

落地页和阅读器借鉴了 Glearning2 原型中的沉浸式方向：游戏切换条、大海报 hero、氛围背景、星星/音符、危险条、边角 chrome，以及每个游戏独立的配色主题。

## 鸣潮真实数据流程

鸣潮阅读器按需读取官方/社区来源文本，不使用 AI 翻译台词。

默认配对是：

- 英文：`https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I`
- 中文：`https://wiki.biligame.com/wutheringwaves/任务回顾/万象新声·上`

当用户从主线任务列表选择任务时，前端会发送 `zhUrl=auto`。Cloudflare Function 会执行以下流程：

- 从 Fandom MediaWiki API 获取英文任务 wikitext。
- 从 Fandom 的语言元数据中提取简体中文标题。
- 在 Kuro Wiki 目录 `fid=1249` 中搜索对应主线任务台词条目。
- 获取匹配到的 Kuro 剧情对话数据。
- 解析说话人、台词、选项和 Fandom 音频引用。
- 用动态规划对齐英文和中文台词，允许某一侧缺行时跳过。
- 优先使用已经打包到站点里的本地 MP3，同时保留来源音频 URL。
- 返回对齐后的台词、术语表、警告、来源 URL、统计数量和音频信息。

手动中文来源仍然支持：

- BWIKI 任务回顾页面。
- Kuro Wiki `wiki.kurobbs.com/mc/item/<id>` 页面。

## 功能列表

- 多游戏落地页和顶部游戏切换条。
- 每个游戏独立阅读器路由和配色选择。
- `/api/main-quests` 提供鸣潮主线任务列表。
- `/api/quest` 提供鸣潮 Fandom 英文 + Kuro/BWIKI 中文配对。
- 台词流支持说话人、隐藏中文、搜索、说话人筛选、阅读密度和仅看有语音台词。
- 语音播放优先使用本地打包的鸣潮 MP3。
- Study 面板展示术语表。
- Sources 面板支持手动替换 Fandom、BWIKI 或 Kuro 来源。
- Export 面板可以导出适合 Anki 或表格复习的 TSV。
- Cloudflare Pages 上支持直接访问 `/games/...` 路由。

## 技术栈

- React 19
- TypeScript
- Vite
- Cloudflare Pages
- Cloudflare Pages Functions
- Wrangler

关键路径：

```text
src/App.tsx                  React 主应用、路由、阅读器外壳、落地页
src/styles.css               视觉系统、主题、落地页和阅读器样式
src/gameData.ts              多游戏元数据、配色、示例台词、术语表
src/types.ts                 前端共享类型
functions/api/quest.js       鸣潮任务解析与中英配对
functions/api/main-quests.js 主线任务目录 API
functions/api/audio.js       音频辅助接口
functions/audio-manifest.js  Functions 使用的本地 MP3 manifest
public/audio/manifest.json   前端可访问的音频 manifest
public/_redirects            Cloudflare Pages 的 SPA 路由回退
```

## 本地开发

安装依赖：

```bash
npm install
```

只启动 Vite 前端：

```bash
npm run dev
```

如果只看前端外壳，可以使用这个命令。注意：普通 Vite dev 不会启动 Cloudflare Pages Functions。

启动完整 Pages 环境：

```bash
npm run pages:dev
```

测试 `/api/quest`、`/api/main-quests`、音频行为或直接访问游戏路由时，应该使用 `pages:dev`。

生产构建：

```bash
npm run build
```

## 部署

Wrangler 部署脚本现在指向 Cloudflare Pages 项目 `glearning`：

```bash
npm run deploy
```

生产站点地址：

```text
https://glearning.pages.dev
```

如果是新的 Cloudflare 账号，需要先创建 Pages 项目：

```bash
npx wrangler pages project create glearning --production-branch main
npm run deploy
```

Cloudflare Pages Git 集成建议配置：

- Build command：`npm run build`
- Build output directory：`dist`
- Functions directory：`functions`
- Production branch：`main`

## API 示例

主线任务目录：

```text
GET /api/main-quests
```

鸣潮默认任务自动中文配对：

```text
GET /api/quest?enUrl=https%3A%2F%2Fwutheringwaves.fandom.com%2Fwiki%2FUtterance_of_Marvels%3A_I&zhUrl=auto
```

手动 BWIKI 配对：

```text
GET /api/quest?enUrl=<fandom-url>&zhUrl=<bwiki-task-review-url>
```

手动 Kuro 配对：

```text
GET /api/quest?enUrl=<fandom-url>&zhUrl=<wiki.kurobbs.com-mc-item-url>
```

## 回归检查

修改 UI 或 API 后，至少检查这些行为：

- `/` 返回落地页。
- `/games/wuwa` 返回鸣潮真实阅读器。
- `/games/cyberpunk` 或其他示例游戏路由能通过 SPA fallback 正常返回。
- `/api/main-quests` 返回 56 个任务。
- `Utterance of Marvels: I` 使用 `zhUrl=auto` 时解析到 Kuro `万象新声·上`，包含本地 MP3 URL，首个打包 MP3 仍是 `/audio/vo-hlmq-xz-3-9.mp3`。
- `Utterance of Marvels: II` 使用 `zhUrl=auto` 时解析到 Kuro `万象新声·下`，并保留配对台词和本地 MP3。
- 显式 BWIKI URL 仍能用于默认任务配对。

## 内容和版权说明

GLearning 是按需读取来源页面的个人学习工具。Fandom、Kuro Wiki、BWIKI、游戏台词、名称、音频和相关素材属于各自社区和权利方。不要把完整复制的台词数据库打包发布为应用数据。新增真实连接器时，应保留来源感知逻辑，并遵守来源站点的条款、许可证和下架要求。

## 后续计划

- 在确认来源可用性和版权边界后，为更多游戏增加真实连接器。
- 增加跨游戏持久化生词和书签。
- 增加术语表和收藏句子的间隔复习模式。
- 优化移动端阅读体验。
- 给仓库文档补充截图或短演示视频。
