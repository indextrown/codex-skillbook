#!/usr/bin/env node

'use strict';

const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const readline = require('node:readline/promises');

const KIT_NAME = 'ios-uikit';
const KIT_DIRECTORY = path.resolve(__dirname, '..', 'project-doc-kits', KIT_NAME);
const MANIFEST_SEGMENTS = ['.project-docs', 'manifest.json'];
const SUPPORTED_INCLUDES = new Set(['gitflow', 'rxswift']);
const ACTIONABLE_STATUSES = new Set(['CREATE', 'UPDATE', 'TRACK', 'RETIRED']);
const PRESERVED_STATUSES = new Set(['SKIP_MODIFIED', 'SKIP_UNTRACKED']);

const USAGE = `사용법:
  project-docs init ios-uikit [--target /absolute/path] [--project-name 이름]
                              [--include gitflow] [--include rxswift]
                              [--dry-run | --apply]

옵션:
  --target        대상 프로젝트의 절대 경로 (기본값: 현재 디렉터리)
  --project-name  문서에 표시할 프로젝트 이름 (기본값: 대상 폴더 이름)
  --include       선택 문서 추가 (gitflow: 1개, rxswift: 3개; 여러 번 지정 가능)
  --dry-run       변경 예정 파일만 표시하고 쓰지 않음
  --apply         대화형 확인 없이 적용
  --help          사용법 표시
`;

function parseArguments(args) {
  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }
  if (args[0] !== 'init' || args[1] !== KIT_NAME) {
    throw new Error(`지원하는 명령은 "init ${KIT_NAME}"뿐이에요.\n${USAGE}`);
  }

  const options = { dryRun: false, apply: false, include: new Set() };
  const seen = new Set();
  for (let index = 2; index < args.length; index += 1) {
    const flag = args[index];
    if (!['--target', '--project-name', '--include', '--dry-run', '--apply'].includes(flag)) {
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
          throw new Error(`지원하지 않는 선택 문서예요: ${value}`);
        }
        if (options.include.has(value)) {
          throw new Error(`선택 문서를 중복 지정했어요: ${value}`);
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

async function loadEntries(projectName, include) {
  const manifest = JSON.parse(await fs.readFile(path.join(KIT_DIRECTORY, 'kit.json'), 'utf8'));
  if (manifest.name !== KIT_NAME || !Array.isArray(manifest.files)) {
    throw new Error('키트 설정을 읽을 수 없어요.');
  }
  const kitRoot = await fs.realpath(KIT_DIRECTORY);
  const knownTargets = new Set();
  const entries = [];
  for (const item of manifest.files) {
    const sourceSegments = relativeSegments(item.template, '템플릿');
    const targetSegments = relativeSegments(item.target, '대상');
    if (knownTargets.has(item.target)) {
      throw new Error(`대상 경로가 중복돼요: ${item.target}`);
    }
    knownTargets.add(item.target);
    if (item.include && !SUPPORTED_INCLUDES.has(item.include)) {
      throw new Error(`알 수 없는 선택 문서예요: ${item.include}`);
    }
    if (item.include && !include.has(item.include)) continue;

    const templatePath = path.join(kitRoot, ...sourceSegments);
    const resolvedTemplate = await fs.realpath(templatePath);
    const sourceStat = await fs.lstat(templatePath);
    if (!isWithin(kitRoot, resolvedTemplate) || sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      throw new Error(`키트 밖의 템플릿은 읽을 수 없어요: ${item.template}`);
    }
    const content = renderTemplate(await fs.readFile(templatePath, 'utf8'), projectName);
    entries.push({ target: item.target, segments: targetSegments, content, templateHash: contentHash(content) });
  }
  return { entries, knownTargets };
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

function printPlan(io, root, entries) {
  io.stdout.write(`대상 프로젝트: ${root}\n`);
  for (const entry of entries) {
    io.stdout.write(`${entry.status.padEnd(16)} ${entry.target}\n`);
  }
}

async function askConfirmation(io) {
  if (io.confirm) return io.confirm();
  const prompt = readline.createInterface({ input: io.stdin, output: io.stdout });
  try {
    return /^y(es)?$/iu.test((await prompt.question('적용할까요? [y/N] ')).trim());
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
    const projectName = markdownText(options.projectName || path.basename(root));
    const manifest = await loadManifest(root);
    const { entries, knownTargets } = await loadEntries(projectName, options.include);
    const plan = [];
    for (const entry of entries) {
      plan.push(await inspectEntry(root, entry, manifest.files.get(entry.target)));
    }
    for (const target of manifest.files.keys()) {
      if (!knownTargets.has(target)) plan.push({ target, status: 'RETIRED' });
    }
    printPlan(io, root, plan);
    if (options.dryRun) return 0;
    if (!plan.some((entry) => ACTIONABLE_STATUSES.has(entry.status))) {
      io.stdout.write('적용할 변경이 없어요.\n');
      return plan.some((entry) => PRESERVED_STATUSES.has(entry.status)) ? 2 : 0;
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
      const status = entry.status !== 'RETIRED' && ACTIONABLE_STATUSES.has(entry.status)
        ? await applyEntry(root, entry, manifest.files.get(entry.target))
        : entry.status;
      results.push({ target: entry.target, status, templateHash: entry.templateHash });
    }

    const nextHashes = new Map(
      [...manifest.files].filter(([target]) => knownTargets.has(target)),
    );
    for (const result of results) {
      if (['CREATE', 'UPDATE', 'TRACK', 'UNCHANGED'].includes(result.status)) {
        nextHashes.set(result.target, result.templateHash);
      }
    }
    await writeManifest(root, manifest, nextHashes);

    io.stdout.write('적용 결과:\n');
    for (const result of results) io.stdout.write(`${result.status.padEnd(16)} ${result.target}\n`);
    const created = results.filter((result) => result.status === 'CREATE').length;
    const updated = results.filter((result) => result.status === 'UPDATE').length;
    const tracked = results.filter((result) => result.status === 'TRACK').length;
    const retired = results.filter((result) => result.status === 'RETIRED').length;
    const skipped = results.filter((result) => PRESERVED_STATUSES.has(result.status)).length;
    io.stdout.write(`생성 ${created}개, 갱신 ${updated}개, 추적 ${tracked}개, 관리 종료 ${retired}개, 사용자 문서 보존 ${skipped}개예요.\n`);
    return skipped ? 2 : 0;
  } catch (error) {
    io.stderr.write(`오류: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { parseArguments, relativeSegments, run };
