/*
 * tools/lib.js —— 生成图标 / 打包要用的最小工具集
 *
 * 只用 Node 内置模块（zlib），不引入任何第三方依赖：
 *   - crc32 / encodePng：手写 PNG 编码（图标必须是 PNG，Firefox 不支持 SVG 作扩展图标）
 *   - zipWrite：手写 ZIP 打包（上传 AMO 的 zip 要求 manifest.json 在根目录）
 */
'use strict';

const zlib = require('zlib');

/* ------------------------------------------------------------------ CRC32 */

const CRC_TABLE = (function () {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/* -------------------------------------------------------------------- PNG */

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * 把 RGBA 像素编码成 PNG。
 * @param {number} width
 * @param {number} height
 * @param {Buffer|Uint8Array} rgba 长度必须是 width*height*4，非预乘 alpha
 */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const source = Buffer.from(rgba.buffer || rgba, rgba.byteOffset || 0, rgba.length);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // 过滤器类型 0（None）
    source.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 位深
  ihdr[9] = 6;  // 颜色类型 6 = RGBA
  ihdr[10] = 0; // 压缩方式
  ihdr[11] = 0; // 过滤方式
  ihdr[12] = 0; // 非隔行

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------------- ZIP */

// 固定时间戳（1980-01-01），让同样的输入产出字节一致的包
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

/**
 * 打包成 zip。文件名统一用正斜杠、放在根目录。
 * @param {Array<{name: string, data: Buffer}>} files
 */
function zipWrite(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  files.forEach(function (file) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const compressed = zlib.deflateRawSync(file.data, { level: 9 });
    const crc = crc32(file.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);  // 本地文件头签名
    local.writeUInt16LE(20, 4);          // 解压所需版本
    local.writeUInt16LE(0x0800, 6);      // bit 11：文件名是 UTF-8
    local.writeUInt16LE(8, 8);           // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);          // 扩展字段长度

    locals.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // 中央目录签名
    central.writeUInt16LE(20, 4);         // 生成版本
    central.writeUInt16LE(20, 6);         // 解压所需版本
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);         // 扩展字段
    central.writeUInt16LE(0, 32);         // 注释
    central.writeUInt16LE(0, 34);         // 起始磁盘
    central.writeUInt16LE(0, 36);         // 内部属性
    central.writeUInt32LE(0, 38);         // 外部属性
    central.writeUInt32LE(offset, 42);    // 本地文件头偏移

    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  });

  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(locals), centralBuffer, end]);
}

module.exports = {
  crc32: crc32,
  encodePng: encodePng,
  zipWrite: zipWrite,
};
