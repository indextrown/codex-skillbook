// 사용법: osascript -l JavaScript export_pages.js <입력.docx|.pages> [--pages <출력.pages>] [--pdf <출력.pdf>]
// Pages로 DOCX를 열어 .pages로 저장하거나 PDF로 내보내요. 출력을 지정하지 않으면 입력과 같은
// 이름의 .pages를 같은 폴더에 만들어요. 이미 있는 파일은 덮어쓰지 않아요.
// 이 스크립트가 연 문서만 닫고, Pages를 이 스크립트가 실행했을 때만 종료해요.
//
// 종료 코드: 0 성공, 2 사용법·파일 오류, 3 macOS 앱 제어 권한 거부, 4 Pages 없음, 5 Pages 작업 실패
ObjC.import('Foundation');
ObjC.import('stdlib');

function fail(code, message) {
  console.log(message);
  $.exit(code);
}

function fileExists(path) {
  return $.NSFileManager.defaultManager.fileExistsAtPath(path);
}

function absolute(path) {
  const cwd = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
  const full = path.startsWith('/') ? path : `${cwd}/${path}`;
  return ObjC.unwrap($(full).stringByStandardizingPath);
}

function ensureParent(path) {
  const parent = ObjC.unwrap($(path).stringByDeletingLastPathComponent);
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(parent, true, $(), $());
}

function parseArgs(argv) {
  const result = { input: null, pages: null, pdf: null };
  for (let k = 0; k < argv.length; k += 1) {
    if (argv[k] === '--pages') result.pages = argv[++k];
    else if (argv[k] === '--pdf') result.pdf = argv[++k];
    else if (argv[k].startsWith('--')) fail(2, `알 수 없는 옵션이에요: ${argv[k]}`);
    else if (result.input === null) result.input = argv[k];
    else fail(2, `입력 파일은 하나만 줄 수 있어요: ${argv[k]}`);
  }
  return result;
}

function run(argv) {
  const args = parseArgs(argv);
  if (!args.input) fail(2, '사용법: osascript -l JavaScript export_pages.js <입력.docx|.pages> [--pages <출력.pages>] [--pdf <출력.pdf>]');
  const input = absolute(args.input);
  if (!fileExists(input)) fail(2, `입력 파일이 없어요: ${input}`);
  if (!args.pages && !args.pdf) args.pages = input.replace(/\.[^./]+$/, '') + '.pages';
  const pagesOut = args.pages ? absolute(args.pages) : null;
  const pdfOut = args.pdf ? absolute(args.pdf) : null;
  for (const target of [pagesOut, pdfOut]) {
    if (target && fileExists(target)) fail(2, `이미 있는 파일은 덮어쓰지 않아요: ${target}`);
  }

  let app;
  try {
    app = Application('com.apple.Pages');
    app.name();
  } catch (error) {
    fail(4, 'Pages를 찾지 못했어요. App Store에서 Pages를 설치하면 .pages 출력을 쓸 수 있어요.');
  }

  const wasRunning = app.running();
  const started = Date.now();
  let doc;
  try {
    doc = app.open(Path(input));
  } catch (error) {
    if (error.errorNumber === -1743) {
      fail(3, 'macOS가 Pages 제어를 허용하지 않았어요. 시스템 설정 > 개인정보 보호 및 보안 > 자동화에서 이 터미널(또는 에이전트 앱)의 Pages 제어를 허용해 주세요.');
    }
    fail(5, `Pages에서 파일을 열지 못했어요: ${error.message}`);
  }

  try {
    if (pagesOut) {
      ensureParent(pagesOut);
      doc.save({ in: Path(pagesOut) });
    }
    if (pdfOut) {
      ensureParent(pdfOut);
      app.export(doc, { to: Path(pdfOut), as: 'PDF' });
    }
  } catch (error) {
    try { doc.close({ saving: 'no' }); } catch (ignored) { /* 이미 닫혔어요 */ }
    fail(5, `Pages 작업에 실패했어요: ${error.message}`);
  }

  const pageCount = doc.pages.length;
  doc.close({ saving: 'no' });
  if (!wasRunning && app.documents.length === 0) app.quit();

  return JSON.stringify({ pages: pagesOut, pdf: pdfOut, pageCount, ms: Date.now() - started });
}
