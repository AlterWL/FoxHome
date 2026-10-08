/*!
 * FoxHome 历史桥 · background
 *
 * 唯一职责：把最近浏览记录交给本机的 FoxHome 起始页。
 * 读完即返回，不落盘、不上传。
 *
 * 安全要点：content script 与页面之间走的是 postMessage，任何本地 HTML 文件
 * 都能伪造那样的消息，所以请求来源必须由浏览器提供 —— 这里用 sender.url 判断，
 * 只有 FoxHome 起始页能拿到数据。
 */
'use strict';

// 允许取历史的页面（扩展自己接管的新标签页不需要走这里，它直接调 history）。
// 目录名不是 FoxHome、或者换了盘符，改这一行即可（同时改 manifest.json 的 matches）。
const ALLOWED_PAGE = /^file:\/\/\/.*\/foxhome\/extension\/index\.html(?:[?#].*)?$/i;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MAX_RESULTS = 500;

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function toItem(entry) {
  return {
    url: entry.url || '',
    title: entry.title || '',
    lastVisitTime: Number(entry.lastVisitTime) || 0,
    visitCount: Number(entry.visitCount) || 0,
  };
}

browser.runtime.onMessage.addListener(function (message, sender) {
  if (!message || message.type !== 'foxhome:history') return undefined;

  const pageUrl = sender.url || (sender.tab && sender.tab.url) || '';
  if (!ALLOWED_PAGE.test(pageUrl)) {
    console.warn('[FoxHome] 拒绝了一个非起始页的历史请求：' + pageUrl);
    return Promise.resolve({ ok: false, error: 'forbidden' });
  }

  const days = clampNumber(message.days, 1, MAX_DAYS, DEFAULT_DAYS);
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

  return browser.history.search({
    text: '',
    startTime: startTime,
    maxResults: MAX_RESULTS,
  }).then(function (entries) {
    return { ok: true, items: entries.map(toItem), days: days };
  }).catch(function (error) {
    console.error('[FoxHome] 读取历史失败', error);
    return { ok: false, error: String((error && error.message) || error) };
  });
});
