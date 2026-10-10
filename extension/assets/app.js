/*!
 * FoxHome · app —— 页面行为（DOM 渲染、交互、本地持久化）
 * 纯逻辑都在 core.js，这里只负责把状态画出来。
 */
(function () {
  'use strict';

  const Core = window.FoxHomeCore;
  if (!Core) {
    console.error('[FoxHome] core.js 未加载，页面无法工作');
    return;
  }

  const $ = function (id) { return document.getElementById(id); };

  // 背景图压缩后的上限（data URL 字符数）。localStorage 大约 5 MB，
  // 这个值留出了给链接数据的余量。
  const IMAGE_LIMIT = 1400000;
  const COMPRESS_ATTEMPTS = [
    { edge: 2560, quality: 0.86 },
    { edge: 2560, quality: 0.75 },
    { edge: 1920, quality: 0.72 },
    { edge: 1600, quality: 0.68 },
    { edge: 1280, quality: 0.64 },
  ];

  const els = {
    bg: $('bg'),
    veil: $('veil'),
    clock: $('clock'),
    clockTime: $('clockTime'),
    clockDate: $('clockDate'),
    searchForm: $('searchForm'),
    engineBtn: $('engineBtn'),
    engineName: $('engineName'),
    engineMenu: $('engineMenu'),
    engineList: $('engineList'),
    engineAddBtn: $('engineAddBtn'),
    engineDialog: $('engineDialog'),
    engineForm: $('engineForm'),
    engineDialogTitle: $('engineDialogTitle'),
    engineNameInput: $('engineNameInput'),
    engineUrlInput: $('engineUrlInput'),
    engineError: $('engineError'),
    engineCancel: $('engineCancel'),
    searchInput: $('searchInput'),
    links: $('links'),
    gearBtn: $('gearBtn'),
    scrim: $('scrim'),
    sheet: $('sheet'),
    sheetClose: $('sheetClose'),
    swatches: $('swatches'),
    pickImageBtn: $('pickImageBtn'),
    clearImageBtn: $('clearImageBtn'),
    imageInput: $('imageInput'),
    imageHint: $('imageHint'),
    overlayRange: $('overlayRange'),
    overlayValue: $('overlayValue'),
    clockToggle: $('clockToggle'),
    faviconToggle: $('faviconToggle'),
    shortcutAutoToggle: $('shortcutAutoToggle'),
    shortcutTotalRange: $('shortcutTotalRange'),
    shortcutTotalValue: $('shortcutTotalValue'),
    shortcutHint: $('shortcutHint'),
    historyBoard: $('historyBoard'),
    historyRefresh: $('historyRefresh'),
    historyList: $('history'),
    historyNote: $('historyNote'),
    historyToggle: $('historyToggle'),
    historyCountRange: $('historyCountRange'),
    historyCountValue: $('historyCountValue'),
    historyMergeToggle: $('historyMergeToggle'),
    historyShotToggle: $('historyShotToggle'),
    historyBlocklist: $('historyBlocklist'),
    historyStatus: $('historyStatus'),
    exportBtn: $('exportBtn'),
    importBtn: $('importBtn'),
    importInput: $('importInput'),
    resetBtn: $('resetBtn'),
    storageHint: $('storageHint'),
    linkDialog: $('linkDialog'),
    linkForm: $('linkForm'),
    linkDialogTitle: $('linkDialogTitle'),
    linkName: $('linkName'),
    linkUrl: $('linkUrl'),
    linkError: $('linkError'),
    linkCancel: $('linkCancel'),
    toast: $('toast'),
  };

  /* ================================================================ 持久化 */

  const storage = (function () {
    let usable = true;
    try {
      localStorage.setItem(Core.STORAGE_KEY + '.probe', '1');
      localStorage.removeItem(Core.STORAGE_KEY + '.probe');
    } catch (error) {
      usable = false;
    }

    return {
      get usable() { return usable; },
      read: function () {
        if (!usable) return null;
        try {
          const raw = localStorage.getItem(Core.STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (error) {
          console.warn('[FoxHome] 本地数据读取失败，将使用默认设置', error);
          return null;
        }
      },
      write: function (data) {
        if (!usable) return { ok: false, reason: 'unavailable' };
        try {
          localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(data));
          return { ok: true };
        } catch (error) {
          const quota = error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22);
          return { ok: false, reason: quota ? 'quota' : 'unknown', error: error };
        }
      },
      clear: function () {
        if (!usable) return;
        try { localStorage.removeItem(Core.STORAGE_KEY); } catch (error) { /* 忽略 */ }
      },
    };
  })();

  let state = Core.normalizeData(storage.read());

  /** 保存当前状态；失败时给出人话提示（而不是静默丢数据）。 */
  function save() {
    const result = storage.write(state);
    if (result.ok) return true;
    if (result.reason === 'quota') {
      toast('本地存储空间不足，改动没能保存。换一张小一点的背景图，或先导出备份。', 'error', 6000);
    } else if (result.reason === 'unavailable') {
      toast('这个环境不允许本地保存，刷新后改动会丢失。建议导出备份。', 'error', 6000);
    } else {
      toast('保存失败：' + ((result.error && result.error.message) || '未知错误'), 'error', 6000);
    }
    return false;
  }

  /* ================================================================ 提示条 */

  let toastTimer = 0;
  function toast(message, type, duration) {
    els.toast.textContent = message;
    els.toast.className = 'toast show' + (type ? ' ' + type : '');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.className = 'toast';
    }, duration || 3200);
  }

  /* ================================================================ 背景 */

  function applyBackground() {
    const background = state.background;
    const hasImage = background.type === 'image' && !!background.image;
    // 卡片要不要上毛玻璃：预设渐变本身平滑，模糊看不出区别，只有图片背景才值得
    // （见 styles.css 里的 .has-image-bg 规则）—— 卡片最多几十个，省下的是 GPU 合成。
    document.body.classList.toggle('has-image-bg', hasImage);
    if (hasImage) {
      els.bg.style.background = '#0d0f13';
      els.bg.style.backgroundImage = 'url("' + background.image + '")';
      els.bg.style.backgroundSize = 'cover';
      els.bg.style.backgroundPosition = 'center';
      els.bg.style.backgroundRepeat = 'no-repeat';
    } else {
      const preset = Core.presetById(background.preset) || Core.PRESETS[0];
      els.bg.style.backgroundImage = 'none';
      els.bg.style.background = preset.css;
    }
    els.veil.style.opacity = String(background.overlay);
  }

  function choosePreset(id) {
    if (!Core.presetById(id)) return;
    state.background.type = 'preset';
    state.background.preset = id;
    save();
    applyBackground();
    updateSwatchState();
  }

  /** 压缩 + 落库。图片始终以 data URL 保存，离线也能用。 */
  function loadBitmap(file) {
    if (typeof window.createImageBitmap === 'function') {
      return window.createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () {
          return window.createImageBitmap(file).catch(function () {
            return loadImageElement(file);
          });
        });
    }
    return loadImageElement(file);
  }

  function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('图片无法解码'));
      };
      image.src = url;
    });
  }

  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsDataURL(file);
    });
  }

  async function compressImage(file) {
    let bitmap = null;
    try {
      bitmap = await loadBitmap(file);
    } catch (error) {
      bitmap = null;
    }

    // 拿不到位图（少见格式）时退回原图，只要体积还过得去
    if (!bitmap) {
      const raw = await readAsDataUrl(file);
      if (raw.length > IMAGE_LIMIT) throw new Error('这张图片太大，且当前环境无法压缩它');
      return { dataUrl: raw, compressed: false };
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    let latest = '';

    for (let i = 0; i < COMPRESS_ATTEMPTS.length; i += 1) {
      const attempt = COMPRESS_ATTEMPTS[i];
      const scale = Math.min(1, attempt.edge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#0d0f13'; // JPEG 没有透明通道，先铺底色
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/jpeg', attempt.quality);
      } catch (error) {
        // 浏览器把画布标记为「污染」时不允许导出，退回原图
        if (bitmap.close) bitmap.close();
        const raw = await readAsDataUrl(file);
        if (raw.length > IMAGE_LIMIT) throw new Error('浏览器不允许压缩这张图片，请换一张更小的');
        return { dataUrl: raw, compressed: false };
      }

      latest = dataUrl;
      if (dataUrl.length <= IMAGE_LIMIT) break;
    }

    if (bitmap.close) bitmap.close();
    if (latest.length > IMAGE_LIMIT) throw new Error('这张图片压缩后依然太大，请换一张');
    return { dataUrl: latest, compressed: true };
  }

  async function useImageFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      toast('请选择图片文件', 'error');
      return;
    }

    els.imageHint.textContent = '正在处理图片…';
    try {
      const result = await compressImage(file);
      state.background.image = result.dataUrl;
      state.background.imageName = file.name.slice(0, 120);
      state.background.type = 'image';
      const saved = save();
      applyBackground();
      renderSwatches();
      syncControls();
      if (saved) toast(result.compressed ? '背景已更新（图片已压缩）' : '背景已更新');
    } catch (error) {
      els.imageHint.textContent = '';
      syncControls();
      toast('图片处理失败：' + error.message, 'error', 5000);
    }
  }

  // 把图片直接拖到页面上
  function dragHasFiles(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    if (!types) return false;
    return Array.prototype.indexOf.call(types, 'Files') !== -1;
  }

  document.addEventListener('dragover', function (event) {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    document.body.classList.add('dropping');
  });

  document.addEventListener('dragleave', function (event) {
    if (event.relatedTarget === null) document.body.classList.remove('dropping');
  });

  document.addEventListener('drop', function (event) {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    document.body.classList.remove('dropping');
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) useImageFile(file);
  });

  /* ================================================================ 时钟 */

  // 界面只显示到分钟，所以没必要每秒醒一次：每次对齐到「下一分钟」的边界再更新，
  // 从每分钟 60 次降到 1 次。
  const MINUTE_MS = 60000;
  let clockTimer = 0;

  function scheduleClock() {
    window.clearTimeout(clockTimer);
    const untilNextMinute = MINUTE_MS - (Date.now() % MINUTE_MS);
    clockTimer = window.setTimeout(function () {
      tickClock();
      scheduleClock();
    }, untilNextMinute + 50); // 多等 50ms，绕开系统计时误差
  }

  function tickClock() {
    const now = new Date();
    const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    if (els.clockTime.textContent !== time) els.clockTime.textContent = time;

    const date = now.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });
    if (els.clockDate.textContent !== date) els.clockDate.textContent = date;
  }

  function pad(number) {
    return number < 10 ? '0' + number : String(number);
  }

  function renderClockVisibility() {
    els.clock.classList.toggle('hidden', !state.layout.showClock);
  }

  /* ================================================================ 搜索 */

  function currentEngine() {
    return Core.engineIn(state.search.engines, state.search.engine) || state.search.engines[0];
  }

  function renderEngine() {
    const engine = currentEngine();
    els.engineName.textContent = engine.name;
    const items = els.engineMenu.querySelectorAll('.engine-item');
    for (let i = 0; i < items.length; i += 1) {
      const active = items[i].dataset.engine === engine.id;
      items[i].classList.toggle('active', active);
      items[i].setAttribute('aria-selected', String(active));
    }
  }

  /** 菜单按用户当前的引擎列表重建 —— 增删改之后要跟着变 */
  function buildEngineMenu() {
    els.engineMenu.replaceChildren();

    state.search.engines.forEach(function (engine) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'engine-item';
      item.dataset.engine = engine.id;
      item.setAttribute('role', 'option');
      item.textContent = engine.name;
      item.addEventListener('click', function () {
        state.search.engine = engine.id;
        save();
        renderEngine();
        renderEngineList();
        closeEngineMenu();
        els.searchInput.focus();
      });
      els.engineMenu.appendChild(item);
    });

    // 菜单尾巴上挂个通往设置的入口，省得为了加一个引擎去翻设置面板
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'engine-item engine-manage';
    manage.textContent = '自定义搜索引擎…';
    manage.addEventListener('click', function () {
      closeEngineMenu();
      openSheet();
      els.engineList.scrollIntoView({ block: 'center' });
    });
    els.engineMenu.appendChild(manage);
  }

  /** 设置面板里的引擎管理列表：点名字切换，右侧编辑/删除 */
  function renderEngineList() {
    els.engineList.replaceChildren();

    state.search.engines.forEach(function (engine) {
      const row = document.createElement('li');
      row.className = 'engine-row';
      if (engine.id === state.search.engine) row.classList.add('active');

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'engine-pick';
      pick.title = '设为当前引擎';
      const rowName = document.createElement('span');
      rowName.className = 'engine-row-name';
      rowName.textContent = engine.name;
      const rowUrl = document.createElement('span');
      rowUrl.className = 'engine-row-url';
      rowUrl.textContent = engine.url;
      pick.appendChild(rowName);
      pick.appendChild(rowUrl);
      pick.addEventListener('click', function () {
        state.search.engine = engine.id;
        save();
        renderEngine();
        renderEngineList();
      });

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'engine-action';
      edit.textContent = '编辑';
      edit.addEventListener('click', function () { openEngineDialog(engine.id); });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'engine-action danger';
      remove.textContent = '删除';
      // 至少留一个：只剩一个时不许再删，否则就没有引擎可用了
      remove.disabled = state.search.engines.length <= 1;
      if (remove.disabled) remove.title = '至少要保留一个搜索引擎';
      remove.addEventListener('click', function () { removeEngine(engine.id); });

      row.appendChild(pick);
      row.appendChild(edit);
      row.appendChild(remove);
      els.engineList.appendChild(row);
    });
  }

  function removeEngine(id) {
    if (state.search.engines.length <= 1) {
      toast('至少要保留一个搜索引擎', 'error');
      return;
    }
    const engine = Core.engineIn(state.search.engines, id);
    if (!engine) return;

    state.search.engines = state.search.engines.filter(function (item) { return item.id !== id; });
    if (state.search.engine === id) state.search.engine = state.search.engines[0].id;
    save();
    buildEngineMenu();
    renderEngine();
    renderEngineList();
    toast('已删除「' + engine.name + '」');
  }

  let editingEngineId = null;

  function openEngineDialog(id) {
    editingEngineId = id || null;
    const engine = editingEngineId ? Core.engineIn(state.search.engines, editingEngineId) : null;

    els.engineDialogTitle.textContent = engine ? '编辑搜索引擎' : '添加搜索引擎';
    els.engineNameInput.value = engine ? engine.name : '';
    els.engineUrlInput.value = engine ? engine.url : '';
    showEngineError('');
    els.engineDialog.showModal();
    window.setTimeout(function () { els.engineNameInput.focus(); }, 30);
  }

  function closeEngineDialog() {
    editingEngineId = null;
    els.engineDialog.close();
  }

  function showEngineError(message) {
    els.engineError.textContent = message || '';
    els.engineError.hidden = !message;
  }

  els.engineForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const name = els.engineNameInput.value.trim();
    const url = els.engineUrlInput.value.trim();

    if (!name) {
      showEngineError('给这个搜索引擎起个名字吧');
      els.engineNameInput.focus();
      return;
    }
    if (!Core.isSearchTemplate(url)) {
      showEngineError('搜索地址要以 http:// 或 https:// 开头，并且用 %s 表示关键词的位置');
      els.engineUrlInput.focus();
      return;
    }
    if (!editingEngineId && state.search.engines.length >= Core.MAX_ENGINES) {
      showEngineError('最多只能有 ' + Core.MAX_ENGINES + ' 个搜索引擎');
      return;
    }

    if (editingEngineId) {
      const engine = Core.engineIn(state.search.engines, editingEngineId);
      if (engine) {
        engine.name = name.slice(0, Core.MAX_ENGINE_NAME);
        engine.url = url;
      }
    } else {
      const engine = Core.sanitizeEngine({ name: name, url: url });
      if (!engine) {
        showEngineError('这个名字或地址看起来不太对，再检查一下');
        return;
      }
      state.search.engines.push(engine);
    }

    save();
    buildEngineMenu();
    renderEngine();
    renderEngineList();
    closeEngineDialog();
  });

  els.engineCancel.addEventListener('click', closeEngineDialog);
  els.engineDialog.addEventListener('click', function (event) {
    if (event.target === els.engineDialog) closeEngineDialog();
  });
  els.engineAddBtn.addEventListener('click', function () { openEngineDialog(null); });

  function openEngineMenu() {
    els.engineMenu.hidden = false;
    els.engineBtn.setAttribute('aria-expanded', 'true');
    els.engineMenu.classList.add('open');
  }

  function closeEngineMenu() {
    els.engineMenu.hidden = true;
    els.engineMenu.classList.remove('open');
    els.engineBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleEngineMenu() {
    if (els.engineMenu.hidden) openEngineMenu();
    else closeEngineMenu();
  }

  function submitSearch() {
    const query = els.searchInput.value.trim();
    if (!query) return;
    const direct = Core.normalizeUrl(query);
    if (direct) {
      window.location.href = direct;
      return;
    }
    window.location.href = Core.buildSearchUrl(state.search.engine, query, state.search.engines);
  }

  /* ================================================================ 链接 */

  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H5L4 6"/><path d="M10 11v6M14 11v6"/></svg>',
  };

  let dragFromIndex = -1;

  /**
   * 快捷方式区 = 手动链接 + 按浏览历史自动补充的部分。
   * 自动部分每次现算、不落库（见 core.js 的 buildShortcutList），所以这里的渲染也是纯展示。
   */
  function renderLinks() {
    const board = Core.buildShortcutList(state.links, history.items, {
      shortcuts: state.shortcuts,
      history: state.history,
    });

    els.links.replaceChildren();
    board.manual.forEach(function (link, index) {
      els.links.appendChild(buildLinkCard(link, index));
    });
    board.auto.forEach(function (entry) {
      els.links.appendChild(buildAutoLinkCard(entry));
    });
    els.links.appendChild(buildAddCard());

    if (els.shortcutHint) {
      els.shortcutHint.dataset.autoCount = String(board.auto.length);
      updateShortcutHint();
    }
  }

  /** 自动补上来的快捷方式：只能点开，不能编辑/删除/拖动，用虚线框和手动的区分开 */
  function buildAutoLinkCard(entry) {
    const anchor = document.createElement('a');
    anchor.className = 'link link-auto';
    anchor.href = entry.url;
    anchor.title = entry.name + '\n' + entry.url
      + '\n（根据浏览历史自动补充，最近 30 天访问 ' + entry.visitCount + ' 次）';

    anchor.appendChild(buildSiteIcon(entry.url, entry.name, 'site-icon-lg'));

    const name = document.createElement('span');
    name.className = 'link-name';
    name.textContent = entry.name;
    anchor.appendChild(name);

    const badge = document.createElement('span');
    badge.className = 'link-auto-badge';
    badge.textContent = '历史';
    anchor.appendChild(badge);

    return anchor;
  }

  /**
   * 站点图标：优先网站 favicon，取不到就回退到「首字母 + 按域名生成的配色」色块。
   * 链接卡片和历史卡片共用。
   */
  /**
   * 外部图片（站点 favicon、第三方截图）会阻塞 window.load ——
   * 新标签页的标签图标因此会转上好几秒（实测 12 个 favicon 把 load 拖到 3.4s）。
   *
   * 这里统一改成：首屏只渲染字母色块，等 load 之后、浏览器空闲时再补上外部图片。
   */
  const pendingImages = [];
  let imagesUnlocked = false;

  function loadExternalImage(image, url) {
    if (imagesUnlocked) {
      image.src = url;
      return;
    }
    pendingImages.push({ image: image, url: url });
  }

  function releaseExternalImages() {
    imagesUnlocked = true;
    const queued = pendingImages.splice(0, pendingImages.length);
    for (let i = 0; i < queued.length; i += 1) queued[i].image.src = queued[i].url;
  }

  if (document.readyState === 'complete') {
    window.setTimeout(releaseExternalImages, 0);
  } else {
    window.addEventListener('load', function () {
      // 再等浏览器空闲：首屏已经画完，取图标的网络请求不跟渲染抢资源
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(releaseExternalImages, { timeout: 1500 });
      } else {
        window.setTimeout(releaseExternalImages, 200);
      }
    });
  }

  function buildSiteIcon(url, label, sizeClass) {
    const icon = document.createElement('span');
    icon.className = 'site-icon' + (sizeClass ? ' ' + sizeClass : '');

    const color = Core.colorForSeed(Core.hostOf(url) || label);
    const badge = document.createElement('span');
    badge.className = 'site-icon-badge';
    badge.textContent = Core.initialOf(label);
    badge.style.background = color.bg;
    badge.style.color = color.fg;
    icon.appendChild(badge);

    const favicon = state.layout.showFavicons ? Core.faviconUrlFor(url) : '';
    if (favicon) {
      const image = document.createElement('img');
      image.className = 'site-icon-favicon';
      image.alt = '';
      image.draggable = false;
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('load', function () { icon.classList.add('has-favicon'); });
      image.addEventListener('error', function () { image.remove(); });
      loadExternalImage(image, favicon);
      icon.appendChild(image);
    }

    return icon;
  }

  function buildLinkCard(link, index) {
    const card = document.createElement('div');
    card.className = 'link';
    card.draggable = true;
    card.dataset.index = String(index);

    // 铺满整张卡片的链接层：卡片里才能放真正的按钮
    const open = document.createElement('a');
    open.className = 'link-open';
    open.href = link.url;
    open.title = link.url;
    open.setAttribute('aria-label', '打开 ' + link.name);
    open.draggable = false;

    const icon = buildSiteIcon(link.url, link.name, 'site-icon-lg');

    const name = document.createElement('span');
    name.className = 'link-name';
    name.textContent = link.name;

    const tools = document.createElement('span');
    tools.className = 'link-tools';
    tools.appendChild(toolButton('编辑', ICONS.edit, function () { openLinkDialog(link.id); }));
    tools.appendChild(toolButton('删除', ICONS.trash, function () { removeLink(link.id); }));

    card.append(open, icon, name, tools);
    bindCardDrag(card, index);
    return card;
  }

  function toolButton(label, svg, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-tool';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = svg;
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function buildAddCard() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link link-add';
    button.innerHTML = '<span class="add-plus">+</span><span class="link-name">添加</span>';
    button.addEventListener('click', function () { openLinkDialog(null); });
    return button;
  }

  /** HTML5 拖放排序：按落点左右半区决定插到目标前还是后。 */
  function bindCardDrag(card, index) {
    card.addEventListener('dragstart', function (event) {
      dragFromIndex = index;
      card.classList.add('dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    });

    card.addEventListener('dragend', function () {
      dragFromIndex = -1;
      clearDropHints();
      card.classList.remove('dragging');
    });

    card.addEventListener('dragover', function (event) {
      if (dragFromIndex < 0) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const rect = card.getBoundingClientRect();
      const after = event.clientX - rect.left > rect.width / 2;
      card.classList.toggle('drop-after', after);
      card.classList.toggle('drop-before', !after);
    });

    card.addEventListener('dragleave', function () {
      card.classList.remove('drop-before', 'drop-after');
    });

    card.addEventListener('drop', function (event) {
      if (dragFromIndex < 0) return;
      event.preventDefault();
      const rect = card.getBoundingClientRect();
      const after = event.clientX - rect.left > rect.width / 2;
      const target = Core.dropTargetIndex(dragFromIndex, index, after);
      clearDropHints();
      moveLink(dragFromIndex, target);
      dragFromIndex = -1;
    });
  }

  function clearDropHints() {
    const hints = els.links.querySelectorAll('.drop-before, .drop-after');
    for (let i = 0; i < hints.length; i += 1) {
      hints[i].classList.remove('drop-before', 'drop-after');
    }
  }

  function moveLink(from, to) {
    if (from < 0 || to < 0 || from === to || from >= state.links.length) return;
    if (to > state.links.length) to = state.links.length;
    const moved = state.links.splice(from, 1)[0];
    state.links.splice(to, 0, moved);
    save();
    renderLinks();
  }

  function removeLink(id) {
    const index = state.links.findIndex(function (link) { return link.id === id; });
    if (index < 0) return;
    const name = state.links[index].name;
    state.links.splice(index, 1);
    save();
    renderLinks();
    toast('已删除「' + name + '」');
  }

  /* ============================================================== 浏览历史 */

  // 新标签页 / 主页都由扩展接管，这类页面有特权 API 权限，可以直接读浏览历史，
  // 不需要任何中转。（如果从 file:// 直接打开这个页面，浏览器不会把 browser 暴露给
  // 页面脚本，那时读不到历史 —— 这是浏览器的安全边界，不是 bug。）
  const privilegedApi = (typeof browser !== 'undefined' && browser && browser.history
    && typeof browser.history.search === 'function') ? browser : null;

  const history = {
    status: 'idle', // idle | loading | ready | error | missing
    items: [],
    error: '',
  };

  function requestHistory() {
    if (!privilegedApi) {
      history.status = 'missing';
      renderHistoryBoard();
      return;
    }

    if (history.status !== 'ready') history.status = 'loading';
    updateHistoryStatusText();

    const startTime = Date.now() - Core.HISTORY_DAYS * 24 * 60 * 60 * 1000;
    return privilegedApi.history.search({
      text: '',
      startTime: startTime,
      // 历史卡片最多显示 24 张、自动快捷方式最多 30 个，按站点合并后再挑，
      // 所以取最近 300 条足够覆盖；不必一次把 30 天的全部记录都拉进内存。
      maxResults: 300,
    }).then(function (items) {
      history.status = 'ready';
      history.items = Array.isArray(items) ? items : [];
      history.error = '';
      refreshHistoryViews();
    }).catch(function (error) {
      history.status = 'error';
      history.error = String((error && error.message) || error);
      renderHistoryBoard();
    });
  }

  /** 历史数据变了：历史卡片和「快捷方式区」都要跟着重画（后者靠历史补位） */
  function refreshHistoryViews() {
    renderHistoryBoard();
    renderLinks();
  }

  function renderHistoryBoard() {
    if (!state.history.enabled) {
      els.historyBoard.classList.add('hidden');
      return;
    }
    els.historyBoard.classList.remove('hidden');
    els.historyList.replaceChildren();

    if (history.status === 'ready') {
      const cards = Core.buildHistoryCards(history.items, state.history, Date.now());
      cards.forEach(function (card) {
        els.historyList.appendChild(buildHistoryCard(card, state.history));
      });
      els.historyNote.textContent = cards.length
        ? '取自 Firefox 最近 ' + Core.HISTORY_DAYS + ' 天的记录，共 ' + cards.length + ' 条。'
        : '最近 ' + Core.HISTORY_DAYS + ' 天里没有可显示的记录（也可能都被屏蔽词过滤了）。';
    } else {
      els.historyNote.textContent = '';
      const placeholder = document.createElement('p');
      placeholder.className = 'board-placeholder';
      placeholder.textContent = historyPlaceholderText();
      els.historyList.appendChild(placeholder);
    }

    updateHistoryStatusText();
  }

  function historyPlaceholderText() {
    if (history.status === 'error') {
      return '读取历史失败：' + history.error;
    }
    if (history.status === 'missing') {
      return '这个页面读不到浏览历史 —— 只有扩展接管的新标签页和主页才有这个权限。'
        + '请按 Ctrl+T 打开新标签页，或把主页指向本扩展（在 about:preferences#home 里设）。';
    }
    return '正在读取浏览历史…';
  }

  function buildHistoryCard(card, settings) {
    const anchor = document.createElement('a');
    anchor.className = 'history-card' + (settings.useScreenshots ? ' has-thumb' : '');
    anchor.href = card.url;
    anchor.title = card.title + '\n' + card.url;

    if (settings.useScreenshots) {
      const thumb = document.createElement('span');
      thumb.className = 'history-thumb';
      const image = document.createElement('img');
      image.alt = '';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      // 第三方截图服务经常还没生成好，失败就退回纯文字卡片，不留破图
      image.addEventListener('error', function () {
        thumb.remove();
        anchor.classList.remove('has-thumb');
      });
      loadExternalImage(image, Core.screenshotUrlFor(card.url, 480));
      thumb.appendChild(image);
      anchor.appendChild(thumb);
    }

    const head = document.createElement('span');
    head.className = 'history-head';
    head.appendChild(buildSiteIcon(card.url, card.label, 'site-icon-sm'));
    const title = document.createElement('span');
    title.className = 'history-title';
    title.textContent = card.label;
    head.appendChild(title);
    anchor.appendChild(head);

    // 域名/时间和访问次数共用一个 flex 行：次数不做绝对定位，否则会压住标题
    const foot = document.createElement('span');
    foot.className = 'history-foot';

    const meta = document.createElement('span');
    meta.className = 'history-meta';
    meta.textContent = card.host.replace(/^www\./i, '') + (card.timeText ? ' · ' + card.timeText : '');
    foot.appendChild(meta);

    if (card.visitCount > 1) {
      const count = document.createElement('span');
      count.className = 'history-count';
      count.textContent = '×' + card.visitCount;
      count.title = '最近 ' + Core.HISTORY_DAYS + ' 天内访问 ' + card.visitCount + ' 次';
      foot.appendChild(count);
    }

    anchor.appendChild(foot);

    return anchor;
  }

  function updateHistoryStatusText() {
    if (history.status === 'ready') {
      els.historyStatus.textContent = '已读取浏览器历史，共 ' + history.items.length + ' 条原始记录。';
    } else if (history.status === 'missing') {
      els.historyStatus.textContent = '当前页面没有读取浏览历史的权限 —— 请通过扩展接管的新标签页或主页打开它。';
    } else if (history.status === 'error') {
      els.historyStatus.textContent = '读取失败：' + history.error;
    } else {
      els.historyStatus.textContent = '正在读取浏览历史…';
    }
  }

  /* ------------------------------------------------------- 链接编辑对话框 */

  let editingLinkId = null;

  function openLinkDialog(id) {
    editingLinkId = id || null;
    const link = editingLinkId
      ? state.links.find(function (item) { return item.id === editingLinkId; })
      : null;

    els.linkDialogTitle.textContent = link ? '编辑链接' : '添加链接';
    els.linkName.value = link ? link.name : '';
    els.linkUrl.value = link ? link.url : '';
    showLinkError('');
    els.linkDialog.showModal();
    window.setTimeout(function () {
      (link ? els.linkUrl : els.linkName).focus();
    }, 30);
  }

  function closeLinkDialog() {
    editingLinkId = null;
    els.linkDialog.close();
  }

  function showLinkError(message) {
    els.linkError.textContent = message || '';
    els.linkError.hidden = !message;
  }

  els.linkForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const url = Core.normalizeUrl(els.linkUrl.value);
    if (!url) {
      showLinkError('请输入有效的网址，例如 example.com 或 https://example.com');
      els.linkUrl.focus();
      return;
    }

    const typed = els.linkName.value.trim();
    const name = (typed || Core.hostOf(url).replace(/^www\./i, '') || url).slice(0, Core.MAX_NAME_LENGTH);

    if (editingLinkId) {
      const link = state.links.find(function (item) { return item.id === editingLinkId; });
      if (link) {
        link.name = name;
        link.url = url;
      }
    } else {
      state.links.push({ id: Core.uid('link'), name: name, url: url });
    }

    save();
    renderLinks();
    closeLinkDialog();
    toast(editingLinkId ? '链接已更新' : '已添加「' + name + '」');
  });

  els.linkCancel.addEventListener('click', closeLinkDialog);

  // 点对话框外的遮罩关闭
  els.linkDialog.addEventListener('click', function (event) {
    if (event.target === els.linkDialog) closeLinkDialog();
  });

  /* ================================================================ 设置面板 */

  function openSheet() {
    els.sheet.classList.add('open');
    els.scrim.classList.add('open');
    els.sheet.setAttribute('aria-hidden', 'false');
    els.gearBtn.setAttribute('aria-expanded', 'true');
    syncControls();
  }

  function closeSheet() {
    if (els.sheet.contains(document.activeElement)) document.activeElement.blur();
    els.sheet.classList.remove('open');
    els.scrim.classList.remove('open');
    els.sheet.setAttribute('aria-hidden', 'true');
    els.gearBtn.setAttribute('aria-expanded', 'false');
  }

  function renderSwatches() {
    els.swatches.replaceChildren();
    Core.PRESETS.forEach(function (preset) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.dataset.preset = preset.id;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-label', preset.name);
      button.title = preset.name;

      const chip = document.createElement('span');
      chip.className = 'swatch-chip';
      chip.style.background = preset.css;

      const label = document.createElement('span');
      label.className = 'swatch-name';
      label.textContent = preset.name;

      button.append(chip, label);
      button.addEventListener('click', function () { choosePreset(preset.id); });
      els.swatches.appendChild(button);
    });

    if (state.background.image) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.dataset.preset = '__image__';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-label', '我的图片');
      button.title = state.background.imageName || '我的图片';

      const chip = document.createElement('span');
      chip.className = 'swatch-chip';
      chip.style.backgroundImage = 'url("' + state.background.image + '")';

      const label = document.createElement('span');
      label.className = 'swatch-name';
      label.textContent = '我的图片';

      button.append(chip, label);
      button.addEventListener('click', function () {
        state.background.type = 'image';
        save();
        applyBackground();
        updateSwatchState();
      });
      els.swatches.appendChild(button);
    }

    updateSwatchState();
  }

  function updateSwatchState() {
    const buttons = els.swatches.querySelectorAll('.swatch');
    for (let i = 0; i < buttons.length; i += 1) {
      const button = buttons[i];
      const active = state.background.type === 'image'
        ? button.dataset.preset === '__image__'
        : button.dataset.preset === state.background.preset;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    }
  }

  /** 设置面板里那行随状态变化的说明 */
  function updateShortcutHint() {
    if (!els.shortcutHint) return;
    const autoCount = Number(els.shortcutHint.dataset.autoCount || 0);

    if (!state.shortcuts.autoFill) {
      els.shortcutHint.textContent = '已关闭自动补充，快捷方式区只显示你手动添加的链接。';
    } else if (autoCount > 0) {
      els.shortcutHint.textContent = '当前自动补了 ' + autoCount + ' 个（虚线框那些），取自「最近浏览」里访问最频繁的站点。'
        + '它们不会被写进你的链接数据，关掉开关就消失。';
    } else {
      els.shortcutHint.textContent = '自动补充的站点取自「最近浏览」，按访问频次挑选、排在你手动添加的后面，并用虚线框标出。'
        + '现在还没有可补的：可能是历史为空、手动链接已占满总数，或者候选都被屏蔽词挡掉了。';
    }
  }

  function syncControls() {
    els.clockToggle.checked = state.layout.showClock;
    els.faviconToggle.checked = state.layout.showFavicons;

    els.shortcutAutoToggle.checked = state.shortcuts.autoFill;
    els.shortcutTotalRange.value = String(state.shortcuts.total);
    els.shortcutTotalValue.textContent = String(state.shortcuts.total);
    updateShortcutHint();

    els.historyToggle.checked = state.history.enabled;
    els.historyMergeToggle.checked = state.history.mergeByHost;
    els.historyShotToggle.checked = state.history.useScreenshots;
    els.historyCountRange.value = String(state.history.count);
    els.historyCountValue.textContent = String(state.history.count);
    if (document.activeElement !== els.historyBlocklist) {
      els.historyBlocklist.value = state.history.blocklist.join('\n');
    }

    const overlayPercent = Math.round(state.background.overlay * 100);
    els.overlayRange.value = String(overlayPercent);
    els.overlayValue.textContent = overlayPercent + '%';

    els.clearImageBtn.disabled = !state.background.image;
    if (state.background.imageName && state.background.image) {
      els.imageHint.textContent = '当前图片：' + state.background.imageName + '（已保存在本机浏览器中）';
    } else {
      els.imageHint.textContent = '也可以把图片直接拖进页面。图片会压缩后保存在本机浏览器里。';
    }

    if (!storage.usable) {
      els.storageHint.textContent = '⚠ 当前环境不允许本地保存，改动只在本次会话有效。';
    } else if (state.background.image && state.background.image.length > IMAGE_LIMIT * 0.9) {
      els.storageHint.textContent = '背景图片较大，本地存储接近上限。';
    } else {
      els.storageHint.textContent = '数据保存在这台电脑的浏览器里，换设备请用导出／导入。';
    }
  }

  els.gearBtn.addEventListener('click', function () {
    if (els.sheet.classList.contains('open')) closeSheet();
    else openSheet();
  });
  els.sheetClose.addEventListener('click', closeSheet);
  els.scrim.addEventListener('click', closeSheet);

  els.pickImageBtn.addEventListener('click', function () { els.imageInput.click(); });
  els.imageInput.addEventListener('change', function () {
    const file = els.imageInput.files && els.imageInput.files[0];
    els.imageInput.value = '';
    useImageFile(file);
  });

  els.clearImageBtn.addEventListener('click', function () {
    state.background.image = '';
    state.background.imageName = '';
    state.background.type = 'preset';
    save();
    applyBackground();
    renderSwatches();
    syncControls();
    toast('已移除背景图片');
  });

  els.overlayRange.addEventListener('input', function () {
    const overlay = Core.clamp(Number(els.overlayRange.value) / 100, 0, Core.MAX_OVERLAY);
    state.background.overlay = overlay;
    els.veil.style.opacity = String(overlay);
    els.overlayValue.textContent = Math.round(overlay * 100) + '%';
  });
  els.overlayRange.addEventListener('change', function () { save(); });

  els.clockToggle.addEventListener('change', function () {
    state.layout.showClock = els.clockToggle.checked;
    save();
    renderClockVisibility();
  });

  els.faviconToggle.addEventListener('change', function () {
    state.layout.showFavicons = els.faviconToggle.checked;
    save();
    renderLinks();
    renderHistoryBoard();
  });

  /* ---------------------------------------------------------- 快捷方式设置 */

  els.shortcutAutoToggle.addEventListener('change', function () {
    state.shortcuts.autoFill = els.shortcutAutoToggle.checked;
    save();
    renderLinks();
    // 刚打开自动补充、但这次会话还没拉过历史时，补一次请求
    if (state.shortcuts.autoFill && history.status !== 'ready') requestHistory();
  });

  els.shortcutTotalRange.addEventListener('input', function () {
    const total = Core.clamp(
      Math.round(Number(els.shortcutTotalRange.value) || 1),
      Core.SHORTCUT_MIN_TOTAL,
      Core.SHORTCUT_MAX_TOTAL
    );
    state.shortcuts.total = total;
    els.shortcutTotalValue.textContent = String(total);
    renderLinks();
  });

  // 拖动时不必每格都写存储，松手再存
  els.shortcutTotalRange.addEventListener('change', function () { save(); });

  /* ------------------------------------------------------------ 历史设置 */

  els.historyToggle.addEventListener('change', function () {
    state.history.enabled = els.historyToggle.checked;
    save();
    renderHistoryBoard();
  });

  els.historyCountRange.addEventListener('input', function () {
    const count = Core.clamp(Math.round(Number(els.historyCountRange.value) || 1), 1, Core.HISTORY_MAX_COUNT);
    state.history.count = count;
    els.historyCountValue.textContent = String(count);
    renderHistoryBoard();
  });

  // 拖动滑块时不必每格都写存储，松手再存
  els.historyCountRange.addEventListener('change', function () { save(); });

  els.historyMergeToggle.addEventListener('change', function () {
    state.history.mergeByHost = els.historyMergeToggle.checked;
    save();
    renderHistoryBoard();
  });

  els.historyShotToggle.addEventListener('change', function () {
    state.history.useScreenshots = els.historyShotToggle.checked;
    save();
    renderHistoryBoard();
    if (state.history.useScreenshots) {
      toast('截图来自第三方服务，网址会作为参数发给它');
    }
  });

  els.historyBlocklist.addEventListener('change', function () {
    state.history.blocklist = els.historyBlocklist.value
      .split(/[\n,]+/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
    save();
    renderHistoryBoard();
  });

  els.historyRefresh.addEventListener('click', function () {
    history.status = history.items.length ? history.status : 'loading';
    requestHistory();
    toast('正在重新读取浏览历史…');
  });

  /* ============================================================ 备份与恢复 */

  function timestamp() {
    const now = new Date();
    return now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
  }

  els.exportBtn.addEventListener('click', function () {
    const payload = {
      app: 'foxhome',
      version: Core.DATA_VERSION,
      exportedAt: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'foxhome-backup-' + timestamp() + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('备份已导出');
  });

  els.importBtn.addEventListener('click', function () { els.importInput.click(); });

  els.importInput.addEventListener('change', function () {
    const file = els.importInput.files && els.importInput.files[0];
    els.importInput.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
      let parsed = null;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (error) {
        toast('导入失败：不是有效的 JSON 文件', 'error', 5000);
        return;
      }

      const raw = parsed && parsed.data ? parsed.data : parsed;
      if (!window.confirm('导入会覆盖当前的设置和链接，确定继续吗？')) return;

      state = Core.normalizeData(raw);
      save();
      renderAll();
      toast('导入完成');
    };
    reader.onerror = function () { toast('导入失败：文件读不出来', 'error', 5000); };
    reader.readAsText(file);
  });

  els.resetBtn.addEventListener('click', function () {
    if (!window.confirm('恢复默认会清空当前的链接、背景和设置，确定继续吗？')) return;
    storage.clear();
    state = Core.defaultData();
    save();
    renderAll();
    toast('已恢复默认设置');
  });

  /* ================================================================ 快捷键 */

  function isTypingTarget(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (!els.engineMenu.hidden) { closeEngineMenu(); return; }
      if (els.sheet.classList.contains('open')) closeSheet();
      if (isTypingTarget(event.target) && event.target.blur) event.target.blur();
      return;
    }

    if ((event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
      return;
    }

    if (event.key === '/' && !isTypingTarget(event.target)) {
      event.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    }
  });

  /* ================================================================ 装配 */

  function renderAll() {
    applyBackground();
    renderClockVisibility();
    renderLinks();
    buildEngineMenu();
    renderEngine();
    renderEngineList();
    renderSwatches();
    renderHistoryBoard();
    syncControls();
  }

  els.searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    submitSearch();
  });

  els.engineBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    toggleEngineMenu();
  });

  document.addEventListener('click', function (event) {
    if (els.engineMenu.hidden) return;
    if (els.searchForm.contains(event.target)) return;
    closeEngineMenu();
  });

  renderAll();
  tickClock();
  scheduleClock();

  // 向扩展要浏览历史：历史卡片要用它，「快捷方式按历史自动补充」也要用它
  if (state.history.enabled || state.shortcuts.autoFill) requestHistory();

  // 起始页的惯例：打开就能直接打字
  els.searchInput.focus();

  // 页面在后台待久了，回到前台时顺便刷新相对时间（不必重新请求扩展）
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    tickClock();
    if (history.status === 'ready') renderHistoryBoard();
  });
})();
