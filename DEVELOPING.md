# FoxHome —— 开发说明

面向**改这个项目的人**。使用者文档在 [README.md](README.md)，提交信息格式约定在 [CONTRIBUTING.md](CONTRIBUTING.md)。

- 没有构建步骤，没有 `node_modules`，没有第三方依赖 —— 只有 Node 内置模块
- 页面是纯静态 HTML/CSS/JS，改完刷新页面就能看到效果
- 需要用到的工具都在 `tools/` 里，自己也都是零依赖的

---

## 一、它是怎么工作的

扩展只有一个职责：**接管新标签页和主页**。

```json
"chrome_url_overrides":   { "newtab": "index.html" },
"chrome_settings_overrides": { "homepage": "index.html" }
```

这两类页面在 Firefox 里带有特权 API 权限，所以页面脚本自己就能调 `browser.history.search()` 读浏览历史 —— 不需要 background script，不需要 content script，也不需要任何消息通道。

由此带来几个结果，改动时值得记着：

- 权限只有 `history` 一项（`background`、`content_scripts` 都已移除，别加回来）
- `file://` 打开同一个页面时浏览器不暴露 `browser`，读不到历史 —— 这是安全边界，页面里已经按"读不到"优雅降级
- 页面里的 `privilegedApi` 判定很窄：只有 `browser.history.search` 是函数才算数

数据在**扩展自己的来源**（`moz-extension://…`）下，所以跟项目路径无关。

---

## 二、文件结构

```
extension/index.html          起始页结构（也是被扩展接管的新标签页与主页）
extension/assets/styles.css   全部样式，含浅色文字与「玻璃」卡片的视觉效果
extension/assets/core.js      纯逻辑：网址解析、搜索引擎、快捷方式与历史处理、数据清洗
extension/assets/app.js       页面行为：渲染、交互、图片压缩、本地保存、读取历史
extension/manifest.json       扩展清单（MV3）
extension/icons/*.png         扩展图标（16/32/48/96/128，脚本生成）
docs/*.png                    README 里用的截图
docs/amo-listing.md           AMO 上架素材（摘要、描述、审核员备注、隐私政策）
tests/core.test.js            core.js 的测试
tools/lib.js                  PNG 编码 / ZIP 打包 / CRC32，零依赖
tools/make-icons.js           生成扩展图标，含多尺寸预览与场景图模式
tools/pack.js                 打包扩展（上传 AMO）或整个项目（源码审核）
tools/check-commit-msg.js     提交信息校验器
tools/git-hooks/commit-msg    校验钩子（core.hooksPath 指向这里）
CONTRIBUTING.md               提交信息规范（约定式提交）
README.md                     使用者文档
.gitmessage                   提交模板
LICENSE                       GPL-3.0
```

整个扩展（含页面）都在 `extension/` 里，就是上传 AMO 的那一份；`tools/` 和 `tests/` 只在开发时用，不会被打包进去。`dist/` 是生成的 zip，可以随时删。

### 分层约定

`core.js` **不碰 DOM**，所有纯逻辑（网址解析、数据清洗与归一化、历史合并、快捷方式挑选）都放这里；`app.js` 只做渲染与交互，需要计算时调 `Core.*`。

这么分的好处是测试能直接在 Node 里跑：

```bash
node tests/core.test.js
```

改完 `core.js` 建议跑一次。测试用的是 `assert` + 一个极简的 `ok(name, fn)` 包装，不引入测试框架。

---

## 三、本地跑起来

**临时载入**（改代码时自测）：

1. `about:debugging#/runtime/this-firefox` → **「临时载入附加组件…」** → 选 `extension/manifest.json`
2. 新标签页应该立刻变成起始页（临时载入同样支持 `chrome_url_overrides`）

> ⚠️ 临时载入的扩展**在 Firefox 重启后会失效**，改完代码要重新载入一次。

只调样式的话，直接用浏览器打开 `extension/index.html` 更快 —— 只是读不到浏览历史。

**语法与一致性检查**（改动提交前顺手跑）：

```bash
node --check extension/assets/core.js
node --check extension/assets/app.js
node tests/core.test.js
```

---

## 四、打包与发布到 AMO

### 打包

```bash
node tools/pack.js            # 扩展包，上传 AMO 用
node tools/pack.js --source   # 源码包，AMO 追问源码时用
```

生成 `dist/foxhome-<版本>.zip` 并列出包内文件 —— AMO 要求 `manifest.json` 在压缩包根目录，脚本会保证这一点（它用自己的 ZIP 写入器，不依赖系统压缩工具）。

### 提交到 AMO

扩展已经按 AMO 的要求配好了（MV3、图标、数据收集声明）。

1. 登录 [AMO 开发者中心](https://addons.mozilla.org/developers/)（免费）
2. 打开 <https://addons.mozilla.org/developers/addon/submit/>
3. 选渠道：
   - **「On your own site」（unlisted）** —— 只在 AMO 留档并签名，不公开列出，不用准备列表页素材
   - **「On this site」（listed）** —— 公开上架。首个 listed 版本必须走网页后台手动提交，API 不行；同一 add-on 可以同时有 listed / unlisted 版本
4. 上传 zip，等自动校验通过
5. 在开发者后台的版本页下载签名好的 `.xpi`

这个扩展没有远程代码、权限只有 `history`，通常走自动校验，几分钟出结果。listed 渠道的文案（摘要、描述、审核员备注、隐私政策）在 [docs/amo-listing.md](docs/amo-listing.md) 里，可以直接抄。

### AMO 问「是否使用过代码生成 / 合并 / 模板等工具」时

**答「是」**，然后上传源码包。

原因：扩展里唯一的生成物是图标 —— `extension/icons/*.png` 由 `tools/make-icons.js` 渲染生成，正落在"对文件二次处理并生成扩展中的文件"这一条上。JS 本身是手写、未压缩、未打包的，但如实回答才不会留下"提供不实信息"的把柄。

`node tools/pack.js --source` 打出的源码包会自动附带一份**英文说明 `SOURCE-NOTES.md`**，AMO 表单里那段说明可以直接抄它。

图标生成是**确定性**的（同样的脚本产出完全相同的字节，已实测），审核员可以自己重跑 `node tools/make-icons.js` 验证。

### 数据声明

AMO 从 2025-11-03 起要求**新提交**的扩展在 manifest 里声明数据行为，不收集数据也必须显式写：

```json
"data_collection_permissions": {
  "required": ["none"],
  "optional": ["browsingActivity"]
}
```

- `required` 里只能写 `none`，不能和别的项并列（并列会直接校验失败）
- `optional` 那条对应**默认关闭**的截图功能：开启后卡片网址会发给 `s0.wp.com`，属于可选的浏览活动传输，必须声明
- 这个字段 Firefox 140 才开始认识，更老的版本会忽略它

### 可能遇到的两件事

**「此附加组件的 ID 已被使用」**：`foxhome@local` 被别人占了。把 `extension/manifest.json` 里 `gecko.id` 改成更独特的（例如 `foxhome-history@local`），重新打包上传。

**重新提交被拒**：每次提交都要把 `manifest.json` 的 `version` 往上加，改完重新跑 `node tools/pack.js`。

---

## 五、图标

图标是脚本画出来的（自己写的 PNG 编码 + 超采样抗锯齿），不用设计软件：

```bash
node tools/make-icons.js                                              # 用当前变体重写 extension/icons/
node tools/make-icons.js --preview=icon-preview.png                    # 多尺寸对比图
node tools/make-icons.js --scene=icon-scene.png --variants=tab,page    # 放进 about:addons 真实场景对比
node tools/make-icons.js --variant=sunrise                             # 换一个变体，再跑上面的命令
```

可选变体（`--variant=` 的值）：

| 变体 | 形状 |
| --- | --- |
| `tab` | 浏览器标签页 —— **当前使用的** |
| `page` | 一张页面（右上折角） |
| `window` | 浏览器窗口 + 页内搜索框 |
| `search` | 一个大搜索框 |
| `home` / `home-grid` | 房子 / 房子加门窗 |
| `grid` | 2×2 快速拨号网格 |
| `sunrise` | 日出 + 地平线 |
| `cards` / `clock` / `timeline` | 叠放卡片 / 时钟回转箭头 / 时间轴 |

底色是青蓝渐变（比起始页的「极夜」背景**亮一档**）—— 这样在 Firefox 深色主题的 `about:addons` 卡片上也能立住；原来的深色底会融进卡片、只剩白色图形可辨。用 `--scene` 可以直接对比这两种背景下的效果。

> **Firefox 不接受 SVG 作扩展图标**，所以必须是 PNG。这也正是 `tools/` 里那个手写 PNG 编码器的由来 —— 为了不引入图形库依赖。

---

## 六、一些实现上的坑

踩过的坑，改相关代码时留意：

**新标签页的加载动画。** 卡片里的站点图标是外部请求，而 DOM 里的 `<img>` 属于延迟 `load` 的资源 —— 一批 favicon 能把 `window.load` 拖到好几秒，标签上就一直转圈。所以外部图片统一走 `loadExternalImage()`，等 `load` 之后、浏览器空闲时才设 `src`。**加任何外部图片都要走这个函数**，否则那个问题会回来。

**引擎菜单被卡片压住。** 入场动画原本用 `animation-fill-mode: both`，它会让元素在动画结束后仍保持层叠上下文，于是兄弟节点只能按 DOM 顺序绘制。改成 `backwards`，并给 `.search` / `.links` 显式 `z-index`。

**毛玻璃的开销。** 卡片最多几十个，每个 `backdrop-filter` 都是一层 GPU 合成；而预设背景是平滑渐变，模糊它肉眼看不出区别。所以只在用户上传了图片（`body.has-image-bg`）时才给卡片开毛玻璃。

**时钟不必每秒醒。** 界面只显示到分钟，所以用 `scheduleClock()` 对齐到下一分钟边界，从每分钟 60 次降到 1 次。

**`normalizeUrl` 不能靠冒号判断。** `example.com:8080` 是合法的 `host:port`，一开始被误判成伪协议。现在用 `HTTP_RE` + `BARE_HOST_RE` 两个正则分别匹配。

---

## 七、提交

提交信息用**约定式提交**，格式、`type`/`scope` 取值和例子都在 [CONTRIBUTING.md](CONTRIBUTING.md)。

仓库里已经配好了模板和校验钩子：

```bash
git config commit.template .gitmessage
git config core.hooksPath tools/git-hooks
```

换台机器后重新配这两条即可。不合规的提交信息会被直接拒绝（临时跳过用 `git commit --no-verify`）。
