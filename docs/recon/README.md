# 参照实现侦察资料

本目录保存对参照实现 `https://examcrafts.com/` 的公开前端侦察产物。**用途是理解其架构与接口契约，不是复制其代码。**

## 目录内容

| 文件 | 说明 |
| --- | --- |
| `NOTES.md` | 侦察过程记录与断点说明（原 `HANDOFF.md`），含 EdgeOne 反爬细节与恢复环境的命令 |
| `chunks.txt` | 52 个懒加载 chunk 的完整名单 |
| `assets/` | 已抓取的 54 个文件（52 个 chunk + 1 CSS 等），约 2.8 MB |
| `index.html` / `fetched_index_live.html` | 首页原始 HTML 与浏览器渲染路径下重取的结果 |
| `fetched_index-CILwo6Dd.css` | 主样式表（249 KB），用于确认设计系统 |
| `sitemap.xml` / `fetched_sitemap.xml` / `fetched_robots.txt` | SEO 与路由暴露信息 |
| `headers_root.txt` | 响应头，用于确认 CDN 与反爬（腾讯云 EdgeOne） |
| `chunk_failures.json` | 某一轮抓取的失败记录（历史痕迹） |
| `cookies.json` | 空文件（无持久 cookie，挑战态不落盘） |

## 采集工具

| 脚本 | 说明 |
| --- | --- |
| `cdp.mjs` | 极简 CDP 客户端（`Session` / `listTargets` / `sleep`）。**注意：默认端口写死为 9333**，与 `fetch-*.mjs` 使用的 9222 不一致，单独复用需改端口 |
| `fetch-all.mjs` | 导航取证 + 从页面 origin 拉取全部 bundle（首轮采集） |
| `fetch-retry.mjs` | 失败 chunk 的退避重试。**已废弃**，见下方「缓存自锁」 |
| `fetch-fix.mjs` | 修正版重试脚本，**推荐使用** |

三个 `fetch-*.mjs` 的输出目录由脚本自身位置推导（`import.meta.url`），因此克隆到任意路径都能直接运行，无需改配置。

### 运行前置条件

需要一个已开启远程调试的 Chrome，且窗口已打开目标站点：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/ec-chrome-profile \
  https://examcrafts.com/
```

然后：

```bash
cd docs/recon
node fetch-fix.mjs
```

端口可用环境变量覆盖：`CDP_PORT=9333 node fetch-fix.mjs`。

## 采集过程中发现的一个坑（值得记录）

`fetch-retry.mjs` 使用了 `cache: 'force-cache'`。当 EdgeOne 返回约 988 字节的 JS 挑战页（HTTP 200 + `text/html`）时，该 HTML 被浏览器缓存，导致后续 8 轮重试**全部命中同一份缓存**，形成自锁——**失败并非风控加强，而是缓存污染**。

`fetch-fix.mjs` 的修正：改用 `cache: 'reload'` 并附加每次变化的 cache-buster 查询参数，同时对响应做 `content-type` 与长度校验；若检测到挑战页，先导航一次以重新解挑战。按此修正后，35 个缺失 chunk **一轮全部成功**。

## 合规边界

**这些产物是他人线上服务的前端编译代码**，仅用于理解架构。已确认的边界（详见 `../design/0001-考试备考平台技术方案.md`）：

- 不得复制参照实现的程序代码、UI 设计、视觉风格、答案解析文案与图谱数据。其页脚明确声明这些内容版权归其所有，禁止复制、转载或仿冒。
- 不得搬运其题库内容。其页脚亦声明真题版权属出题方。
- 本站点目标为**备考练习功能**，须自建题目或取得授权，且不得使用考试主办方的官方标识或声称官方认证。

## `assets/` 不纳入版本控制

**`assets/` 已被 `.gitignore` 排除，克隆仓库后该目录不存在。** 这是有意的：

- 它是参照实现的**编译产物**（约 2.9 MB），属他人代码。其页脚声明「全部程序代码…未经书面授权禁止任何形式的复制、转载或仿冒」，因此不向公开仓库再分发。
- **协作者不需要它也能开发。** 从侦察中提炼出的全部结论（55 条路由表、40+ 接口契约、数据模型字段、题型结构）都已写入 `../design/` 的两份设计文档，那才是开发的事实来源。

### 需要原始文件时如何重建

判断某个接口或字段的确切写法时，可能需要直接检索原始 chunk。重建步骤：

1. 启动一个带远程调试的 Chrome，并打开目标站点：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/ec-chrome-profile \
  https://examcrafts.com/
```

2. 拉取全部 chunk：

```bash
cd docs/recon
node fetch-fix.mjs
```

脚本会依据 `chunks.txt` 的名单补齐缺失文件，输出到自身所在目录。约需 1~2 分钟（脚本内置节流，避免触发风控）。

**前提说明**：此操作会访问第三方线上服务。请遵守其服务条款，仅作架构参考，不要批量抓取或压测。
