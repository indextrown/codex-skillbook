#!/usr/bin/env node

'use strict';

const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');

const KIT_NAME = 'ios-uikit';
const KIT_DIRECTORY = path.resolve(__dirname, '..', 'project-doc-kits', KIT_NAME);

const USAGE = `사용법:
  project-docs init ios-uikit [--target /absolute/path] [--project-name 이름]
                              [--include gitflow] [--dry-run | --apply]

옵션:
  --target        대상 프로젝트의 절대 경로 (기본값: 현재 디렉터리)
  --project-name  문서에 표시할 프로젝트 이름 (기본값: 대상 폴더 이름)
  --include       선택 문서 추가 (현재 지원: gitflow)
  --dry-run       생성 예정 파일만 표시하고 쓰지 않음
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

  const options = { dryRun: false, apply: false, include: null };
  const seen = new Set();
  for (let index = 2; index < args.length; index += 1) {
    const flag = args[index];
    if (!['--target', '--project-name', '--include', '--dry-run', '--apply'].includes(flag)) {
      throw new Error(`알 수 없는 옵션이에요: ${flag}`);
    }
    if (seen.has(flag)) {
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
      if (flag === '--include') options.include = value;
    }
  }
  if (options.dryRun && options.apply) {
    throw new Error('--dry-run과 --apply는 함께 사용할 수 없어요.');
  }
  if (options.include && options.include !== 'gitflow') {
    throw new Error(`지원하지 않는 선택 문서예요: ${options.include}`);
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
  const targets = new Set();
  const entries = [];
  for (const item of manifest.files) {
    const sourceSegments = relativeSegments(item.template, '템플릿');
    const targetSegments = relativeSegments(item.target, '대상');
    if (targets.has(item.target)) {
      throw new Error(`대상 경로가 중복돼요: ${item.target}`);
    }
    targets.add(item.target);
    if (item.include && item.include !== 'gitflow') {
      throw new Error(`알 수 없는 선택 문서예요: ${item.include}`);
    }
    if (item.include && item.include !== include) continue;

    const templatePath = path.join(kitRoot, ...sourceSegments);
    const resolvedTemplate = await fs.realpath(templatePath);
    const sourceStat = await fs.lstat(templatePath);
    if (!isWithin(kitRoot, resolvedTemplate) || sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      throw new Error(`키트 밖의 템플릿은 읽을 수 없어요: ${item.template}`);
    }
    const content = renderTemplate(await fs.readFile(templatePath, 'utf8'), projectName);
    entries.push({ target: item.target, segments: targetSegments, content });
  }
  return entries;
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

async function inspectEntry(root, entry) {
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
  return { ...entry, destination, status: existing.equals(entry.content) ? 'UNCHANGED' : 'SKIP_EXISTING' };
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

async function applyEntry(root, entry) {
  await ensureParents(root, entry.segments);
  const updated = await inspectEntry(root, entry);
  if (updated.status !== 'CREATE') return updated.status;

  let handle;
  try {
    handle = await fs.open(entry.destination, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0), 0o644);
    await handle.writeFile(entry.content);
    return 'CREATE';
  } catch (error) {
    if (error.code === 'EEXIST') {
      return (await inspectEntry(root, entry)).status;
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

function printPlan(io, root, entries) {
  io.stdout.write(`대상 프로젝트: ${root}\n`);
  for (const entry of entries) {
    io.stdout.write(`${entry.status.padEnd(13)} ${entry.target}\n`);
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
    const entries = await loadEntries(projectName, options.include);
    const plan = [];
    for (const entry of entries) plan.push(await inspectEntry(root, entry));
    printPlan(io, root, plan);
    if (options.dryRun) return 0;
    if (!plan.some((entry) => entry.status === 'CREATE')) {
      io.stdout.write('생성할 파일이 없어요.\n');
      return plan.some((entry) => entry.status === 'SKIP_EXISTING') ? 2 : 0;
    }
    if (!options.apply) {
      if (!io.stdin.isTTY || !io.stdout.isTTY) {
        io.stderr.write('비대화형 환경에서는 --apply를 지정해야 파일을 만들 수 있어요.\n');
        return 1;
      }
      if (!(await askConfirmation(io))) {
        io.stdout.write('적용을 취소했어요.\n');
        return 0;
      }
    }

    const results = [];
    for (const entry of plan) {
      results.push({ target: entry.target, status: entry.status === 'CREATE' ? await applyEntry(root, entry) : entry.status });
    }
    io.stdout.write('적용 결과:\n');
    for (const result of results) io.stdout.write(`${result.status.padEnd(13)} ${result.target}\n`);
    const created = results.filter((result) => result.status === 'CREATE').length;
    const skipped = results.filter((result) => result.status === 'SKIP_EXISTING').length;
    io.stdout.write(`생성 ${created}개, 기존 파일 보존 ${skipped}개예요.\n`);
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
