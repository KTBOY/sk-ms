/* 品牌资产渲染：build/*.svg → icon.ico / icon.png / installerSidebar.bmp / installerHeader.bmp
   依赖项目自带 Electron 做离屏栅格化，零第三方依赖。用法：npm run brand
   - icon.ico：16/24/32/48 用 icon-small.svg（小尺寸可读），64/128/256 用 icon.svg；
     ≤128 为 32bpp BMP 条目，256 为 PNG 条目
   - installerSidebar.bmp / installerHeader.bmp：24bpp BMP（NSIS MUI 要求真实 BMP） */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.disableHardwareAcceleration(); // 离屏软件光栅，输出确定

const buildDir = path.join(__dirname, '..', 'build');
const readSvg = (f) => fs.readFileSync(path.join(buildDir, f), 'utf8');

/* 渲染器代码（在 about:blank 页面执行；无模板字面量，避免注入冲突） */
const RENDERER_BODY = `
  const out = {};

  function b64(u8) {
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }

  function loadSvg(svg) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('SVG 加载失败'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  async function raster(svg, w, h) {
    const img = await loadSvg(svg);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  }

  function pngBytes(canvas) {
    return new Promise((resolve) =>
      canvas.toBlob((b) => { b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))); }, 'image/png'));
  }

  /* 24bpp BMP（自底向上、BGR、行按 4 字节对齐） */
  function encodeBMP24(canvas) {
    const w = canvas.width, h = canvas.height;
    const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const rowSize = Math.ceil((w * 3) / 4) * 4;
    const pixSize = rowSize * h;
    const buf = new Uint8Array(54 + pixSize);
    const dv = new DataView(buf.buffer);
    buf[0] = 0x42; buf[1] = 0x4d;                    // "BM"
    dv.setUint32(2, buf.length, true);
    dv.setUint32(10, 54, true);                       // 像素偏移
    dv.setUint32(14, 40, true);                       // BITMAPINFOHEADER
    dv.setInt32(18, w, true);
    dv.setInt32(22, h, true);                         // 正高 = 自底向上
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(34, pixSize, true);
    let o = 54;
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        buf[o++] = data[i + 2]; buf[o++] = data[i + 1]; buf[o++] = data[i];
      }
      o += rowSize - w * 3;                           // 行尾填充保持 0
    }
    return buf;
  }

  /* ICO 内的 32bpp BMP 条目（XOR 图 + 全 0 AND 掩码） */
  function encodeICOBmpEntry(canvas) {
    const w = canvas.width, h = canvas.height;
    const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const maskRow = Math.ceil(Math.ceil(w / 8) / 4) * 4;
    const pixSize = w * h * 4, maskSize = maskRow * h;
    const buf = new Uint8Array(40 + pixSize + maskSize);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, 40, true);
    dv.setInt32(4, w, true);
    dv.setInt32(8, h * 2, true);                      // XOR + AND 双倍高
    dv.setUint16(12, 1, true);
    dv.setUint16(14, 32, true);
    dv.setUint32(20, pixSize + maskSize, true);
    let o = 40;
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        buf[o++] = data[i + 2]; buf[o++] = data[i + 1]; buf[o++] = data[i]; buf[o++] = data[i + 3];
      }
    }
    return buf;
  }

  function assembleICO(entries) {
    const n = entries.length;
    const head = 6 + 16 * n;
    const buf = new Uint8Array(head + entries.reduce((a, e) => a + e.data.length, 0));
    const dv = new DataView(buf.buffer);
    dv.setUint16(2, 1, true); dv.setUint16(4, n, true);
    let off = head;
    for (let i = 0; i < n; i++) {
      const e = entries[i], o = 6 + 16 * i;
      const dim = e.size >= 256 ? 0 : e.size;
      buf[o] = dim; buf[o + 1] = dim;
      dv.setUint16(o + 4, 1, true);
      dv.setUint16(o + 6, 32, true);
      dv.setUint32(o + 8, e.data.length, true);
      dv.setUint32(o + 12, off, true);
      buf.set(e.data, off);
      off += e.data.length;
    }
    return buf;
  }

  const icoEntries = [];
  for (const s of [16, 24, 32, 48, 64, 128, 256]) {
    const svg = s === 16 ? SVGS.iconTiny : (s <= 48 ? SVGS.iconSmall : SVGS.icon);
    const c = await raster(svg, s, s);
    icoEntries.push({ size: s, data: s === 256 ? await pngBytes(c) : encodeICOBmpEntry(c) });
  }
  out['icon.ico'] = b64(assembleICO(icoEntries));
  out['icon.png'] = b64(await pngBytes(await raster(SVGS.icon, 1024, 1024)));

  const sidebar = await raster(SVGS.sidebar, 164, 314);
  out['installerSidebar.bmp'] = b64(encodeBMP24(sidebar));
  out['preview/installerSidebar.png'] = b64(await pngBytes(sidebar));

  const header = await raster(SVGS.header, 150, 57);
  out['installerHeader.bmp'] = b64(encodeBMP24(header));
  out['preview/installerHeader.png'] = b64(await pngBytes(header));

  /* 尺寸检视拼板：256 / 128 / 64 / 48 / 32 / 16 */
  const sheet = document.createElement('canvas');
  sheet.width = 430; sheet.height = 348;
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#0a0b0d'; sc.fillRect(0, 0, 430, 348);
  const slots = [[256, 12, 12], [128, 286, 12], [64, 286, 150], [48, 286, 220], [32, 286, 272], [16, 286, 308]];
  for (const [s, x, y] of slots) {
    const svg = s === 16 ? SVGS.iconTiny : (s <= 48 ? SVGS.iconSmall : SVGS.icon);
    const c = await raster(svg, s, s);
    sc.drawImage(c, x, y);
    sc.strokeStyle = 'rgba(201,172,103,.4)';
    sc.strokeRect(x - 3, y - 3, s + 6, s + 6);
  }
  out['preview/icon-sheet.png'] = b64(await pngBytes(sheet));

  /* 16px 像素级检查图（8 倍最近邻放大） */
  const tiny = await raster(SVGS.iconTiny, 16, 16);
  const zoom = document.createElement('canvas');
  zoom.width = 128; zoom.height = 128;
  const zc = zoom.getContext('2d');
  zc.imageSmoothingEnabled = false;
  zc.drawImage(tiny, 0, 0, 128, 128);
  out['preview/icon-16-zoom.png'] = b64(await pngBytes(zoom));

  return out;
`;

app.whenReady().then(async () => {
  const svgs = {
    icon: readSvg('icon.svg'),
    iconSmall: readSvg('icon-small.svg'),
    iconTiny: readSvg('icon-tiny.svg'),
    sidebar: readSvg('installerSidebar.svg'),
    header: readSvg('installerHeader.svg'),
  };
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await win.loadURL('about:blank');
  const code = '(async () => { const SVGS = ' + JSON.stringify(svgs) + ';\n' + RENDERER_BODY + '\n})()';
  const files = await win.webContents.executeJavaScript(code);
  for (const [name, data] of Object.entries(files)) {
    const outPath = path.join(buildDir, name);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log('[brand]', name, fs.statSync(outPath).size, 'bytes');
  }
  app.exit(0);
}).catch((err) => {
  console.error('[brand] 渲染失败:', err);
  app.exit(1);
});
