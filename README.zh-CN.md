# GLearning 中文文档

GLearning 是一个面向游戏剧情的英语学习站点。它把玩家熟悉的任务台词做成双语阅读器，支持游戏专属主题、真实来源配对、语音播放、免麦克风 shadow practice、术语表学习和 TSV 导出。

线上地址：<https://glearning.pages.dev>

英文文档：[README.md](./README.md)

## 当前已经上线的内容

生产站点现在分成四个 launch surface：

- 多游戏落地页：每个游戏都有自己的路由、配色、装饰元素和示例学习内容。
- 静态 `/demo` 评审路线：概览当前真实可用范围和明确延期的账号/云端/分享/语音能力。
- 鸣潮真实阅读器：使用实时 wiki/API 数据，不是 mock 数据。
- 浏览器本地 `/saved` 收藏/复习库：跨游戏保存台词、术语和到期复习卡片，没有账号或云同步。

目前只有鸣潮接入了真实数据源。其他游戏页面先使用原型里的示例台词和术语表，用来承载完整的页面主题、路由、阅读器和导出流程；这些页面不会伪装成已经有真实 API。

连接器就绪架构现在写在 `src/gameData.ts` 的显式类型化元数据里：每个游戏都会声明是否允许调用任务 API、任务目录 API 和来源语音连接器。目前只有鸣潮开启这些 live 能力；所有非鸣潮游戏仍明确是 sample reader，没有新增任何外部真实来源。

语音/发音练习在 launch 阶段是安全边界明确的 MVP：Voice 标签页只做免麦克风 shadow practice。用户可以选择台词，有来源音频时只播放来源音频，阅读确定性的分块提示，并用本次会话内计数记录自己私下跟读了几次；不会请求麦克风、录音、上传、调用语音识别、生成 TTS/新音频，也不会给发音打分、评级或声称准确率。

## 支持的游戏页面

评审演示路由：

- `/demo` — 静态 launch walkthrough，说明鸣潮 live reader、非鸣潮 sample reader、浏览器本地收藏/复习库、TSV 导出、免麦克风 shadow practice，以及账号/云端/profile/share-card 等延期项。页面渲染时不应请求任务 API，也不应写入收藏/复习存储。

本地收藏/复习库路由：

- `/saved` — 浏览器本地保存的台词、术语和第一个到期复习卡片；使用 `glearning-saves-v1` 和 `glearning-review-v1`，没有账号或云同步。

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
- `src/gameData.ts` 中的类型化连接器元数据/助手函数负责 gate live 任务/目录 API；非鸣潮路由使用 `createSampleQuest(activeGame)`，不会调用鸣潮 live API。
- `/api/main-quests` 提供鸣潮主线任务列表。
- `/api/quest` 提供鸣潮 Fandom 英文 + Kuro/BWIKI 中文配对。
- 台词流支持说话人、隐藏中文、搜索、说话人筛选、阅读密度和仅看有语音台词。
- 语音播放优先使用本地打包的鸣潮 MP3。
- Reader 右侧 Voice 标签页提供免麦克风 shadow practice：每张台词卡都有 `Shadow practice` 按钮，选中的台词会显示确定性分块、本次会话内的跟读次数计数；有来源音频时复用现有播放器，计数不写入持久化存储。
- 语音/发音安全边界：没有麦克风权限、没有录音、没有上传、没有语音识别、没有 TTS/生成音频，也没有发音分数/评级/准确率声明。
- Study 面板展示术语表。
- Sources 面板支持手动替换 Fandom、BWIKI 或 Kuro 来源。
- Export 面板可以导出适合 Anki 或表格复习的 TSV。
- Cloudflare Pages 上支持直接访问 `/demo`、`/saved` 和 `/games/...` 路由。
- 静态 `/demo` / `/demo/` 评审页：诚实说明当前只有鸣潮是真实连接器，其他游戏是 sample reader，收藏/复习是浏览器本地，分享范围是 TSV，Voice 是免麦克风 shadow practice，账号/云端/profile/share-card 延期。
- 移动端阅读器/收藏库体验 MVP：手机和平板宽度下，游戏路由优先显示阅读器，顶部栏可安全换行，底部阅读器 dock 预留安全间距，`/saved` 的筛选、卡片和操作按钮适合触控且不会造成页面级横向滚动。

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
src/gameData.ts              多游戏元数据、连接器能力/助手函数、配色、示例台词、术语表
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
- `/demo` 和 `/demo/` 通过显式 Pages fallback 返回静态评审页，不要重新加入宽泛的 `/*` redirect。
- `/saved` 和 `/saved/` 返回本地收藏/复习库，并提供版本化本地 JSON 快照下载；这是纯本地导出，明确没有账号、云同步、公开主页、分享卡片，也还没有恢复/导入。
- `/games/wuwa` 返回鸣潮真实阅读器。
- 手机宽度下，`/games/wuwa` 和示例游戏路由应先显示阅读器再显示左右侧栏；底部阅读器 dock 不遮住末尾内容；`/saved` 的筛选框、卡片和操作按钮不产生页面级横向溢出。
- `/demo` 在手机宽度下不应产生横向溢出；文案应包含鸣潮-only live connector、非鸣潮 sample-reader honesty、浏览器本地 saved/review、TSV export、免麦克风 shadow practice，以及延期的 account/cloud/share/profile claims。
- `/api/main-quests` 返回 56 个任务。
- `Utterance of Marvels: I` 使用 `zhUrl=auto` 时解析到 Kuro `万象新声·上`，包含本地 MP3 URL，首个打包 MP3 仍是 `/audio/vo-hlmq-xz-3-9.mp3`。
- `Utterance of Marvels: II` 使用 `zhUrl=auto` 时解析到 Kuro `万象新声·下`，并保留配对台词和本地 MP3。
- 显式 BWIKI URL 仍能用于默认任务配对。
- 本地快照导出回归：预先写入 `glearning-saves-v1`、`glearning-review-v1`、至少一个 `glearning-study-v1:*`、`glearning-density`、`glearning-palette-*`；打开 `/saved` 点击 `Download local JSON snapshot`；确认 JSON 中 `app` 为 `GLearning`、`version` 为 `1`，account/cloudSync/publicProfile/shareCards/restoreImport 均为 `false`，计数符合预期，导出过程不调用 API，也不新增 localStorage key。
- 语音/发音安全回归：运行 `grep -RInE 'getUserMedia|MediaRecorder|SpeechRecognition|webkitSpeechRecognition' src functions` 应无匹配；`/games/wuwa` 和 `/games/cyberpunk` 的 Voice 标签页都应明确 no mic/no recording/no upload/no speech recognition/no score/no TTS/generated audio；点击台词卡的 `Shadow practice` 应选择台词并显示分块；鸣潮有来源音频的台词复用现有播放器，示例游戏说明没有来源片段且不会生成音频或评分；`I repeated this line aloud` 只增加本次会话计数，不新增 localStorage key。

## 内容和版权说明

GLearning 是按需读取来源页面的个人学习工具。Fandom、Kuro Wiki、BWIKI、游戏台词、名称、音频和相关素材属于各自社区和权利方。不要把完整复制的台词数据库打包发布为应用数据。新增真实连接器时，应保留来源感知逻辑，并遵守来源站点的条款、许可证和下架要求。

## 后续计划

- 在确认来源可用性和版权边界后，为更多游戏增加真实连接器。
- 继续保持收藏/复习/本地 JSON 快照为浏览器本地能力；账号、云同步、公开主页、分享卡片和恢复/导入都等对应系统存在后再做。
- 增加术语表和收藏句子的间隔复习模式。
- 在已经完成的 CSS-only 移动端阅读器/收藏库 MVP 基础上继续优化移动端体验。
- 给仓库文档补充截图或短演示视频。
