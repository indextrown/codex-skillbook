#!/usr/bin/env node
// 사용법: node lint_report.mjs <보고서 폴더> [--json]
// 허용하지 않은 구조, 없는 이미지, 없는 출처 ID, 남은 자리 표시자를 찾아요.
// 오류나 자리 표시자가 하나라도 있으면 종료 코드 1로 끝나고, 내보내기 스크립트도 멈춰요.
import { formatLint, lintReport } from './lib/lint.mjs';
import { loadReport, parseArgs } from './lib/report.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['--json'] });
  if (args.positional.length !== 1) {
    console.error('사용법: node lint_report.mjs <보고서 폴더> [--json]');
    return 2;
  }
  const report = loadReport(args.positional[0]);
  const result = lintReport(report);
  const ready = result.errors.length === 0 && result.placeholders.length === 0;

  if (args.flags.has('--json')) {
    console.log(JSON.stringify({ ready, ...result }, null, 2));
  } else {
    for (const line of formatLint(report, result)) console.log(line);
    console.log(ready
      ? '검사 통과: 내보낼 수 있어요.'
      : `오류 ${result.errors.length}개, 자리 표시자 ${result.placeholders.length}개가 남아 있어요.`);
  }
  return ready ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
