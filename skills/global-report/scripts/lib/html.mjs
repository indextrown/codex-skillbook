// report.html 전용의 작은 HTML 파서예요. 보고서는 허용 요소만 쓰는 정돈된 HTML이라
// 브라우저 수준의 오류 복구 대신, 닫히지 않은 태그를 오류로 알려 주는 쪽을 택해요.
// 외부 의존성이 없어서 PDF 출력과 검사는 npm 설치 없이 동작해요.

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  middot: '·', hellip: '…', ndash: '–', mdash: '—', rarr: '→', larr: '←', times: '×',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', reg: '®', deg: '°', plusmn: '±',
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const TAG_NAME = /[a-zA-Z][a-zA-Z0-9-]*/y;
const ATTR_NAME = /[^\s"'>/=]+/y;
const UNQUOTED_VALUE = /[^\s>]+/y;
const END_TAG = /<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/y;

/**
 * HTML 문자열을 트리로 바꿔요.
 * 노드: { type: 'root' | 'element' | 'text', name, attrs, children, text, line, parent }
 * @returns {{ root: object, errors: Array<{ line: number, message: string }> }}
 */
export function parseHTML(source) {
  const root = { type: 'root', children: [], line: 1, parent: null };
  const stack = [root];
  const errors = [];
  let index = 0;
  let line = 1;

  const moveTo = (next) => {
    for (let k = index; k < next; k += 1) {
      if (source.charCodeAt(k) === 10) line += 1;
    }
    index = next;
  };
  const current = () => stack[stack.length - 1];
  const addText = (text, textLine) => {
    if (!text) return;
    const parent = current();
    const last = parent.children[parent.children.length - 1];
    if (last && last.type === 'text') {
      last.text += text;
    } else {
      parent.children.push({ type: 'text', text, line: textLine, parent });
    }
  };

  while (index < source.length) {
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      if (end < 0) {
        errors.push({ line, message: '주석(<!--)이 닫히지 않았어요.' });
        moveTo(source.length);
        break;
      }
      moveTo(end + 3);
      continue;
    }

    if (source.startsWith('<!', index) || source.startsWith('<?', index)) {
      const end = source.indexOf('>', index);
      moveTo(end < 0 ? source.length : end + 1);
      continue;
    }

    if (source.startsWith('</', index)) {
      END_TAG.lastIndex = index;
      const match = END_TAG.exec(source);
      if (!match) {
        errors.push({ line, message: '닫는 태그 형식이 올바르지 않아요.' });
        addText('<', line);
        moveTo(index + 1);
        continue;
      }
      const name = match[1].toLowerCase();
      const tagLine = line;
      moveTo(index + match[0].length);
      let depth = stack.length - 1;
      while (depth > 0 && stack[depth].name !== name) depth -= 1;
      if (depth === 0) {
        errors.push({ line: tagLine, message: `</${name}>에 맞는 여는 태그가 없어요.` });
        continue;
      }
      for (let k = stack.length - 1; k > depth; k -= 1) {
        errors.push({ line: stack[k].line, message: `<${stack[k].name}>가 닫히지 않았어요.` });
      }
      stack.length = depth;
      continue;
    }

    if (source[index] === '<' && /[a-zA-Z]/.test(source[index + 1] ?? '')) {
      const tagLine = line;
      TAG_NAME.lastIndex = index + 1;
      const name = TAG_NAME.exec(source)[0].toLowerCase();
      let cursor = TAG_NAME.lastIndex;
      const attrs = {};
      let selfClosing = false;
      let closed = false;

      while (cursor < source.length) {
        while (/\s/.test(source[cursor] ?? '')) cursor += 1;
        if (source[cursor] === '>') {
          cursor += 1;
          closed = true;
          break;
        }
        if (source[cursor] === '/' && source[cursor + 1] === '>') {
          cursor += 2;
          selfClosing = true;
          closed = true;
          break;
        }
        ATTR_NAME.lastIndex = cursor;
        const attrMatch = ATTR_NAME.exec(source);
        if (!attrMatch) {
          cursor += 1;
          continue;
        }
        const attrName = attrMatch[0].toLowerCase();
        cursor = ATTR_NAME.lastIndex;
        while (/\s/.test(source[cursor] ?? '')) cursor += 1;
        let value = '';
        if (source[cursor] === '=') {
          cursor += 1;
          while (/\s/.test(source[cursor] ?? '')) cursor += 1;
          const quote = source[cursor];
          if (quote === '"' || quote === "'") {
            const end = source.indexOf(quote, cursor + 1);
            if (end < 0) {
              errors.push({ line: tagLine, message: `<${name}>의 ${attrName} 속성 따옴표가 닫히지 않았어요.` });
              cursor = source.length;
              break;
            }
            value = source.slice(cursor + 1, end);
            cursor = end + 1;
          } else {
            UNQUOTED_VALUE.lastIndex = cursor;
            const valueMatch = UNQUOTED_VALUE.exec(source);
            value = valueMatch ? valueMatch[0] : '';
            cursor += value.length;
          }
        }
        if (Object.hasOwn(attrs, attrName)) {
          errors.push({ line: tagLine, message: `<${name}>에 ${attrName} 속성이 두 번 있어요.` });
        }
        attrs[attrName] = decodeEntities(value);
      }

      if (!closed) errors.push({ line: tagLine, message: `<${name}> 태그가 >로 끝나지 않았어요.` });
      moveTo(Math.min(cursor, source.length));

      const parent = current();
      const node = { type: 'element', name, attrs, children: [], line: tagLine, parent };
      parent.children.push(node);

      if (RAW_TEXT_ELEMENTS.has(name)) {
        const end = source.toLowerCase().indexOf(`</${name}`, index);
        const stop = end < 0 ? source.length : end;
        node.children.push({ type: 'text', text: source.slice(index, stop), line, parent: node });
        moveTo(stop);
        if (end >= 0) {
          const close = source.indexOf('>', stop);
          moveTo(close < 0 ? source.length : close + 1);
        } else {
          errors.push({ line: tagLine, message: `<${name}>가 닫히지 않았어요.` });
        }
        continue;
      }

      if (!VOID_ELEMENTS.has(name) && !selfClosing) stack.push(node);
      continue;
    }

    const next = source.indexOf('<', index + (source[index] === '<' ? 1 : 0));
    const stop = next < 0 ? source.length : next;
    addText(decodeEntities(source.slice(index, stop)), line);
    moveTo(stop);
  }

  for (let k = stack.length - 1; k > 0; k -= 1) {
    errors.push({ line: stack[k].line, message: `<${stack[k].name}>가 닫히지 않았어요.` });
  }

  return { root, errors };
}

function escapeText(text) {
  return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
}

function escapeAttribute(value) {
  return value.replace(/[&"<>]/g, (char) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[char]);
}

/** 노드를 다시 HTML 문자열로 바꿔요. */
export function serializeHTML(node) {
  if (node.type === 'text') return escapeText(node.text);
  const inner = node.children.map(serializeHTML).join('');
  if (node.type === 'root') return inner;
  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
    .join('');
  if (VOID_ELEMENTS.has(node.name)) return `<${node.name}${attrs}>`;
  return `<${node.name}${attrs}>${inner}</${node.name}>`;
}

export function elementChildren(node) {
  return node.children.filter((child) => child.type === 'element');
}

export function classList(node) {
  return (node.attrs?.class ?? '').split(/\s+/).filter(Boolean);
}

export function hasClass(node, name) {
  return classList(node).includes(name);
}

export function textContent(node) {
  if (node.type === 'text') return node.text;
  return node.children.map(textContent).join('');
}

export function findAll(node, predicate, found = []) {
  for (const child of node.children ?? []) {
    if (child.type !== 'element') continue;
    if (predicate(child)) found.push(child);
    findAll(child, predicate, found);
  }
  return found;
}

export function findFirst(node, predicate) {
  for (const child of node.children ?? []) {
    if (child.type !== 'element') continue;
    if (predicate(child)) return child;
    const nested = findFirst(child, predicate);
    if (nested) return nested;
  }
  return null;
}

export function isBlank(text) {
  return /^[\s ]*$/.test(text);
}
