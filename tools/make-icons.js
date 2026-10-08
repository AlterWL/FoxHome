/*
 * tools/make-icons.js —— 生成扩展图标（PNG）
 *
 * 为什么手写而不是画 SVG：Firefox 不接受 SVG 作为扩展图标（manifest 的 icons
 * 必须是位图），所以这里直接按像素生成，顺便用超采样做抗锯齿。
 *
 * 用法：
 *   node tools/make-icons.js              # 用默认变体写入 extension/icons/
 *   node tools/make-icons.js --variant=cards
 *   node tools/make-icons.js --preview=out.png    # 只出预览对比图，不写图标
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { encodePng } = require('./lib');

const SIZES = [16, 32, 48, 96, 128];
const ICON_DIR = path.join(__dirname, '..', 'extension', 'icons');

// 底色：与起始页默认背景（极夜）同色系，但整体调亮一档并提高了饱和度。
// 原因：Firefox 深色主题下 about:addons 的卡片是 #42414d，原来的深色底会「融进」卡片，
// 只剩白色图形可辨；提亮 + 加饱和后靠色相差异就能立住。
const BG_STOPS = [
  { at: 0, color: [20, 101, 127] },  // #14657f
  { at: 0.52, color: [30, 134, 166] }, // #1e86a6
  { at: 1, color: [47, 166, 201] },  // #2fa6c9
];

const WHITE = [255, 255, 255];

/* ------------------------------------------------------------------ 小工具 */

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function mixColor(from, to, t) {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

function gradientAt(t) {
  const value = clamp01(t);
  for (let i = 1; i < BG_STOPS.length; i += 1) {
    const prev = BG_STOPS[i - 1];
    const next = BG_STOPS[i];
    if (value <= next.at) {
      const local = (value - prev.at) / (next.at - prev.at || 1);
      return mixColor(prev.color, next.color, local);
    }
  }
  return BG_STOPS[BG_STOPS.length - 1].color.slice();
}

function insideRoundRect(u, v, x, y, w, h, r) {
  if (u < x || u > x + w || v < y || v > y + h) return false;
  const cx = Math.min(Math.max(u, x + r), x + w - r);
  const cy = Math.min(Math.max(v, y + r), y + h - r);
  const dx = u - cx;
  const dy = v - cy;
  return dx * dx + dy * dy <= r * r;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp01(((px - x1) * dx + (py - y1) * dy) / lengthSq);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function insideTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const sign = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

/* --------------------------------------------------------------- 三个变体 */

/** 公共底：圆角方块 + 与主页一致的深色渐变 */
function backgroundLayer(u, v) {
  if (!insideRoundRect(u, v, 0, 0, 1, 1, 0.22)) return null;
  const color = gradientAt(u * 0.35 + v * 0.65);
  return [color[0], color[1], color[2], 1];
}

/** A：时钟表盘（左上留缺口）+ 回转箭头 + 指针 —— 最通用的「历史」符号 */
function clockLayer(u, v) {
  const cx = 0.5;
  const cy = 0.53;
  const radius = 0.25;
  const halfWidth = 0.058;
  const distance = Math.hypot(u - cx, v - cy);
  const deg = (Math.atan2(v - cy, u - cx) * 180 / Math.PI + 360) % 360;

  // 表盘：左上 205°~252° 留口给箭头（0°=右、90°=下，所以这段落在左上偏左）
  const inGap = deg >= 205 && deg <= 252;
  if (!inGap && Math.abs(distance - radius) <= halfWidth) return WHITE;

  // 箭头压在缺口的一端，指向逆时针（「往回翻」的语义）
  const arrowDeg = 250;
  const angle = arrowDeg * Math.PI / 180;
  const px = cx + Math.cos(angle) * radius;
  const py = cy + Math.sin(angle) * radius;
  const tx = Math.sin(angle);   // 逆时针切线
  const ty = -Math.cos(angle);
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const size = 0.125;
  if (insideTriangle(
    u, v,
    px + tx * size, py + ty * size,
    px - tx * size * 0.45 + nx * size * 0.85, py - ty * size * 0.45 + ny * size * 0.85,
    px - tx * size * 0.45 - nx * size * 0.85, py - ty * size * 0.45 - ny * size * 0.85
  )) return WHITE;

  // 指针
  if (distanceToSegment(u, v, cx, cy, cx, cy - 0.125) <= 0.038) return WHITE;
  if (distanceToSegment(u, v, cx, cy, cx + 0.12, cy + 0.085) <= 0.038) return WHITE;

  return null;
}

/** B：三张错位叠放的卡片 —— 直接对应页面上的「卡片栏」 */
function cardsLayer(u, v) {
  const w = 0.44;
  const h = 0.27;
  const r = 0.06;
  // 从最前面往后判定，前面那张要盖住后面的
  const front = { x: 0.20, y: 0.42 };
  const middle = { x: 0.28, y: 0.35 };
  const back = { x: 0.36, y: 0.28 };

  if (insideRoundRect(u, v, front.x, front.y, w, h, r)) {
    // 卡面上的两行「文字」用底色挖空，做出卡片感
    if (v >= front.y + 0.06 && v <= front.y + 0.096 && u >= front.x + 0.07 && u <= front.x + 0.34) return [15, 32, 39, 1];
    if (v >= front.y + 0.14 && v <= front.y + 0.172 && u >= front.x + 0.07 && u <= front.x + 0.22) return [15, 32, 39, 1];
    return WHITE;
  }
  if (insideRoundRect(u, v, middle.x, middle.y, w, h, r)) return [255, 255, 255, 0.5];
  if (insideRoundRect(u, v, back.x, back.y, w, h, r)) return [255, 255, 255, 0.26];
  return null;
}

/** C：时间轴 —— 一条竖线 + 三个节点，最简、16px 下最清楚 */
function timelineLayer(u, v) {
  const rows = [0.28, 0.5, 0.72];
  const nodeAlpha = [1, 0.78, 0.58]; // 越新的越实，呼应页面上的相对时间

  for (let i = 0; i < rows.length; i += 1) {
    const y = rows[i];
    // 节点要明显小于行间距，否则三个圆会连成一串
    if (Math.hypot(u - 0.31, v - y) <= 0.066) return [255, 255, 255, nodeAlpha[i]];
    // 条目线
    if (v >= y - 0.029 && v <= y + 0.029 && u >= 0.52 && u <= 0.79) {
      return [255, 255, 255, nodeAlpha[i] * 0.92];
    }
  }

  // 竖线放在最后判：节点和条目线要盖在它上面，且它本身要暗一点才不成「珠子串」
  if (Math.abs(u - 0.31) <= 0.028 && v >= 0.2 && v <= 0.8) return [255, 255, 255, 0.45];

  return null;
}

/* ------------------------------------------------ 以下三个突出「起始页」语义 */

/** 底色，用来「挖空」出镂空效果（跟背景渐变对齐，看不出接缝） */
function backgroundAt(u, v) {
  const color = gradientAt(u * 0.35 + v * 0.65);
  return [color[0], color[1], color[2], 1];
}

/** 屋顶：平缓一些、比屋身宽出一圈，才像「家」而不是箭头 */
function houseRoof(u, v) {
  return insideTriangle(u, v, 0.5, 0.19, 0.9, 0.48, 0.1, 0.48);
}

const HOUSE_BODY = { x: 0.21, y: 0.46, w: 0.58, h: 0.4, r: 0.055 };

/** D：房子 —— 浏览器里「主页」的通用说法，几何简单、小尺寸最稳 */
function homeLayer(u, v) {
  if (houseRoof(u, v)) return WHITE;
  const body = HOUSE_BODY;
  if (!insideRoundRect(u, v, body.x, body.y, body.w, body.h, body.r)) return null;
  // 门洞镂空
  if (insideRoundRect(u, v, 0.415, 0.65, 0.17, 0.21, 0.05)) return backgroundAt(u, v);
  return WHITE;
}

/** E：房子 + 门与窗 —— 门偏左、窗在右上，避免并排两块被读成「一张脸」 */
function homeGridLayer(u, v) {
  if (houseRoof(u, v)) return WHITE;
  const body = HOUSE_BODY;
  if (!insideRoundRect(u, v, body.x, body.y, body.w, body.h, body.r)) return null;

  if (insideRoundRect(u, v, 0.30, 0.65, 0.17, 0.21, 0.05)) return backgroundAt(u, v); // 门
  if (insideRoundRect(u, v, 0.585, 0.56, 0.14, 0.14, 0.02)) return backgroundAt(u, v); // 窗
  return WHITE;
}

/** F：快速拨号网格 —— 起始页本身的形态，最简洁 */
function gridLayer(u, v) {
  const size = 0.3;
  const gap = 0.1;
  const x0 = 0.5 - size - gap / 2;
  const y0 = 0.5 - size - gap / 2;
  const cells = [
    [x0, y0, 1],
    [x0 + size + gap, y0, 0.82],
    [x0, y0 + size + gap, 0.82],
    [x0 + size + gap, y0 + size + gap, 0.62],
  ];
  for (let i = 0; i < cells.length; i += 1) {
    if (insideRoundRect(u, v, cells[i][0], cells[i][1], size, size, 0.075)) {
      return [255, 255, 255, cells[i][2]];
    }
  }
  return null;
}

/* -------------------------------------------------- 换一批「形态」差异更大的 */

/** 浏览器窗口：上半（工具栏）半透明、下半（页面）实心，页面里放一个搜索框 */
function windowLayer(u, v) {
  const x = 0.1;
  const y = 0.15;
  const w = 0.8;
  const h = 0.7;

  if (!insideRoundRect(u, v, x, y, w, h, 0.13)) return null;

  // 页面区域里挖一个搜索胶囊
  if (v >= y + 0.18 && insideRoundRect(u, v, 0.21, 0.47, 0.58, 0.14, 0.07)) return backgroundAt(u, v);

  // 工具栏用半透明表示，省掉细线（小尺寸下细线会糊）
  if (v < y + 0.17) return [255, 255, 255, 0.45];
  return WHITE;
}

/** 浏览器标签页：顶部左侧凸起 + 页面里的两行内容 */
function tabLayer(u, v) {
  // 凸起（梯形，上窄下宽）
  if (v >= 0.16 && v <= 0.37) {
    const t = (v - 0.16) / 0.21;
    const left = 0.28 - 0.1 * t;
    const right = 0.6 + 0.12 * t;
    if (u >= left && u <= right) return WHITE;
  }

  if (insideRoundRect(u, v, 0.11, 0.33, 0.78, 0.52, 0.1)) {
    if (insideRoundRect(u, v, 0.22, 0.47, 0.44, 0.075, 0.035)) return backgroundAt(u, v);
    if (insideRoundRect(u, v, 0.22, 0.62, 0.3, 0.075, 0.035)) return backgroundAt(u, v);
    return WHITE;
  }
  return null;
}

/** 一张纸：右上折角 + 两行内容 —— 字面上的「页面」 */
function pageLayer(u, v) {
  const x = 0.2;
  const y = 0.12;
  const w = 0.6;
  const h = 0.76;

  if (!insideRoundRect(u, v, x, y, w, h, 0.06)) return null;

  // 右上角折角
  if (insideTriangle(u, v, x + w - 0.24, y, x + w, y, x + w, y + 0.24)) return backgroundAt(u, v);

  if (insideRoundRect(u, v, 0.3, 0.4, 0.4, 0.065, 0.03)) return backgroundAt(u, v);
  if (insideRoundRect(u, v, 0.3, 0.54, 0.28, 0.065, 0.03)) return backgroundAt(u, v);
  return WHITE;
}

/** 大搜索框：起始页最核心的那个元素 */
function searchLayer(u, v) {
  if (!insideRoundRect(u, v, 0.09, 0.37, 0.82, 0.26, 0.13)) return null;
  // 输入光标
  if (insideRoundRect(u, v, 0.21, 0.44, 0.055, 0.12, 0.025)) return backgroundAt(u, v);
  return WHITE;
}

/** 日出 + 地平线：一个新开始的意思 */
function sunriseLayer(u, v) {
  const horizon = 0.68;
  // 地平线
  if (v >= horizon - 0.032 && v <= horizon + 0.032 && u >= 0.12 && u <= 0.88) return WHITE;
  // 半个太阳
  const d = Math.hypot(u - 0.5, v - horizon);
  if (v <= horizon && d <= 0.21) return WHITE;
  // 三条光线，方向是 225° / 270° / 315°（屏幕坐标 y 向下，这三个都在太阳上方）
  for (let i = 0; i < 3; i += 1) {
    const angle = Math.PI * 1.5 + (i - 1) * (Math.PI / 4);
    const x0 = 0.5 + Math.cos(angle) * 0.27;
    const y0 = horizon + Math.sin(angle) * 0.27;
    const x1 = 0.5 + Math.cos(angle) * 0.38;
    const y1 = horizon + Math.sin(angle) * 0.38;
    if (distanceToSegment(u, v, x0, y0, x1, y1) <= 0.032) return WHITE;
  }
  return null;
}

const VARIANTS = {
  window: { title: '浏览器窗口 + 搜索框', mark: windowLayer },
  tab: { title: '浏览器标签页', mark: tabLayer },
  page: { title: '一张页面（折角）', mark: pageLayer },
  search: { title: '大搜索框', mark: searchLayer },
  sunrise: { title: '日出 + 地平线', mark: sunriseLayer },
  home: { title: '房子（主页）', mark: homeLayer },
  'home-grid': { title: '房子 + 窗格', mark: homeGridLayer },
  grid: { title: '快速拨号网格', mark: gridLayer },
  cards: { title: '三张叠放的卡片', mark: cardsLayer },
  clock: { title: '时钟 + 回转箭头', mark: clockLayer },
  timeline: { title: '时间轴节点', mark: timelineLayer },
};

const DEFAULT_VARIANT = 'tab';

/* -------------------------------------------------------------- 渲染核心 */

/**
 * 超采样渲染：每个像素拆成 ss×ss 个采样点，按图层从底到顶做 source-over 合成，
 * 最后在「预乘 alpha」空间求平均 —— 这样边缘不会渗出黑边。
 */
function renderIcon(size, mark, ss) {
  const out = Buffer.alloc(size * size * 4);
  const samples = ss * ss;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let pr = 0;
      let pg = 0;
      let pb = 0;
      let pa = 0;

      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const u = (px + (sx + 0.5) / ss) / size;
          const v = (py + (sy + 0.5) / ss) / size;

          let r = 0, g = 0, b = 0, a = 0; // 预乘
          const layers = [backgroundLayer, mark];
          for (let i = 0; i < layers.length; i += 1) {
            const color = layers[i](u, v);
            if (!color) continue;
            const sa = color[3];
            if (sa <= 0) continue;
            r = color[0] * sa + r * (1 - sa);
            g = color[1] * sa + g * (1 - sa);
            b = color[2] * sa + b * (1 - sa);
            a = sa + a * (1 - sa);
          }
          pr += r;
          pg += g;
          pb += b;
          pa += a;
        }
      }

      const alpha = pa / samples;
      const index = (py * size + px) * 4;
      if (alpha > 0) {
        out[index] = Math.max(0, Math.min(255, Math.round(pr / samples / alpha)));
        out[index + 1] = Math.max(0, Math.min(255, Math.round(pg / samples / alpha)));
        out[index + 2] = Math.max(0, Math.min(255, Math.round(pb / samples / alpha)));
      }
      out[index + 3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    }
  }

  return out;
}

function renderVariant(variant, size) {
  const ss = size <= 48 ? 8 : 4;
  return renderIcon(size, VARIANTS[variant].mark, ss);
}

/* ------------------------------------------------------------ 预览拼图 */

function fillRect(target, tw, x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const i = (py * tw + px) * 4;
      target[i] = color[0];
      target[i + 1] = color[1];
      target[i + 2] = color[2];
      target[i + 3] = 255;
    }
  }
}

/** 最近邻放大绘制（用来看 16px 的真实像素效果） */
function blitScaled(target, tw, source, sw, sh, x, y, scale, backdrop) {
  for (let py = 0; py < sh * scale; py += 1) {
    for (let px = 0; px < sw * scale; px += 1) {
      const si = (Math.floor(py / scale) * sw + Math.floor(px / scale)) * 4;
      const a = source[si + 3] / 255;
      const ti = ((y + py) * tw + (x + px)) * 4;
      target[ti] = Math.round(source[si] * a + backdrop[0] * (1 - a));
      target[ti + 1] = Math.round(source[si + 1] * a + backdrop[1] * (1 - a));
      target[ti + 2] = Math.round(source[si + 2] * a + backdrop[2] * (1 - a));
      target[ti + 3] = 255;
    }
  }
}

function renderPreview(variants) {
  const backdrop = [232, 233, 238];
  const colWidth = 168;
  const width = colWidth * variants.length;
  const height = 330;
  const canvas = Buffer.alloc(width * height * 4);
  fillRect(canvas, width, 0, 0, width, height, backdrop);

  variants.forEach(function (variant, column) {
    const originX = column * colWidth + (colWidth - 128) / 2;
    let cursorY = 16;

    // 128px 主图
    blitScaled(canvas, width, renderVariant(variant, 128), 128, 128, originX, cursorY, 1, backdrop);
    cursorY += 128 + 16;

    // 常用尺寸原尺寸排列
    let x = column * colWidth + 20;
    [48, 32, 16].forEach(function (size) {
      blitScaled(canvas, width, renderVariant(variant, size), size, size, x, cursorY, 1, backdrop);
      x += size + 10;
    });
    cursorY += 48 + 16;

    // 16px 放大 4 倍：看小尺寸下还认不认得出
    blitScaled(canvas, width, renderVariant(variant, 16), 16, 16, column * colWidth + 20, cursorY, 4, backdrop);
  });

  return { width: width, height: height, data: canvas };
}

/**
 * 场景模拟：这个扩展没有工具栏按钮，它实际只出现在几处 ——
 * `about:addons` 的列表行（浅色 / 深色主题）、AMO 页面上的大图。
 */
function renderScene(variants) {
  const colWidth = 300;
  const width = colWidth * variants.length;
  const height = 340;
  const canvas = Buffer.alloc(width * height * 4);

  const pageBg = [245, 246, 248];
  const lightCard = [255, 255, 255];
  const darkCard = [66, 65, 77];
  const lineStrong = [198, 200, 208];
  const lineWeak = [222, 224, 230];
  const lineDarkStrong = [176, 175, 188];
  const lineDarkWeak = [140, 139, 152];

  fillRect(canvas, width, 0, 0, width, height, pageBg);

  variants.forEach(function (variant, column) {
    const x0 = column * colWidth;
    const icon = function (size) { return renderVariant(variant, size); };

    // 1) about:addons —— 浅色主题下的一行
    fillRect(canvas, width, x0 + 12, 12, colWidth - 24, 76, lightCard);
    blitScaled(canvas, width, icon(32), 32, 32, x0 + 28, 34, 1, lightCard);
    fillRect(canvas, width, x0 + 76, 36, 160, 11, lineStrong);
    fillRect(canvas, width, x0 + 76, 58, 108, 9, lineWeak);

    // 2) about:addons —— 深色主题下的一行（底色会让图标轮廓变弱，这里能看出来）
    fillRect(canvas, width, x0 + 12, 100, colWidth - 24, 76, darkCard);
    blitScaled(canvas, width, icon(32), 32, 32, x0 + 28, 122, 1, darkCard);
    fillRect(canvas, width, x0 + 76, 124, 160, 11, lineDarkStrong);
    fillRect(canvas, width, x0 + 76, 146, 108, 9, lineDarkWeak);

    // 3) AMO 页面上真正会用到的大图
    blitScaled(canvas, width, icon(128), 128, 128, x0 + (colWidth - 128) / 2, 192, 1, pageBg);
  });

  return { width: width, height: height, data: canvas };
}

/* ------------------------------------------------------------------ 入口 */

function main() {
  const args = process.argv.slice(2);
  const previewArg = args.find((a) => a.startsWith('--preview='));
  const sceneArg = args.find((a) => a.startsWith('--scene='));
  const variantsArg = args.find((a) => a.startsWith('--variants='));
  const variantArg = args.find((a) => a.startsWith('--variant='));
  const variant = variantArg ? variantArg.split('=')[1] : DEFAULT_VARIANT;

  if (!VARIANTS[variant]) {
    console.error('未知变体：' + variant + '（可选：' + Object.keys(VARIANTS).join(' / ') + '）');
    process.exit(1);
  }

  if (previewArg || sceneArg) {
    const arg = previewArg || sceneArg;
    const target = arg.split('=')[1];
    const list = variantsArg ? variantsArg.split('=')[1].split(',').filter((v) => VARIANTS[v]) : Object.keys(VARIANTS);
    if (!list.length) {
      console.error('--variants 里没有有效变体');
      process.exit(1);
    }
    const image = previewArg ? renderPreview(list) : renderScene(list);
    fs.writeFileSync(target, encodePng(image.width, image.height, image.data));
    console.log((previewArg ? '预览图：' : '场景图：') + target + '（' + list.join(' / ') + '）');
    return;
  }

  fs.mkdirSync(ICON_DIR, { recursive: true });
  SIZES.forEach(function (size) {
    const file = path.join(ICON_DIR, 'icon-' + size + '.png');
    fs.writeFileSync(file, encodePng(size, size, renderVariant(variant, size)));
    console.log('写入 ' + path.relative(process.cwd(), file));
  });
  console.log('变体：' + variant + '（' + VARIANTS[variant].title + '）');
}

main();
