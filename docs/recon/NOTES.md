# ExamCrafts 逆向 — 断点交接说明

状态：**进行中，已暂停**（用户主动停止，去核对另一个对话的结果）
最后更新：本会话结束时

---

## 1. 目标

`https://examcrafts.com/` — 中文在线考试备考平台（CET 四六级 / TEM 专四专八 / 考研数学）。
用户目标：**想做一个类似的站点**，所以逆向目标是「功能 + 架构 + 后端契约」，而不是找漏洞。

---

## 2. 已完成

### 2.1 站点侦察 ✅

- 反爬：**腾讯 EdgeOne**（`eo-log-uuid` / `eo-cache-status` / `eo-nel` 响应头）。
  纯 curl 会被 JS 挑战拦截，返回 **988 字节**的挑战页（`EO_Bot_Ssid` 变量）。
  **必须用真浏览器**。
- 前端栈：**Vue 3 + Vite**，SPA，`<div id="app">` 挂载。
- UI 框架：**daisyUI**（`<html data-theme="cupcake">` 是 daisyUI 的主题命名法）+ Tailwind。
- 字体：Noto Serif（Google Fonts）。
- PWA：有 `manifest.json`，`display: standalone`。
- CDN：nginx + EdgeOne。

### 2.2 资源清单 ✅（部分）

从 `index.html` 拿到的核心资源：
```
/assets/index-C-mmH9Q6.js    362 KB  ← 核心（路由/API/状态/加密）
/assets/vendor-Bg96V-a1.js   113 KB
/assets/index-CILwo6Dd.css   249 KB
```

路由级懒加载 chunk：**共 52 个**，清单在 `chunks.txt`。
已抓到 **18 个**（含 core），**还差 34 个**。

### 2.3 后端契约（初步）✅

从核心 bundle 直接抽到的 API 路径：
```
/api/auth/login/            /api/auth/register/
/api/auth/logout/           /api/auth/profile/
/api/auth/token/refresh/    ← JWT
/api/exams/decrypt-key      ← 试卷内容加密下发（关键设计点）
/api/announcements/
/api/common/heartbeat/      /api/common/status/
/api/common/security/report
/api/community/notifications/read/
/api/feedback/              /api/feedback/history/
/api/feedback/mark-read/
```

**推断**：尾部斜杠 + `token/refresh/` = **Django REST Framework + SimpleJWT** 的典型约定。
发现后台域名：`https://admin.examcrafts.com`

### 2.4 功能地图（来自 chunk 命名）✅

```
认证        AuthView
CET         CETSelectView / CETExamView / CETExamAnswerView / CETExamResultView
            CETExamAnalysisView / CETHistoryView
CET 专项    CETTopicSelectView / CETTopicExamView / CETTopicAnswerView
            CETTopicResultView / CETTopicAnalysisView / CETTopicHistoryView
TEM         同上全套（TEM*，6+6 个视图）
考研        KaoyanExamListView / KaoyanLearningView
            KaoyanMathGraph / KaoyanMathSubjects
教材        TextbookChaptersView / TextbookPracticeView
词汇        VocabularyView / VocabularyBookView / VocabularyReviewView
            VocabularyContextReviewView / VocabularyArticleListView
错题本      MistakeCollectionView / MistakeCollectionDetailView
笔记        NotesView / NoteEditorView / NoteDetailView
知识图谱    KnowledgeGraph / KnowledgeSandboxHomeView / KnowledgeSandboxMathView
其他        HomeView / SubjectsView / ProfileView / LeaderboardView
            MessageWallView / NotFoundView / PlaceholderExam
```

---

## 3. 环境与工具（本次已搭好，但已清理）

- 用 **真 Chrome + CDP** 绕过 EdgeOne；驱动脚本已写好并验证可用：
  - `cdp.mjs` — 极简 CDP 客户端
  - `fetch-all.mjs` — 导航 + 解挑战 + 从页面 origin 拉全部 bundle
  - `fetch-retry.mjs` — 失败 chunk 的退避重试（**上次跑到一半被中断**）
- 采集要点：必须在**页面上下文里 `fetch()`**，才能继承 origin 和已解出的挑战态。
  直接 curl 一律失败。
- 调试用 Chrome 实例**已关闭**，临时 profile 已删（它带着
  `--remote-allow-origins=*`，不宜常驻）。

### 恢复环境的命令

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9333 --remote-allow-origins='*' \
  --user-data-dir=/tmp/ec-chrome-profile \
  --no-first-run --no-default-browser-check --disable-gpu \
  --window-size=1440,900 about:blank &

# 然后
cd <本目录> && node fetch-all.mjs && node fetch-retry.mjs
```

---

## 4. 未完成（后续 TODO）

1. 补抓剩余 **34 个 chunk**（跑 `fetch-retry.mjs`，注意退避，别触发风控）
2. 用 REA `analyze_javascript_application` 对 `assets/` 跑静态应用图分析
   → 拿路由表、状态管理结构、组件依赖图
3. 补全 **API 契约**：请求/响应体形状、鉴权流、`decrypt-key` 的加密方案
   （这是复刻的关键，决定试卷内容怎么保护）
4. 梳理**数据模型**（题库 / 试卷 / 作答 / 错题 / 生词 / 笔记）
5. 可选：REA `capture_browser_scenario` 做关键页面运行时观察 + 截图
6. 产出**重建蓝图**：技术选型、模块划分、数据模型、实施路径

---

## 5. 注意事项

- 站点有 EdgeOne 风控，**抓取要有节流**，上次批量并发就触发了拦截。
- 这是别人运营的线上服务：只做公开资源的静态分析，**不要压测、不要爬题库内容、
  不要尝试登录态越权**。目标是「学架构」，不是「抄数据」。
- `admin.examcrafts.com` 只观察到域名，未探测。

---

## 6. 文件清单

| 文件 | 说明 |
|---|---|
| `chunks.txt` | 52 个懒加载 chunk 的完整名单 |
| `assets/` | 已抓到的 18 个 JS（core 完整）+ 1 个 CSS |
| `chunk_failures.json` | 上一轮失败的 chunk 列表 |
| `index.html` | 首页原始 HTML（含 SEO/OG meta） |
| `fetched_index_live.html` | 浏览器渲染路径下重新取的首页 |
| `sitemap.xml` / `fetched_robots.txt` | SEO 与路由暴露信息 |
| `headers_root.txt` | 响应头（确认 EdgeOne） |
| `cookies.json` | 空（无持久 cookie，挑战态不落盘） |
| `cdp.mjs` / `fetch-all.mjs` / `fetch-retry.mjs` | 采集工具链 |
