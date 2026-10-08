/*!
 * FoxHome · core —— 纯逻辑层，不依赖 DOM。
 * 浏览器：<script src="assets/core.js"> 之后通过 window.FoxHomeCore 使用
 * Node  ：const Core = require('./assets/core.js') 可直接单测
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.FoxHomeCore = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /** 本地存储键；改动它等于换一份数据。 */
  const STORAGE_KEY = 'foxhome.v1';
  const DATA_VERSION = 1;

  const MAX_LINKS = 200;
  const MAX_NAME_LENGTH = 40;

  /** 可选搜索引擎。想加一个，照着下面的格式追加一条即可。 */
  const ENGINES = [
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
    { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q=%s' },
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s' },
    { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  ];

  /** 内置背景预设；css 会直接赋给 background 属性，渐变和纯色都行。 */
  const PRESETS = [
    { id: 'midnight', name: '极夜', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 52%, #2c5364 100%)' },
    { id: 'graphite', name: '石墨', css: 'linear-gradient(160deg, #141e30 0%, #2b3a55 100%)' },
    { id: 'violet', name: '紫夜', css: 'linear-gradient(160deg, #2b1055 0%, #4d2a7a 58%, #6c4aa0 100%)' },
    { id: 'forest', name: '林间', css: 'linear-gradient(160deg, #0b3c34 0%, #1c5c4a 55%, #3d7f60 100%)' },
    { id: 'ember', name: '余烬', css: 'linear-gradient(160deg, #2b1010 0%, #5a2320 55%, #8a4a2a 100%)' },
    { id: 'ink', name: '墨黑', css: '#0d0f13' },
  ];

  /** 首次打开时的默认链接。 */
  const DEFAULT_LINKS = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: '知乎', url: 'https://www.zhihu.com' },
    { name: '哔哩哔哩', url: 'https://www.bilibili.com' },
    { name: '微博', url: 'https://weibo.com' },
    { name: 'Google', url: 'https://www.google.com' },
    { name: 'MDN', url: 'https://developer.mozilla.org' },
  ];

  const DEFAULT_OVERLAY = 0.28;
  const MAX_OVERLAY = 0.8;

  /** 历史卡片：默认显示几张、最多几张、向扩展查询最近多少天。 */
  const HISTORY_DEFAULT_COUNT = 8;
  const HISTORY_MAX_COUNT = 24;
  const HISTORY_DAYS = 30;

  /** 快捷方式区：默认总个数（手动 + 自动），以及可调范围。 */
  const SHORTCUT_DEFAULT_TOTAL = 12;
  const SHORTCUT_MIN_TOTAL = 1;
  const SHORTCUT_MAX_TOTAL = 30;

  /* ---------------------------------------------------------------- 基础工具 */

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  let uidCounter = 0;
  function uid(prefix) {
    uidCounter += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + uidCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /**
   * 拖拽排序用：算出被拖的元素应该落到哪个下标。
   * targetIndex 是落点卡片的下标，dropAfter 表示落点在目标卡片右半边。
   * 返回值配合「先 splice 移除、再 splice 插入」使用，所以源自己后面的目标要减 1。
   */
  function dropTargetIndex(fromIndex, targetIndex, dropAfter) {
    if (fromIndex < 0 || targetIndex < 0) return -1;
    let to = targetIndex + (dropAfter ? 1 : 0);
    if (fromIndex < to) to -= 1;
    return to;
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ------------------------------------------------------------ 网址与图标 */

  const HTTP_RE = /^https?:\/\//i;
  // 裸输入：localhost / IPv4 / 带点的域名，可跟端口、路径、查询。
  // 注意不能靠「有没有冒号」判断协议，否则 example.com:8080 会被当成伪协议。
  const BARE_HOST_RE = /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[^\s/?#@:]+(?:\.[^\s/?#@:]+)+)(?::\d{1,5})?(?:[/?#]\S*)?$/i;

  /**
   * 把用户输入解析成可以访问的网址；不是网址则返回 null（交给搜索引擎）。
   * 只放行 http/https，避免 javascript: 之类的伪协议被当成地址执行。
   */
  function normalizeUrl(input) {
    if (typeof input !== 'string') return null;
    const text = input.trim();
    if (!text || /\s/.test(text)) return null;

    let candidate = null;
    if (HTTP_RE.test(text)) {
      candidate = text;
    } else if (BARE_HOST_RE.test(text)) {
      // 形如 host:port 的裸输入也走这里（例如 example.com:8080/path）
      candidate = 'https://' + text;
    }
    if (!candidate) return null;

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      if (!parsed.hostname) return null;
      return parsed.href;
    } catch (error) {
      return null;
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return '';
    }
  }

  /** 站点根目录下的 favicon.ico；取不到就让调用方回退到字母图标。 */
  function faviconUrlFor(pageUrl) {
    try {
      const parsed = new URL(pageUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.origin + '/favicon.ico';
    } catch (error) {
      return '';
    }
  }

  /** 由域名稳定推导一个颜色，同名站点每次结果一致。 */
  function colorForSeed(seed) {
    const hash = hashString(String(seed || ''));
    const hue = hash % 360;
    const light = 30 + ((hash >> 9) % 12);
    return {
      bg: 'hsl(' + hue + ' 38% ' + light + '%)',
      fg: '#fff',
    };
  }

  /** 字母图标用：优先取首字符，兼容 emoji 与中文。 */
  function initialOf(name) {
    const text = String(name == null ? '' : name).trim();
    if (!text) return '?';
    const chars = Array.from(text);
    return chars[0].toUpperCase();
  }

  /* ---------------------------------------------------------------- 搜索引擎 */

  function engineById(id) {
    for (let i = 0; i < ENGINES.length; i += 1) {
      if (ENGINES[i].id === id) return ENGINES[i];
    }
    return null;
  }

  function buildSearchUrl(engineId, query) {
    const engine = engineById(engineId) || ENGINES[0];
    return engine.url.replace('%s', encodeURIComponent(String(query == null ? '' : query).trim()));
  }

  function presetById(id) {
    for (let i = 0; i < PRESETS.length; i += 1) {
      if (PRESETS[i].id === id) return PRESETS[i];
    }
    return null;
  }

  /* ------------------------------------------------------------ 数据的清洗 */

  function sanitizeLink(raw) {
    if (!isPlainObject(raw)) return null;
    const url = normalizeUrl(raw.url);
    if (!url) return null;

    let name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : '';
    if (!name) name = hostOf(url).replace(/^www\./i, '') || url;

    const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : uid('link');
    return { id: id, name: name, url: url };
  }

  function defaultData() {
    return {
      version: DATA_VERSION,
      background: defaultBackground(),
      search: { engine: ENGINES[0].id },
      layout: { showClock: true, showFavicons: true },
      links: DEFAULT_LINKS.map(function (item) {
        return { id: uid('link'), name: item.name, url: item.url };
      }),
      history: defaultHistorySettings(),
      shortcuts: defaultShortcutSettings(),
    };
  }

  function defaultBackground() {
    return {
      type: 'preset',
      preset: PRESETS[0].id,
      image: '',
      imageName: '',
      overlay: DEFAULT_OVERLAY,
    };
  }

  function normalizeBackground(raw) {
    const out = defaultBackground();
    if (!isPlainObject(raw)) return out;

    // 图片数据即使当前没用（type=preset）也保留，方便用户切回来
    if (typeof raw.image === 'string' && raw.image.indexOf('data:image/') === 0) {
      out.image = raw.image;
      out.imageName = typeof raw.imageName === 'string' ? raw.imageName.slice(0, 120) : '';
    }
    if (typeof raw.preset === 'string' && presetById(raw.preset)) out.preset = raw.preset;
    out.type = raw.type === 'image' && out.image ? 'image' : 'preset';

    const overlay = Number(raw.overlay);
    if (Number.isFinite(overlay)) out.overlay = clamp(Math.round(overlay * 100) / 100, 0, MAX_OVERLAY);

    return out;
  }

  /**
   * 把任意来源的数据（本地存储、导入的备份文件）整理成一份合法状态。
   * 缺字段补默认值，坏数据丢掉而不是让页面崩掉。
   */
  function normalizeData(raw) {
    const out = defaultData();
    if (!isPlainObject(raw)) return out;

    out.background = normalizeBackground(raw.background);

    const engineId = isPlainObject(raw.search) ? raw.search.engine : null;
    out.search = { engine: engineById(engineId) ? engineId : out.search.engine };

    if (isPlainObject(raw.layout)) {
      out.layout = {
        showClock: raw.layout.showClock !== false,
        showFavicons: raw.layout.showFavicons !== false,
      };
    }

    if (Array.isArray(raw.links)) {
      const seen = Object.create(null);
      const links = [];
      for (let i = 0; i < raw.links.length && links.length < MAX_LINKS; i += 1) {
        const link = sanitizeLink(raw.links[i]);
        if (!link || seen[link.url]) continue;
        seen[link.url] = true;
        links.push(link);
      }
      out.links = links;
    }

    out.history = normalizeHistorySettings(raw.history);
    out.shortcuts = normalizeShortcutSettings(raw.shortcuts);

    out.version = DATA_VERSION;
    return out;
  }

  /* -------------------------------------------------------------- 浏览历史 */

  function defaultHistorySettings() {
    return {
      enabled: true,
      count: HISTORY_DEFAULT_COUNT,
      mergeByHost: true,
      useScreenshots: false,
      blocklist: [],
    };
  }

  function normalizeHistorySettings(raw) {
    const out = defaultHistorySettings();
    if (!isPlainObject(raw)) return out;

    out.enabled = raw.enabled !== false;
    out.mergeByHost = raw.mergeByHost !== false;
    out.useScreenshots = raw.useScreenshots === true;

    const count = Number(raw.count);
    if (Number.isFinite(count)) out.count = clamp(Math.round(count), 1, HISTORY_MAX_COUNT);

    if (Array.isArray(raw.blocklist)) {
      const patterns = [];
      for (let i = 0; i < raw.blocklist.length && patterns.length < 60; i += 1) {
        const pattern = typeof raw.blocklist[i] === 'string' ? raw.blocklist[i].trim().slice(0, 80) : '';
        if (pattern) patterns.push(pattern);
      }
      out.blocklist = patterns;
    }

    return out;
  }

  /**
   * 屏蔽词编译成正则。统一按「包含」匹配：写 mail 就能挡掉 gmail；
   * 带 * 时星号是通配（mail.* 、*.example.com），但依然不锚定整串 ——
   * 因为匹配对象是完整网址（https://…），锚定开头会让 mail.* 永远不命中。
   */
  function compileBlockPatterns(blocklist) {
    const patterns = [];
    if (!Array.isArray(blocklist)) return patterns;
    for (let i = 0; i < blocklist.length; i += 1) {
      const text = String(blocklist[i] == null ? '' : blocklist[i]).trim();
      if (!text) continue;
      try {
        const source = text.indexOf('*') >= 0
          ? escapeRegExp(text).replace(/\\\*/g, '.*')
          : escapeRegExp(text);
        patterns.push(new RegExp(source, 'i'));
      } catch (error) {
        // 极少数情况下正则不合法，跳过这一条而不是让整页崩掉
      }
    }
    return patterns;
  }

  /** 扩展给的一条记录 → 卡片数据；不是 http(s) 的一律丢掉。 */
  function normalizeHistoryItem(raw) {
    if (!isPlainObject(raw)) return null;

    const url = typeof raw.url === 'string' ? raw.url : '';
    if (!/^https?:\/\//i.test(url)) return null;

    const host = hostOf(url);
    if (!host) return null;

    const title = typeof raw.title === 'string' ? raw.title.replace(/\s+/g, ' ').trim() : '';
    const lastVisitTime = Number(raw.lastVisitTime);
    const visitCount = Number(raw.visitCount);

    return {
      url: url,
      host: host,
      title: (title || host.replace(/^www\./i, '') || url).slice(0, 200),
      lastVisitTime: Number.isFinite(lastVisitTime) && lastVisitTime > 0 ? lastVisitTime : 0,
      visitCount: Number.isFinite(visitCount) && visitCount > 0 ? Math.floor(visitCount) : 1,
      mergedCount: 1,
    };
  }

  function isBlockedByPatterns(card, patterns) {
    if (!patterns.length) return false;
    const haystack = card.url + '\n' + card.title + '\n' + card.host;
    for (let i = 0; i < patterns.length; i += 1) {
      if (patterns[i].test(haystack)) return true;
    }
    return false;
  }

  /** 同域名合并：保留最近访问的那条作为代表，访问次数累加。 */
  function mergeHistoryByHost(cards) {
    const byHost = new Map();
    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const existing = byHost.get(card.host);
      if (!existing) {
        byHost.set(card.host, card);
        continue;
      }
      existing.visitCount += card.visitCount;
      existing.mergedCount += 1;
      if (card.lastVisitTime > existing.lastVisitTime) {
        existing.url = card.url;
        existing.title = card.title;
        existing.lastVisitTime = card.lastVisitTime;
      }
    }
    return Array.from(byHost.values());
  }

  /** 「3 分钟前」这类相对时间；超过 30 天就给具体日期。 */
  function relativeTime(timestamp, now) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return '';

    const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const diff = current - value;

    const minute = 60000;
    const hour = minute * 60;
    const day = hour * 24;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < day * 30) return Math.floor(diff / day) + ' 天前';

    const date = new Date(value);
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /**
   * 扩展返回的原始记录 → 要渲染的卡片列表：
   * 清洗 → 按屏蔽词过滤 → 去重 → 按时间倒序 → （可选）同域名合并 → 截断。
   */
  function buildHistoryCards(rawItems, settings, now) {
    const options = normalizeHistorySettings(settings);
    const patterns = compileBlockPatterns(options.blocklist);

    const seen = Object.create(null);
    let cards = [];
    const list = Array.isArray(rawItems) ? rawItems : [];
    for (let i = 0; i < list.length; i += 1) {
      const card = normalizeHistoryItem(list[i]);
      if (!card || seen[card.url]) continue;
      seen[card.url] = true;
      if (isBlockedByPatterns(card, patterns)) continue;
      cards.push(card);
    }

    cards.sort(byLastVisitDesc);
    if (options.mergeByHost) {
      cards = mergeHistoryByHost(cards);
      cards.sort(byLastVisitDesc);
    }

    cards = cards.slice(0, options.count);
    cards.forEach(function (card) {
      card.timeText = relativeTime(card.lastVisitTime, now);
      card.label = card.title || card.host.replace(/^www\./i, '');
    });
    return cards;
  }

  function byLastVisitDesc(a, b) {
    return b.lastVisitTime - a.lastVisitTime;
  }

  /**
   * 第三方网站截图服务（WordPress mShots，免费无需 key）。
   * 注意：这会把网址作为参数发给对方，所以默认关闭，由用户在设置里主动开启。
   */
  function screenshotUrlFor(pageUrl, width) {
    const size = clamp(Math.round(Number(width) || 480), 120, 1280);
    return 'https://s0.wp.com/mshots/v1/' + encodeURIComponent(pageUrl) + '?w=' + size;
  }

  /* -------------------------------------------------------------- 快捷方式 */

  function defaultShortcutSettings() {
    return {
      autoFill: true,                     // 是否按历史自动补充
      total: SHORTCUT_DEFAULT_TOTAL,      // 快捷方式总个数（手动 + 自动）
    };
  }

  function normalizeShortcutSettings(raw) {
    const out = defaultShortcutSettings();
    if (!isPlainObject(raw)) return out;

    out.autoFill = raw.autoFill !== false;

    const total = Number(raw.total);
    if (Number.isFinite(total)) {
      out.total = clamp(Math.round(total), SHORTCUT_MIN_TOTAL, SHORTCUT_MAX_TOTAL);
    }
    return out;
  }

  /**
   * 快捷方式区 = 手动链接 + 由浏览历史自动补充的部分。
   *
   * 自动部分**不写进 links**，每次渲染现算：这样不会污染用户手动维护的数据，
   * 关掉开关立刻恢复原样，也不会出现「删掉了下次又冒出来」。
   *
   * 挑选规则：沿用历史那套过滤（屏蔽词、同域名合并），再排掉手动链接里已有的站点，
   * 剩下的按访问频次从高到低取，同频次看谁更近。
   */
  function buildShortcutList(manualLinks, rawHistory, options) {
    const opts = isPlainObject(options) ? options : {};
    const config = normalizeShortcutSettings(opts.shortcuts);
    const manual = Array.isArray(manualLinks) ? manualLinks : [];

    const result = {
      manual: manual,
      auto: [],
      total: manual.length,
      slots: Math.max(0, config.total - manual.length),
    };

    if (!config.autoFill || result.slots === 0 || !Array.isArray(rawHistory) || !rawHistory.length) {
      return result;
    }

    // count 放大：这里要的是「候选池」，最后取多少由 slots 决定
    const historyOptions = {};
    const source = isPlainObject(opts.history) ? opts.history : {};
    Object.keys(source).forEach(function (key) { historyOptions[key] = source[key]; });
    historyOptions.count = 200;
    historyOptions.mergeByHost = true;

    const cards = buildHistoryCards(rawHistory, historyOptions, Date.now());
    cards.sort(function (a, b) {
      return (b.visitCount - a.visitCount) || (b.lastVisitTime - a.lastVisitTime);
    });

    const taken = Object.create(null);
    manual.forEach(function (link) {
      const host = hostOf(link && link.url);
      if (host) taken[host] = true;
    });

    for (let i = 0; i < cards.length && result.auto.length < result.slots; i += 1) {
      const card = cards[i];
      if (taken[card.host]) continue;
      taken[card.host] = true;
      result.auto.push({
        id: 'auto:' + card.host,
        name: card.host.replace(/^www\./i, ''),
        url: card.url,
        host: card.host,
        auto: true,
        visitCount: card.visitCount,
        timeText: card.timeText,
      });
    }

    result.total = manual.length + result.auto.length;
    return result;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    DATA_VERSION: DATA_VERSION,
    MAX_LINKS: MAX_LINKS,
    MAX_NAME_LENGTH: MAX_NAME_LENGTH,
    DEFAULT_OVERLAY: DEFAULT_OVERLAY,
    MAX_OVERLAY: MAX_OVERLAY,
    HISTORY_DEFAULT_COUNT: HISTORY_DEFAULT_COUNT,
    HISTORY_MAX_COUNT: HISTORY_MAX_COUNT,
    HISTORY_DAYS: HISTORY_DAYS,
    SHORTCUT_DEFAULT_TOTAL: SHORTCUT_DEFAULT_TOTAL,
    SHORTCUT_MIN_TOTAL: SHORTCUT_MIN_TOTAL,
    SHORTCUT_MAX_TOTAL: SHORTCUT_MAX_TOTAL,
    ENGINES: ENGINES,
    PRESETS: PRESETS,
    DEFAULT_LINKS: DEFAULT_LINKS,

    defaultData: defaultData,
    defaultBackground: defaultBackground,
    normalizeData: normalizeData,
    normalizeBackground: normalizeBackground,
    sanitizeLink: sanitizeLink,

    normalizeUrl: normalizeUrl,
    hostOf: hostOf,
    faviconUrlFor: faviconUrlFor,
    colorForSeed: colorForSeed,
    initialOf: initialOf,

    engineById: engineById,
    buildSearchUrl: buildSearchUrl,
    presetById: presetById,

    defaultHistorySettings: defaultHistorySettings,
    normalizeHistorySettings: normalizeHistorySettings,
    compileBlockPatterns: compileBlockPatterns,
    normalizeHistoryItem: normalizeHistoryItem,
    mergeHistoryByHost: mergeHistoryByHost,
    relativeTime: relativeTime,
    buildHistoryCards: buildHistoryCards,
    screenshotUrlFor: screenshotUrlFor,

    defaultShortcutSettings: defaultShortcutSettings,
    normalizeShortcutSettings: normalizeShortcutSettings,
    buildShortcutList: buildShortcutList,

    uid: uid,
    clamp: clamp,
    dropTargetIndex: dropTargetIndex,
  };
});
