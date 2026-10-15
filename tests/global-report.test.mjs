// global-report 스킬의 검사·내보내기 스크립트 테스트예요.
// DOCX 테스트는 skills/global-report/scripts에서 npm ci를 한 뒤에 실행돼요.
// PDF 테스트는 Chrome, 쪽 확인은 Poppler(pdfinfo·pdftotext·pdffonts·pdftoppm)가 있어야 실행돼요.
// Pages 테스트는 GUI 앱을 띄우므로 GLOBAL_REPORT_TEST_PAGES=1일 때만 실행해요.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKILL = path.join(ROOT, 'skills', 'global-report');
const SCRIPTS = path.join(SKILL, 'scripts');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'global-report', 'sample-report');

const { parseHTML } = await import(path.join(SCRIPTS, 'lib', 'html.mjs'));
const { lintReport } = await import(path.join(SCRIPTS, 'lib', 'lint.mjs'));
const { findChrome, loadReport, nextExportPath, which } = await import(path.join(SCRIPTS, 'lib', 'report.mjs'));

const hasDocx = fs.existsSync(path.join(SCRIPTS, 'node_modules', 'docx', 'package.json'));
const hasChrome = Boolean(findChrome());
const hasPoppler = ['pdfinfo', 'pdftotext', 'pdffonts', 'pdftoppm'].every((tool) => which(tool));

/** 단색 PNG를 만들어요. 테스트용 이미지 파일을 저장소에 두지 않으려고 써요. */
function solidPng(width, height) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x5a)]);
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function sampleReport(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'global-report-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'sources'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sources', 'screen.png'), solidPng(120, 240));
  return dir;
}

function rewrite(dir, transform) {
  const file = path.join(dir, 'report.html');
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
}

function runScript(script, args, options = {}) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { encoding: 'utf8', ...options });
}

function unzipText(file, entry) {
  return spawnSync('unzip', ['-p', file, entry], { encoding: 'utf8' }).stdout;
}

test('파서는 중첩 요소와 닫히지 않은 태그를 구분해요', () => {
  const { root, errors } = parseHTML('<p>가 <strong>나 &amp; 다</strong></p><ul><li>하나</ul>');
  assert.equal(root.children[0].name, 'p');
  assert.equal(root.children[0].children[1].children[0].text, '나 & 다');
  assert.deepEqual(errors.map((error) => error.message), ['<li>가 닫히지 않았어요.']);
});

test('예시 보고서는 검사를 통과해요', (t) => {
  const result = lintReport(loadReport(sampleReport(t)));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.placeholders, []);
});

test('캡션 없는 표는 장 안에 바로 쓸 수 있어요', (t) => {
  const dir = sampleReport(t);
  rewrite(dir, (html) => html.replace('<h4>위험 요소</h4>', '<table><tbody><tr><th>위험</th><td>앱 제어</td></tr></tbody></table>\n  <h4>위험 요소</h4>'));
  assert.deepEqual(lintReport(loadReport(dir)).errors, []);
});

test('보고서 종류별 틀은 자리 표시자만 남아요', (t) => {
  for (const name of ['work-report', 'analysis-report', 'meeting-notes', 'proposal', 'field-trial-report']) {
    const dir = sampleReport(t);
    fs.copyFileSync(path.join(SKILL, 'assets', 'templates', `${name}.html`), path.join(dir, 'report.html'));
    const result = lintReport(loadReport(dir));
    assert.deepEqual(result.errors, [], name);
    assert.ok(result.placeholders.length > 0, name);
  }
});

test('완성 예시 보고서는 그대로 검사를 통과해요', () => {
  const examples = path.join(SKILL, 'assets', 'templates', 'examples');
  for (const name of fs.readdirSync(examples)) {
    const result = lintReport(loadReport(path.join(examples, name)));
    assert.deepEqual(result.errors, [], name);
    assert.deepEqual(result.placeholders, [], name);
  }
});

test('검사는 허용하지 않은 구조와 깨진 참조를 오류로 알려요', async (t) => {
  const cases = [
    ['<p>관련 저장소', '<div>관련 저장소', /<div>는 쓸 수 없는 요소예요/],
    ['<p>이번 주에는', '<p style="color:red">이번 주에는', /style 속성을 쓸 수 없어요/],
    ['sources/screen.png', 'sources/none.png', /이미지 파일이 없어요/],
    ['data-sources="S2"', 'data-sources="S9"', /출처 ID S9가 sources\.md에 없어요/],
    ['<td class="num">90</td>', '<td class="num" colspan="2">90</td>', /칸 수\(5\)가 첫 행\(4\)과 달라요/],
    ['<h4>위험 요소</h4>', '</section><section><h2>4. 빈 장</h2></section><section><h2>5. 다음</h2><h4>위험 요소</h4>', /빈 장이에요: 4\. 빈 장/],
    ['<li>RMC가 무효(V)면 속도와 침로를 지워요.</li>', '<li>RMC<ul><li>세 번째 단계</li></ul></li>', /목록은 2단계까지만/],
    ['<strong>연결 안정성</strong>', '<strong>연결 안정성', /<strong>가 닫히지 않았어요/],
  ];
  for (const [from, to, expected] of cases) {
    const dir = sampleReport(t);
    rewrite(dir, (html) => html.replace(from, to));
    const { errors } = lintReport(loadReport(dir));
    assert.ok(errors.some((error) => expected.test(error.message)), `${expected}: ${JSON.stringify(errors)}`);
  }
});

test('심볼릭 링크로 설치한 스킬에서도 스크립트가 실행돼요', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'global-report-link-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const linked = path.join(dir, 'global-report');
  fs.symlinkSync(SKILL, linked);
  const result = spawnSync(process.execPath, [path.join(linked, 'scripts', 'check_deps.mjs'), '--no-install', '--json'], { encoding: 'utf8' });
  assert.ok(Array.isArray(JSON.parse(result.stdout).checks), result.stderr);
});

test('Codex 샌드박스 안에서는 앱이 필요한 출력을 종료 코드 3으로 안내해요', (t) => {
  const dir = sampleReport(t);
  const env = { ...process.env, CODEX_SANDBOX: 'seatbelt' };
  const pdf = runScript('export_pdf.mjs', [dir], { env });
  assert.equal(pdf.status, 3, pdf.stderr);
  assert.match(pdf.stderr, /샌드박스 밖에서 실행하도록/);
  assert.equal(fs.existsSync(path.join(dir, 'exports')), false);

  const docxPath = path.join(dir, 'sample.docx');
  fs.writeFileSync(docxPath, 'not a real docx');
  const preview = runScript('render_preview.mjs', [docxPath], { env });
  assert.equal(preview.status, 3, preview.stderr);

  const deps = JSON.parse(runScript('check_deps.mjs', ['--no-install', '--json'], { env }).stdout);
  assert.equal(deps.sandbox, 'seatbelt');
  assert.equal(deps.notes.length, 1);

  if (process.platform === 'darwin') {
    const pages = spawnSync('osascript', ['-l', 'JavaScript', path.join(SCRIPTS, 'export_pages.js'), docxPath], { encoding: 'utf8', env });
    assert.equal(pages.status, 3, pages.stdout + pages.stderr);
    assert.match(pages.stdout + pages.stderr, /Codex 샌드박스/);
  }
});

test('자리 표시자가 남으면 내보내지 않아요', (t) => {
  const dir = sampleReport(t);
  rewrite(dir, (html) => html.replace('관련 저장소', '{{관련 저장소}}'));
  const result = runScript('export_pdf.mjs', [dir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /자리 표시자: \{\{관련 저장소\}\}/);
  assert.equal(fs.existsSync(path.join(dir, 'exports')), false);
});

test('내보내기 파일은 버전을 올리고 이전 파일을 남겨요', (t) => {
  const dir = sampleReport(t);
  const date = new Date(2026, 9, 15);
  const first = nextExportPath(dir, '주간 보고: 10/3주', 'pdf', date);
  assert.equal(path.basename(first), '주간_보고_103주_v1_20261015.pdf');
  fs.writeFileSync(first, '');
  assert.equal(path.basename(nextExportPath(dir, '주간 보고: 10/3주', 'pdf', date)), '주간_보고_103주_v2_20261015.pdf');
  assert.equal(path.basename(nextExportPath(dir, '주간 보고: 10/3주', 'docx', date)), '주간_보고_103주_v1_20261015.docx');
});

test('DOCX는 Word 스타일, 표 머리행, 이미지, 쪽 번호를 담아요', { skip: !hasDocx && 'npm ci를 하지 않아 docx가 없어요' }, (t) => {
  const dir = sampleReport(t);
  const result = runScript('export_docx.mjs', [dir, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const { docx, warnings } = JSON.parse(result.stdout);
  assert.deepEqual(warnings, []);
  const document = unzipText(docx, 'word/document.xml');
  for (const style of ['Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3', 'Callout', 'Caption', 'TableCaption', 'TocTitle']) {
    assert.match(document, new RegExp(`w:pStyle w:val="${style}"`), style);
  }
  assert.match(document, /<w:tblHeader\/>|<w:tblHeader /);
  assert.match(document, /w:fill="0C2D6F"/);
  assert.match(document, /TOC \\h/);
  const files = spawnSync('unzip', ['-Z1', docx], { encoding: 'utf8' }).stdout.split('\n');
  assert.ok(files.some((name) => name.startsWith('word/media/')), '이미지가 문서 안에 들어가야 해요');
  const footers = files.filter((name) => /^word\/footer\d+\.xml$/.test(name)).map((name) => unzipText(docx, name)).join('');
  assert.match(footers, /PAGE/);
  assert.match(footers, /NUMPAGES/);
  assert.match(unzipText(docx, 'word/styles.xml'), /w:eastAsia="Pretendard"/);
});

test('PDF는 표지를 빼고 머리말과 쪽 번호를 넣어요', { skip: !(hasChrome && hasPoppler) && 'Chrome이나 Poppler가 없어요' }, (t) => {
  const dir = sampleReport(t);
  const result = runScript('export_pdf.mjs', [dir, '--json'], { timeout: 120_000 });
  assert.equal(result.status, 0, result.stderr);
  const { pdf, pages, type3Fonts } = JSON.parse(result.stdout);
  assert.ok(pages >= 3, `쪽 수 ${pages}`);
  assert.deepEqual(type3Fonts, []);
  const pageText = (page) => spawnSync('pdftotext', ['-f', String(page), '-l', String(page), '-layout', pdf, '-'], { encoding: 'utf8' }).stdout;
  assert.doesNotMatch(pageText(1), new RegExp(`1\\s*/\\s*${pages}`));
  assert.match(pageText(2), /목차/);
  assert.match(pageText(2), new RegExp(`2\\s*/\\s*${pages}`));
  assert.match(pageText(2), /RTK 데모 앱 10월 진행 보고/);
  const fonts = spawnSync('pdffonts', [pdf], { encoding: 'utf8' }).stdout;
  assert.match(fonts, /Pretendard/);

  const preview = runScript('render_preview.mjs', [pdf, '--out-dir', path.join(dir, 'preview'), '--dpi', '30', '--json']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).images.length, pages);
});

test('Pages는 DOCX를 .pages로 저장해요', { skip: process.env.GLOBAL_REPORT_TEST_PAGES !== '1' && 'GLOBAL_REPORT_TEST_PAGES=1일 때만 실행해요' }, (t) => {
  const dir = sampleReport(t);
  const docx = JSON.parse(runScript('export_docx.mjs', [dir, '--json']).stdout).docx;
  const result = spawnSync('osascript', ['-l', 'JavaScript', path.join(SCRIPTS, 'export_pages.js'), docx], { encoding: 'utf8', timeout: 180_000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const pagesFile = docx.replace(/\.docx$/, '.pages');
  assert.ok(fs.existsSync(pagesFile));
  const again = spawnSync('osascript', ['-l', 'JavaScript', path.join(SCRIPTS, 'export_pages.js'), docx], { encoding: 'utf8' });
  assert.equal(again.status, 2, '이미 있는 .pages는 덮어쓰지 않아야 해요');
});
