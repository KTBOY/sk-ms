import JSZip from 'jszip';
import type { Project } from '../types';
import { downloadBlob, sanitize, type ExportOptions } from './index';

/** EPUB3 导出：JSZip 手工组装，正文按段落转 XHTML。 */

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const xhtmlPage = (title: string, body: string) =>
  `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
<head><meta charset="utf-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body>
</html>`;

const paragraphs = (text: string) =>
  text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeXml(p)}</p>`)
    .join('\n');

export async function exportEpub(project: Project, options: ExportOptions): Promise<void> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const oebps = zip.folder('OEBPS');
  if (!oebps) throw new Error('EPUB 打包失败');
  oebps.file(
    'style.css',
    'body{font-family:serif;line-height:1.8;margin:1em}h1{font-size:1.4em;text-align:center;margin:2em 0}p{text-indent:2em;margin:.4em 0}',
  );

  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  const manifest: string[] = [];
  const spine: string[] = [];

  oebps.file(
    'title.xhtml',
    xhtmlPage(project.name, `<h1>${escapeXml(project.name)}</h1><p style="text-align:center">${escapeXml(project.genre)}</p>${project.description ? `<p style="text-align:center">${escapeXml(project.description)}</p>` : ''}`),
  );
  manifest.push('<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>');
  spine.push('<itemref idref="title"/>');

  chapters.forEach((c, i) => {
    const id = `ch${i + 1}`;
    oebps.file(`${id}.xhtml`, xhtmlPage(c.title, `<h1>${escapeXml(c.title)}</h1>${paragraphs(c.content)}`));
    manifest.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
  });

  if (options.includeWorldbook) {
    const wb = [
      '<h1>附录 · 设定集</h1>',
      ...project.characters.map((c) => `<p><b>${escapeXml(c.name)}</b>（${escapeXml(c.role)}）：${escapeXml(c.description || c.background)}</p>`),
      ...project.events.sort((a, b) => a.sortIndex - b.sortIndex).map((e) => `<p>${e.sortIndex}.〔${escapeXml(e.timeLabel)}〕<b>${escapeXml(e.name)}</b>：${escapeXml(e.description)}</p>`),
    ].join('\n');
    oebps.file('worldbook.xhtml', xhtmlPage('设定集', wb));
    manifest.push('<item id="worldbook" href="worldbook.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="worldbook"/>');
  }

  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:novel-atlas:${escapeXml(project.id)}</dc:identifier>
    <dc:title>${escapeXml(project.name)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:creator>墨枢 NovelAtlas</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>${manifest.join('\n')}<item id="css" href="style.css" media-type="text/css"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest>
  <spine>${spine.join('\n')}</spine>
</package>`,
  );

  oebps.file(
    'nav.xhtml',
    xhtmlPage(
      '目录',
      `<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><h1>目录</h1><ol><li><a href="title.xhtml">扉页</a></li>${chapters
        .map((c, i) => `<li><a href="ch${i + 1}.xhtml">${escapeXml(c.title)}</a></li>`)
        .join('')}${options.includeWorldbook ? '<li><a href="worldbook.xhtml">设定集</a></li>' : ''}</ol></nav>`,
    ),
  );

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  downloadBlob(`${sanitize(project.name)}.epub`, blob);
}
