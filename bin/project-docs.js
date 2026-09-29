#!/usr/bin/env node

'use strict';

const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');

const KIT_NAME = 'ios-uikit';
const KIT_DIRECTORY = path.resolve(__dirname, '..', 'project-doc-kits', KIT_NAME);
const MANIFEST_SEGMENTS = ['.project-docs', 'manifest.json'];
const SUPPORTED_INCLUDES = new Set(['gitflow', 'rxswift']);
const ACTIONABLE_STATUSES = new Set(['CREATE', 'UPDATE', 'TRACK', 'DELETE', 'RETIRED']);
const PRESERVED_STATUSES = new Set(['SKIP_MODIFIED', 'SKIP_UNTRACKED', 'SKIP_RETIRED_MODIFIED']);
const HOOK_ACTIONABLE_STATUSES = new Set(['CREATE', 'UPDATE', 'SET', 'ADD']);
const HOOK_DECISION_KEY = 'project-docs.gitHooks';
const HOOK_COMMAND = 'npx --yes --package=github:indextrown/codex-skillbook -- project-docs hooks ios-uikit';
const COMMAND_OPTIONS = {
  init: ['--target', '--project-name', '--include', '--dry-run', '--apply'],
  hooks: ['--target', '--dry-run', '--apply'],
  contribute: ['--target', '--project-name', '--title', '--all', '--dry-run', '--apply'],
};
const CONTRIBUTE_REPOSITORY = 'indextrown/codex-skillbook';
const CONTRIBUTE_BASE_BRANCH = 'main';

const USAGE = `사용법:
  project-docs init ios-uikit [--target /absolute/path] [--project-name 이름]
                              [--dry-run | --apply]
  project-docs hooks ios-uikit [--target /absolute/path] [--dry-run | --apply]
  project-docs contribute ios-uikit (<문서 경로>... | --all) [--target /absolute/path]
                              [--project-name 이름] [--title PR 제목] [--dry-run | --apply]

명령:
  init   문서 키트를 적용해요. 터미널에서는 git hook 설정 여부도 한 번 물어요.
  hooks  push 전 Claude 코드 리뷰 git hook만 설정해요.
  contribute
         프로젝트에서 고친 문서를 키트 템플릿에 옮겨 이 저장소에 draft PR로 올려요.

옵션:
  --target        대상 프로젝트의 절대 경로 (기본값: 현재 디렉터리)
  --project-name  문서에 표시할 프로젝트 이름 (기본값: 대상 폴더 이름)
  --dry-run       변경 예정 파일만 표시하고 쓰지 않음
  --apply         대화형 확인 없이 적용
  --title         contribute가 만들 PR 제목
  --all           contribute에서 마지막 적용 뒤 수정한 문서를 모두 올림
  --help          사용법 표시

현재 키트의 문서는 모두 기본 생성해요.
이전 명령의 --include gitflow과 --include rxswift도 호환을 위해 허용해요.
`;

function parseArguments(args) {
  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }
  if (!Object.hasOwn(COMMAND_OPTIONS, args[0]) || args[1] !== KIT_NAME) {
    throw new Error(`지원하는 명령은 "init ${KIT_NAME}", "hooks ${KIT_NAME}", "contribute ${KIT_NAME}"뿐이에요.\n${USAGE}`);
  }

  const options = { command: args[0], dryRun: false, apply: false, include: new Set(), files: [] };
  const allowedFlags = COMMAND_OPTIONS[options.command];
  const seen = new Set();
  for (let index = 2; index < args.length; index += 1) {
    const flag = args[index];
    if (options.command === 'contribute' && !flag.startsWith('-')) {
      relativeSegments(flag, '올릴 문서');
      if (options.files.includes(flag)) throw new Error(`올릴 문서를 중복 지정했어요: ${flag}`);
      options.files.push(flag);
      continue;
    }
    if (!allowedFlags.includes(flag)) {
      throw new Error(`알 수 없는 옵션이에요: ${flag}`);
    }
    if (seen.has(flag) && flag !== '--include') {
      throw new Error(`옵션을 중복 지정했어요: ${flag}`);
    }
    seen.add(flag);
    if (flag === '--dry-run') {
      options.dryRun = true;
    } else if (flag === '--apply') {
      options.apply = true;
    } else if (flag === '--all') {
      options.all = true;
    } else {
      const value = args[++index];
      if (!value || value.startsWith('--')) {
        throw new Error(`${flag} 뒤에 값을 지정해 주세요.`);
      }
      if (flag === '--target') options.target = value;
      if (flag === '--project-name') options.projectName = value;
      if (flag === '--title') options.title = value;
      if (flag === '--include') {
        if (!SUPPORTED_INCLUDES.has(value)) {
          throw new Error(`지원하지 않는 --include 값이에요: ${value}`);
        }
        if (options.include.has(value)) {
          throw new Error(`--include 값을 중복 지정했어요: ${value}`);
        }
        options.include.add(value);
      }
    }
  }
  if (options.dryRun && options.apply) {
    throw new Error('--dry-run과 --apply는 함께 사용할 수 없어요.');
  }
  if (options.all && options.files.length > 0) {
    throw new Error('--all과 문서 경로는 함께 지정할 수 없어요.');
  }
  if (options.target && !path.isAbsolute(options.target)) {
    throw new Error('--target에는 절대 경로를 지정해 주세요.');
  }
  return options;
}

function relativeSegments(value, label) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')) {
    throw new Error(`${label} 경로가 올바르지 않아요.`);
  }
  const segments = value.split('/');
  if (path.posix.isAbsolute(value) || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`${label} 경로가 프로젝트 밖을 가리킬 수 있어요: ${value}`);
  }
  return segments;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function lstatOrNull(candidate) {
  try {
    return await fs.lstat(candidate);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function resolveTarget(target) {
  const requested = path.resolve(target || process.cwd());
  const stats = await lstatOrNull(requested);
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`대상은 심볼릭 링크가 아닌 기존 디렉터리여야 해요: ${requested}`);
  }
  const root = await fs.realpath(requested);
  if (root === path.parse(root).root) {
    throw new Error('파일 시스템 루트에는 문서 키트를 적용할 수 없어요.');
  }
  return root;
}

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function serializeManifest(files) {
  return Buffer.from(`${JSON.stringify({
    kit: KIT_NAME,
    files: Object.fromEntries([...files].sort(([left], [right]) => left.localeCompare(right))),
  }, null, 2)}\n`, 'utf8');
}

async function loadManifest(root) {
  await inspectParents(root, MANIFEST_SEGMENTS);
  const destination = path.join(root, ...MANIFEST_SEGMENTS);
  const stats = await lstatOrNull(destination);
  if (!stats) return { destination, exists: false, files: new Map() };
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`문서 관리 파일이 일반 파일이 아니거나 심볼릭 링크예요: ${destination}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(destination, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`문서 관리 파일의 JSON 형식이 올바르지 않아요: ${destination}`);
    }
    throw error;
  }
  if (!parsed || Array.isArray(parsed) || parsed.kit !== KIT_NAME
      || !parsed.files || Array.isArray(parsed.files) || typeof parsed.files !== 'object') {
    throw new Error(`문서 관리 파일의 구조가 올바르지 않아요: ${destination}`);
  }

  const files = new Map();
  for (const [target, hash] of Object.entries(parsed.files)) {
    relativeSegments(target, '문서 관리 대상');
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/u.test(hash)) {
      throw new Error(`문서 관리 파일의 해시가 올바르지 않아요: ${target}`);
    }
    files.set(target, hash);
  }
  return { destination, exists: true, files };
}

function markdownText(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/u.test(value) || value.length > 120) {
    throw new Error('프로젝트 이름은 줄바꿈·제어 문자 없이 1~120자로 지정해 주세요.');
  }
  return value.trim().replace(/[\\`*_{}\[\]()#+.!<>|~]/gu, '\\$&');
}

function renderTemplate(source, projectName) {
  const rendered = source.replaceAll('{{PROJECT_NAME}}', projectName);
  if (/\{\{[^{}]+\}\}/u.test(rendered)) {
    throw new Error('템플릿에 알 수 없는 자리 표시자가 남아 있어요.');
  }
  return Buffer.from(rendered, 'utf8');
}

async function loadEntries(projectName) {
  const manifest = JSON.parse(await fs.readFile(path.join(KIT_DIRECTORY, 'kit.json'), 'utf8'));
  if (manifest.name !== KIT_NAME || !Array.isArray(manifest.files)
      || (manifest.retiredFiles !== undefined && !Array.isArray(manifest.retiredFiles))) {
    throw new Error('키트 설정을 읽을 수 없어요.');
  }
  const kitRoot = await fs.realpath(KIT_DIRECTORY);
  const knownTargets = new Set();
  const configuredTargets = new Set();
  const entries = [];
  for (const item of manifest.files) {
    const sourceSegments = relativeSegments(item.template, '템플릿');
    const targetSegments = relativeSegments(item.target, '대상');
    if (configuredTargets.has(item.target)) {
      throw new Error(`대상 경로가 중복돼요: ${item.target}`);
    }
    configuredTargets.add(item.target);
    knownTargets.add(item.target);
    if (item.include) {
      throw new Error(`현재 문서는 모두 필수이므로 include 설정을 사용할 수 없어요: ${item.target}`);
    }

    const templatePath = path.join(kitRoot, ...sourceSegments);
    const resolvedTemplate = await fs.realpath(templatePath);
    const sourceStat = await fs.lstat(templatePath);
    if (!isWithin(kitRoot, resolvedTemplate) || sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      throw new Error(`키트 밖의 템플릿은 읽을 수 없어요: ${item.template}`);
    }
    const content = renderTemplate(await fs.readFile(templatePath, 'utf8'), projectName);
    entries.push({ target: item.target, segments: targetSegments, content, templateHash: contentHash(content) });
  }

  const retiredEntries = [];
  for (const item of manifest.retiredFiles || []) {
    const sourceSegments = relativeSegments(item.template, '관리 종료 템플릿');
    const targetSegments = relativeSegments(item.target, '관리 종료 대상');
    if (configuredTargets.has(item.target)) {
      throw new Error(`대상 경로가 중복돼요: ${item.target}`);
    }
    configuredTargets.add(item.target);
    const templatePath = path.join(kitRoot, ...sourceSegments);
    const resolvedTemplate = await fs.realpath(templatePath);
    const sourceStat = await fs.lstat(templatePath);
    if (!isWithin(kitRoot, resolvedTemplate) || sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      throw new Error(`키트 밖의 관리 종료 템플릿은 읽을 수 없어요: ${item.template}`);
    }
    const content = renderTemplate(await fs.readFile(templatePath, 'utf8'), projectName);
    retiredEntries.push({
      target: item.target,
      segments: targetSegments,
      templateHash: contentHash(content),
    });
  }
  return { entries, knownTargets, retiredEntries };
}

async function inspectParents(root, segments) {
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const stats = await lstatOrNull(current);
    if (!stats) continue;
    if (stats.isSymbolicLink() || !stats.isDirectory() || !isWithin(root, await fs.realpath(current))) {
      throw new Error(`대상 상위 경로가 디렉터리가 아니거나 심볼릭 링크예요: ${current}`);
    }
  }
}

async function inspectEntry(root, entry, trackedHash) {
  await inspectParents(root, entry.segments);
  const destination = path.join(root, ...entry.segments);
  if (!isWithin(root, destination)) {
    throw new Error(`프로젝트 밖으로 쓰는 경로예요: ${entry.target}`);
  }
  const stats = await lstatOrNull(destination);
  if (!stats) return { ...entry, destination, status: 'CREATE' };
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`대상 경로가 파일이 아니거나 심볼릭 링크예요: ${destination}`);
  }
  const existing = await fs.readFile(destination);
  const existingHash = contentHash(existing);
  if (existing.equals(entry.content)) {
    return {
      ...entry,
      destination,
      existingHash,
      status: trackedHash === entry.templateHash ? 'UNCHANGED' : 'TRACK',
    };
  }
  let status = 'SKIP_UNTRACKED';
  if (trackedHash) status = existingHash === trackedHash ? 'UPDATE' : 'SKIP_MODIFIED';
  return {
    ...entry,
    destination,
    existingHash,
    status,
  };
}

// git merge-file은 충돌 개수를 종료 코드로 돌려줘요. 음수(255 이상)는 실행 오류예요.
async function mergeContents(current, base, latest, extraArgs) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'project-docs-merge-'));
  try {
    const files = { current, base, latest };
    for (const [name, content] of Object.entries(files)) {
      await fs.writeFile(path.join(directory, name), content, { mode: 0o600 });
    }
    const result = spawnSync('git', [
      'merge-file', '-p', ...extraArgs,
      path.join(directory, 'current'), path.join(directory, 'base'), path.join(directory, 'latest'),
    ], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    if (result.error || typeof result.status !== 'number' || result.status > 127) return null;
    return { content: result.stdout, conflicts: result.status };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function inspectRetiredEntry(root, target, trackedHash, retiredTemplateHash) {
  const segments = relativeSegments(target, '관리 종료 대상');
  await inspectParents(root, segments);
  const destination = path.join(root, ...segments);
  if (!isWithin(root, destination)) {
    throw new Error(`프로젝트 밖의 문서는 삭제할 수 없어요: ${target}`);
  }
  const stats = await lstatOrNull(destination);
  if (!stats) {
    return trackedHash ? { target, segments, destination, status: 'RETIRED' } : null;
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    if (!trackedHash) return null;
    throw new Error(`관리 종료 대상이 일반 파일이 아니거나 심볼릭 링크예요: ${destination}`);
  }
  const existingHash = contentHash(await fs.readFile(destination));
  if (!trackedHash && existingHash !== retiredTemplateHash) return null;
  return {
    target,
    segments,
    destination,
    expectedHash: trackedHash || retiredTemplateHash,
    status: existingHash === (trackedHash || retiredTemplateHash) ? 'DELETE' : 'SKIP_RETIRED_MODIFIED',
  };
}

async function ensureParents(root, segments) {
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const stats = await lstatOrNull(current);
    if (!stats) {
      try {
        await fs.mkdir(current);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
    const currentStat = await fs.lstat(current);
    if (currentStat.isSymbolicLink() || !currentStat.isDirectory() || !isWithin(root, await fs.realpath(current))) {
      throw new Error(`대상 상위 경로가 디렉터리가 아니거나 심볼릭 링크예요: ${current}`);
    }
  }
}

async function writeAtomically(destination, content, mode = 0o644) {
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}-${process.pid}-${crypto.randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0),
      mode,
    );
    await handle.writeFile(content);
    await handle.close();
    handle = null;
    await fs.rename(temporary, destination);
  } finally {
    if (handle) await handle.close();
    try {
      await fs.unlink(temporary);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

async function applyEntry(root, entry, trackedHash) {
  await ensureParents(root, entry.segments);
  const updated = await inspectEntry(root, entry, trackedHash);
  if (updated.status === 'TRACK' || updated.status === 'UNCHANGED'
      || PRESERVED_STATUSES.has(updated.status)) return updated.status;

  let handle;
  try {
    if (updated.status === 'CREATE') {
      handle = await fs.open(
        entry.destination,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0),
        0o644,
      );
      await handle.writeFile(entry.content);
      return 'CREATE';
    }

    handle = await fs.open(entry.destination, constants.O_RDWR | (constants.O_NOFOLLOW || 0));
    const currentStat = await handle.stat();
    if (!currentStat.isFile()) {
      throw new Error(`갱신 대상이 일반 파일이 아니에요: ${entry.destination}`);
    }
    const current = await handle.readFile();
    if (contentHash(current) !== trackedHash) return 'SKIP_MODIFIED';
    await handle.close();
    handle = null;
    await writeAtomically(entry.destination, entry.content, currentStat.mode & 0o777);
    return 'UPDATE';
  } catch (error) {
    if (error.code === 'EEXIST') {
      return (await inspectEntry(root, entry, trackedHash)).status;
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function deleteRetiredEntry(root, entry, trackedHash) {
  const updated = await inspectRetiredEntry(
    root,
    entry.target,
    trackedHash || entry.expectedHash,
    entry.expectedHash,
  );
  if (updated.status !== 'DELETE') return updated.status;

  let handle;
  try {
    handle = await fs.open(updated.destination, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const openedStat = await handle.stat();
    if (!openedStat.isFile()) {
      throw new Error(`삭제 대상이 일반 파일이 아니에요: ${updated.destination}`);
    }
    if (contentHash(await handle.readFile()) !== updated.expectedHash) return 'SKIP_RETIRED_MODIFIED';
    const currentStat = await fs.lstat(updated.destination);
    if (currentStat.isSymbolicLink() || !currentStat.isFile()
        || currentStat.dev !== openedStat.dev || currentStat.ino !== openedStat.ino) {
      return 'SKIP_RETIRED_MODIFIED';
    }
    await fs.unlink(updated.destination);
    return 'DELETE';
  } catch (error) {
    if (error.code === 'ENOENT') return 'RETIRED';
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function writeManifest(root, manifest, files) {
  if (!manifest.exists && files.size === 0) return;
  const content = serializeManifest(files);
  await ensureParents(root, MANIFEST_SEGMENTS);
  const existing = await lstatOrNull(manifest.destination);
  if (existing && (existing.isSymbolicLink() || !existing.isFile())) {
    throw new Error(`문서 관리 파일이 일반 파일이 아니거나 심볼릭 링크예요: ${manifest.destination}`);
  }
  if (existing && (await fs.readFile(manifest.destination)).equals(content)) return;
  await writeAtomically(manifest.destination, content);
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (error.code === 'ENOENT' || typeof error.status === 'number') return null;
    throw error;
  }
}

function gitOrThrow(root, args) {
  const output = git(root, args);
  if (output === null) throw new Error(`git ${args.join(' ')} 명령이 실패했어요.`);
  return output;
}

async function loadGitHooks() {
  const manifest = JSON.parse(await fs.readFile(path.join(KIT_DIRECTORY, 'kit.json'), 'utf8'));
  const config = manifest.gitHooks;
  if (!config || typeof config !== 'object' || !Array.isArray(config.files)) {
    throw new Error('키트의 git hook 설정을 읽을 수 없어요.');
  }
  const directorySegments = relativeSegments(config.directory, 'git hook 디렉터리');
  if (directorySegments.length !== 1) {
    throw new Error(`git hook 디렉터리는 프로젝트 루트 바로 아래여야 해요: ${config.directory}`);
  }
  const kitRoot = await fs.realpath(KIT_DIRECTORY);
  const files = [];
  for (const item of config.files) {
    if (typeof item.name !== 'string' || !/^[a-z][a-z-]*$/u.test(item.name)) {
      throw new Error(`git hook 이름이 올바르지 않아요: ${item.name}`);
    }
    const templatePath = path.join(kitRoot, ...relativeSegments(item.template, 'git hook 템플릿'));
    const sourceStat = await fs.lstat(templatePath);
    if (!isWithin(kitRoot, await fs.realpath(templatePath)) || sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      throw new Error(`키트 밖의 git hook 템플릿은 읽을 수 없어요: ${item.template}`);
    }
    // hook은 셸 스크립트라 자리 표시자를 치환하지 않고 그대로 복사해요.
    const content = await fs.readFile(templatePath);
    files.push({
      name: item.name,
      target: `${config.directory}/${item.name}`,
      segments: [...directorySegments, item.name],
      content,
      templateHash: contentHash(content),
      hashKey: `project-docs.${item.name}.hash`,
    });
  }
  return { directory: config.directory, files };
}

async function activeDefaultHooks(root) {
  // --path-format=absolute는 git 2.31부터라서, 상대 경로로 받아 대상 루트 기준으로 풀어요.
  const commonDirectory = git(root, ['rev-parse', '--git-common-dir']);
  if (!commonDirectory) {
    throw new Error('.git/hooks 위치를 확인하지 못해서 기존 hook을 보호할 수 없어요.');
  }
  let entries;
  try {
    entries = await fs.readdir(path.resolve(root, commonDirectory, 'hooks'), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => !entry.isDirectory() && !entry.name.endsWith('.sample'))
    .map((entry) => entry.name)
    .sort();
}

// hook은 개인 설정이라 커밋되는 manifest 대신 저장소의 로컬 git 설정에 상태를 기록해요.
async function inspectGitHooks(root, hooks) {
  const topLevel = git(root, ['rev-parse', '--show-toplevel']);
  if (!topLevel) {
    return { available: false, reason: 'git 저장소가 아니라서 git hook을 설정할 수 없어요.' };
  }
  if (await fs.realpath(topLevel) !== root) {
    return { available: false, reason: `git hook은 저장소 루트에서만 설정해요: ${topLevel}` };
  }

  const items = [];
  const conflicts = [];
  const tracked = git(root, ['ls-files', '--', hooks.directory]);
  if (tracked) {
    conflicts.push(`${hooks.directory}/가 이미 저장소에 커밋돼 있어요. 개인용 hook으로 바꾸지 않아요.`);
  }

  for (const file of hooks.files) {
    await inspectParents(root, file.segments);
    const destination = path.join(root, ...file.segments);
    const recordedHash = git(root, ['config', '--local', '--get', file.hashKey]) || undefined;
    const stats = await lstatOrNull(destination);
    let status = 'CREATE';
    if (stats) {
      if (stats.isSymbolicLink() || !stats.isFile()) {
        throw new Error(`git hook 경로가 파일이 아니거나 심볼릭 링크예요: ${destination}`);
      }
      const existingHash = contentHash(await fs.readFile(destination));
      if (existingHash === file.templateHash) status = 'UNCHANGED';
      else status = existingHash === recordedHash ? 'UPDATE' : 'SKIP_MODIFIED';
    }
    items.push({ ...file, kind: 'file', destination, recordedHash, status, label: file.target });
  }

  const hooksPath = git(root, ['config', '--get', 'core.hooksPath']);
  let hooksPathStatus = 'SET';
  if (hooksPath === hooks.directory) hooksPathStatus = 'UNCHANGED';
  else if (hooksPath) {
    hooksPathStatus = 'CONFLICT';
    conflicts.push(`core.hooksPath가 이미 ${hooksPath}(으)로 설정돼 있어요. 다른 hook 설정을 덮어쓰지 않아요.`);
  } else {
    // core.hooksPath를 바꾸면 .git/hooks는 더 이상 실행되지 않아요. Git LFS의 pre-push 같은 hook이 꺼지지 않게 막아요.
    const activeHooks = await activeDefaultHooks(root);
    if (activeHooks.length > 0) {
      hooksPathStatus = 'CONFLICT';
      conflicts.push(`.git/hooks에 사용 중인 hook(${activeHooks.join(', ')})이 있어요. core.hooksPath를 바꾸면 이 hook이 꺼져서 설정하지 않아요.`);
    }
  }
  items.push({ kind: 'hooksPath', status: hooksPathStatus, label: `core.hooksPath = ${hooksPath || hooks.directory}` });

  const gitignore = path.join(root, '.gitignore');
  const gitignoreStat = await lstatOrNull(gitignore);
  if (gitignoreStat && (gitignoreStat.isSymbolicLink() || !gitignoreStat.isFile())) {
    throw new Error(`.gitignore가 일반 파일이 아니거나 심볼릭 링크예요: ${gitignore}`);
  }
  // check-ignore는 규칙에 맞으면 빈 문자열, 맞지 않으면 null을 돌려줘요.
  const ignored = git(root, ['check-ignore', '--no-index', '-q', `${hooks.directory}/${hooks.files[0].name}`]) !== null;
  items.push({
    kind: 'gitignore',
    destination: gitignore,
    status: ignored ? 'UNCHANGED' : 'ADD',
    label: `.gitignore += ${hooks.directory}/`,
  });

  const decision = git(root, ['config', '--local', '--get', HOOK_DECISION_KEY]);
  const configured = hooksPathStatus === 'UNCHANGED'
    && items.every((item) => item.kind !== 'file' || item.status !== 'CREATE');
  return { available: true, items, conflicts, decision, configured, directory: hooks.directory };
}

function hookPlanIsActionable(plan) {
  return plan.conflicts.length === 0 && plan.items.some((item) => HOOK_ACTIONABLE_STATUSES.has(item.status));
}

function printHookPlan(io, plan) {
  io.stdout.write('git hook (push 전 Claude 코드 리뷰, 개인 설정):\n');
  for (const item of plan.items) io.stdout.write(`${item.status.padEnd(16)} ${item.label}\n`);
  for (const conflict of plan.conflicts) io.stdout.write(`안내: ${conflict}\n`);
}

async function writeHookFile(root, item) {
  await ensureParents(root, item.segments);
  if (item.status === 'CREATE') {
    let handle;
    try {
      handle = await fs.open(
        item.destination,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0),
        0o755,
      );
      await handle.writeFile(item.content);
      await handle.chmod(0o755);
      return 'CREATE';
    } catch (error) {
      if (error.code === 'EEXIST') return 'SKIP_MODIFIED';
      throw error;
    } finally {
      if (handle) await handle.close();
    }
  }
  // 갱신 직전에 다시 읽어 마지막 기록 이후 사용자가 고치지 않았는지 확인해요.
  const stats = await fs.lstat(item.destination);
  if (stats.isSymbolicLink() || !stats.isFile()
      || contentHash(await fs.readFile(item.destination)) !== item.recordedHash) {
    return 'SKIP_MODIFIED';
  }
  await writeAtomically(item.destination, item.content, 0o755);
  return 'UPDATE';
}

async function appendGitignore(item, directory) {
  const existing = (await lstatOrNull(item.destination)) ? await fs.readFile(item.destination, 'utf8') : '';
  const separator = existing && !existing.endsWith('\n') ? '\n' : '';
  const block = `${existing ? '\n' : ''}# 프로젝트 문서 키트의 개인용 git hook\n${directory}/\n`;
  await writeAtomically(item.destination, Buffer.from(`${existing}${separator}${block}`, 'utf8'));
}

async function applyGitHooks(root, plan) {
  const results = [];
  // hook 파일과 .gitignore를 먼저 준비하고, 마지막에 core.hooksPath로 hook을 켜요.
  for (const item of plan.items.filter((entry) => entry.kind === 'file')) {
    let status = item.status;
    if (status === 'CREATE' || status === 'UPDATE') status = await writeHookFile(root, item);
    if (['CREATE', 'UPDATE', 'UNCHANGED'].includes(status)) {
      gitOrThrow(root, ['config', '--local', item.hashKey, item.templateHash]);
    }
    results.push({ label: item.label, status });
  }
  for (const item of plan.items.filter((entry) => entry.kind === 'gitignore')) {
    if (item.status === 'ADD') await appendGitignore(item, plan.directory);
    results.push({ label: item.label, status: item.status });
  }
  for (const item of plan.items.filter((entry) => entry.kind === 'hooksPath')) {
    if (item.status === 'SET') gitOrThrow(root, ['config', '--local', 'core.hooksPath', plan.directory]);
    results.push({ label: `core.hooksPath = ${plan.directory}`, status: item.status });
  }
  git(root, ['config', '--local', '--unset', HOOK_DECISION_KEY]);
  return results;
}

function printHookResults(io, results) {
  io.stdout.write('git hook 적용 결과:\n');
  for (const result of results) io.stdout.write(`${result.status.padEnd(16)} ${result.label}\n`);
}

// init 뒤에 이어지는 선택 단계예요. hook을 요청하지 않은 사용자의 종료 코드는 바꾸지 않아요.
async function offerGitHooks(root, options, io) {
  const declinedHint = `안내: git hook 설정을 거절한 기록이 있어 묻지 않았어요. 설정하려면 ${HOOK_COMMAND}을 실행해요.\n`;
  let plan;
  try {
    const hooks = await loadGitHooks();
    // 거절했고 아직 설정하지 않은 저장소는 hook 경로를 살펴보지 않고 넘어가요.
    if (git(root, ['config', '--local', '--get', HOOK_DECISION_KEY]) === 'declined'
        && git(root, ['config', '--get', 'core.hooksPath']) !== hooks.directory) {
      io.stdout.write(declinedHint);
      return 0;
    }
    plan = await inspectGitHooks(root, hooks);
  } catch (error) {
    // 문서는 이미 처리했으므로 선택 단계의 검사 오류가 init의 결과를 바꾸지 않게 해요.
    io.stdout.write(`안내: git hook 단계를 건너뛰었어요. ${error.message}\n`);
    return 0;
  }
  if (!plan.available || (!hookPlanIsActionable(plan) && plan.conflicts.length === 0)) return 0;
  if (plan.conflicts.length > 0) {
    for (const conflict of plan.conflicts) io.stdout.write(`안내: git hook을 설정하지 않았어요. ${conflict}\n`);
    return 0;
  }
  if (options.dryRun) {
    printHookPlan(io, plan);
    return 0;
  }
  if (!plan.configured && plan.decision === 'declined') {
    io.stdout.write(declinedHint);
    return 0;
  }
  if (options.apply || !io.stdin.isTTY || !io.stdout.isTTY) {
    io.stdout.write(`안내: push 전 Claude 코드 리뷰 git hook은 ${HOOK_COMMAND}으로 설정할 수 있어요.\n`);
    return 0;
  }

  printHookPlan(io, plan);
  const question = plan.configured
    ? 'git hook 변경을 적용할까요? [y/N] '
    : 'push 전 Claude 코드 리뷰 git hook을 설정할까요? [y/N] ';
  if (!(await askConfirmation(io, question, 'hooks'))) {
    if (!plan.configured) {
      gitOrThrow(root, ['config', '--local', HOOK_DECISION_KEY, 'declined']);
      io.stdout.write(`git hook을 설정하지 않았어요. 다시 묻지 않아요. 나중에 설정하려면 ${HOOK_COMMAND}을 실행해요.\n`);
    } else {
      io.stdout.write('git hook 변경을 적용하지 않았어요.\n');
    }
    return 0;
  }
  const results = await applyGitHooks(root, plan);
  printHookResults(io, results);
  return results.some((result) => result.status === 'SKIP_MODIFIED') ? 2 : 0;
}

async function runHooks(root, options, io) {
  const plan = await inspectGitHooks(root, await loadGitHooks());
  if (!plan.available) {
    io.stderr.write(`오류: ${plan.reason}\n`);
    return 1;
  }
  io.stdout.write(`대상 프로젝트: ${root}\n`);
  printHookPlan(io, plan);
  const preserved = plan.conflicts.length > 0 || plan.items.some((item) => item.status === 'SKIP_MODIFIED');
  if (options.dryRun) return preserved ? 2 : 0;
  if (plan.conflicts.length > 0) {
    io.stdout.write('충돌이 있어 git hook을 설정하지 않았어요.\n');
    return 2;
  }
  if (!hookPlanIsActionable(plan)) {
    io.stdout.write('적용할 변경이 없어요.\n');
    return preserved ? 2 : 0;
  }
  if (!options.apply) {
    if (!io.stdin.isTTY || !io.stdout.isTTY) {
      io.stderr.write('비대화형 환경에서는 --apply를 지정해야 git hook을 설정할 수 있어요.\n');
      return 1;
    }
    if (!(await askConfirmation(io, 'git hook 설정을 적용할까요? [y/N] ', 'hooks'))) {
      io.stdout.write('적용을 취소했어요.\n');
      return 0;
    }
  }
  const results = await applyGitHooks(root, plan);
  printHookResults(io, results);
  return results.some((result) => result.status === 'SKIP_MODIFIED') ? 2 : 0;
}

// 테스트는 로컬 저장소와 가짜 gh로 원격 작업을 대신해요.
function contributeRepositoryUrl() {
  return process.env.PROJECT_DOCS_REPOSITORY || `https://github.com/${CONTRIBUTE_REPOSITORY}.git`;
}

function runOrThrow(command, args, message, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.error?.message || '').trim();
    const error = new Error(`${message}${detail ? `\n${detail}` : ''}`);
    error.missing = result.error?.code === 'ENOENT';
    throw error;
  }
  return result.stdout.trim();
}

async function loadRemoteTemplates(checkout) {
  const kitRoot = await fs.realpath(path.join(checkout, 'project-doc-kits', KIT_NAME));
  const manifest = JSON.parse(await fs.readFile(path.join(kitRoot, 'kit.json'), 'utf8'));
  if (manifest.name !== KIT_NAME || !Array.isArray(manifest.files)) {
    throw new Error('원격 키트 설정을 읽을 수 없어요.');
  }
  const templates = new Map();
  for (const item of manifest.files) {
    relativeSegments(item.target, '원격 대상');
    const templatePath = path.join(kitRoot, ...relativeSegments(item.template, '원격 템플릿'));
    const stats = await lstatOrNull(templatePath);
    if (!stats || stats.isSymbolicLink() || !stats.isFile() || !isWithin(kitRoot, await fs.realpath(templatePath))) {
      throw new Error(`원격 템플릿을 읽을 수 없어요: ${item.template}`);
    }
    templates.set(item.target, { path: templatePath, repositoryPath: `project-doc-kits/${KIT_NAME}/${item.template}` });
  }
  return templates;
}

// 로컬 수정분만 원격 템플릿 원문에 옮겨요. 바뀌지 않은 줄은 원문을 그대로 써서 자리 표시자를 지켜요.
// 로컬에서 고친 줄이 자리 표시자가 있는 줄과 겹치면 로컬 내용을 택하고, 남은 프로젝트 이름은 경고로 보여줘요.
async function templateFromLocal(entry, remoteTemplate, projectName) {
  const raw = await fs.readFile(remoteTemplate.path);
  const rendered = renderTemplate(raw.toString('utf8'), projectName);
  // 로컬 문서의 어느 부분이 사용자 수정인지 가를 기준이 없어서, 옮기면 원격 변경을 되돌릴 수 있어요.
  if (contentHash(rendered) !== entry.trackedHash) return null;
  const merged = await mergeContents(raw, rendered, entry.local, ['--theirs']);
  if (!merged) throw new Error('git merge-file을 실행하지 못했어요.');
  let roundTrip;
  try {
    roundTrip = renderTemplate(merged.content.toString('utf8'), projectName);
  } catch {
    roundTrip = null;
  }
  if (!roundTrip || !roundTrip.equals(entry.local)) {
    throw new Error(`문서를 템플릿으로 되돌리지 못했어요. {{...}} 형식의 문자열이 있는지 확인해 주세요: ${entry.target}`);
  }
  return merged.content;
}

function linesContaining(content, names) {
  return content.toString('utf8').split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => names.some((name) => line.includes(name)));
}

function contributeTexts(targets, repositoryPaths, title) {
  const names = targets.length > 3
    ? `문서 키트 템플릿 ${targets.length}개`
    : targets.map((target) => path.posix.basename(target)).join(', ');
  const body = [
    '## 변경 내용',
    '',
    '프로젝트 문서에서 개선한 내용을 문서 키트 템플릿에 옮긴다. 수정하지 않은 줄은 템플릿 원문을 유지해 `{{PROJECT_NAME}}` 자리 표시자를 보존했다.',
    '',
    ...repositoryPaths.map((repositoryPath) => `- \`${repositoryPath}\``),
    '',
    '## 확인할 내용',
    '',
    '- [ ] 변경 이유와 배경을 이 본문에 적는다.',
    '- [ ] 특정 프로젝트에만 해당하는 내용이 섞이지 않았는지 확인한다.',
    '- [ ] 필요하면 README, 테스트와 테크 스펙을 함께 갱신한다.',
    '',
    '`project-docs contribute`로 만든 draft PR이다.',
    '',
  ].join('\n');
  return {
    commit: `[docs] ${names} 템플릿 개선 반영`,
    title: title || `[docs] ${names} 템플릿을 개선한다`,
    body,
  };
}

function contributeBranch(targets) {
  const slug = targets.length > 1 ? 'docs' : path.posix.basename(targets[0]).replace(/\.md$/u, '').toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'docs';
  const stamp = new Date().toISOString().replace(/[-:T]/gu, '').slice(0, 14);
  return `docs/contribute-${slug}-${stamp}`;
}

async function listContributable(root, manifest, entries) {
  const candidates = [];
  for (const entry of entries) {
    const trackedHash = manifest.files.get(entry.target);
    if (!trackedHash) continue;
    const stats = await lstatOrNull(path.join(root, ...entry.segments));
    if (!stats || stats.isSymbolicLink() || !stats.isFile()) continue;
    if (contentHash(await fs.readFile(path.join(root, ...entry.segments))) !== trackedHash) {
      candidates.push(entry.target);
    }
  }
  return candidates;
}

async function runContribute(root, options, io) {
  const rawName = (options.projectName || path.basename(root)).trim();
  const projectName = markdownText(rawName);
  const manifest = await loadManifest(root);
  const { entries } = await loadEntries(projectName);
  const byTarget = new Map(entries.map((entry) => [entry.target, entry]));

  const candidates = options.all || options.files.length === 0
    ? await listContributable(root, manifest, entries)
    : [];
  if (!options.all && options.files.length === 0) {
    io.stderr.write('오류: 이 저장소에 올릴 문서 경로를 지정하거나 --all을 붙여 주세요.\n');
    if (candidates.length > 0) {
      io.stderr.write('마지막 적용 뒤 수정한 문서예요:\n');
      for (const candidate of candidates) io.stderr.write(`  ${candidate}\n`);
    }
    return 1;
  }

  const selected = [];
  for (const target of options.all ? candidates : options.files) {
    const entry = byTarget.get(target);
    if (!entry) throw new Error(`문서 키트가 관리하는 문서가 아니에요: ${target}`);
    await inspectParents(root, entry.segments);
    const destination = path.join(root, ...entry.segments);
    const stats = await lstatOrNull(destination);
    if (!stats || stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`올릴 문서가 없거나 일반 파일이 아니에요: ${target}`);
    }
    const trackedHash = manifest.files.get(target);
    if (!trackedHash) throw new Error(`관리 이력이 없어 어떤 템플릿을 고쳤는지 알 수 없어요: ${target}`);
    const local = await fs.readFile(destination);
    if (contentHash(local) === trackedHash) {
      io.stdout.write(`안내: 마지막 적용 뒤 수정한 내용이 없어 제외했어요: ${target}\n`);
      continue;
    }
    selected.push({ target, trackedHash, local });
  }
  if (selected.length === 0) {
    io.stdout.write('올릴 변경이 없어요.\n');
    return 0;
  }

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'project-docs-contribute-'));
  try {
    const checkout = path.join(workspace, 'codex-skillbook');
    io.stdout.write(`${CONTRIBUTE_REPOSITORY}의 ${CONTRIBUTE_BASE_BRANCH} 브랜치를 임시 폴더에 가져오는 중이에요.\n`);
    runOrThrow('git', [
      'clone', '--quiet', '--depth', '1', '--branch', CONTRIBUTE_BASE_BRANCH, contributeRepositoryUrl(), checkout,
    ], '저장소를 가져오지 못했어요.');
    const templates = await loadRemoteTemplates(checkout);
    const changed = [];
    for (const entry of selected) {
      const remoteTemplate = templates.get(entry.target);
      if (!remoteTemplate) throw new Error(`원격 키트에 없는 문서예요: ${entry.target}`);
      const content = await templateFromLocal(entry, remoteTemplate, projectName);
      if (!content) {
        const message = `원격 템플릿이 마지막 적용 뒤 바뀌어서 자동으로 옮길 수 없어요: ${entry.target}\n`
          + `저장소의 ${remoteTemplate.repositoryPath}를 직접 수정해 PR을 올려 주세요.`;
        // --all은 문서 하나 때문에 전체를 멈추지 않고 나머지를 올려요.
        if (!options.all) throw new Error(message);
        io.stdout.write(`안내: ${message}\n`);
        continue;
      }
      if (content.equals(await fs.readFile(remoteTemplate.path))) continue;
      await writeAtomically(remoteTemplate.path, content);
      changed.push({ ...entry, content, repositoryPath: remoteTemplate.repositoryPath });
    }
    if (changed.length === 0) {
      io.stdout.write('템플릿에 옮길 변경이 없어요.\n');
      return 0;
    }

    io.stdout.write(`대상 프로젝트: ${root}\n`);
    io.stdout.write(`${CONTRIBUTE_REPOSITORY}에 올릴 템플릿 변경:\n`);
    io.stdout.write(`${runOrThrow('git', ['-C', checkout, 'diff', '--no-color'], '변경 내용을 비교하지 못했어요.')}\n`);
    const names = [...new Set([rawName, projectName])];
    for (const item of changed) {
      const lines = linesContaining(item.content, names);
      if (lines.length === 0) continue;
      io.stdout.write(`주의: 프로젝트 이름이 남은 줄이 있어요. 공개 저장소에 올라가도 되는지 확인해 주세요: ${item.repositoryPath}\n`);
      for (const { line, number } of lines) io.stdout.write(`  ${number}: ${line}\n`);
    }
    if (options.dryRun) {
      io.stdout.write('--dry-run이라 브랜치를 push하지 않았어요.\n');
      return 0;
    }
    if (!options.apply) {
      if (!io.stdin.isTTY || !io.stdout.isTTY) {
        io.stderr.write('비대화형 환경에서는 --apply를 지정해야 PR을 만들 수 있어요.\n');
        return 1;
      }
      const question = `공개 저장소 ${CONTRIBUTE_REPOSITORY}에 브랜치를 push하고 draft PR을 만들까요? [y/N] `;
      if (!(await askConfirmation(io, question, 'contribute'))) {
        io.stdout.write('PR을 만들지 않았어요.\n');
        return 0;
      }
    }

    const branch = contributeBranch(changed.map((item) => item.target));
    const texts = contributeTexts(
      changed.map((item) => item.target),
      changed.map((item) => item.repositoryPath),
      options.title,
    );
    runOrThrow('git', ['-C', checkout, 'switch', '--quiet', '-c', branch], '브랜치를 만들지 못했어요.');
    runOrThrow('git', ['-C', checkout, 'add', '--', ...changed.map((item) => item.repositoryPath)], '변경을 스테이징하지 못했어요.');
    runOrThrow('git', ['-C', checkout, 'commit', '--quiet', '-m', texts.commit], '커밋하지 못했어요. git user.name과 user.email 설정을 확인해 주세요.');
    runOrThrow('git', ['-C', checkout, 'push', '--quiet', '-u', 'origin', branch], '브랜치를 push하지 못했어요. 저장소 쓰기 권한을 확인해 주세요.');
    io.stdout.write(`PUSH             ${branch}\n`);

    const compareUrl = `https://github.com/${CONTRIBUTE_REPOSITORY}/compare/${CONTRIBUTE_BASE_BRANCH}...${branch}?expand=1`;
    let url;
    try {
      url = runOrThrow(process.env.PROJECT_DOCS_GH || 'gh', [
        'pr', 'create', '--draft', '--base', CONTRIBUTE_BASE_BRANCH, '--head', branch,
        '--title', texts.title, '--body', texts.body,
      ], 'PR을 만들지 못했어요.', { cwd: checkout });
    } catch (error) {
      io.stdout.write(error.missing
        ? 'gh가 없어 PR은 만들지 않았어요. 다음 주소에서 PR을 만들어 주세요.\n'
        : `${error.message}\n다음 주소에서 PR을 만들어 주세요.\n`);
      io.stdout.write(`${compareUrl}\n`);
      return error.missing ? 0 : 1;
    }
    io.stdout.write(`PR               ${url.split('\n').pop()}\n`);
    io.stdout.write('안내: draft PR의 본문에 변경 이유를 채운 뒤 리뷰를 요청해 주세요.\n');
    io.stdout.write(`안내: PR이 merge된 뒤 init ${KIT_NAME}을 실행하면 이 문서가 다시 키트 관리 대상(TRACK)이 돼요.\n`);
    return 0;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

function printPlan(io, root, entries, legacyIncludes) {
  io.stdout.write(`대상 프로젝트: ${root}\n`);
  if (legacyIncludes.size > 0) {
    io.stdout.write('안내: --include 옵션은 더 이상 필요하지 않아요. 현재 문서는 모두 기본 생성해요.\n');
  }
  for (const entry of entries) {
    io.stdout.write(`${entry.status.padEnd(16)} ${entry.target}\n`);
  }
}

async function askConfirmation(io, question = '적용할까요? [y/N] ', kind = 'docs') {
  if (io.confirm) return io.confirm(kind);
  const prompt = readline.createInterface({ input: io.stdin, output: io.stdout });
  try {
    return /^y(es)?$/iu.test((await prompt.question(question)).trim());
  } finally {
    prompt.close();
  }
}

async function run(args, io = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr }) {
  try {
    const options = parseArguments(args);
    if (options.help) {
      io.stdout.write(USAGE);
      return 0;
    }
    const root = await resolveTarget(options.target);
    if (options.command === 'hooks') return await runHooks(root, options, io);
    if (options.command === 'contribute') return await runContribute(root, options, io);
    const projectName = markdownText(options.projectName || path.basename(root));
    const manifest = await loadManifest(root);
    const { entries, knownTargets, retiredEntries } = await loadEntries(projectName);
    const plan = [];
    for (const entry of entries) {
      plan.push(await inspectEntry(root, entry, manifest.files.get(entry.target)));
    }
    const retiredByTarget = new Map(retiredEntries.map((entry) => [entry.target, entry]));
    const retiredTargets = new Set([
      ...[...manifest.files.keys()].filter((target) => !knownTargets.has(target)),
      ...retiredByTarget.keys(),
    ]);
    for (const target of retiredTargets) {
      const retiredEntry = await inspectRetiredEntry(
        root,
        target,
        manifest.files.get(target),
        retiredByTarget.get(target)?.templateHash,
      );
      if (retiredEntry) plan.push(retiredEntry);
    }
    printPlan(io, root, plan, options.include);
    if (options.dryRun) {
      await offerGitHooks(root, options, io);
      return 0;
    }
    if (!plan.some((entry) => ACTIONABLE_STATUSES.has(entry.status))) {
      io.stdout.write('적용할 변경이 없어요.\n');
      const hookCode = await offerGitHooks(root, options, io);
      return Math.max(plan.some((entry) => PRESERVED_STATUSES.has(entry.status)) ? 2 : 0, hookCode);
    }
    if (!options.apply) {
      if (!io.stdin.isTTY || !io.stdout.isTTY) {
        io.stderr.write('비대화형 환경에서는 --apply를 지정해야 문서를 적용할 수 있어요.\n');
        return 1;
      }
      if (!(await askConfirmation(io))) {
        io.stdout.write('적용을 취소했어요.\n');
        return 0;
      }
    }

    const results = [];
    for (const entry of plan) {
      let status = entry.status;
      if (entry.status === 'DELETE') {
        status = await deleteRetiredEntry(root, entry, manifest.files.get(entry.target));
      } else if (entry.status !== 'RETIRED' && ACTIONABLE_STATUSES.has(entry.status)) {
        status = await applyEntry(root, entry, manifest.files.get(entry.target));
      }
      results.push({ target: entry.target, status, templateHash: entry.templateHash });
    }

    const nextHashes = new Map(manifest.files);
    for (const result of results) {
      if (['DELETE', 'RETIRED'].includes(result.status)) {
        nextHashes.delete(result.target);
      } else if (['CREATE', 'UPDATE', 'TRACK', 'UNCHANGED'].includes(result.status)) {
        nextHashes.set(result.target, result.templateHash);
      }
    }
    await writeManifest(root, manifest, nextHashes);

    io.stdout.write('적용 결과:\n');
    for (const result of results) io.stdout.write(`${result.status.padEnd(16)} ${result.target}\n`);
    const created = results.filter((result) => result.status === 'CREATE').length;
    const updated = results.filter((result) => result.status === 'UPDATE').length;
    const deleted = results.filter((result) => result.status === 'DELETE').length;
    const tracked = results.filter((result) => result.status === 'TRACK').length;
    const retired = results.filter((result) => result.status === 'RETIRED').length;
    const skipped = results.filter((result) => PRESERVED_STATUSES.has(result.status)).length;
    io.stdout.write(`생성 ${created}개, 갱신 ${updated}개, 삭제 ${deleted}개, 추적 ${tracked}개, 관리 종료 ${retired}개, 사용자 문서 보존 ${skipped}개예요.\n`);
    const hookCode = await offerGitHooks(root, options, io);
    return Math.max(skipped ? 2 : 0, hookCode);
  } catch (error) {
    io.stderr.write(`오류: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { parseArguments, relativeSegments, run };
