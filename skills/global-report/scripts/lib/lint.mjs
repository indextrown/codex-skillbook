// report.html이 references/allowed-elements.md의 규칙을 지키는지 검사해요.
import fs from 'node:fs';
import path from 'node:path';
import { classList, elementChildren, isBlank, textContent } from './html.mjs';
import { imageSize, resolveInside, sourceIds } from './report.mjs';

const INLINE = new Set(['strong', 'em', 'a', 'span', 'br']);
const HEADING_INLINE = new Set(['strong', 'em', 'span']);
const CHAPTER_BLOCKS = new Set(['h3', 'h4', 'p', 'ul', 'ol', 'table', 'figure', 'aside']);
const IMAGE_TYPES = new Set(['png', 'jpg', 'gif']);
const PLACEHOLDER = /\{\{|\}\}|작성 예정/;
const HINTS = {
  div: '내용에 맞게 장 section, p, aside.callout으로 바꿔요.',
  b: 'strong을 써요.',
  i: 'em을 써요.',
  blockquote: 'aside.callout을 써요.',
  h5: 'h4까지만 써요.',
  h6: 'h4까지만 써요.',
};

const ALLOWED_ATTRS = {
  html: ['lang'],
  head: [],
  meta: ['charset'],
  title: [],
  body: [],
  section: ['class', 'data-sources'],
  nav: ['class'],
  h1: [], h2: [], h3: [], h4: [],
  p: ['data-sources'],
  ul: ['data-sources'],
  ol: ['data-sources'],
  li: [],
  figure: ['data-sources'],
  figcaption: [],
  img: ['src', 'alt', 'width'],
  table: [], thead: [], tbody: [], tr: [],
  th: ['colspan', 'class'],
  td: ['colspan', 'class'],
  aside: ['class', 'data-sources'],
  a: ['href'],
  span: ['class'],
  strong: [], em: [], br: [],
};
const ALLOWED_CLASSES = {
  section: [['cover'], ['cover', 'compact']],
  nav: [['toc']],
  aside: [['callout']],
  span: [['accent']],
  th: [['num']],
  td: [['num']],
};

/**
 * @param {object} report loadReport()의 결과
 * @returns {{ errors: Array<{line, message}>, placeholders: Array<{line, text}> }}
 */
export function lintReport(report) {
  const errors = [...report.parseErrors];
  const placeholders = [];
  const knownSources = report.sourcesText === null ? null : sourceIds(report.sourcesText);
  const error = (node, message) => errors.push({ line: node.line, message });

  if (report.sourcesText === null) {
    errors.push({ line: 0, message: 'sources.md가 없어요. 작업 폴더에 자료 목록을 만들어요.' });
  }

  function checkAttributes(node) {
    const allowed = ALLOWED_ATTRS[node.name] ?? [];
    for (const [name, value] of Object.entries(node.attrs)) {
      if (!allowed.includes(name)) {
        error(node, `<${node.name}>에는 ${name} 속성을 쓸 수 없어요.`);
        continue;
      }
      if (name === 'class') {
        const classes = classList(node).sort().join(' ');
        const options = ALLOWED_CLASSES[node.name] ?? [];
        if (!options.some((option) => [...option].sort().join(' ') === classes)) {
          error(node, `<${node.name}>에는 class="${value}"를 쓸 수 없어요.`);
        }
      }
      if (name === 'data-sources') {
        const ids = value.split(/\s+/).filter(Boolean);
        if (ids.length === 0) error(node, 'data-sources가 비어 있어요.');
        for (const id of ids) {
          if (!/^S\d+$/.test(id)) error(node, `출처 ID "${id}" 형식이 올바르지 않아요. S1처럼 써요.`);
          else if (knownSources && !knownSources.has(id)) error(node, `출처 ID ${id}가 sources.md에 없어요.`);
        }
      }
      if (name === 'colspan' && !/^[1-9]\d*$/.test(value)) error(node, `colspan="${value}"는 1 이상의 정수여야 해요.`);
      if (name === 'width' && !/^[1-9]\d*$/.test(value)) error(node, `width="${value}"는 px 단위 정수여야 해요.`);
    }
  }

  function checkText(node) {
    if (PLACEHOLDER.test(node.text)) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      placeholders.push({ line: node.line, text: text.length > 60 ? `${text.slice(0, 60)}…` : text });
    }
  }

  function unknownElement(node) {
    const hint = HINTS[node.name] ? ` ${HINTS[node.name]}` : '';
    error(node, `<${node.name}>는 쓸 수 없는 요소예요.${hint}`);
  }

  function checkInline(parent, allowed = INLINE) {
    for (const child of parent.children) {
      if (child.type === 'text') {
        checkText(child);
        continue;
      }
      if (!allowed.has(child.name)) {
        if (ALLOWED_ATTRS[child.name] === undefined) unknownElement(child);
        else error(child, `<${parent.name}> 안에는 <${child.name}>를 쓸 수 없어요.`);
        continue;
      }
      checkAttributes(child);
      if (child.name === 'span' && !classList(child).includes('accent')) error(child, '<span>에는 class="accent"가 필요해요.');
      if (child.name === 'a') {
        const href = child.attrs.href ?? '';
        if (!/^(https?:|mailto:)/i.test(href)) error(child, `<a href="${href}">는 http, https, mailto 주소만 쓸 수 있어요.`);
      }
      if (child.name !== 'br') checkInline(child, new Set(['strong', 'em']));
    }
  }

  function requireText(node, label) {
    if (isBlank(textContent(node))) error(node, `${label}이 비어 있어요.`);
  }

  function checkList(list, depth) {
    checkAttributes(list);
    if (depth > 2) error(list, '목록은 2단계까지만 쓸 수 있어요.');
    const items = elementChildren(list);
    if (items.length === 0) error(list, `<${list.name}>에 항목이 없어요.`);
    for (const child of list.children) {
      if (child.type === 'text') {
        if (!isBlank(child.text)) error(list, `<${list.name}> 안의 글은 <li>로 감싸요.`);
        continue;
      }
      if (child.name !== 'li') {
        error(child, `<${list.name}> 안에는 <li>만 쓸 수 있어요.`);
        continue;
      }
      checkAttributes(child);
      const nested = elementChildren(child).filter((node) => node.name === 'ul' || node.name === 'ol');
      if (nested.length > 1) error(child, '<li> 안의 하위 목록은 하나만 쓸 수 있어요.');
      const nestedList = nested[0];
      if (nestedList) {
        const after = child.children.slice(child.children.indexOf(nestedList) + 1);
        if (after.some((node) => node.type === 'element' || !isBlank(node.text))) {
          error(nestedList, '하위 목록은 <li>의 마지막에 써요.');
        }
        checkList(nestedList, depth + 1);
      }
      const inlineOnly = { ...child, children: child.children.filter((node) => node !== nestedList) };
      checkInline(inlineOnly);
      if (isBlank(textContent(inlineOnly))) error(child, '목록 항목이 비어 있어요.');
    }
  }

  function checkTable(table) {
    checkAttributes(table);
    let tbodyCount = 0;
    let columns = null;
    for (const child of table.children) {
      if (child.type === 'text') {
        if (!isBlank(child.text)) error(table, '<table> 안의 글은 칸(<td>)에 써요.');
        continue;
      }
      if (child.name !== 'thead' && child.name !== 'tbody') {
        error(child, `<table> 안에는 <thead>, <tbody>만 쓸 수 있어요.`);
        continue;
      }
      if (child.name === 'tbody') tbodyCount += 1;
      checkAttributes(child);
      for (const row of child.children) {
        if (row.type === 'text') continue;
        if (row.name !== 'tr') {
          error(row, `<${child.name}> 안에는 <tr>만 쓸 수 있어요.`);
          continue;
        }
        checkAttributes(row);
        let width = 0;
        for (const cell of row.children) {
          if (cell.type === 'text') {
            if (!isBlank(cell.text)) error(row, '<tr> 안의 글은 칸(<td>)에 써요.');
            continue;
          }
          if (cell.name !== 'th' && cell.name !== 'td') {
            error(cell, '<tr> 안에는 <th>, <td>만 쓸 수 있어요.');
            continue;
          }
          checkAttributes(cell);
          checkInline(cell);
          width += Number(cell.attrs.colspan ?? 1) || 1;
        }
        if (width === 0) error(row, '빈 행이에요.');
        else if (columns === null) columns = width;
        else if (width !== columns) error(row, `이 행의 칸 수(${width})가 첫 행(${columns})과 달라요.`);
      }
    }
    if (tbodyCount !== 1) error(table, '<table>에는 <tbody>가 하나 있어야 해요.');
  }

  function checkImage(img) {
    checkAttributes(img);
    const src = img.attrs.src;
    if (!src) {
      error(img, '<img>에 src가 없어요.');
      return;
    }
    const file = resolveInside(report.dir, src);
    if (!file) {
      error(img, `이미지 "${src}"는 작업 폴더 안의 상대 경로여야 해요.`);
      return;
    }
    if (!fs.existsSync(file)) {
      error(img, `이미지 파일이 없어요: ${src}`);
      return;
    }
    const size = imageSize(file);
    if (!size || !IMAGE_TYPES.has(size.type)) error(img, `이미지는 PNG, JPG, GIF만 쓸 수 있어요: ${src}`);
  }

  function checkFigure(figure) {
    checkAttributes(figure);
    const children = elementChildren(figure);
    const content = children.filter((node) => node.name === 'img' || node.name === 'table');
    if (content.length !== 1) error(figure, '<figure>에는 <img>나 <table> 하나만 넣어요.');
    for (const child of figure.children) {
      if (child.type === 'text') {
        if (!isBlank(child.text)) error(figure, '<figure> 안의 글은 <figcaption>에 써요.');
        continue;
      }
      if (child.name === 'img') checkImage(child);
      else if (child.name === 'table') checkTable(child);
      else if (child.name === 'figcaption') {
        if (child !== children[children.length - 1]) error(child, '<figcaption>은 <figure>의 마지막에 써요.');
        checkAttributes(child);
        checkInline(child);
        requireText(child, '캡션');
      } else error(child, `<figure> 안에는 <${child.name}>를 쓸 수 없어요.`);
    }
  }

  function checkCallout(aside) {
    checkAttributes(aside);
    if (!classList(aside).includes('callout')) error(aside, '<aside>에는 class="callout"이 필요해요.');
    const paragraphs = elementChildren(aside).filter((node) => node.name === 'p');
    if (paragraphs.length > 0) {
      for (const child of aside.children) {
        if (child.type === 'text') {
          if (!isBlank(child.text)) error(aside, '<aside> 안에서 글과 <p>를 섞지 않아요.');
        } else if (child.name !== 'p') {
          error(child, '<aside> 안에는 인라인 요소나 <p>만 쓸 수 있어요.');
        } else {
          checkAttributes(child);
          checkInline(child);
        }
      }
    } else {
      checkInline(aside);
    }
    requireText(aside, '요약 상자');
  }

  function checkBlock(node) {
    switch (node.name) {
      case 'h3':
      case 'h4':
        checkAttributes(node);
        checkInline(node, HEADING_INLINE);
        requireText(node, '제목');
        break;
      case 'p':
        checkAttributes(node);
        checkInline(node);
        requireText(node, '문단');
        break;
      case 'ul':
      case 'ol':
        checkList(node, 1);
        break;
      case 'table':
        checkTable(node);
        break;
      case 'figure':
        checkFigure(node);
        break;
      case 'aside':
        checkCallout(node);
        break;
      default:
        break;
    }
  }

  function checkChapter(section) {
    checkAttributes(section);
    const children = elementChildren(section);
    for (const child of section.children) {
      if (child.type === 'text' && !isBlank(child.text)) error(section, '장 안의 글은 <p>로 감싸요.');
    }
    if (children[0]?.name !== 'h2') {
      error(section, '장 <section>은 <h2>로 시작해요.');
    } else {
      checkAttributes(children[0]);
      checkInline(children[0], HEADING_INLINE);
      requireText(children[0], '장 제목');
    }
    const blocks = children.slice(children[0]?.name === 'h2' ? 1 : 0);
    if (blocks.length === 0) error(section, `빈 장이에요: ${textContent(children[0] ?? section).trim() || '(제목 없음)'}`);
    for (const block of blocks) {
      if (CHAPTER_BLOCKS.has(block.name)) checkBlock(block);
      else if (block.name === 'h2') error(block, '장 하나에는 <h2>를 하나만 써요. 새 장은 새 <section>으로 나눠요.');
      else if (ALLOWED_ATTRS[block.name] === undefined) unknownElement(block);
      else error(block, `장 안에는 <${block.name}>를 쓸 수 없어요.`);
    }
  }

  function checkCover(section) {
    checkAttributes(section);
    const children = elementChildren(section);
    if (children[0]?.name !== 'h1') error(section, '표지는 <h1>로 시작해요.');
    for (const child of section.children) {
      if (child.type === 'text') {
        if (!isBlank(child.text)) error(section, '표지 안의 글은 <h1>이나 <p>로 감싸요.');
        continue;
      }
      if (child.name === 'h1') {
        if (child !== children[0]) error(child, '표지에는 <h1>을 하나만 써요.');
        checkAttributes(child);
        checkInline(child, HEADING_INLINE);
        requireText(child, '보고서 제목');
      } else if (child.name === 'p') {
        checkAttributes(child);
        checkInline(child);
      } else {
        error(child, `표지 안에는 <${child.name}>를 쓸 수 없어요.`);
      }
    }
  }

  function checkBody(body) {
    checkAttributes(body);
    const children = elementChildren(body);
    let chapters = 0;
    children.forEach((child, position) => {
      const classes = classList(child);
      if (child.name === 'section' && classes.includes('cover')) {
        if (position !== 0) error(child, '표지는 <body>의 맨 앞에 하나만 써요.');
        checkCover(child);
      } else if (child.name === 'nav') {
        checkAttributes(child);
        if (!classes.includes('toc')) error(child, '<nav>에는 class="toc"가 필요해요.');
        if (chapters > 0) error(child, '목차는 첫 장보다 앞에 써요.');
        if (!isBlank(textContent(child)) || elementChildren(child).length > 0) {
          error(child, '목차 <nav class="toc">는 비워 둬요. 내보낼 때 채워요.');
        }
      } else if (child.name === 'section') {
        chapters += 1;
        checkChapter(child);
      } else if (child.name === 'aside') {
        checkCallout(child);
      } else if (ALLOWED_ATTRS[child.name] === undefined) {
        unknownElement(child);
      } else {
        error(child, `<body> 바로 안에는 <${child.name}>를 쓸 수 없어요. 장 <section> 안에 넣어요.`);
      }
    });
    for (const child of body.children) {
      if (child.type === 'text' && !isBlank(child.text)) error(body, '<body> 바로 안의 글은 장 <section>과 <p>로 감싸요.');
    }
    if (chapters === 0) error(body, '장 <section>이 하나 이상 있어야 해요.');
  }

  const html = elementChildren(report.root).find((node) => node.name === 'html');
  if (!html) {
    errors.push({ line: 1, message: '<html> 요소가 없어요.' });
    return { errors, placeholders };
  }
  checkAttributes(html);
  const head = elementChildren(html).find((node) => node.name === 'head');
  const body = elementChildren(html).find((node) => node.name === 'body');
  if (!head) error(html, '<head>가 없어요.');
  if (!body) error(html, '<body>가 없어요.');
  for (const child of elementChildren(html)) {
    if (child.name !== 'head' && child.name !== 'body') error(child, `<html> 안에는 <${child.name}>를 쓸 수 없어요.`);
  }
  if (head) {
    checkAttributes(head);
    for (const child of elementChildren(head)) {
      if (child.name === 'meta' || child.name === 'title') {
        checkAttributes(child);
        if (child.name === 'title') child.children.filter((node) => node.type === 'text').forEach(checkText);
      } else {
        error(child, `<head>에는 <meta charset>과 <title>만 써요. <${child.name}>는 쓸 수 없어요.`);
      }
    }
    if (!report.title) error(head, '<title>이 비어 있어요.');
  }
  if (body) checkBody(body);

  errors.sort((a, b) => a.line - b.line);
  placeholders.sort((a, b) => a.line - b.line);
  return { errors, placeholders };
}

/** 검사 결과를 사람이 읽는 줄로 바꿔요. */
export function formatLint(report, { errors, placeholders }) {
  const relative = path.relative(process.cwd(), report.htmlPath);
  const name = relative && !relative.startsWith('..') ? relative : report.htmlPath;
  const lines = [];
  for (const item of errors) lines.push(`${name}:${item.line} 오류: ${item.message}`);
  for (const item of placeholders) lines.push(`${name}:${item.line} 자리 표시자: ${item.text}`);
  return lines;
}
