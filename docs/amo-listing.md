# AMO 上架素材（listed）

提交到 AMO 时照这里的段落复制即可。这份文件是给**提交表单**准备的，不参与扩展运行：扩展包
`dist/foxhome-<版本>.zip` 里没有它（`--source` 打出的源码包里有，无妨）。

> 上架流程本身看 [DEVELOPING.md](../DEVELOPING.md) 的「打包与发布到 AMO」。

---

## 一、表单字段

| 字段 | 填什么 |
| --- | --- |
| **Name** | `FoxHome`（先在 AMO 搜一下有没有重名） |
| **Summary** | 下面第二节的英文摘要（≤250 字符）；中文版可作备选 |
| **Categories** | `Tabs`（主）+ `Appearance` |
| **Tags** | `new tab`、`start page`、`homepage`、`bookmarks`、`history` |
| **License** | `GPL-3.0`（本仓库的 LICENSE） |
| **Support site** | `https://github.com/AlterWL/FoxHome` |
| **Support email** | 可不填，Support site 已经够用 |
| **Homepage** | 同上：`https://github.com/AlterWL/FoxHome` |
| **Privacy policy** | **必须是能打开的 URL**。把第五节的文案放进本仓库的 `docs/privacy.md`（GitHub 会渲染成网页），然后填 `https://github.com/AlterWL/FoxHome/blob/main/docs/privacy.md` |
| **Screenshots** | `docs/screenshot-home.jpg`、`docs/screenshot-engines.jpg`、`docs/screenshot-settings.jpg`（1366×768，是 AMO 建议的宽屏比例；最多 10 张） |
| **Release notes** | 用下面那段「版本说明」，本次是 **1.0.7** |
| **Notes to reviewer** | 第四节的备注，**强烈建议填** |
| **渠道（最关键的一步）** | 上传那一步选 **listed（On this site）**，否则只会签名、不会公开列出 |
| **最低 Firefox 版本** | 109（`manifest.json` 里的 `strict_min_version`；109 起支持 MV3） |

### 版本说明（Release notes）

每次提交 AMO 都要填一段。这次直接复制：

**英文**

```
- Deleting history entries now updates the recent-visits cards right away,
  instead of waiting for the page to be reopened.
- Recent visits can show the exact time (20:31, or 10月9日 20:37 for older
  entries) instead of "3 hours ago" — the system locale decides the wording.
- Search engines can be added, edited and removed by the user (from 1.0.6).
```

**中文**

```
- 删掉浏览记录后，「最近浏览」卡片会立刻跟着更新，不再需要重开页面。
- 「最近浏览」可以显示具体时刻（今天的显示 20:31，更早的显示 10月9日 20:37），
  替代原来的「3 小时前」—— 设置面板里有新开关。
- 搜索引擎支持自己增删改（1.0.6 起）。
```

> 如果你这次提交同时包含了 1.0.6 和 1.0.7 的改动（比如上一版还没传过），把上面三条一起用即可。

---

## 二、Summary（≤250 字符）

**英文（202 字符）**

```
Turn Firefox's new tab and home page into a clean, local start page: clock, custom search engines, quick links that auto-fill from your history, and recent-visit cards. Everything stays on your machine.
```

**中文（备选）**

```
把 Firefox 的新标签页和主页换成自己的清爽起始页：时钟、可自定义的搜索引擎、按浏览历史自动补充的快捷方式、最近浏览卡片。数据只在本机流转。
```

---

## 三、Description（详细描述）

**英文**

```markdown
FoxHome replaces Firefox's new tab page (and optionally the home page) with a
clean, self-contained start page.

## What you get

- **Clock and date** — unobtrusive, can be turned off.
- **Search** — Google, Bing, Baidu, or DuckDuckGo. You can also add, edit or
  remove engines yourself: give one a name and any search URL containing `%s`,
  and it shows up in the picker. Switching engines is one click and it remembers.
  Typing a URL (like `github.com`) opens it directly instead of searching.
- **Quick links** — add, rename, delete and drag to reorder. FoxHome also takes
  the sites you visit most often and appends them as extra shortcuts
  (marked with a "history" badge). Those auto-added ones are never written into
  your saved links — flip the switch off and they disappear.
- **Recent visits** — your actual browsing history as compact cards: title,
  domain, relative time, visit count. Deduplicate by site, filter by keyword,
  or turn the whole section off.
- **Custom background** — six built-in gradients, or drop in your own image
  (it is compressed and stored locally), with an adjustable dimming layer.
- **Keyboard first** — `/` or `Ctrl+K` jumps straight to the search box.

## Where your data goes

Nowhere. Everything FoxHome stores — links, background, settings — lives in your
own browser's local storage. The extension reads your browsing history through
Firefox's `history` API, renders it locally, and never transmits it.

The one exception is **off by default** and clearly labelled in the settings:
if you turn on "use website screenshots", the URLs of the cards on screen are
sent to a third-party screenshot service (s0.wp.com) to fetch thumbnails.

## Permissions, and why

- **history** — powers the "recent visits" cards and the auto-filled quick links.
  Nothing else needs a permission: the search-engine editor is plain local data.
- **New tab override** — the whole point of the extension.
- **Home page override** — also optional in effect: change your home page in
  `about:preferences#home` at any time and FoxHome will stop overriding it.

No remote code, no analytics, no telemetry. Ships as-is: hand-written HTML/CSS/JS,
no bundler, no minifier.
```

**中文**

```markdown
FoxHome 把 Firefox 的新标签页（以及可选的主页）换成自己的起始页。

## 有什么

- **时钟与日期** —— 不抢眼，可关闭。
- **搜索** —— Google / 必应 / 百度 / DuckDuckGo。也能自己增删改：起个名字，再填一个带 `%s` 的搜索地址，它就出现在切换菜单里；一键切换并记住。输入网址会直接打开而不是去搜索。
- **快捷方式** —— 可增删改、拖拽排序；同时会按浏览历史把最常访问的站点自动补在后面（带「历史」角标），这些自动项不会写进你保存的链接，关掉开关即消失。
- **最近浏览** —— 真实历史做成小卡片：标题、域名、相对时间、访问次数。支持同站点合并、关键词屏蔽，也可以整块关掉。
- **自定义背景** —— 6 套内置渐变，或拖入自己的图片（会自动压缩并存在本机），带遮罩调节。
- **键盘优先** —— `/` 或 `Ctrl+K` 直接聚焦搜索框。

## 数据去哪了

哪儿也没去。扩展保存的链接、背景和设置都在你自己浏览器的本地存储里；浏览历史通过 Firefox 的 `history` API 读取、在本机渲染，从不外传。

唯一的例外**默认关闭**，且设置里写得很清楚：开启「用网站截图当缩略图」后，卡片上的网址会发给第三方截图服务（s0.wp.com）以获取缩略图。

## 权限用途

- **history** —— 用于「最近浏览」卡片和快捷方式的自动补充。其余功能不需要任何额外权限（搜索引擎编辑器只是一份本地数据）。
- **接管新标签页** —— 这个扩展存在的意义本身。
- **接管主页** —— 同样可以随时在 `about:preferences#home` 改回去，改掉之后 FoxHome 就不再覆盖。

没有远程代码，没有统计，没有遥测。交付的就是源码：手写的 HTML/CSS/JS，没有打包器，没有压缩器。
```

---

## 四、Notes to reviewer（审核员备注）

**这段建议填上**，能显著减少因为"权限看起来可疑"而被卡住的概率。

```
Hi — a few notes on this add-on's design, in case they help:

1. `history` is used for two visible features: the "recent visits" card grid and
   the quick links that are appended below the user's own links. Both are
   rendered locally in the add-on's own page and never leave the browser.
   The user can turn either feature off, and can filter entries by keyword.

2. Both overrides (new tab and home page) are the add-on's stated purpose, not
   a side effect: the entire product is "a start page". The home page override
   in particular is reversible by the user at any time via
   about:preferences#home — it is a manifest declaration, not something done
   behind the user's back at runtime.

3. The quick links that are auto-added from history are recomputed on every
   render and are deliberately NOT persisted into the user's saved links, so
   the add-on never grows a hidden data set on the user's behalf.

4. `data_collection_permissions` declares `required: ["none"]`. The optional
   `browsingActivity` entry covers one **opt-in, off-by-default** feature:
   "use website screenshots" sends the URL of the cards currently on screen to
   a third-party screenshot service (s0.wp.com). It is described in the settings
   UI and in the privacy policy.

5. The code shipped is exactly the source: no bundler, no minifier, no
   transpiler, no remote code. The only generated files are the PNG icons (see
   tools/make-icons.js in the source package). Nothing is eval'd.

6. The user-defined search engines are plain `{name, url}` records in local
   storage — no new permission, no network request, no remote content. The URL
   must start with http(s) and contain a `%s` placeholder, so `javascript:` and
   similar schemes cannot be stored. The add-on only builds a navigation URL.

7. Since 1.0.7 the add-on also subscribes to `history.onVisitRemoved` and
   `history.onVisited`. Before that, deleting history entries left stale cards
   on screen until the page was reopened. These listeners only schedule a re-run
   of the same in-page `history.search()` query — they add no permission, write
   nothing to storage, and send nothing anywhere. To keep the cost low the
   refresh is debounced (800 ms, so a bulk delete results in one query) and is
   skipped entirely while the page sits in a background tab; it runs when the
   page becomes visible again.
```

---

## 五、隐私政策文案

把这段放进本仓库的 `docs/privacy.md`（GitHub 会把 Markdown 渲染成网页），然后把它的 URL 填进 AMO 的 Privacy policy 字段。

```markdown
# FoxHome — Privacy Policy

FoxHome does not collect, transmit, or sell any personal data.

## What is stored, and where

All of your settings — quick links, background image, and preferences — are
stored in your own browser's local storage, on your own computer. They are never
uploaded. Uninstalling the add-on removes them.

## Browsing history

FoxHome reads your browsing history through Firefox's `history` API in order to
render the "recent visits" cards and to suggest quick links for sites you visit
often. This processing happens entirely inside your browser. The history is not
stored by the add-on, not written to disk by the add-on, and not sent anywhere.

You can disable the history-based features at any time in FoxHome's settings, or
revoke the permission in `about:addons`.

To keep the cards accurate, FoxHome also listens for `history.onVisited` and
`history.onVisitRemoved` — for example so that deleting history entries updates
the page instead of leaving stale cards behind. These listeners do nothing
except trigger another in-page read; nothing is stored and nothing is sent.

## Search engines

Custom search engines are just a name and a URL template saved in your own
browser's local storage. Adding one requires no permission and sends nothing.

## The one exception: website screenshots (off by default)

FoxHome has an optional setting called "use website screenshots". It is **off by
default** and is clearly labelled in the settings panel. If you turn it on, the
URLs of the history cards currently on screen are sent to a third-party
screenshot service (WordPress mShots, `s0.wp.com`) in order to fetch thumbnail
images. That service receives those URLs and may cache them; it is governed by
WordPress.com's own privacy policy. Turn the setting off to stop all such
requests.

## No telemetry

FoxHome contains no analytics, no tracking, and no telemetry of any kind.

## Contact

Issues and questions: https://github.com/AlterWL/FoxHome/issues
```

---

## 六、提交前后的检查清单

- [ ] 在 AMO 搜 `FoxHome`，确认没有重名
- [ ] `extension/manifest.json` 的 `version` 已递增（当前 **1.0.7**）
- [ ] 截图**不含任何真实浏览记录**（`docs/` 里那三张都是中性的示例数据）
- [ ] 隐私政策的 URL 已经能打开（第五节的文案放到 `docs/privacy.md` 后就是 GitHub 的网页）
- [ ] `node tests/core.test.js` 全绿
- [ ] `node tools/pack.js` 生成 `dist/foxhome-<版本>.zip`
- [ ] 开发者中心 → 打开现有 FoxHome → **Upload New Version** → 渠道选 **listed**
- [ ] 表单字段按第一节填齐，**Notes to reviewer 一定要填**
- [ ] 提交后的流程：自动校验 → 可能人工审核（几小时到几周）→ 公开上架
