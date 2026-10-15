#!/usr/bin/env node
// 사용법: node export_pdf.mjs <보고서 폴더> [--out <파일.pdf>] [--json]
// report.html을 검사한 뒤 Chrome으로 인쇄해 exports/<제목>_v<N>_<날짜>.pdf를 만들어요.
// npm 의존성 없이 Node와 Chrome만으로 동작해요.
// 종료 코드: 0 성공, 1 검사 실패, 2 그 밖의 오류, 3 Codex 샌드박스 안이라 Chrome을 실행할 수 없음
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { formatLint, lintReport } from './lib/lint.mjs';
import { buildPrintHtml } from './lib/print.mjs';
import {
  agentSandbox, exitCodeFor, findChrome, isMain, loadReport, loadTheme, nextExportPath, parseArgs, pdfFonts, pdfPageCount,
  sandboxError,
} from './lib/report.mjs';

export function exportPdf(reportDir, { out } = {}) {
  const report = loadReport(reportDir);
  const lint = lintReport(report);
  if (lint.errors.length > 0 || lint.placeholders.length > 0) {
    const error = new Error(['검사를 통과하지 못해 PDF를 만들지 않았어요.', ...formatLint(report, lint)].join('\n'));
    error.code = 'LINT';
    throw error;
  }

  if (agentSandbox() === 'seatbelt') throw sandboxError('PDF를 만드는 Chrome은');
  const chrome = findChrome();
  if (!chrome) {
    const error = new Error('Chrome을 찾지 못했어요. Google Chrome을 설치하거나 CHROME_PATH 환경 변수로 위치를 알려 주세요.');
    error.code = 'DEPENDENCY';
    throw error;
  }

  const target = path.resolve(out ?? nextExportPath(report.dir, report.title, 'pdf'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'global-report-pdf-'));
  try {
    const printPath = path.join(workDir, 'print.html');
    fs.writeFileSync(printPath, buildPrintHtml(report, loadTheme()));
    const result = spawnSync(chrome, [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-pdf-header-footer',
      '--generate-pdf-document-outline',
      // report.html에는 lint가 <script>를 허용하지 않아요. --blink-settings로 스크립트를 끄면
      // Chrome 155가 PDF를 만들지 않아서 쓰지 않아요.
      `--user-data-dir=${path.join(workDir, 'profile')}`,
      `--print-to-pdf=${target}`,
      pathToFileURL(printPath).href,
    ], { encoding: 'utf8', timeout: 120_000 });
    if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
      if (agentSandbox()) throw sandboxError('PDF를 만드는 Chrome은');
      throw new Error(`Chrome이 PDF를 만들지 못했어요.\n${(result.stderr ?? '').trim()}`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  const fonts = pdfFonts(target);
  return {
    pdf: target,
    pages: pdfPageCount(target),
    type3Fonts: fonts ? fonts.filter((font) => font.type === 'Type 3').map((font) => font.name) : null,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['--json'], options: ['--out'] });
  if (args.positional.length !== 1) {
    console.error('사용법: node export_pdf.mjs <보고서 폴더> [--out <파일.pdf>] [--json]');
    return 2;
  }
  const result = exportPdf(args.positional[0], { out: args.options['--out'] });
  if (args.flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`PDF를 만들었어요: ${result.pdf}`);
    if (result.pages !== null) console.log(`쪽 수: ${result.pages}`);
    if (result.type3Fonts?.length) console.log(`확인 필요: Type 3 글꼴이 들어갔어요 (${result.type3Fonts.join(', ')}).`);
  }
  return 0;
}

if (isMain(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = exitCodeFor(error);
  }
}
