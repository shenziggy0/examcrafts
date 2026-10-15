# ExamCrafts

> 项目初始化中 — 仓库已建立，等待添加实际代码。

## 概况

| 项目 | 内容 |
| --- | --- |
| 仓库 | [shenziggy0/examcrafts](https://github.com/shenziggy0/examcrafts) |
| 主分支 | `main` |
| 远程地址 | `git@github.com:shenziggy0/examcrafts.git` |

## 快速开始

```bash
# 克隆仓库
git clone git@github.com:shenziggy0/examcrafts.git
cd examcrafts
```

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

## 目录结构

```
.
├── .gitignore   # 忽略规则（跨平台 / 多语言）
└── README.md    # 本文件
```

## 许可证

尚未指定。如需开源，请添加 `LICENSE` 文件。
