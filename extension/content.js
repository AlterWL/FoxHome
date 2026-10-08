/*!
 * FoxHome 历史桥 · content script
 *
 * 在起始页里运行：向 background 要浏览历史，用 postMessage 交给页面。
 * 页面自己负责过滤、合并、截断、渲染 —— 这里只做搬运，外加一点点缓存
 * （避免用户连点设置时反复查询）。
 */
(function () {
  'use strict';

  const FROM_PAGE = 'foxhome-page';
  const FROM_EXTENSION = 'foxhome-extension';
  const CACHE_MS = 15000;

  let cache = null; // { at: number, payload: object }
  let inflight = null;

  function post(payload) {
    window.postMessage({
      source: FROM_EXTENSION,
      type: 'history',
      ok: payload.ok,
      error: payload.error || '',
      items: payload.items || [],
      at: Date.now(),
    }, '*');
  }

  function request(days) {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return Promise.resolve(cache.payload);
    }
    if (inflight) return inflight;

    inflight = browser.runtime.sendMessage({ type: 'foxhome:history', days: days })
      .then(function (response) {
        const payload = response && response.ok
          ? { ok: true, items: response.items || [] }
          : { ok: false, error: (response && response.error) || 'no-response' };
        cache = { at: Date.now(), payload: payload };
        return payload;
      })
      .catch(function (error) {
        // 例如扩展被禁用、后台脚本报错
        return { ok: false, error: String((error && error.message) || error) };
      })
      .then(function (payload) {
        inflight = null;
        return payload;
      });

    return inflight;
  }

  function deliver(days) {
    request(days).then(post);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== FROM_PAGE) return;
    if (data.type !== 'history-request') return;

    if (data.force) cache = null;
    deliver(Number(data.days) || 30);
  });

  // 页面可能在 content script 就绪之前就已经发过请求了，所以这里主动推一次；
  // 之后页面还可以随时再要（例如用户改了数量）
  deliver(30);
})();
