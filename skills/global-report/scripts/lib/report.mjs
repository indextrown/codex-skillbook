// 보고서 작업 폴더와 스킬 자산을 다루는 공용 함수예요.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseHTML, findFirst, textContent } from './html.mjs';

export const SCRIPTS_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SKILL_DIR = path.dirname(SCRIPTS_DIR);
export const ASSETS_DIR = path.join(SKILL_DIR, 'assets');

export function loadTheme() {
  return JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, 'theme.json'), 'utf8'));
}

export function fontFile(theme, weight) {
  return path.join(ASSETS_DIR, theme.font.files[weight]);
}

/** 보고서 작업 폴더를 읽어요. report.html이 없으면 예외를 던져요. */
export function loadReport(reportDir) {
  const dir = path.resolve(reportDir);
  const htmlPath = path.join(dir, 'report.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`report.html이 없어요: ${htmlPath}`);
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { root, errors: parseErrors } = parseHTML(html);
  const titleNode = findFirst(root, (node) => node.name === 'title');
  const title = titleNode ? textContent(titleNode).replace(/\s+/g, ' ').trim() : '';
  const sourcesPath = path.join(dir, 'sources.md');
  const sourcesText = fs.existsSync(sourcesPath) ? fs.readFileSync(sourcesPath, 'utf8') : null;
  return { dir, htmlPath, html, root, parseErrors, title, sourcesPath, sourcesText };
}

/** sources.md 표의 첫 열에서 S1, S2 같은 ID를 읽어요. */
export function sourceIds(sourcesText) {
  const ids = new Set();
  for (const line of (sourcesText ?? '').split('\n')) {
    const match = /^\s*\|\s*(S\d+)\s*\|/.exec(line);
    if (match) ids.add(match[1]);
  }
  return ids;
}

function sanitizeFileName(title) {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  return (cleaned || 'report').slice(0, 80);
}

function dateStamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * exports/<제목>_v<N>_<YYYYMMDD>.<확장자> 경로를 정해요.
 * 같은 제목과 확장자의 기존 파일 중 가장 큰 N에 1을 더하고, 기존 파일은 남겨요.
 */
export function nextExportPath(reportDir, title, extension, date = new Date()) {
  const exportsDir = path.join(reportDir, 'exports');
  fs.mkdirSync(exportsDir, { recursive: true });
  const base = sanitizeFileName(title);
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_v(\\d+)_\\d{8}\\.${extension}$`);
  let version = 0;
  for (const name of fs.readdirSync(exportsDir)) {
    const match = pattern.exec(name);
    if (match) version = Math.max(version, Number(match[1]));
  }
  return path.join(exportsDir, `${base}_v${version + 1}_${dateStamp(date)}.${extension}`);
}

export function which(command) {
  const result = spawnSync('/bin/sh', ['-c', `command -v "${command}"`], { encoding: 'utf8' });
  const found = result.stdout.trim();
  return result.status === 0 && found ? found : null;
}

const CHROME_APP_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
];
const CHROME_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

/** Chrome 실행 파일을 찾아요. CHROME_PATH 환경 변수가 있으면 먼저 써요. */
export function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const candidate of CHROME_APP_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const command of CHROME_COMMANDS) {
    const found = which(command);
    if (found) return found;
  }
  return null;
}

/** pdfinfo로 쪽 수를 읽어요. pdfinfo가 없으면 null이에요. */
export function pdfPageCount(pdfPath) {
  if (!which('pdfinfo')) return null;
  const result = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const match = /^Pages:\s+(\d+)/m.exec(result.stdout ?? '');
  return match ? Number(match[1]) : null;
}

/** pdffonts로 PDF에 들어간 글꼴을 읽어요. pdffonts가 없으면 null이에요. */
export function pdfFonts(pdfPath) {
  if (!which('pdffonts')) return null;
  const result = spawnSync('pdffonts', [pdfPath], { encoding: 'utf8' });
  return (result.stdout ?? '')
    .split('\n')
    .slice(2)
    .filter((line) => line.trim())
    .map((line) => {
      const [name, ...rest] = line.trim().split(/\s+/);
      const typeMatch = /(Type 3|Type 1C|Type 1|CID TrueType|CID Type 0C|CID Type 0|TrueType)/.exec(rest.join(' '));
      return { name, type: typeMatch ? typeMatch[1] : rest[0] };
    });
}

/** PNG, JPEG, GIF 파일의 픽셀 크기를 읽어요. 읽을 수 없으면 null이에요. */
export function imageSize(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { type: 'png', width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length > 10 && data.toString('ascii', 0, 3) === 'GIF') {
    return { type: 'gif', width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = data[offset + 1];
      const length = data.readUInt16BE(offset + 2);
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isStartOfFrame) {
        return { type: 'jpg', width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/** 작업 폴더 밖을 가리키지 않는 상대 경로인지 확인하고 절대 경로를 돌려줘요. */
export function resolveInside(reportDir, relative) {
  if (!relative || /^[a-z][a-z0-9+.-]*:/i.test(relative) || path.isAbsolute(relative)) return null;
  const resolved = path.resolve(reportDir, decodeURI(relative));
  const inside = path.relative(reportDir, resolved);
  if (inside.startsWith('..') || path.isAbsolute(inside)) return null;
  return resolved;
}

/**
 * Codex 같은 에이전트 샌드박스 안에서 실행 중이면 샌드박스 이름(예: seatbelt)을 돌려줘요.
 * macOS seatbelt 샌드박스 안에서는 Chrome·Pages·LibreOffice 같은 앱을 실행할 수 없어요.
 */
export function agentSandbox() {
  return process.env.CODEX_SANDBOX || null;
}

/** 앱 실행이 샌드박스에 막혔을 때 쓰는 오류예요. 스크립트는 종료 코드 3으로 끝나요. */
export function sandboxError(subject) {
  const error = new Error(
    `${subject} Codex 샌드박스(${agentSandbox()}) 안에서 실행할 수 없어요. macOS가 샌드박스 안에서 앱 실행을 막아요. `
    + '같은 명령을 샌드박스 밖에서 실행하도록 사용자에게 권한 승인을 요청한 뒤 다시 실행해 주세요.',
  );
  error.code = 'SANDBOX';
  return error;
}

/** 오류 종류에 맞는 종료 코드예요. 검사 실패 1, 샌드박스 3, 그 밖의 오류 2. */
export function exitCodeFor(error) {
  if (error.code === 'LINT') return 1;
  if (error.code === 'SANDBOX') return 3;
  return 2;
}

/**
 * 스크립트가 직접 실행됐는지 확인해요. 심볼릭 링크로 설치된 스킬이나 macOS의 /var → /private/var처럼
 * 경로 문자열이 달라도 같은 파일이면 참이에요.
 */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}

export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const result = { positional: [], flags: new Set(), options: {} };
  for (let k = 0; k < argv.length; k += 1) {
    const arg = argv[k];
    if (flags.includes(arg)) {
      result.flags.add(arg);
    } else if (options.includes(arg)) {
      result.options[arg] = argv[k + 1];
      k += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`알 수 없는 옵션이에요: ${arg}`);
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}
