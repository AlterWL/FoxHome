# 提交信息规范

本项目采用 **约定式提交（Conventional Commits）**，也就是 Angular 团队那套规范被标准化之后的版本。

```
<type>(<scope>): <subject>      ← 标题，必填

<body>                          ← 正文，可选，空一行后写

<footer>                        ← 脚注，可选，空一行后写
```

> 本规范**从引入时起生效，不追溯改写已有提交** —— 历史里那些不符合格式的信息就留在那儿了。

---

## type（必填）

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 只改文档（README、CONTRIBUTING 等） |
| `style` | 不影响行为的格式调整（空格、缩进、分号、排版） |
| `refactor` | 重构：既不加功能也不修 bug |
| `perf` | 性能优化 |
| `test` | 增改测试 |
| `build` | 构建/打包：`tools/`、manifest 版本号、图标生成 |
| `ci` | CI 配置 |
| `chore` | 其它杂项（依赖、编辑器配置） |
| `revert` | 回滚某次提交 |

按语义化版本对应：`feat` → MINOR，`fix` → PATCH，破坏性变更 → MAJOR。

## scope（可选）

说明改动落在哪一块，用括号跟在 type 后面。本项目常用的：

| scope | 对应 |
| --- | --- |
| `page` | 起始页本体（`extension/index.html` + `extension/assets/`） |
| `core` | 纯逻辑层（`extension/assets/core.js`） |
| `history` | 最近浏览与历史处理 |
| `shortcuts` | 快捷方式区与自动补充 |
| `extension` | 扩展清单与打包（`manifest.json`、`tools/pack.js`） |
| `icons` | 图标生成（`tools/make-icons.js`） |
| `docs` | 文档与截图（仅在 `type` 不适合用 `docs` 时配合使用） |

没把握或改动很杂时，**省略 scope 比乱填更好**。

## subject（必填）

- 一句话说清"做了什么"，**中文英文都行**
- **不超过 72 字符**
- **结尾不加句号**
- 用祈使句：写"加…""修…"，别写"加了…""修复了…"

## body（可选）

- 与标题之间**空一行**
- 重点写**为什么**这么改、和旧行为的差异，而不是复述代码
- 多条时用 `-` 起头

## footer（可选）

- `BREAKING CHANGE: 说明` —— 不兼容改动；同时建议在标题的 type 后加 `!`
- `Closes #12` —— 关联或关闭 issue（也可用 `Fixes` / `Resolves`）

---

## 例子

新功能，带正文和 issue：

```
feat(shortcuts): 按浏览历史自动补充快捷方式

- 复用「最近浏览」的过滤与合并逻辑，按访问频次挑选
- 自动项不写进 links 数据，关掉开关即消失

Closes #7
```

修 bug，正文解释原因：

```
fix(page): 引擎下拉框被下方快捷方式遮住

入场动画的 fill-mode: both 让搜索区和快捷方式区各自成为层叠上下文，
两个兄弟节点只能按 DOM 顺序绘制。改成 backwards，并给两块显式 z-index。
```

只改文档：

```
docs: 补上 AMO 上架素材

摘要、详细描述、审核员备注和隐私政策，提交时可直接复制。
```

破坏性变更：

```
feat(extension)!: 移除 file:// 模式的桥接代码

BREAKING CHANGE: 不再支持用 file:// 路径打开页面时读取历史，
请改用扩展接管的新标签页或主页。
```

---

## 怎么保证写对

**1. 提交模板（本仓库已配好）**

`git commit` 会带出 `.gitmessage` 里的注释提示，照着填就行。换台机器后重新配一次：

```bash
git config commit.template .gitmessage
```

**2. 自动校验（本仓库已启用）**

```bash
git config core.hooksPath tools/git-hooks
```

之后提交信息不合规会被**直接拒绝**，并告诉你哪里不对。想临时跳过用 `git commit --no-verify`；想关掉校验：

```bash
git config --unset core.hooksPath
```

也可以手动校验一条信息：

```bash
node tools/check-commit-msg.js "feat(page): 加个东西"
node tools/check-commit-msg.js .git/COMMIT_EDITMSG
```
