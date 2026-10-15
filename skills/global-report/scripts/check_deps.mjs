#!/usr/bin/env node
// 사용법: node check_deps.mjs [--no-install] [--json]
// 보고서 스킬에 필요한 도구를 확인해요. scripts/node_modules가 없으면 npm ci로 고정한
// 의존성(docx)을 설치해요. 필수 도구가 빠지면 종료 코드 1로 끝나요.
//
// 필수: Node.js 22 이상, Chrome(PDF), pdfinfo·pdftoppm·pdffonts(확인)
// DOCX: docx 라이브러리(npm ci로 설치)
// 선택: Pages(.pages 출력, DOCX 확인용 렌더), LibreOffice(Pages가 없을 때의 DOCX 렌더),
//       pdftotext·textutil(받은 PDF·DOCX 자료 읽기)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SCRIPTS_DIR, agentSandbox, findChrome, isMain, parseArgs, which } from './lib/report.mjs';

const isMac = process.platform === 'darwin';
const POPPLER_HINT = isMac ? 'brew install poppler' : 'sudo apt-get install poppler-utils';

function findPages() {
  if (!isMac) return null;
  const result = spawnSync('mdfind', ["kMDItemCFBundleIdentifier == 'com.apple.Pages'"], { encoding: 'utf8' });
  const found = (result.stdout ?? '').split('\n').find((line) => line.endsWith('.app'));
  if (found) return found;
  return ['/Applications/Pages.app', '/Applications/Pages Creator Studio.app'].find((app) => fs.existsSync(app)) ?? null;
}

function findLibreOffice() {
  const app = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
  return which('soffice') ?? (fs.existsSync(app) ? app : null);
}

function docxInstalled() {
  return fs.existsSync(path.join(SCRIPTS_DIR, 'node_modules', 'docx', 'package.json'));
}

function installDocx() {
  const npm = which('npm');
  if (!npm) return { ok: false, message: 'npm이 없어 docx를 설치하지 못했어요.' };
  const result = spawnSync(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: SCRIPTS_DIR,
    encoding: 'utf8',
    timeout: 300_000,
  });
  if (result.status === 0 && docxInstalled()) return { ok: true, message: 'npm ci로 docx를 설치했어요.' };
  const reason = agentSandbox()
    ? 'Codex 샌드박스가 네트워크와 스킬 폴더 쓰기를 막아서 npm ci가 실패했어요. 이 명령을 샌드박스 밖에서 실행하도록 권한 승인을 요청해 주세요.'
    : 'npm ci가 실패했어요. 네트워크를 확인해 주세요.';
  return { ok: false, message: `${reason}\n${(result.stderr ?? '').trim()}` };
}

export function checkDependencies({ install = true } = {}) {
  const sandbox = agentSandbox();
  const checks = [];
  const add = (name, level, found, detail, hint) => checks.push({ name, level, ok: Boolean(found), detail: found || detail, hint: found ? '' : hint });

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add('Node.js 22 이상', 'required', nodeMajor >= 22 ? `v${process.versions.node}` : null, `v${process.versions.node}`, 'Node.js 22 이상을 설치해 주세요.');
  add('Chrome (PDF 출력)', 'required', findChrome(), '없음', 'Google Chrome을 설치하거나 CHROME_PATH로 위치를 알려 주세요.');
  for (const tool of ['pdfinfo', 'pdftoppm', 'pdffonts']) {
    add(`${tool} (결과 확인)`, 'required', which(tool), '없음', POPPLER_HINT);
  }

  let docxDetail = docxInstalled() ? '설치됨' : null;
  let docxHint = `cd "${SCRIPTS_DIR}" && npm ci --omit=dev`;
  if (!docxDetail && install) {
    const result = installDocx();
    docxDetail = result.ok ? result.message : null;
    if (!result.ok) docxHint = `${result.message}\n${docxHint}`;
  }
  add('docx 라이브러리 (DOCX 출력)', 'required', docxDetail, '없음', docxHint);

  // 샌드박스 안에서는 앱 위치 조회가 막혀서, 설치돼 있어도 찾지 못할 수 있어요.
  const missingApp = sandbox ? '샌드박스 안이라 확인하지 못했어요' : '없음';
  add('Pages (.pages 출력, DOCX 확인)', 'optional', findPages(), isMac ? missingApp : 'macOS가 아니에요', 'App Store에서 Pages를 설치하면 .pages 출력을 쓸 수 있어요.');
  add('LibreOffice (Pages가 없을 때 DOCX 확인)', 'optional', findLibreOffice(), missingApp, isMac ? 'brew install --cask libreoffice' : 'sudo apt-get install libreoffice');
  add('pdftotext (PDF 자료 읽기)', 'optional', which('pdftotext'), '없음', POPPLER_HINT);
  if (isMac) add('textutil (DOCX 자료 읽기)', 'optional', which('textutil'), '없음', 'macOS 기본 도구예요.');

  const ok = checks.every((check) => check.ok || check.level === 'optional');
  const notes = sandbox
    ? [`Codex 샌드박스(${sandbox}) 안에서 실행 중이에요. 검사, DOCX 생성, PDF 쪽 이미지 만들기는 샌드박스 안에서 돼요. `
      + 'PDF 출력(Chrome), Pages 출력, DOCX 확인 렌더는 샌드박스 밖에서 실행하도록 권한 승인이 필요해요.']
    : [];
  return { ok, sandbox, notes, checks };
}

function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['--no-install', '--json'] });
  const result = checkDependencies({ install: !args.flags.has('--no-install') });
  if (args.flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const check of result.checks) {
      const mark = check.ok ? '✓' : check.level === 'required' ? '✗' : '–';
      console.log(`${mark} ${check.name}: ${check.detail}`);
      if (check.hint) console.log(`    ${check.hint.replace(/\n/g, '\n    ')}`);
    }
    for (const note of result.notes) console.log(`확인 필요: ${note}`);
    console.log(result.ok ? '필수 도구가 모두 준비됐어요.' : '필수 도구가 빠져 있어요. 위 안내대로 설치한 뒤 다시 실행해 주세요.');
  }
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  process.exitCode = main();
}
