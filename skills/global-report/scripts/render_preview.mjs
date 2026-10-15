#!/usr/bin/env node
// 사용법: node render_preview.mjs <파일.pdf|.docx|.pages> [--out-dir <폴더>] [--dpi <숫자>] [--json]
// 내보낸 결과를 쪽별 PNG로 만들어 눈으로 확인할 수 있게 해요.
// - PDF: pdftoppm으로 바로 바꿔요.
// - DOCX·Pages: Pages로 PDF를 뽑아 바꿔요. Pages가 없을 때만 LibreOffice를 쓰고,
//   LibreOffice는 Pretendard를 찾지 못해 글꼴·굵게가 다르게 보일 수 있다고 알려요.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain, parseArgs, which } from './lib/report.mjs';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const LIBREOFFICE_APP = '/Applications/LibreOffice.app/Contents/MacOS/soffice';

function fail(message, code = 'RENDER') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function pagesToPdf(input, pdf) {
  if (process.platform !== 'darwin') return { ok: false, reason: 'Pages는 macOS에서만 쓸 수 있어요.' };
  const result = spawnSync('osascript', ['-l', 'JavaScript', path.join(SCRIPTS_DIR, 'export_pages.js'), input, '--pdf', pdf], {
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (result.status === 0 && fs.existsSync(pdf)) return { ok: true };
  return { ok: false, status: result.status, reason: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function libreOfficeToPdf(input, outDir) {
  const soffice = which('soffice') ?? (fs.existsSync(LIBREOFFICE_APP) ? LIBREOFFICE_APP : null);
  if (!soffice) return { ok: false, reason: 'LibreOffice가 없어요.' };
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'global-report-lo-'));
  try {
    spawnSync(soffice, [`-env:UserInstallation=${pathToFileURL(profile).href}`, '--headless', '--convert-to', 'pdf', '--outdir', outDir, input], {
      encoding: 'utf8',
      timeout: 180_000,
    });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
  const pdf = path.join(outDir, `${path.parse(input).name}.pdf`);
  return fs.existsSync(pdf) ? { ok: true, pdf } : { ok: false, reason: 'LibreOffice가 PDF를 만들지 못했어요.' };
}

export function renderPreview(file, { outDir, dpi = 80 } = {}) {
  const input = path.resolve(file);
  if (!fs.existsSync(input)) throw fail(`파일이 없어요: ${input}`, 'USAGE');
  if (!which('pdftoppm')) throw fail('pdftoppm이 없어요. macOS는 brew install poppler, Linux는 poppler-utils를 설치해 주세요.', 'DEPENDENCY');

  const extension = path.extname(input).toLowerCase();
  const previewName = `${path.parse(input).name}-${extension.slice(1)}`;
  const target = path.resolve(outDir ?? path.join(os.tmpdir(), 'global-report-preview', previewName));
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  let pdf = input;
  let renderer = 'pdf';
  const notes = [];
  if (extension === '.docx' || extension === '.pages') {
    pdf = path.join(target, 'rendered.pdf');
    const viaPages = pagesToPdf(input, pdf);
    if (viaPages.ok) {
      renderer = 'pages';
    } else if (extension === '.docx') {
      const viaLibreOffice = libreOfficeToPdf(input, target);
      if (!viaLibreOffice.ok) throw fail(`DOCX를 렌더할 앱이 없어요. Pages: ${viaPages.reason} / LibreOffice: ${viaLibreOffice.reason}`, 'DEPENDENCY');
      pdf = viaLibreOffice.pdf;
      renderer = 'libreoffice';
      notes.push(`Pages로 렌더하지 못해 LibreOffice를 썼어요 (${viaPages.reason}). LibreOffice는 Pretendard를 찾지 못해 글꼴과 굵게가 Word·Pages와 다르게 보일 수 있어요.`);
    } else {
      throw fail(`.pages 파일은 Pages로만 렌더할 수 있어요: ${viaPages.reason}`, 'DEPENDENCY');
    }
  } else if (extension !== '.pdf') {
    throw fail('PDF, DOCX, Pages 파일만 렌더할 수 있어요.', 'USAGE');
  }

  spawnSync('pdftoppm', ['-r', String(dpi), '-png', pdf, path.join(target, 'page')], { encoding: 'utf8' });
  const images = fs.readdirSync(target)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]))
    .map((name) => path.join(target, name));
  if (images.length === 0) throw fail('쪽 이미지를 만들지 못했어요.');
  return { renderer, images, notes };
}

function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['--json'], options: ['--out-dir', '--dpi'] });
  if (args.positional.length !== 1) {
    console.error('사용법: node render_preview.mjs <파일.pdf|.docx|.pages> [--out-dir <폴더>] [--dpi <숫자>] [--json]');
    return 2;
  }
  const result = renderPreview(args.positional[0], {
    outDir: args.options['--out-dir'],
    dpi: args.options['--dpi'] ? Number(args.options['--dpi']) : undefined,
  });
  if (args.flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`쪽 이미지 ${result.images.length}장을 만들었어요 (렌더: ${result.renderer}).`);
    for (const image of result.images) console.log(image);
    for (const note of result.notes) console.log(`확인 필요: ${note}`);
  }
  return 0;
}

if (isMain(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
