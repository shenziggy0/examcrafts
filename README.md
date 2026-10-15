# ExamCrafts

> 面向英语备考的在线刷题平台。一期范围为 **CET4 / CET6 / IELTS Academic** 的听力、阅读、写作三科。

## 概况

| 项目 | 内容 |
| --- | --- |
| 仓库 | [shenziggy0/examcrafts](https://github.com/shenziggy0/examcrafts) |
| 主分支 | `main` |
| 远程地址 | `git@github.com:shenziggy0/examcrafts.git` |
| 当前阶段 | 设计已定稿，待搭建工程骨架 |

## 一期范围

| 能力 | 状态 |
| --- | --- |
| 听力、阅读自动出分 | 一期实现 |
| 写作作答与保存 | 一期实现，**但不出分**（待二期接入 DeepSeek 批改） |
| 雅思口语 | **不做**（一期与二期均不实现） |
| 雅思培训类（General Training） | **不做**（仅学术类） |
| 雅思总分 | **不计算、不展示**，仅提示官方口径 |
| 四六级总分 | 正常计算并展示（官方 710 分制），须同时标注可判分上限 |
| 错题本、生词本、笔记 | 一期实现 |

## 技术选型

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | Vue 3 + Vite + Pinia + vue-router | UI 用 Tailwind + daisyUI（`cupcake` 主题） |
| 后端 | Django + Django REST Framework | 鉴权用 SimpleJWT |
| 数据库（本地） | SQLite | 零配置，Django ORM 自动映射，无需改模型代码 |
| 数据库（部署） | PostgreSQL（拟） | 部署方案待定，见下方「未决事项」 |
| AI | DeepSeek | 仅二期用于写作批改 |

> **部署方案尚未确定。** 已评估过 Cloudflare Workers + D1 与自购 VPS 两条路线，各有取舍，暂缓决定；本地开发用 SQLite，数据模型保持数据库无关，两条路线均可平滑迁移。

## 目录结构

```
.
├── .gitignore
├── README.md
└── docs
    ├── design                  # 设计文档（事实来源）
    │   ├── 0001-考试备考平台技术方案.md
    │   └── 0002-考试内容与题型模型.md
    └── recon                   # 参照实现的公开前端侦察资料
        ├── README.md
        ├── NOTES.md
        ├── assets/             # 52 个 chunk（约 2.9 MB）— 不入库，见协作说明
        └── fetch-*.mjs         # 采集工具
```

## 文档导航

- **[0001 技术方案](docs/design/0001-考试备考平台技术方案.md)** — 整体架构：55 条路由表、40+ 接口契约、数据模型、API 客户端实现（含 401 并发刷新与限流器）。
- **[0002 考试内容与题型模型](docs/design/0002-考试内容与题型模型.md)** — 核心数据契约：`payload` 题型结构（题目组 + 子题）、两套计分体系共存的 `scoring` 对象、一期各科出分能力。
- **[侦察资料说明](docs/recon/README.md)** — 参照实现的侦察产物、采集工具用法与合规边界。

## 快速开始

```bash
git clone git@github.com:shenziggy0/examcrafts.git
cd examcrafts
```

工程骨架尚在搭建中。以下为**已实测通过**的工具链与本项目的环境要求，克隆后即可对照准备。

### 工具链（版本已实测）

| 工具 | 实测版本 | 最低要求 | 用途 |
| --- | --- | --- | --- |
| Python | 3.14.7 | 3.12+ | 后端 |
| Django | 6.1.2 | — | 后端框架 |
| DRF | 3.18.3 | — | 接口层 |
| SimpleJWT | 5.5.1 | — | 令牌鉴权 |
| Node.js | 22.23.2 | 22+ | 前端构建 |
| pnpm | 10.34.5 | 10+ | 包管理 |
| SQLite | 系统自带 | — | 本地开发数据库（**无需安装**） |

> 本地开发**不需要安装 PostgreSQL**。Django 的 ORM 会把 `JSONField` 映射为合适的列类型，同一份 `models.py` 在本地 SQLite 与部署环境的 Postgres 上均可运行，无需改代码。

### 本地环境准备

```bash
# 后端
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 数据库初始化
python manage.py migrate

# 启动后端
python manage.py runserver

# 前端（另开终端）
pnpm install
pnpm dev
```

`requirements.txt`、前端工程与上述命令将在骨架搭建后提供，届时本节会更新为可直接复制执行的形式。

### 环境变量

需要环境变量的配置项统一通过 `.env` 提供，**该文件不入库**（已在 `.gitignore` 中）：

```bash
cp .env.example .env   # .env.example 随后续代码提供
```

已确定需要的变量（模板将随骨架一并创建）：

| 变量 | 用途 | 何时需要 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 写作批改调用 DeepSeek | **二期**（一期不出分，暂不需要） |
| `DJANGO_SECRET_KEY` | Django 签名 | 立即 |
| `DJANGO_DEBUG` | 调试开关 | 立即 |

## 协作说明

### 克隆后你会得到什么

| 内容 | 是否入库 | 说明 |
| --- | --- | --- |
| `docs/design/` | ✅ | 设计文档，**开发的事实来源** |
| `docs/recon/` 的名单、工具、笔记、响应头 | ✅ | 侦察记录 |
| `docs/recon/assets/`（约 2.9 MB） | ❌ **不入库** | 参照实现的编译产物，避免再分发他人代码。需要时按 [`docs/recon/README.md`](docs/recon/README.md) 的步骤重新采集。**协作者不需要它也能开发**——全部结论已提炼进设计文档 |
| `.env` | ❌ | 各自本地创建 |
| 数据库文件 | ❌ | 各自 `migrate` 生成 |

### 开工前请先读

1. [`docs/design/0001-考试备考平台技术方案.md`](docs/design/0001-考试备考平台技术方案.md) — 整体架构与接口契约
2. [`docs/design/0002-考试内容与题型模型.md`](docs/design/0002-考试内容与题型模型.md) — 数据结构与题型定义
3. 下方「关键设计约束」— 实现红线

### 合规要求（重要）

本项目是**备考练习功能**，不是参照实现的克隆：

- **不得**复制参照实现的程序代码、UI 设计、视觉风格、答案解析文案与图谱数据。
- **不得**搬运其题库内容。真题版权属出题方。
- **不得**使用 IELTS 等考试主办方的官方标识，或声称官方认证。
- 题目须自建或取得授权，并保留来源凭证。

## 关键设计约束

以下几条已定稿，实现时不得偏离（依据见 `docs/design/0002-考试内容与题型模型.md`）：

1. **未出分的科目不写数据行**，而非写 0 分——「未出分」与「得 0 分」是两种状态，用 `null` 或 `0` 表达会被误算。
2. **雅思成绩接口不返回任何总分字段**，也不得用现有科目的平均值冒充。
3. **四六级成绩单须同时标注**「官方满分 710」与「本次可判分部分满分」，不得出现「得分 X / 710」这类会让用户误以为写作已计 0 分的表述。
4. **错题计数落库**（反规范化），不在读取时聚合——后者在部分部署环境会触及 CPU 上限。
5. **`payload` 的 `items[]` 长度为 1 时仍必须是数组**，不得塌陷为对象。
6. **题目组 + 子题**是统一抽象，覆盖雅思阅读（一文多题）、雅思听力（一音频多题）与四六级各题型。

## 开发约定

### 分支模型

- `main` — 稳定分支，始终保持可发布状态
- `feat/<topic>` — 功能开发分支
- `fix/<topic>` — 缺陷修复分支

### 提交信息

采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

feat:     新功能
fix:      修复缺陷
docs:     文档变更
style:    格式调整（不影响逻辑）
refactor: 重构
perf:     性能优化
test:     测试相关
build:    构建系统或依赖
ci:       持续集成配置
chore:    杂项维护
```

示例：

```bash
git commit -m "feat(parser): 支持解析多选题目型"
git commit -m "fix(export): 修正 PDF 导出页码错位"
```

### 工作流

```bash
# 1. 从最新的 main 创建分支
git switch main && git pull
git switch -c feat/your-feature

# 2. 开发并提交
git add .
git commit -m "feat: 描述你的改动"

# 3. 推送并创建 Pull Request
git push -u origin feat/your-feature
```

## 许可证

尚未指定。如需开源，请添加 `LICENSE` 文件。
