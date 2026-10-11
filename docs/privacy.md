# FoxHome — Privacy Policy

_Last updated: 2026-10-11_

This document is the privacy policy for the FoxHome Firefox add-on. It is the page
linked from the add-on's listing on [addons.mozilla.org](https://addons.mozilla.org/).
A Chinese translation follows the English text.

---

## English

FoxHome does not collect, transmit, or sell any personal data.

### What is stored, and where

All of your settings — quick links, background image, and preferences — are
stored in your own browser's local storage, on your own computer. They are never
uploaded. Uninstalling the add-on removes them.

### Browsing history

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

### Search engines

Custom search engines are just a name and a URL template saved in your own
browser's local storage. Adding one requires no permission and sends nothing.

### The one exception: website screenshots (off by default)

FoxHome has an optional setting called "use website screenshots". It is **off by
default** and is clearly labelled in the settings panel. If you turn it on, the
URLs of the history cards currently on screen are sent to a third-party
screenshot service (WordPress mShots, `s0.wp.com`) in order to fetch thumbnail
images. That service receives those URLs and may cache them; it is governed by
WordPress.com's own privacy policy. Turn the setting off to stop all such
requests.

### No telemetry

FoxHome contains no analytics, no tracking, and no telemetry of any kind.

### Contact

Issues and questions: <https://github.com/AlterWL/FoxHome/issues>

---

## 中文

FoxHome 不收集、不传输、也不出售任何个人数据。

### 存在什么、存在哪里

你的所有设置 —— 快捷方式、背景图片、各项偏好 —— 都存在你自己电脑的浏览器本地存储里，不会上传。卸载扩展会一并清掉。

### 浏览历史

FoxHome 通过 Firefox 的 `history` API 读取浏览历史，用来渲染「最近浏览」卡片，以及为常访问的站点推荐快捷方式。整个过程都在你的浏览器里完成：历史不会被扩展存储、不会被扩展写到磁盘、也不会发往任何地方。

你可以随时在 FoxHome 的设置里关掉这些基于历史的功能，或者在 `about:addons` 里撤销该权限。

为了让卡片保持准确，FoxHome 还会监听 `history.onVisited` 与 `history.onVisitRemoved` —— 比如你删掉浏览记录后页面能跟着更新，而不是留着一张过时的卡片。这两个监听器只会在本页重新读一次历史，不保存任何东西，也不发送任何东西。

### 搜索引擎

自定义的搜索引擎只是存在你本地的一份「名称 + 网址模板」。添加它不需要任何权限，也不会发送任何东西。

### 唯一的例外：网站截图（默认关闭）

FoxHome 有一个可选设置叫「用网站截图当缩略图」，**默认关闭**，且设置面板里写得很清楚。如果你打开它，屏幕上那些历史卡片的网址会被发往第三方截图服务（WordPress mShots，`s0.wp.com`）以获取缩略图。该服务会收到这些网址，并可能缓存它们；它受 WordPress.com 自己的隐私政策约束。关掉这个开关即可停止所有此类请求。

### 没有遥测

FoxHome 不含任何统计、追踪或遥测。

### 联系方式

问题与反馈：<https://github.com/AlterWL/FoxHome/issues>
