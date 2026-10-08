/*
 * core.js 的验收测试：node tests/core.test.js
 * core.js 不依赖 DOM，所以可以直接在 Node 里跑。
 */
'use strict';

const assert = require('assert');
const path = require('path');
const Core = require(path.join(__dirname, '..', 'extension', 'assets', 'core.js'));

let passed = 0;
const failures = [];

function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓ ' + name);
  } catch (error) {
    failures.push(name);
    console.log('  ✗ ' + name + '\n      ' + error.message);
  }
}

console.log('normalizeUrl —— 输入是不是一个可以直接打开的网址');
ok('裸域名补上 https', () => assert.strictEqual(Core.normalizeUrl('github.com'), 'https://github.com/'));
ok('完整网址原样保留', () => assert.strictEqual(Core.normalizeUrl('https://a.com/x?y=1'), 'https://a.com/x?y=1'));
ok('localhost 带端口', () => assert.strictEqual(Core.normalizeUrl('localhost:3000'), 'https://localhost:3000/'));
ok('IPv4 带路径', () => assert.strictEqual(Core.normalizeUrl('192.168.1.1/admin'), 'https://192.168.1.1/admin'));
ok('域名带端口和查询串', () => assert.strictEqual(Core.normalizeUrl('example.com:8080/a?b=1'), 'https://example.com:8080/a?b=1'));
ok('www 开头的裸域名', () => assert.strictEqual(Core.normalizeUrl('www.baidu.com/s?wd=x'), 'https://www.baidu.com/s?wd=x'));
ok('拒绝 javascript: 伪协议', () => assert.strictEqual(Core.normalizeUrl('javascript:alert(1)'), null));
ok('拒绝 data: 伪协议', () => assert.strictEqual(Core.normalizeUrl('data:text/html,<script>x</script>'), null));
ok('拒绝 file: 与 about:', () => {
  assert.strictEqual(Core.normalizeUrl('file:///C:/x.html'), null);
  assert.strictEqual(Core.normalizeUrl('about:config'), null);
});
ok('拒绝 ftp:', () => assert.strictEqual(Core.normalizeUrl('ftp://example.com'), null));
ok('拒绝 mailto:', () => assert.strictEqual(Core.normalizeUrl('mailto:a@b.com'), null));
ok('含空格的内容交给搜索', () => assert.strictEqual(Core.normalizeUrl('hello world'), null));
ok('普通词组交给搜索', () => assert.strictEqual(Core.normalizeUrl('reactive programming'), null));
ok('中文交给搜索', () => assert.strictEqual(Core.normalizeUrl('知乎'), null));
ok('空值与非法类型不报错', () => {
  assert.strictEqual(Core.normalizeUrl(''), null);
  assert.strictEqual(Core.normalizeUrl(null), null);
  assert.strictEqual(Core.normalizeUrl(42), null);
});

console.log('搜索引擎');
ok('查询词会被转义', () => assert.strictEqual(Core.buildSearchUrl('baidu', 'a b&c'), 'https://www.baidu.com/s?wd=a%20b%26c'));
ok('未知引擎回退到第一个', () => assert.strictEqual(Core.buildSearchUrl('nope', 'x'), 'https://www.google.com/search?q=x'));
ok('每个引擎模板都含 %s', () => Core.ENGINES.forEach(e => assert.ok(e.url.indexOf('%s') > -1, e.id + ' 缺少 %s')));

console.log('链接与数据清洗');
ok('没填名称时用域名（去掉 www）', () => {
  const link = Core.sanitizeLink({ url: 'https://www.example.com/a' });
  assert.strictEqual(link.name, 'example.com');
  assert.ok(link.id);
});
ok('非法链接被丢弃', () => assert.strictEqual(Core.sanitizeLink({ url: 'javascript:alert(1)' }), null));
ok('非对象输入被丢弃', () => assert.strictEqual(Core.sanitizeLink('x'), null));
ok('超长名称被截断', () => {
  const link = Core.sanitizeLink({ name: 'x'.repeat(100), url: 'https://a.com' });
  assert.strictEqual(link.name.length, Core.MAX_NAME_LENGTH);
});
ok('空数据得到默认值', () => {
  const data = Core.normalizeData(null);
  assert.strictEqual(data.links.length, Core.DEFAULT_LINKS.length);
  assert.strictEqual(data.background.type, 'preset');
  assert.strictEqual(data.layout.showClock, true);
});
ok('乱七八糟的数据不会抛异常', () => { Core.normalizeData({ links: 'nope', background: 5, search: [], layout: 'x' }); });
ok('重复链接被去重，坏链接被过滤', () => {
  const data = Core.normalizeData({
    links: [{ url: 'https://a.com' }, { url: 'https://a.com/' }, { url: 'javascript:x' }, { url: 'b.com' }],
  });
  assert.deepStrictEqual(data.links.map(l => l.url), ['https://a.com/', 'https://b.com/']);
});
ok('用户主动清空链接后保持为空', () => assert.strictEqual(Core.normalizeData({ links: [] }).links.length, 0));
ok('未知引擎回退', () => assert.strictEqual(Core.normalizeData({ search: { engine: 'x' } }).search.engine, 'google'));
ok('遮罩强度被夹在合法范围内', () => {
  assert.strictEqual(Core.normalizeData({ background: { overlay: 9 } }).background.overlay, Core.MAX_OVERLAY);
  assert.strictEqual(Core.normalizeData({ background: { overlay: -3 } }).background.overlay, 0);
});
ok('未知预设回退到第一个', () => {
  assert.strictEqual(Core.normalizeData({ background: { type: 'preset', preset: 'zzz' } }).background.preset, Core.PRESETS[0].id);
});
ok('图片背景保留图片数据', () => {
  const data = Core.normalizeData({ background: { type: 'image', image: 'data:image/png;base64,AAA' } });
  assert.strictEqual(data.background.type, 'image');
  assert.strictEqual(data.background.image, 'data:image/png;base64,AAA');
});
ok('非 data:image 的图片来源被丢弃', () => {
  const data = Core.normalizeData({ background: { type: 'image', image: 'https://evil/x.png' } });
  assert.strictEqual(data.background.type, 'preset');
  assert.strictEqual(data.background.image, '');
});
ok('切到预设后图片仍保留（方便切回来）', () => {
  const data = Core.normalizeData({ background: { type: 'preset', preset: 'ink', image: 'data:image/png;base64,AAA' } });
  assert.strictEqual(data.background.type, 'preset');
  assert.strictEqual(data.background.image, 'data:image/png;base64,AAA');
});
ok('归一化是幂等的', () => {
  const once = Core.normalizeData({ links: [{ url: 'a.com', name: 'A' }] });
  assert.deepStrictEqual(Core.normalizeData(once), once);
});

console.log('图标与配色');
ok('favicon 取站点根目录', () => assert.strictEqual(Core.faviconUrlFor('https://a.com/x/y?z'), 'https://a.com/favicon.ico'));
ok('非法网址没有 favicon', () => assert.strictEqual(Core.faviconUrlFor('nope'), ''));
ok('同一域名颜色稳定、不同域名不同', () => {
  assert.deepStrictEqual(Core.colorForSeed('github.com'), Core.colorForSeed('github.com'));
  assert.notStrictEqual(Core.colorForSeed('github.com').bg, Core.colorForSeed('zhihu.com').bg);
});
ok('首字兼容中文与 emoji', () => {
  assert.strictEqual(Core.initialOf('知乎'), '知');
  assert.strictEqual(Core.initialOf('github'), 'G');
  assert.strictEqual(Core.initialOf('🌊 海浪'), '🌊');
  assert.strictEqual(Core.initialOf(''), '?');
});
ok('预设 id 全部可查', () => Core.PRESETS.forEach(p => assert.ok(Core.presetById(p.id))));

console.log('拖拽排序（配合「先移除再插入」的落点计算）');
const list = ['A', 'B', 'C', 'D'];
function move(items, from, targetIndex, dropAfter) {
  const to = Core.dropTargetIndex(from, targetIndex, dropAfter);
  const copy = items.slice();
  const moved = copy.splice(from, 1)[0];
  copy.splice(to, 0, moved);
  return copy;
}
ok('往后拖：落在目标右半边 → 插到它后面', () => assert.deepStrictEqual(move(list, 0, 1, true), ['B', 'A', 'C', 'D']));
ok('往后拖：落在目标左半边 → 位置不变', () => assert.deepStrictEqual(move(list, 0, 1, false), ['A', 'B', 'C', 'D']));
ok('往前拖：落在最前面', () => assert.deepStrictEqual(move(list, 3, 0, false), ['D', 'A', 'B', 'C']));
ok('往前拖：落在目标右半边 → 插到它后面', () => assert.deepStrictEqual(move(list, 3, 1, true), ['A', 'B', 'D', 'C']));
ok('拖到自己身上不动', () => {
  assert.deepStrictEqual(move(list, 1, 1, true), ['A', 'B', 'C', 'D']);
  assert.deepStrictEqual(move(list, 1, 1, false), ['A', 'B', 'C', 'D']);
});
ok('直接拖到末尾', () => assert.deepStrictEqual(move(list, 0, 3, true), ['B', 'C', 'D', 'A']));
ok('非法下标返回 -1', () => {
  assert.strictEqual(Core.dropTargetIndex(-1, 2, false), -1);
  assert.strictEqual(Core.dropTargetIndex(0, -1, false), -1);
});
ok('任意拖放都不会丢元素', () => {
  for (let from = 0; from < list.length; from += 1) {
    for (let target = 0; target < list.length; target += 1) {
      for (const after of [true, false]) {
        const result = move(list, from, target, after);
        assert.strictEqual(result.length, list.length, '长度变了: ' + [from, target, after]);
        assert.deepStrictEqual(result.slice().sort(), ['A', 'B', 'C', 'D'], '元素变了: ' + [from, target, after]);
      }
    }
  }
});

console.log('浏览历史：设置与屏蔽词');
ok('默认设置', () => {
  const settings = Core.normalizeHistorySettings(null);
  assert.strictEqual(settings.enabled, true);
  assert.strictEqual(settings.count, Core.HISTORY_DEFAULT_COUNT);
  assert.strictEqual(settings.mergeByHost, true);
  assert.strictEqual(settings.useScreenshots, false);
  assert.deepStrictEqual(settings.blocklist, []);
});
ok('数量被夹在 1~24', () => {
  assert.strictEqual(Core.normalizeHistorySettings({ count: 0 }).count, 1);
  assert.strictEqual(Core.normalizeHistorySettings({ count: 999 }).count, Core.HISTORY_MAX_COUNT);
  assert.strictEqual(Core.normalizeHistorySettings({ count: 12.6 }).count, 13);
});
ok('开关取值安全', () => {
  const settings = Core.normalizeHistorySettings({ enabled: false, mergeByHost: false, useScreenshots: 'yes' });
  assert.strictEqual(settings.enabled, false);
  assert.strictEqual(settings.mergeByHost, false);
  assert.strictEqual(settings.useScreenshots, false, '只有 true 才算开启截图');
});
ok('屏蔽词清洗：去空、截断、限量', () => {
  const settings = Core.normalizeHistorySettings({ blocklist: ['  mail  ', '', null, 42, 'x'.repeat(200)] });
  assert.deepStrictEqual(settings.blocklist, ['mail', 'x'.repeat(80)]);
});
ok('无 * 的屏蔽词按「包含」匹配', () => {
  const patterns = Core.compileBlockPatterns(['mail']);
  assert.strictEqual(patterns[0].test('https://gmail.com/x'), true);
  assert.strictEqual(patterns[0].test('https://github.com'), false);
});
ok('有 * 的屏蔽词按通配匹配（仍是「包含」，不锚定整串）', () => {
  const patterns = Core.compileBlockPatterns(['*.example.com', 'mail.*']);
  assert.strictEqual(patterns[0].test('https://a.example.com'), true);
  assert.strictEqual(patterns[0].test('https://b.example.com/path'), true);
  assert.strictEqual(patterns[0].test('https://example.com'), false, '.example.com 不该匹配根域');
  assert.strictEqual(patterns[1].test('https://mail.qq.com'), true);
  assert.strictEqual(patterns[1].test('https://www.mail.qq.com'), true, 'mail.* 命中任意位置的 mail. ');
});
ok('屏蔽词里的正则元字符被当普通字符', () => {
  const patterns = Core.compileBlockPatterns(['a.b']);
  assert.strictEqual(patterns[0].test('xaxb'), false, '点号不该当成任意字符');
  assert.strictEqual(patterns[0].test('a.b'), true);
});

console.log('浏览历史：记录清洗');
ok('非 http(s) 的记录被丢掉', () => {
  assert.strictEqual(Core.normalizeHistoryItem({ url: 'about:config' }), null);
  assert.strictEqual(Core.normalizeHistoryItem({ url: 'javascript:x' }), null);
  assert.strictEqual(Core.normalizeHistoryItem({ url: 'file:///C:/x.html' }), null);
});
ok('标题为空时用域名（去掉 www）', () => {
  const item = Core.normalizeHistoryItem({ url: 'https://www.zhihu.com/question/1', title: '  ' });
  assert.strictEqual(item.title, 'zhihu.com');
});
ok('标题里的连续空白被折叠', () => {
  const item = Core.normalizeHistoryItem({ url: 'https://a.com', title: '  知乎 \n 首页  ' });
  assert.strictEqual(item.title, '知乎 首页');
});
ok('缺失的访问次数兜底为 1', () => {
  assert.strictEqual(Core.normalizeHistoryItem({ url: 'https://a.com' }).visitCount, 1);
});

console.log('浏览历史：合并与排序');
ok('同域名合并：访问次数累加，代表取最近一条', () => {
  const merged = Core.mergeHistoryByHost([
    { url: 'https://a.com/1', host: 'a.com', title: '旧', lastVisitTime: 100, visitCount: 2, mergedCount: 1 },
    { url: 'https://a.com/2', host: 'a.com', title: '新', lastVisitTime: 500, visitCount: 3, mergedCount: 1 },
    { url: 'https://b.com', host: 'b.com', title: 'B', lastVisitTime: 300, visitCount: 1, mergedCount: 1 },
  ]);
  const a = merged.find(c => c.host === 'a.com');
  assert.strictEqual(a.visitCount, 5);
  assert.strictEqual(a.mergedCount, 2);
  assert.strictEqual(a.url, 'https://a.com/2');
  assert.strictEqual(a.title, '新');
});

console.log('浏览历史：相对时间');
ok('各时间档位', () => {
  const now = 1700000000000;
  assert.strictEqual(Core.relativeTime(now - 5000, now), '刚刚');
  assert.strictEqual(Core.relativeTime(now - 5 * 60000, now), '5 分钟前');
  assert.strictEqual(Core.relativeTime(now - 3 * 3600000, now), '3 小时前');
  assert.strictEqual(Core.relativeTime(now - 2 * 86400000, now), '2 天前');
});
ok('超过 30 天给具体日期', () => {
  const now = new Date(2026, 8, 29, 12, 0, 0).getTime();
  const old = new Date(2026, 0, 5, 12, 0, 0).getTime();
  assert.strictEqual(Core.relativeTime(old, now), '2026-01-05');
});
ok('时间戳缺失时不显示', () => {
  assert.strictEqual(Core.relativeTime(0, Date.now()), '');
  assert.strictEqual(Core.relativeTime(undefined, Date.now()), '');
});

console.log('浏览历史：整条流水线');
const rawHistory = [
  { url: 'https://a.com/1', title: 'A 旧', lastVisitTime: 100, visitCount: 1 },
  { url: 'https://a.com/2', title: 'A 新', lastVisitTime: 900, visitCount: 4 },
  { url: 'https://b.com/', title: '', lastVisitTime: 800, visitCount: 1 },
  { url: 'https://mail.qq.com/', title: '邮箱', lastVisitTime: 700, visitCount: 9 },
  { url: 'https://c.com/', title: 'C', lastVisitTime: 600, visitCount: 1 },
  { url: 'https://a.com/2', title: '重复', lastVisitTime: 900, visitCount: 4 },
  { url: 'about:config', title: 'x', lastVisitTime: 999 },
];
ok('默认：按时间倒序、去重、合并同域名、条数受限', () => {
  const cards = Core.buildHistoryCards(rawHistory, { count: 3, blocklist: ['mail'] }, 1000);
  assert.deepStrictEqual(cards.map(c => c.host), ['a.com', 'b.com', 'c.com']);
  assert.strictEqual(cards[0].title, 'A 新');
  assert.strictEqual(cards[0].visitCount, 5);
  assert.strictEqual(cards[1].title, 'b.com', '标题为空回落域名');
  assert.strictEqual(cards[0].label, 'A 新');
});
ok('数量设置生效', () => {
  assert.strictEqual(Core.buildHistoryCards(rawHistory, { count: 1 }, 1000).length, 1);
  assert.strictEqual(Core.buildHistoryCards(rawHistory, { count: 24 }, 1000).length, 4);
});
ok('关掉合并时不合并同域名（顺序按最近访问倒序）', () => {
  const cards = Core.buildHistoryCards(rawHistory, { mergeByHost: false, count: 24 }, 1000);
  assert.strictEqual(cards.length, 5);
  assert.deepStrictEqual(cards.map(c => c.host), ['a.com', 'b.com', 'mail.qq.com', 'c.com', 'a.com']);
  assert.strictEqual(cards[0].url, 'https://a.com/2', 'a.com 最近的一条排最前');
  assert.strictEqual(cards[4].url, 'https://a.com/1', 'a.com 更早的一条排最后');
});
ok('屏蔽词生效（标题命中也会被挡）', () => {
  const cards = Core.buildHistoryCards(rawHistory, { blocklist: ['A 新'], count: 24, mergeByHost: false }, 1000);
  assert.deepStrictEqual(cards.map(c => c.url), ['https://b.com/', 'https://mail.qq.com/', 'https://c.com/', 'https://a.com/1']);
  const cards2 = Core.buildHistoryCards(rawHistory, { blocklist: ['*qq*'], count: 24 }, 1000);
  assert.deepStrictEqual(cards2.map(c => c.host), ['a.com', 'b.com', 'c.com']);
});
ok('空输入与坏输入不报错', () => {
  assert.deepStrictEqual(Core.buildHistoryCards(null, null, 1), []);
  assert.deepStrictEqual(Core.buildHistoryCards([null, 'x', 42], {}, 1), []);
});
ok('每条卡片都带相对时间文案', () => {
  const cards = Core.buildHistoryCards(rawHistory, { count: 24 }, 900000 + 60000);
  assert.ok(cards[0].timeText, '缺少 timeText');
});

console.log('浏览历史：截图地址');
ok('网址被正确转义进路径', () => {
  const url = Core.screenshotUrlFor('https://a.com/x?y=1&z=2', 480);
  assert.strictEqual(url, 'https://s0.wp.com/mshots/v1/' + encodeURIComponent('https://a.com/x?y=1&z=2') + '?w=480');
  assert.ok(url.indexOf('a.com/x?y=1') === -1, '原始网址不该以明文出现');
});
ok('宽度被夹在合理范围', () => {
  assert.strictEqual(Core.screenshotUrlFor('https://a.com').indexOf('?w=480') > 0, true);
  assert.strictEqual(Core.screenshotUrlFor('https://a.com', 5).indexOf('?w=120') > 0, true);
  assert.strictEqual(Core.screenshotUrlFor('https://a.com', 9999).indexOf('?w=1280') > 0, true);
});

console.log('快捷方式：设置');
ok('默认开启自动补充，总数 12', () => {
  const settings = Core.normalizeShortcutSettings(null);
  assert.strictEqual(settings.autoFill, true);
  assert.strictEqual(settings.total, Core.SHORTCUT_DEFAULT_TOTAL);
});
ok('总数被夹在合法范围', () => {
  assert.strictEqual(Core.normalizeShortcutSettings({ total: 1 }).total, Core.SHORTCUT_MIN_TOTAL);
  assert.strictEqual(Core.normalizeShortcutSettings({ total: 999 }).total, Core.SHORTCUT_MAX_TOTAL);
  assert.strictEqual(Core.normalizeShortcutSettings({ total: 9.4 }).total, 9);
});
ok('开关只有显式 false 才算关闭', () => {
  assert.strictEqual(Core.normalizeShortcutSettings({ autoFill: false }).autoFill, false);
  assert.strictEqual(Core.normalizeShortcutSettings({ autoFill: 'no' }).autoFill, true);
});

console.log('快捷方式：按历史自动补充');
const shortcutHistory = [
  { url: 'https://github.com/mozilla/x', title: 'GH', lastVisitTime: 1000, visitCount: 50 },
  { url: 'https://news.ycombinator.com/', title: 'HN', lastVisitTime: 5000, visitCount: 30 },
  { url: 'https://mail.qq.com/', title: '邮箱', lastVisitTime: 9000, visitCount: 20 },
  { url: 'https://zhihu.com/q/1', title: '知乎', lastVisitTime: 9000, visitCount: 10 },
];
const manualLinks = [
  { id: 'l1', name: 'GitHub', url: 'https://github.com' },
  { id: 'l2', name: 'B站', url: 'https://www.bilibili.com' },
];
ok('补到设定的总个数，按访问频次从高到低', () => {
  const board = Core.buildShortcutList(manualLinks, shortcutHistory, { shortcuts: { total: 4 } });
  assert.strictEqual(board.manual.length, 2);
  assert.strictEqual(board.total, 4);
  assert.deepStrictEqual(board.auto.map((a) => a.host), ['news.ycombinator.com', 'mail.qq.com']);
});
ok('手动已有的站点不会被重复补一份', () => {
  const board = Core.buildShortcutList(manualLinks, shortcutHistory, { shortcuts: { total: 4 } });
  assert.strictEqual(board.auto.filter((a) => a.host === 'github.com').length, 0);
});
ok('总数已被手动链接占满时不再补', () => {
  const board = Core.buildShortcutList(manualLinks, shortcutHistory, { shortcuts: { total: 2 } });
  assert.deepStrictEqual(board.auto, []);
  assert.strictEqual(board.total, 2);
});
ok('手动链接超过总数也不报错', () => {
  const board = Core.buildShortcutList(manualLinks, shortcutHistory, { shortcuts: { total: 4, autoFill: true } });
  const three = manualLinks.concat([{ id: 'l3', name: 'C', url: 'https://c.com' }]);
  const overflow = Core.buildShortcutList(three, shortcutHistory, { shortcuts: { total: 2 } });
  assert.strictEqual(overflow.slots, 0);
  assert.strictEqual(overflow.auto.length, 0);
  assert.strictEqual(board.slots, 2);
});
ok('关掉开关就完全不补', () => {
  const board = Core.buildShortcutList(manualLinks, shortcutHistory, { shortcuts: { autoFill: false, total: 12 } });
  assert.deepStrictEqual(board.auto, []);
  assert.strictEqual(board.total, manualLinks.length);
});
ok('屏蔽词对自动补充同样生效', () => {
  const board = Core.buildShortcutList(manualLinks, shortcutHistory, {
    shortcuts: { total: 4 },
    history: { blocklist: ['mail'] },
  });
  assert.deepStrictEqual(board.auto.map((a) => a.host), ['news.ycombinator.com', 'zhihu.com']);
});
ok('没有历史就什么都不补', () => {
  assert.strictEqual(Core.buildShortcutList(manualLinks, [], { shortcuts: { total: 12 } }).auto.length, 0);
  assert.strictEqual(Core.buildShortcutList(manualLinks, null, {}).auto.length, 0);
});
ok('自动项带 auto 标记，供渲染区分', () => {
  const board = Core.buildShortcutList([], shortcutHistory, { shortcuts: { total: 3 } });
  assert.deepStrictEqual(board.auto.map((a) => a.host), ['github.com', 'news.ycombinator.com', 'mail.qq.com']);
  assert.ok(board.auto.every((a) => a.auto === true));
  assert.ok(board.auto.every((a) => a.id.indexOf('auto:') === 0));
});
ok('不会改动传进来的手动链接数组（自动部分不落库）', () => {
  const links = [{ id: 'x', name: 'A', url: 'https://a.com' }];
  const before = JSON.stringify(links);
  Core.buildShortcutList(links, shortcutHistory, { shortcuts: { total: 5 } });
  assert.strictEqual(JSON.stringify(links), before);
});
ok('非 http(s) 的历史记录进不了快捷方式', () => {
  const board = Core.buildShortcutList([], [
    { url: 'about:config', title: 'x', lastVisitTime: 1, visitCount: 99 },
    { url: 'https://ok.com/', title: 'OK', lastVisitTime: 2, visitCount: 1 },
  ], { shortcuts: { total: 5 } });
  assert.deepStrictEqual(board.auto.map((a) => a.host), ['ok.com']);
});

console.log('\n通过 ' + passed + ' 项，失败 ' + failures.length + ' 项');
if (failures.length) process.exit(1);
