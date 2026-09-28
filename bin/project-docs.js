#!/usr/bin/env node

'use strict';

const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
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
};

const USAGE = `사용법:
  project-docs init ios-uikit [--target /absolute/path] [--project-name 이름]
                              [--dry-run | --apply]
  project-docs hooks ios-uikit [--target /absolute/path] [--dry-run | --apply]

명령:
  init   문서 키트를 적용해요. 터미널에서는 git hook 설정 여부도 한 번 물어요.
  hooks  push 전 Claude 코드 리뷰 git hook만 설정해요.

옵션:
  --target        대상 프로젝트의 절대 경로 (기본값: 현재 디렉터리)
  --project-name  문서에 표시할 프로젝트 이름 (기본값: 대상 폴더 이름)
  --dry-run       변경 예정 파일만 표시하고 쓰지 않음
  --apply         대화형 확인 없이 적용
  --help          사용법 표시

현재 키트의 문서는 모두 기본 생성해요.
이전 명령의 --include gitflow과 --include rxswift도 호환을 위해 허용해요.
`;

function parseArguments(args) {
  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }
  if (!Object.hasOwn(COMMAND_OPTIONS, args[0]) || args[1] !== KIT_NAME) {
    throw new Error(`지원하는 명령은 "init ${KIT_NAME}"과 "hooks ${KIT_NAME}"뿐이에요.\n${USAGE}`);
  }

  const options = { command: args[0], dryRun: false, apply: false, include: new Set() };
  const allowedFlags = COMMAND_OPTIONS[options.command];
  const seen = new Set();
  for (let index = 2; index < args.length; index += 1) {
    const flag = args[index];
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
    } else {
      const value = args[++index];
      if (!value || value.startsWith('--')) {
        throw new Error(`${flag} 뒤에 값을 지정해 주세요.`);
      }
      if (flag === '--target') options.target = value;
      if (flag === '--project-name') options.projectName = value;
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
  const plan = await inspectGitHooks(root, await loadGitHooks());
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
    io.stdout.write(`안내: git hook 설정을 거절한 기록이 있어 묻지 않았어요. 설정하려면 ${HOOK_COMMAND}을 실행해요.\n`);
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
