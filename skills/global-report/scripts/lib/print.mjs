// Chrome으로 인쇄할 HTML을 만들어요. report.html은 바꾸지 않고, 임시 파일에
// 글꼴·테마 변수·쪽 설정과 목차를 넣어요.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { classList, elementChildren, findFirst, textContent } from './html.mjs';
import { ASSETS_DIR, fontFile } from './report.mjs';

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function cssString(text) {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ')}"`;
}

/** 장 제목(h2)과 절 제목(h3)을 목차 항목으로 모아요. */
export function tocEntries(root) {
  const body = findFirst(root, (node) => node.name === 'body');
  const entries = [];
  for (const section of elementChildren(body ?? { children: [] })) {
    if (section.name !== 'section' || classList(section).includes('cover')) continue;
    for (const child of elementChildren(section)) {
      if (child.name === 'h2') entries.push({ level: 1, text: textContent(child).replace(/\s+/g, ' ').trim() });
      if (child.name === 'h3') entries.push({ level: 2, text: textContent(child).replace(/\s+/g, ' ').trim() });
    }
  }
  return entries;
}

export function coverKind(root) {
  const cover = findFirst(root, (node) => node.name === 'section' && classList(node).includes('cover'));
  if (!cover) return 'none';
  return classList(cover).includes('compact') ? 'compact' : 'page';
}

function themeCss(theme, { title, cover }) {
  const { color, size, spacing, page, bar } = theme;
  const pt = (value) => `${value}pt`;
  const family = theme.font.family;
  const contentHeight = page.height - page.margin.top - page.margin.bottom;
  const marginBox = `font-family: ${cssString(family)}, sans-serif; font-size: ${pt(size.header)};`;
  const firstPage = cover === 'page'
    ? '@page :first { @top-right { content: none; } @bottom-right { content: none; } }'
    : '';
  return `
@font-face { font-family: ${cssString(family)}; font-weight: 400; src: url(${cssString(pathToFileURL(fontFile(theme, 'regular')).href)}); }
@font-face { font-family: ${cssString(family)}; font-weight: 700; src: url(${cssString(pathToFileURL(fontFile(theme, 'bold')).href)}); }
:root {
  --font-family: ${cssString(family)}, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --ink: #${color.ink}; --muted: #${color.muted}; --subtle: #${color.subtle}; --navy: #${color.navy};
  --accent: #${color.accent}; --line: #${color.line}; --tint: #${color.tint}; --zebra: #${color.zebra};
  --bar-title: ${bar.title}mm; --bar-heading1: ${bar.heading1}mm; --bar-callout: ${bar.callout}mm;
  --size-title: ${pt(size.title)}; --size-subtitle: ${pt(size.subtitle)};
  --size-heading1: ${pt(size.heading1)}; --size-heading2: ${pt(size.heading2)}; --size-heading3: ${pt(size.heading3)};
  --size-body: ${pt(size.body)}; --size-table: ${pt(size.table)}; --size-caption: ${pt(size.caption)};
  --line-height: ${theme.lineHeight};
  --paragraph-after: ${pt(spacing.paragraphAfter)};
  --heading1-before: ${pt(spacing.heading1Before)}; --heading1-after: ${pt(spacing.heading1After)};
  --heading2-before: ${pt(spacing.heading2Before)}; --heading2-after: ${pt(spacing.heading2After)};
  --heading3-before: ${pt(spacing.heading3Before)}; --heading3-after: ${pt(spacing.heading3After)};
  --cover-height: ${contentHeight - 10}mm;
}
@page {
  size: ${page.width}mm ${page.height}mm;
  margin: ${page.margin.top}mm ${page.margin.right}mm ${page.margin.bottom}mm ${page.margin.left}mm;
  @top-right { content: ${cssString(title)}; ${marginBox} color: #${color.muted}; vertical-align: bottom; padding-bottom: 4mm; }
  @bottom-right { content: counter(page) " / " counter(pages); ${marginBox} font-weight: 700; color: #${color.subtle}; vertical-align: top; padding-top: 4mm; }
}
${firstPage}
`;
}

function tocHtml(entries) {
  const items = entries
    .map((entry) => `<li class="toc-level-${entry.level}">${escapeHtml(entry.text)}</li>`)
    .join('\n');
  return `<nav class="toc"><p class="toc-title">목차</p><ol>\n${items}\n</ol></nav>`;
}

/** report.html 문자열에 인쇄용 설정을 넣은 HTML을 돌려줘요. */
export function buildPrintHtml(report, theme) {
  const cover = coverKind(report.root);
  const head = [
    `<base href="${escapeHtml(pathToFileURL(report.dir + path.sep).href)}">`,
    `<style>${themeCss(theme, { title: report.title, cover })}</style>`,
    `<link rel="stylesheet" href="${escapeHtml(pathToFileURL(path.join(ASSETS_DIR, 'report.css')).href)}">`,
  ].join('\n');
  let html = report.html.replace(/<\/head>/i, `${head}\n</head>`);
  html = html.replace(/<nav\s+class="toc"\s*>\s*<\/nav>/i, tocHtml(tocEntries(report.root)));
  return html;
}
