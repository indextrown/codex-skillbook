#!/usr/bin/env node
// 사용법: node export_docx.mjs <보고서 폴더> [--out <파일.docx>] [--json]
// report.html을 검사한 뒤 Word 문서로 옮겨 exports/<제목>_v<N>_<날짜>.docx를 만들어요.
// - 본문: docx/html이 report.html의 장을 Word 문단·표·목록으로 바꿔요. 요소마다 쓸 Word
//   스타일은 styleMap으로 정하고, 스타일의 모양은 theme.json 값으로 정의해요.
// - 표지·목차·머리말·쪽 번호: 이 파일에서 직접 만들어요.
import fs from 'node:fs';
import path from 'node:path';
import { classList, elementChildren, findFirst, serializeHTML } from './lib/html.mjs';
import { formatLint, lintReport } from './lib/lint.mjs';
import { coverKind } from './lib/print.mjs';
import {
  exitCodeFor, imageSize, isMain, loadReport, loadTheme, nextExportPath, parseArgs, resolveInside,
} from './lib/report.mjs';

const TWIPS_PER_MM = 1440 / 25.4;
const PX_PER_MM = 96 / 25.4;
const MAX_IMAGE_HEIGHT_MM = 110;

async function loadDocx() {
  try {
    const docx = await import('docx');
    const { htmlToContent, htmlToRuns } = await import('docx/html');
    return { ...docx, htmlToContent, htmlToRuns };
  } catch {
    const error = new Error('docx 라이브러리가 없어요. 먼저 node check_deps.mjs를 실행해 의존성을 설치해 주세요.');
    error.code = 'DEPENDENCY';
    throw error;
  }
}

const twips = (mm) => Math.round(mm * TWIPS_PER_MM);
const halfPoints = (pt) => Math.round(pt * 2);
const pointTwips = (pt) => Math.round(pt * 20);
const borderEighths = (mm) => Math.min(96, Math.round((mm * 72) / 25.4 * 8));

/** 이미지 크기와 캡션 종류를 정하고, Word로 옮기지 않을 속성을 지워요. */
function prepareForWord(node, report, theme) {
  if (node.type !== 'element') return;
  delete node.attrs['data-sources'];
  if (node.name === 'figcaption') {
    const hasTable = elementChildren(node.parent).some((child) => child.name === 'table');
    node.attrs.class = hasTable ? 'table-caption' : 'image-caption';
  }
  if (node.name === 'img') {
    const size = imageSize(resolveInside(report.dir, node.attrs.src));
    const { page } = theme;
    const maxWidth = (page.width - page.margin.left - page.margin.right) * PX_PER_MM;
    const maxHeight = MAX_IMAGE_HEIGHT_MM * PX_PER_MM;
    const width = Number(node.attrs.width ?? size.width);
    const height = (width * size.height) / size.width;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    node.attrs.width = String(Math.round(width * scale));
    node.attrs.height = String(Math.round(height * scale));
  }
  for (const child of node.children) prepareForWord(child, report, theme);
}

function wordStylesheet(theme) {
  const { color, size } = theme;
  return `
th, td { border: 0.5pt solid #${color.line}; padding: 3.5pt 5.5pt; text-align: left; vertical-align: middle; font-size: ${size.table}pt; }
thead th { border-color: #${color.navy}; background: #${color.navy}; color: #ffffff; font-weight: bold; }
tbody th { background: #${color.tint}; color: #${color.navy}; font-weight: bold; }
tbody tr:nth-child(even) td { background: #${color.zebra}; }
th.num, td.num { text-align: right; }
.accent, a { color: #${color.accent}; }
figure { text-align: center; }
figcaption.table-caption { text-align: right; }
ol ol { list-style-type: lower-alpha; }
`;
}

const STYLE_MAP = {
  h2: 'Heading1',
  h3: 'Heading2',
  h4: 'Heading3',
  'figcaption.image-caption': 'Caption',
  'figcaption.table-caption': 'TableCaption',
  'aside.callout': 'Callout',
  'aside.callout p': 'Callout',
};

function wordStyles(theme) {
  const { color, size, spacing, bar } = theme;
  const font = { ascii: theme.font.family, hAnsi: theme.font.family, eastAsia: theme.font.family, cs: theme.font.family };
  const line = Math.round(theme.lineHeight * 240);
  const titleBar = { style: 'single', size: borderEighths(bar.title), color: color.navy, space: 12 };
  const heading = (id, name, sizePt, before, after, outlineLevel, extra = {}) => ({
    id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { font, size: halfPoints(sizePt), bold: true, color: color.navy },
    paragraph: { spacing: { before: pointTwips(before), after: pointTwips(after), line }, keepNext: true, keepLines: true, outlineLevel, ...extra },
  });
  return {
    default: {
      document: {
        run: { font, size: halfPoints(size.body), color: color.ink },
        paragraph: { spacing: { after: pointTwips(spacing.paragraphAfter), line } },
      },
    },
    paragraphStyles: [
      {
        id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Subtitle', quickFormat: true,
        run: { font, size: halfPoints(size.title), bold: true, color: color.navy },
        paragraph: { spacing: { after: pointTwips(4), line: 300 }, border: { left: titleBar } },
      },
      {
        id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font, size: halfPoints(size.subtitle), color: color.muted },
        paragraph: { spacing: { after: pointTwips(2) }, border: { left: titleBar } },
      },
      heading('Heading1', 'Heading 1', size.heading1, spacing.heading1Before, spacing.heading1After, 0, {
        border: { left: { style: 'single', size: borderEighths(bar.heading1), color: color.accent, space: 6 } },
      }),
      heading('Heading2', 'Heading 2', size.heading2, spacing.heading2Before, spacing.heading2After, 1),
      heading('Heading3', 'Heading 3', size.heading3, spacing.heading3Before, spacing.heading3After, 2),
      {
        id: 'TocTitle', name: 'TOC Title', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font, size: halfPoints(size.heading1), bold: true, color: color.navy },
        paragraph: { spacing: { after: pointTwips(12) } },
      },
      {
        id: 'Caption', name: 'Caption', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font, size: halfPoints(size.caption), color: color.muted },
        paragraph: { alignment: 'center', spacing: { before: pointTwips(4), after: pointTwips(10) } },
      },
      {
        id: 'TableCaption', name: 'Table Caption', basedOn: 'Caption', next: 'Normal', quickFormat: true,
        paragraph: { alignment: 'right' },
      },
      {
        id: 'Callout', name: 'Callout', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        paragraph: {
          shading: { type: 'clear', fill: color.tint, color: 'auto' },
          border: { left: { style: 'single', size: borderEighths(bar.callout), color: color.accent, space: 8 } },
          indent: { left: twips(2), right: twips(2) },
          spacing: { before: pointTwips(8), after: pointTwips(10) },
        },
      },
      {
        id: 'ListParagraph', name: 'List Paragraph', basedOn: 'Normal', quickFormat: true,
        paragraph: { spacing: { after: pointTwips(3) } },
      },
    ],
  };
}

/** report.html을 Word 문서 버퍼로 만들어요. 파일은 쓰지 않아요. */
export async function buildDocx(report, theme) {
  const docx = await loadDocx();
  const {
    AlignmentType, Document, Footer, Header, LineRuleType, Packer, PageNumber, Paragraph, TableOfContents, TextRun,
    htmlToContent, htmlToRuns,
  } = docx;
  const warnings = [];
  const htmlOptions = {
    stylesheet: wordStylesheet(theme),
    styleMap: STYLE_MAP,
    images: (source) => {
      const file = resolveInside(report.dir, source);
      return file && fs.existsSync(file) ? fs.readFileSync(file) : undefined;
    },
    maxImageWidth: Math.floor((theme.page.width - theme.page.margin.left - theme.page.margin.right) * PX_PER_MM),
    onWarning: (warning) => warnings.push(warning.message),
  };

  const body = findFirst(report.root, (node) => node.name === 'body');
  const cover = elementChildren(body).find((node) => node.name === 'section' && classList(node).includes('cover'));
  const hasToc = elementChildren(body).some((node) => node.name === 'nav');
  const kind = coverKind(report.root);

  // 표지 쪽은 제목 앞에 높이를 고정한 빈 문단을 둬서 내려요. Pages는 구역 세로 정렬과
  // 쪽 맨 위 문단의 앞 간격을 무시하지만, 고정 줄 높이는 지켜요.
  const contentHeight = theme.page.height - theme.page.margin.top - theme.page.margin.bottom;
  const coverParagraphs = [];
  if (cover) {
    if (kind === 'page') {
      coverParagraphs.push(new Paragraph({
        spacing: { before: 0, after: 0, line: twips(contentHeight * 0.36), lineRule: LineRuleType.EXACT },
        children: [],
      }));
    }
    for (const child of elementChildren(cover)) {
      const runs = htmlToRuns(child.children.map(serializeHTML).join(''), htmlOptions);
      coverParagraphs.push(new Paragraph({ style: child.name === 'h1' ? 'Title' : 'Subtitle', children: [...runs] }));
    }
    if (kind === 'compact') coverParagraphs.push(new Paragraph({ spacing: { after: pointTwips(6) }, children: [] }));
  }

  const contentHtml = elementChildren(body)
    .filter((node) => node !== cover && node.name !== 'nav')
    .map((node) => {
      prepareForWord(node, report, theme);
      return serializeHTML(node);
    })
    .join('\n');
  const content = htmlToContent(contentHtml, htmlOptions);

  const { color, size, page } = theme;
  const pageProperties = {
    page: {
      size: { width: twips(page.width), height: twips(page.height) },
      margin: {
        top: twips(page.margin.top),
        bottom: twips(page.margin.bottom),
        left: twips(page.margin.left),
        right: twips(page.margin.right),
        header: twips(page.headerDistance),
        footer: twips(page.footerDistance),
      },
    },
  };
  const headers = {
    default: new Header({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: report.title, size: halfPoints(size.header), color: color.muted })],
      })],
    }),
  };
  const footers = {
    default: new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({
          children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
          size: halfPoints(size.header),
          bold: true,
          color: color.subtle,
        })],
      })],
    }),
  };

  // 표지 쪽과 목차는 각각 새 쪽에서 시작하는 구역으로 나눠요. 쪽 번호는 문서 전체로 이어져요.
  const sections = [];
  if (kind === 'page') {
    sections.push({
      properties: pageProperties,
      headers: { default: new Header({ children: [] }) },
      footers: { default: new Footer({ children: [] }) },
      children: coverParagraphs,
    });
  }
  if (hasToc) {
    sections.push({
      properties: pageProperties,
      headers,
      footers,
      children: [
        new Paragraph({ style: 'TocTitle', children: [new TextRun('목차')] }),
        new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
      ],
    });
  }
  sections.push({
    properties: pageProperties,
    headers,
    footers,
    children: [...(kind === 'compact' ? coverParagraphs : []), ...content],
  });

  const document = new Document({
    creator: 'global-report',
    title: report.title,
    features: hasToc ? { updateFields: true } : undefined,
    styles: wordStyles(theme),
    sections,
  });
  return { buffer: await Packer.toBuffer(document), warnings };
}

export async function exportDocx(reportDir, { out } = {}) {
  const report = loadReport(reportDir);
  const lint = lintReport(report);
  if (lint.errors.length > 0 || lint.placeholders.length > 0) {
    const error = new Error(['검사를 통과하지 못해 DOCX를 만들지 않았어요.', ...formatLint(report, lint)].join('\n'));
    error.code = 'LINT';
    throw error;
  }
  const { buffer, warnings } = await buildDocx(report, loadTheme());
  const target = path.resolve(out ?? nextExportPath(report.dir, report.title, 'docx'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return { docx: target, warnings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['--json'], options: ['--out'] });
  if (args.positional.length !== 1) {
    console.error('사용법: node export_docx.mjs <보고서 폴더> [--out <파일.docx>] [--json]');
    return 2;
  }
  const result = await exportDocx(args.positional[0], { out: args.options['--out'] });
  if (args.flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`DOCX를 만들었어요: ${result.docx}`);
    for (const warning of result.warnings) console.log(`확인 필요: ${warning}`);
  }
  return 0;
}

if (isMain(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = exitCodeFor(error);
  }
}
