'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { relativeSegments, run } = require('../bin/project-docs.js');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function manifestPath(root) {
  return path.join(root, '.project-docs', 'manifest.json');
}

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

test('--dry-run previews all eleven required files without changing the project', async (t) => {
  const root = project(t);
  const result = await invoke(['init', 'ios-uikit', '--target', root, '--dry-run']);

  assert.equal(result.code, 0);
  assert.match(result.output, /CREATE\s+AGENTS\.md/u);
  assert.match(result.output, /CREATE\s+CLAUDE\.md/u);
  assert.match(result.output, /CREATE\s+docs\/architecture\/architecture\.md/u);
  assert.match(result.output, /CREATE\s+docs\/architecture\/dicontainer\.md/u);
  assert.match(result.output, /CREATE\s+docs\/architecture\/view-viewmodel-protocols\.md/u);
  assert.match(result.output, /CREATE\s+docs\/architecture\/rxswift\.md/u);
  assert.match(result.output, /CREATE\s+docs\/architecture\/rxswift-binding-policy\.md/u);
  assert.match(result.output, /CREATE\s+docs\/architecture\/rxswift-input-output\.md/u);
  assert.match(result.output, /CREATE\s+docs\/development\/gitflow\.md/u);
  assert.match(result.output, /CREATE\s+docs\/development\/swiftstyle\.md/u);
  assert.match(result.output, /CREATE\s+docs\/development\/testing\.md/u);
  assert.doesNotMatch(result.output, /Root\.md/u);
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
  assert.deepEqual(fs.readdirSync(root).sort(), ['.project-docs', 'AGENTS.md', 'CLAUDE.md', 'docs']);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs')).sort(), ['architecture', 'development']);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'architecture')).sort(), [
    'architecture.md', 'dicontainer.md', 'rxswift-binding-policy.md', 'rxswift-input-output.md', 'rxswift.md',
    'view-viewmodel-protocols.md',
  ]);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'development')).sort(), [
    'gitflow.md', 'swiftstyle.md', 'testing.md',
  ]);
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /MyUIKitApp/u);
  assert.match(agents, /## 작업 전에 확인할 문서/u);
  assert.match(agents, /\| 확인할 내용 \| 문서 \| 확인 기준 \|/u);
  assert.match(agents, /\[아키텍처\]\(docs\/architecture\/architecture\.md\)/u);
  assert.match(agents, /\[DI Container\]\(docs\/architecture\/dicontainer\.md\)/u);
  assert.match(agents, /\[View·ViewModel 프로토콜\]\(docs\/architecture\/view-viewmodel-protocols\.md\)/u);
  assert.match(agents, /\[Swift 스타일\]\(docs\/development\/swiftstyle\.md\)/u);
  assert.match(agents, /\[테스트\]\(docs\/development\/testing\.md\)/u);
  assert.match(agents, /\[Git 작업 흐름\]\(docs\/development\/gitflow\.md\)/u);
  assert.match(agents, /\[RxSwift\]\(docs\/architecture\/rxswift\.md\)/u);
  assert.doesNotMatch(agents, /Root\.md/u);
  assert.match(agents, /## 작업 중 판단 기준/u);
  assert.doesNotMatch(agents, /선택 문서/u);
  assert.match(agents, /## 작업 완료 전 확인/u);
  assert.match(agents, /프로젝트에 맞는 테스트를 실행하고 결과를 기록했어요/u);
  assert.doesNotMatch(agents, /Yeobaek|Navi 3\.0|PopPang/u);
  const claude = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(claude, /# MyUIKitApp Claude Code 작업 안내/u);
  assert.match(claude, /^@AGENTS\.md$/mu);
  assert.match(claude, /공통 규칙은 이 파일에 중복해서 적지 않아요/u);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'development', 'gitflow.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', 'rxswift.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', 'rxswift-binding-policy.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', 'rxswift-input-output.md')), true);
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
  assert.match(architecture, /\[DI Container 패턴\]\(dicontainer\.md\)/u);
  assert.match(architecture, /\[View·ViewModel 프로토콜 패턴\]\(view-viewmodel-protocols\.md\)/u);
  assert.match(architecture, /\[테스트\]\(\.\.\/development\/testing\.md\)/u);
  assert.doesNotMatch(architecture, /Root\.md/u);
  assert.match(architecture, /프로젝트 코드를 분석하지 않아요/u);
  assert.match(architecture, /이 키트가 RxSwift 도입을 요구하지는 않아요/u);
  const diContainer = fs.readFileSync(path.join(root, 'docs', 'architecture', 'dicontainer.md'), 'utf8');
  assert.match(diContainer, /# MyUIKitApp iOS DI Container 패턴/u);
  assert.match(diContainer, /\| `private let`/u);
  assert.match(diContainer, /\| `private lazy var = Type\(\.\.\.\)`/u);
  assert.match(diContainer, /\| `private lazy var = \{ \.\.\. \}\(\)`/u);
  assert.match(diContainer, /\| `func make\.\.\.\(\)`/u);
  assert.match(diContainer, /func makeProfileViewModel\(\n\s+userID: String/u);
  assert.match(diContainer, /### 사용처 주석 규칙/u);
  assert.match(diContainer, /Infrastructure → Domain → Presentation/u);
  assert.match(diContainer, /### ViewModel Factory 메서드/u);
  assert.match(diContainer, /func makeSplashViewModel\(\n\s+_ actions: SplashViewActions/u);
  assert.doesNotMatch(diContainer, /Navi 3\.0|이유업|다른 UIKit 프로젝트/u);
  const protocolsPath = path.join(root, 'docs', 'architecture', 'view-viewmodel-protocols.md');
  const protocols = fs.readFileSync(protocolsPath, 'utf8');
  assert.match(protocols, /# MyUIKitApp UIKit View·ViewModel 프로토콜 패턴/u);
  assert.doesNotMatch(protocols, /\{\{PROJECT_NAME\}\}|\/Users\//u);
  for (const match of protocols.matchAll(/\]\(([^)]+\.md)\)/gu)) {
    if (/^https?:/u.test(match[1])) continue;
    assert.equal(fs.existsSync(path.resolve(path.dirname(protocolsPath), match[1])), true, match[1]);
  }
  const swiftStyle = fs.readFileSync(path.join(root, 'docs', 'development', 'swiftstyle.md'), 'utf8');
  assert.match(swiftStyle, /# MyUIKitApp Swift 스타일 가이드/u);
  assert.match(swiftStyle, /## 파일 헤더/u);
  assert.match(swiftStyle, /## 코드 포맷팅/u);
  assert.match(swiftStyle, /## 네이밍/u);
  assert.match(swiftStyle, /## 코드 스타일/u);
  assert.match(swiftStyle, /## MARK 주석/u);
  assert.match(swiftStyle, /Created by Developer/u);
  assert.match(swiftStyle, /UIView\.animate\(/u);
  assert.match(swiftStyle, /`private extension` 금지/u);
  assert.match(swiftStyle, /\[아키텍처\]\(\.\.\/architecture\/architecture\.md\)/u);
  assert.doesNotMatch(swiftStyle, /\{\{PROJECT_NAME\}\}|Navi 3\.0|이유업|UPs|_DevGuide_Index/u);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  assert.equal(manifest.kit, 'ios-uikit');
  assert.equal(Object.hasOwn(manifest, 'version'), false);
  assert.deepEqual(Object.keys(manifest.files), [
    'AGENTS.md',
    'CLAUDE.md',
    'docs/architecture/architecture.md',
    'docs/architecture/dicontainer.md',
    'docs/architecture/view-viewmodel-protocols.md',
    'docs/architecture/rxswift-binding-policy.md',
    'docs/architecture/rxswift-input-output.md',
    'docs/architecture/rxswift.md',
    'docs/development/gitflow.md',
    'docs/development/swiftstyle.md',
    'docs/development/testing.md',
  ].sort((left, right) => left.localeCompare(right)));
  assert.equal(manifest.files['AGENTS.md'], sha256(fs.readFileSync(path.join(root, 'AGENTS.md'))));
  assert.equal(manifest.files['CLAUDE.md'], sha256(fs.readFileSync(path.join(root, 'CLAUDE.md'))));
  assert.equal(
    manifest.files['docs/development/swiftstyle.md'],
    sha256(fs.readFileSync(path.join(root, 'docs', 'development', 'swiftstyle.md'))),
  );
  assert.equal(fs.existsSync(path.join(root, 'package.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'package-lock.json')), false);
});

test('the legacy --include gitflow option remains compatible', async (t) => {
  const root = project(t);
  const result = await invoke(['init', 'ios-uikit', '--target', root, '--include', 'gitflow', '--apply']);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /--include 옵션은 더 이상 필요하지 않아요/u);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'development')).sort(), [
    'gitflow.md', 'swiftstyle.md', 'testing.md',
  ]);
  const gitflow = fs.readFileSync(path.join(root, 'docs', 'development', 'gitflow.md'), 'utf8');
  assert.match(gitflow, /확인 필요/u);
  assert.match(gitflow, /## 한 작업을 PR로 보내는 흐름/u);
  assert.match(gitflow, /작업 브랜치 생성 → 변경·검증 → 커밋할 파일 선택 → 커밋 → push → PR 생성·리뷰/u);
  assert.match(gitflow, /### 2\. 작업 브랜치를 만들어요/u);
  assert.match(gitflow, /### 4\. 커밋할 파일을 선택하고 확인해요/u);
  assert.match(gitflow, /커밋하기 직전에 이번 커밋에 포함할 파일만 stage해요/u);
  assert.match(gitflow, /git add docs\/development\/gitflow\.md/u);
  assert.doesNotMatch(gitflow, /git add --/u);
  assert.match(gitflow, /git diff --staged/u);
  assert.match(gitflow, /### 5\. 커밋 규칙을 확인하고 커밋해요/u);
  assert.match(gitflow, /git log -20 --pretty=format/u);
  assert.match(gitflow, /\| `feat` \|/u);
  assert.match(gitflow, /\[feat\] 프로필 새로고침 추가/u);
  assert.match(gitflow, /\[docs\] Git 작업 흐름 정리/u);
  assert.match(gitflow, /git commit -m "\[docs\] Git 작업 흐름 정리"/u);
  assert.match(gitflow, /git log -1 --oneline/u);
  assert.match(gitflow, /### 6\. 커밋을 원격 저장소에 push해요/u);
  assert.match(gitflow, /git push -u origin feature\/profile-refresh/u);
  assert.match(gitflow, /### 7\. PR을 만들고 리뷰를 요청해요/u);
  assert.doesNotMatch(gitflow, /(?:feat|fix|refactor|test|docs|chore): /u);
  assert.match(gitflow, /#### PR 제목을 작성해요/u);
  assert.match(gitflow, /\[docs\] Git 작업 흐름을 개선한다/u);
  assert.match(gitflow, /#### PR 본문은 저장소 템플릿을 따라요/u);
  assert.match(gitflow, /새로 작성하는 문장은 `-다`체로 통일해요/u);
  assert.match(gitflow, /\.github\/PULL_REQUEST_TEMPLATE\.md/u);
  assert.match(gitflow, /PR 템플릿이 없어요\. 이 저장소에 새 템플릿을 만들까요\?/u);
  assert.match(gitflow, /사용자가 요청하지 않았다면 PR을 만들기 위해 새 이슈를 만들지 않아요/u);
  assert.match(gitflow, /gh --version/u);
  assert.match(gitflow, /GitHub CLI가 없어요\. gh 방식으로 PR을 만들 수 있도록 설치할까요\?/u);
  assert.match(gitflow, /gh pr create/u);
  assert.match(gitflow, /설치를 원하지 않으면 push 결과의 GitHub 링크나 웹 화면에서 PR을 만들어요/u);
  assert.match(gitflow, /## 커밋·PR 전 체크리스트/u);
  assert.match(gitflow, /기본 브랜치가 `main`이고 원격 이름이 `origin`인 경우/u);
  assert.doesNotMatch(gitflow, /## 작업 중 기본 브랜치|## 작업 중 변경 보관|## 긴급 수정과 릴리스/u);
  assert.doesNotMatch(gitflow, /Yeobaek|Seoul|MapBox|Tuist|PopPang/u);
});

test('the legacy --include rxswift option remains compatible', async (t) => {
  const root = project(t);
  const result = await invoke(['init', 'ios-uikit', '--target', root, '--include', 'rxswift', '--apply']);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /--include 옵션은 더 이상 필요하지 않아요/u);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs', 'architecture')).sort(), [
    'architecture.md', 'dicontainer.md', 'rxswift-binding-policy.md', 'rxswift-input-output.md', 'rxswift.md',
    'view-viewmodel-protocols.md',
  ]);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'development', 'gitflow.md')), true);
  const guide = fs.readFileSync(path.join(root, 'docs', 'architecture', 'rxswift.md'), 'utf8');
  assert.match(guide, /# RxSwift와 RxCocoa 타입 및 연산자 가이드/u);
  assert.match(guide, /## 최종 선택표/u);
  assert.match(guide, /## 위치 조회 화면에서는 이렇게 사용할 수 있어요/u);
  assert.match(guide, /\[바인딩 정책\]\(rxswift-binding-policy\.md\)/u);
  assert.match(guide, /\[Input\/Output 패턴\]\(rxswift-input-output\.md\)/u);
  assert.doesNotMatch(guide, /MapBox|Yeobaek|현재 프로젝트의/u);
  const policy = fs.readFileSync(path.join(root, 'docs', 'architecture', 'rxswift-binding-policy.md'), 'utf8');
  assert.match(policy, /## `Driver` 미사용은 명시적으로 선택해요/u);
  assert.match(policy, /defaultTapThrottle\(\).*별도로 정의해야 하는 확장/u);
  assert.doesNotMatch(policy, /Navi 3\.0|MarkEditInfo|이유업|다른 UIKit 프로젝트|참고한 팀 사례/u);
  const pattern = fs.readFileSync(path.join(root, 'docs', 'architecture', 'rxswift-input-output.md'), 'utf8');
  assert.match(pattern, /## Input·Output 계약을 먼저 정해요/u);
  assert.match(pattern, /func transform\(\n\s+input: ProfileInput,\n\s+disposeBag: DisposeBag/u);
  assert.match(pattern, /## Output을 화면에 연결해요/u);
  assert.doesNotMatch(pattern, /Navi 3\.0|MarkEditInfo|이유업|참고 사례/u);
  for (const document of [guide, policy, pattern]) {
    for (const match of document.matchAll(/\]\((rxswift[^)]+\.md)\)/gu)) {
      assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', match[1])), true, match[1]);
    }
  }
});

test('both legacy --include options can be used together', async (t) => {
  const root = project(t);
  const result = await invoke([
    'init', 'ios-uikit', '--target', root, '--include', 'gitflow', '--include', 'rxswift', '--apply',
  ]);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /--include 옵션은 더 이상 필요하지 않아요/u);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'development', 'gitflow.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', 'rxswift.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', 'rxswift-binding-policy.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', 'rxswift-input-output.md')), true);
});

test('re-running without legacy --include flags keeps every document under management', async (t) => {
  const root = project(t);
  assert.equal((await invoke([
    'init', 'ios-uikit', '--target', root, '--include', 'gitflow', '--include', 'rxswift', '--apply',
  ])).code, 0);

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 0, result.errors);
  assert.doesNotMatch(result.output, /RETIRED/u);
  assert.doesNotMatch(result.output, /DELETE/u);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  assert.equal(Object.hasOwn(manifest.files, 'docs/development/gitflow.md'), true);
  assert.equal(Object.hasOwn(manifest.files, 'docs/architecture/rxswift.md'), true);
  assert.equal(Object.hasOwn(manifest.files, 'docs/architecture/rxswift-binding-policy.md'), true);
  assert.equal(Object.hasOwn(manifest.files, 'docs/architecture/rxswift-input-output.md'), true);
});

test('re-running preserves an edited required RxSwift guide', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const guidePath = path.join(root, 'docs', 'architecture', 'rxswift.md');
  fs.writeFileSync(guidePath, '# 팀이 수정한 RxSwift 가이드\n');

  const result = await invoke(args);

  assert.equal(result.code, 2);
  assert.match(result.output, /SKIP_MODIFIED\s+docs\/architecture\/rxswift\.md/u);
  assert.equal(fs.readFileSync(guidePath, 'utf8'), '# 팀이 수정한 RxSwift 가이드\n');
});

test('an existing rxswift.md is preserved while the two companion documents are added', async (t) => {
  const root = project(t);
  const architecture = path.join(root, 'docs', 'architecture');
  fs.mkdirSync(architecture, { recursive: true });
  fs.writeFileSync(path.join(architecture, 'rxswift.md'), '# 기존 가이드\n');

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 2);
  assert.match(result.output, /SKIP_UNTRACKED\s+docs\/architecture\/rxswift\.md/u);
  assert.equal(fs.readFileSync(path.join(architecture, 'rxswift.md'), 'utf8'), '# 기존 가이드\n');
  assert.equal(fs.existsSync(path.join(architecture, 'rxswift-binding-policy.md')), true);
  assert.equal(fs.existsSync(path.join(architecture, 'rxswift-input-output.md')), true);
});

test('the executable uses the current project directory by default', (t) => {
  const root = project(t);
  const result = spawnSync(process.execPath, [
    path.resolve(__dirname, '..', 'bin', 'project-docs.js'), 'init', 'ios-uikit', '--apply',
  ], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`대상 프로젝트: ${fs.realpathSync(root)}`));
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), true);
});

test('re-running the command leaves generated files unchanged', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const before = fs.readFileSync(path.join(root, 'AGENTS.md'));

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.equal((result.output.match(/UNCHANGED/g) || []).length, 11);
  assert.deepEqual(fs.readFileSync(path.join(root, 'AGENTS.md')), before);
});

test('re-running the command updates a tracked file that the user did not edit', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const agentsPath = path.join(root, 'AGENTS.md');
  const previousTemplate = Buffer.from('# 이전 키트가 만든 문서\n');
  fs.writeFileSync(agentsPath, previousTemplate);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  manifest.files['AGENTS.md'] = sha256(previousTemplate);
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /UPDATE\s+AGENTS\.md/u);
  assert.doesNotMatch(fs.readFileSync(agentsPath, 'utf8'), /이전 키트가 만든 문서/u);
  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  assert.equal(updatedManifest.files['AGENTS.md'], sha256(fs.readFileSync(agentsPath)));
});

for (const documentName of ['dicontainer.md', 'view-viewmodel-protocols.md']) {
  test(`re-running an older managed kit adds the default ${documentName} document`, async (t) => {
    const root = project(t);
    const args = ['init', 'ios-uikit', '--target', root, '--apply'];
    assert.equal((await invoke(args)).code, 0);
    const documentTarget = `docs/architecture/${documentName}`;
    const documentPath = path.join(root, documentTarget);
    const expected = fs.readFileSync(documentPath);
    fs.rmSync(documentPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
    delete manifest.files[documentTarget];
    fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

    const result = await invoke(args);

    assert.equal(result.code, 0, result.errors);
    assert.ok(result.output.split('\n').some((line) =>
      line.startsWith('CREATE') && line.endsWith(documentTarget),
    ));
    assert.deepEqual(fs.readFileSync(documentPath), expected);
    const updatedManifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
    assert.equal(updatedManifest.files[documentTarget], sha256(expected));
  });
}

test('re-running an older managed kit adds the new CLAUDE.md bridge', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const claudePath = path.join(root, 'CLAUDE.md');
  fs.rmSync(claudePath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  delete manifest.files['CLAUDE.md'];
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /CREATE\s+CLAUDE\.md/u);
  assert.match(fs.readFileSync(claudePath, 'utf8'), /^@AGENTS\.md$/mu);
  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  assert.equal(updatedManifest.files['CLAUDE.md'], sha256(fs.readFileSync(claudePath)));
});

test('re-running an older managed kit adds the new Swift style guide', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const swiftStylePath = path.join(root, 'docs', 'development', 'swiftstyle.md');
  fs.rmSync(swiftStylePath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  delete manifest.files['docs/development/swiftstyle.md'];
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /CREATE\s+docs\/development\/swiftstyle\.md/u);
  assert.match(fs.readFileSync(swiftStylePath, 'utf8'), /## MARK 주석/u);
  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  assert.equal(
    updatedManifest.files['docs/development/swiftstyle.md'],
    sha256(fs.readFileSync(swiftStylePath)),
  );
});

test('re-running deletes a retired generated document that was not edited', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const retiredPath = path.join(root, 'docs', 'Root.md');
  const retiredContent = Buffer.from('# 이전 문서 길잡이\n');
  fs.writeFileSync(retiredPath, retiredContent);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  manifest.files['docs/Root.md'] = sha256(retiredContent);
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /DELETE\s+docs\/Root\.md/u);
  assert.match(result.output, /삭제 1개/u);
  assert.equal(fs.existsSync(retiredPath), false);
  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  assert.equal(Object.hasOwn(updatedManifest.files, 'docs/Root.md'), false);
});

test('re-running deletes an unchanged legacy document after it was untracked', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const retiredPath = path.join(root, 'docs', 'Root.md');
  const retiredTemplate = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'project-doc-kits',
    'ios-uikit',
    'retired',
    'docs',
    'Root.md.tmpl',
  ), 'utf8');
  fs.writeFileSync(retiredPath, retiredTemplate.replaceAll('{{PROJECT_NAME}}', path.basename(root)));

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /DELETE\s+docs\/Root\.md/u);
  assert.equal(fs.existsSync(retiredPath), false);
});

test('re-running preserves an edited retired document', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const retiredPath = path.join(root, 'docs', 'Root.md');
  const generatedContent = Buffer.from('# 이전 문서 길잡이\n');
  const editedContent = Buffer.from('# 팀이 수정한 문서 길잡이\n');
  fs.writeFileSync(retiredPath, editedContent);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  manifest.files['docs/Root.md'] = sha256(generatedContent);
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

  const result = await invoke(args);

  assert.equal(result.code, 2, result.errors);
  assert.match(result.output, /SKIP_RETIRED_MODIFIED\s+docs\/Root\.md/u);
  assert.deepEqual(fs.readFileSync(retiredPath), editedContent);
  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  assert.equal(updatedManifest.files['docs/Root.md'], sha256(generatedContent));
});

test('re-running preserves an untracked Root.md that does not match the legacy template', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const rootPath = path.join(root, 'docs', 'Root.md');
  const customContent = '# 팀에서 만든 문서 홈\n';
  fs.writeFileSync(rootPath, customContent);

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.doesNotMatch(result.output, /Root\.md/u);
  assert.equal(fs.readFileSync(rootPath, 'utf8'), customContent);
});

test('a symlinked retired document is rejected before deletion', async (t) => {
  const root = project(t);
  const outside = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const outsideFile = path.join(outside, 'Root.md');
  fs.writeFileSync(outsideFile, '# 외부 문서\n');
  fs.symlinkSync(outsideFile, path.join(root, 'docs', 'Root.md'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
  manifest.files['docs/Root.md'] = sha256(Buffer.from('# 이전 문서 길잡이\n'));
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

  const result = await invoke(args);

  assert.equal(result.code, 1);
  assert.match(result.errors, /관리 종료 대상이 일반 파일이 아니거나 심볼릭 링크/u);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), '# 외부 문서\n');
});

test('a legacy file that already matches the template can be tracked safely', async (t) => {
  const root = project(t);
  const args = ['init', 'ios-uikit', '--target', root, '--apply'];
  assert.equal((await invoke(args)).code, 0);
  const before = fs.readFileSync(path.join(root, 'AGENTS.md'));
  fs.rmSync(path.join(root, '.project-docs'), { recursive: true });

  const result = await invoke(args);

  assert.equal(result.code, 0, result.errors);
  assert.match(result.output, /생성 0개, 갱신 0개, 삭제 0개, 추적 11개, 관리 종료 0개, 사용자 문서 보존 0개/u);
  assert.deepEqual(fs.readFileSync(path.join(root, 'AGENTS.md')), before);
  assert.equal(fs.existsSync(manifestPath(root)), true);
});

test('an existing docs directory and unrelated documents are left untouched', async (t) => {
  const root = project(t);
  const existing = path.join(root, 'docs', 'decisions.md');
  fs.mkdirSync(path.dirname(existing));
  fs.writeFileSync(existing, '# 팀 결정 기록\n');

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 0, result.errors);
  assert.equal(fs.readFileSync(existing, 'utf8'), '# 팀 결정 기록\n');
  assert.equal(fs.existsSync(path.join(root, 'docs', 'architecture', 'architecture.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'development', 'testing.md')), true);
});

test('a differing existing file is preserved while missing files are created', async (t) => {
  const root = project(t);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '팀에서 작성한 규칙\n');

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 2);
  assert.match(result.output, /SKIP_UNTRACKED\s+AGENTS\.md/u);
  assert.match(result.output, /생성 10개, 갱신 0개, 삭제 0개, 추적 0개, 관리 종료 0개, 사용자 문서 보존 1개/u);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), '팀에서 작성한 규칙\n');
  assert.equal(fs.existsSync(path.join(root, 'docs', 'development', 'testing.md')), true);
});

test('an existing CLAUDE.md is preserved while missing files are created', async (t) => {
  const root = project(t);
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# 팀에서 작성한 Claude 규칙\n');

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 2);
  assert.match(result.output, /SKIP_UNTRACKED\s+CLAUDE\.md/u);
  assert.equal(
    fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'),
    '# 팀에서 작성한 Claude 규칙\n',
  );
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), true);
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

test('an invalid management manifest rejects the entire plan before writing', async (t) => {
  const root = project(t);
  fs.mkdirSync(path.join(root, '.project-docs'));
  fs.writeFileSync(manifestPath(root), '{ invalid json');

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 1);
  assert.match(result.errors, /JSON 형식/u);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
});

test('a symlinked management manifest rejects the entire plan before writing', async (t) => {
  const root = project(t);
  const outside = project(t);
  const outsideManifest = path.join(outside, 'manifest.json');
  fs.writeFileSync(outsideManifest, '{"kit":"ios-uikit","files":{}}\n');
  fs.mkdirSync(path.join(root, '.project-docs'));
  fs.symlinkSync(outsideManifest, manifestPath(root));

  const result = await invoke(['init', 'ios-uikit', '--target', root, '--apply']);

  assert.equal(result.code, 1);
  assert.match(result.errors, /심볼릭 링크/u);
  assert.equal(fs.readFileSync(outsideManifest, 'utf8'), '{"kit":"ios-uikit","files":{}}\n');
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
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
  assert.equal((await invoke(['init', 'ios-uikit', '--target', root, '--include', 'unknown', '--apply'])).code, 1);
  assert.equal((await invoke(['init', 'ios-uikit', '--target', root, '--include', 'rxswift', '--include', 'rxswift', '--apply'])).code, 1);
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
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/CLAUDE.md.tmpl'));
  assert.equal(packagedPaths.includes('project-doc-kits/ios-uikit/docs/Root.md.tmpl'), false);
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/retired/docs/Root.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/architecture/architecture.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/architecture/rxswift.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/architecture/rxswift-binding-policy.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/architecture/rxswift-input-output.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/development/gitflow.md.tmpl'));
  assert.ok(packagedPaths.includes('project-doc-kits/ios-uikit/docs/development/swiftstyle.md.tmpl'));
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
  assert.equal(fs.existsSync(path.join(target, 'CLAUDE.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'docs', 'architecture', 'rxswift.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'docs', 'architecture', 'rxswift-binding-policy.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'docs', 'architecture', 'rxswift-input-output.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'docs', 'development', 'gitflow.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'docs', 'development', 'swiftstyle.md')), true);
  assert.equal(fs.existsSync(manifestPath(target)), true);
  assert.equal(fs.readFileSync(appSource, 'utf8'), 'import UIKit\n');
  for (const [name, content] of before) {
    assert.deepEqual(fs.readFileSync(path.join(target, name)), content);
  }
  assert.equal(fs.existsSync(path.join(target, 'node_modules')), false);
});

test('README remote examples use the repository package and explicit executable', () => {
  const packageRoot = path.resolve(__dirname, '..');
  const readme = fs.readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
  const expectedPrefix = [
    'npx --yes',
    '--package=github:indextrown/codex-skillbook',
    '-- project-docs',
  ].join(' ');
  const remoteCommands = readme
    .split('\n')
    .filter((line) => line.startsWith('npx ') && line.includes('--package=github:indextrown/codex-skillbook'));

  assert.equal(remoteCommands.length, 3);
  for (const command of remoteCommands) {
    assert.ok(command.startsWith(expectedPrefix), command);
  }
  assert.doesNotMatch(readme, /--package=github:indextrown\/codex-skillbook#/u);
});
