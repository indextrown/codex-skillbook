'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { relativeSegments, run } = require('../bin/project-docs.js');

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-docs-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

async function invoke(args, { tty = false, confirm = false } = {}) {
  let output = '';
  let errors = '';
  const io = {
    stdin: { isTTY: tty },
    stdout: { isTTY: tty, write: (chunk) => { output += chunk; } },
    stderr: { write: (chunk) => { errors += chunk; } },
    confirm: async () => confirm,
  };
  const code = await run(args, io);
  return { code, output, errors };
}

test('--dry-run previews the four default files without changing the project', async (t) => {
  const root = project(t);
  const result = await invoke(['init', 'ios-uikit', '--target', root, '--dry-run']);

  assert.equal(result.code, 0);
  assert.match(result.output, /CREATE\s+AGENTS\.md/u);
  assert.match(result.output, /CREATE\s+docs\/Root\.md/u);
  assert.match(result.output, /CREATE\s+docs\/architecture\/architecture\.md/u);
  assert.match(result.output, /CREATE\s+docs\/development\/testing\.md/u);
  assert.doesNotMatch(result.output, /gitflow\.md/u);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('non-interactive execution requires --apply before writing', async (t) => {
  const root = project(t);
  const result = await invoke(['init', 'ios-uikit', '--target', root]);

  assert.equal(result.code, 1);
  assert.match(result.errors, /--apply/u);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('declining the interactive confirmation writes nothing', async (t) => {
  const root = project(t);
  const result = await invoke(['init', 'ios-uikit', '--target', root], { tty: true, confirm: false });

  assert.equal(result.code, 0);
  assert.match(result.output, /적용을 취소했어요/u);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('interactive confirmation creates only the documented default tree', async (t) => {
  const root = project(t);
  const result = await invoke(
    ['init', 'ios-uikit', '--target', root, '--project-name', 'MyUIKitApp'],
    { tty: true, confirm: true },
  );

  assert.equal(result.code, 0, result.errors);
  assert.deepEqual(fs.readdirSync(root).sort(), ['AGENTS.md', 'docs']);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs')).sort(), ['Root.md', 'architecture', 'development']);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'architecture')), ['architecture.md']);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'development')), ['testing.md']);
  assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /MyUIKitApp/u);
  const rootDoc = fs.readFileSync(path.join(root, 'docs', 'Root.md'), 'utf8');
  assert.match(rootDoc, /\[아키텍처\]\(architecture\/architecture\.md\)/u);
  assert.match(rootDoc, /\[테스트\]\(development\/testing\.md\)/u);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'development', 'gitflow.md')), false);
  const architecture = fs.readFileSync(path.join(root, 'docs', 'architecture', 'architecture.md'), 'utf8');
  assert.match(architecture, /## 목차/u);
  assert.match(architecture, /## 계층별 구조/u);
  assert.match(architecture, /### App: 시작점과 의존성 조립/u);
  assert.match(architecture, /### Domain: 비즈니스 규칙과 계약/u);
  assert.match(architecture, /### Data: 계약 구현과 데이터 변환/u);
  assert.match(architecture, /### Infrastructure: 외부 시스템 접근/u);
  assert.match(architecture, /### Presentation: 화면과 화면 상태/u);
  assert.match(architecture, /Presentation → Domain ← Data → Infrastructure/u);
  assert.match(architecture, /### 화면에서 데이터까지: 프로필 새로고침 예시/u);
  assert.match(architecture, /## 주요 패턴과 사용 기술/u);
  assert.match(architecture, /## 새 기능 개발 체크리스트/u);
  assert.match(architecture, /## 관련 문서/u);
  assert.match(architecture, /\[문서 길잡이\]\(\.\.\/Root\.md\)/u);
  assert.match(architecture, /\[테스트\]\(\.\.\/development\/testing\.md\)/u);
  assert.match(architecture, /프로젝트 코드를 분석하지 않아요/u);
  assert.match(architecture, /이 키트가 RxSwift 도입을 요구하지는 않아요/u);
  assert.equal(fs.existsSync(path.join(root, 'package.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'package-lock.json')), false);
});

test('--include gitflow adds the optional document', async (t) => {
  const root = project(t);
  const result = await invoke(['init', 'ios-uikit', '--target', root, '--include', 'gitflow', '--apply']);

  assert.equal(result.code, 0, result.errors);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'development')).sort(), ['gitflow.md', 'testing.md']);
  const gitflow = fs.readFileSync(path.join(root, 'docs', 'development', 'gitflow.md'), 'utf8');
  assert.match(gitflow, /확인 필요/u);
  assert.match(gitflow, /## 한 작업을 PR로 보내는 흐름/u);
  assert.match(gitflow, /git diff --staged/u);
  assert.match(gitflow, /## 커밋·PR 전 체크리스트/u);
  assert.match(gitflow, /기본 브랜치가 `main`이고 원격 이름이 `origin`인 경우/u);
  assert.doesNotMatch(gitflow, /Yeobaek|Seoul|MapBox|Tuist/u);
});

test('the executable uses the current project directory by default', (t) => {
  const root = project(t);
  const result = spawnSync(process.execPath, [
    path.resolve(__dirname, '..', 'bin', 'project-docs.js'), 'init', 'ios-uikit', '--apply',
  ], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`대상 프로젝트: ${fs.realpathSync(root)}`));
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), true);
});

test('re-running the command leaves generated files unchanged', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const before = fs.readFileSync(path.join(root, 'AGENTS.md'));

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.equal((result.output.match(/UNCHANGED/g) || []).length, 4);
  assert.deepEqual(fs.readFileSync(path.join(root, 'AGENTS.md')), before);
});

test('a differing existing file is preserved while missing files are created', async (t) => {
  const root = project(t);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '팀에서 작성한 규칙\n');

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 2);
  assert.match(result.output, /SKIP_EXISTING\s+AGENTS\.md/u);
  assert.match(result.output, /생성 3개, 기존 파일 보존 1개/u);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), '팀에서 작성한 규칙\n');
  assert.equal(fs.existsSync(path.join(root, 'docs', 'development', 'testing.md')), true);
});

test('a symlinked destination rejects the entire plan before writing', async (t) => {
  const root = project(t);
  const outside = project(t);
  const outsideFile = path.join(outside, 'outside.md');
  fs.writeFileSync(outsideFile, 'outside\n');
  fs.symlinkSync(outsideFile, path.join(root, 'AGENTS.md'));

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 1);
  assert.match(result.errors, /심볼릭 링크/u);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside\n');
  assert.equal(fs.existsSync(path.join(root, 'docs')), false);
});

test('a symlinked parent rejects the entire plan before writing', async (t) => {
  const root = project(t);
  const outside = project(t);
  fs.symlinkSync(outside, path.join(root, 'docs'));

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 1);
  assert.match(result.errors, /상위 경로/u);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('a symlinked target root is rejected', async (t) => {
  const root = project(t);
  const linkDirectory = project(t);
  const link = path.join(linkDirectory, 'linked-project');
  fs.symlinkSync(root, link);

  const result = await invoke(['init', 'ios-uikit', '--target', link, '--apply']);

  assert.equal(result.code, 1);
  assert.match(result.errors, /심볼릭 링크/u);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('a file in place of a parent directory rejects the plan', async (t) => {
  const root = project(t);
  fs.writeFileSync(path.join(root, 'docs'), 'not a directory');

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
});

test('relative targets, traversal paths, and conflicting modes are rejected', async (t) => {
  const root = project(t);

  assert.throws(() => relativeSegments('../outside.md', '대상'), /프로젝트 밖/u);
  assert.throws(() => relativeSegments('docs//testing.md', '대상'), /프로젝트 밖/u);
  assert.equal((await invoke(['init', 'ios-uikit', '--target', 'relative/path', '--apply'])).code, 1);
  assert.equal((await invoke(['init', 'ios-uikit', '--target', root, '--dry-run', '--apply'])).code, 1);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('the packed CLI runs through npm without adding dependencies to the target', (t) => {
  const packageRoot = path.resolve(__dirname, '..');
  const packDirectory = project(t);
  const target = project(t);
  const appSource = path.join(target, 'MyUIKitApp', 'AppDelegate.swift');
  fs.mkdirSync(path.dirname(appSource));
  fs.writeFileSync(appSource, 'import UIKit\n');
  fs.writeFileSync(path.join(target, 'package.json'), '{"name":"existing-app"}\n');
  fs.writeFileSync(path.join(target, 'package-lock.json'), '{"name":"existing-app","lockfileVersion":3}\n');
  const before = new Map(['package.json', 'package-lock.json'].map((name) => [
    name, fs.readFileSync(path.join(target, name)),
  ]));
  const packResult = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
  }));
  const packagedPaths = packResult[0].files.map((file) => file.path);
  assert.ok(packagedPaths.includes('bin/project-docs.js'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/kit.json'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/Root.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/architecture/architecture.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/development/gitflow.md.tmpl'));
  assert.equal(packagedPaths.some((file) => file.startsWith('skills/') || file.startsWith('docs/')), false);

  const archive = JSON.parse(execFileSync('npm', ['pack', '--pack-destination', packDirectory, '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
  }))[0].filename;
  const result = spawnSync('npm', [
    'exec', '--yes', `--package=${path.join(packDirectory, archive)}`, '--',
    'project-docs', 'init', 'ios-uikit', '--target', target, '--apply',
  ], {
    cwd: target,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: path.join(packDirectory, 'npm-cache') },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(target, 'AGENTS.md')), true);
  assert.equal(fs.readFileSync(appSource, 'utf8'), 'import UIKit\n');
  for (const [name, content] of before) {
    assert.deepEqual(fs.readFileSync(path.join(target, name)), content);
  }
  assert.equal(fs.existsSync(path.join(target, 'node_modules')), false);
});
