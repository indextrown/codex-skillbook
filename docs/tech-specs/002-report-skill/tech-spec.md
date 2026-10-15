---
kind: tech-spec
title: "보고서 작성 스킬"
status: "승인"
owner: ""
reviewers: []
last_updated: "2026-10-15"
related_issue: ""
html: "./tech-spec.html"
---

# 보고서 작성 스킬

## 요약

`global-report` 스킬을 새로 추가해요. 사용자는 이 스킬을 여러 번 호출하면서 보고서에 들어갈 내용과 파일을 조금씩 건네요. 스킬은 그 자료를 보고서 하나에 쌓고, 요청이 오면 같은 원본에서 PDF, DOCX, Pages 파일을 만들어요. 사용자는 호출할 때마다 보고서의 목적과 형식을 다시 설명하지 않아도 돼요.

보고서 원본은 정해진 태그만 쓰는 HTML이에요. PDF는 Chrome이 HTML을 그대로 인쇄해서 만들어요. DOCX는 같은 HTML을 Word 문서 구조로 옮겨 적은 뒤 Word 스타일을 입혀서 만들어요. Pages 파일은 그 DOCX를 Pages로 열어 저장해서 만들어요. Keynote 발표 자료는 별도 스킬로 분리하고 이번 범위에서 빼요.

## 배경

이 저장소에는 기술 문서를 다듬는 `global-technical-writing`과 기능 설계를 정리하는 `global-tech-spec`이 있어요. 하지만 여러 번 나눠 받은 자료를 보고서 하나로 쌓고 PDF나 Word 파일로 내보내는 스킬은 없어요. 사용자는 보고서를 만들 때마다 목적, 양식, 출력 형식을 처음부터 설명해야 해요.

이전에 발표 자료를 만든 `MapseaLab/docs/ppt/rtk-발표준비`에서는 python-pptx로 도형을 인치 좌표에 하나씩 배치하는 스크립트를 썼어요. 버전마다 776~1,606줄짜리 스크립트를 복사해서 고쳤고, 문구 하나를 바꿔도 코드를 고치고 다시 빌드한 뒤 파일을 열어 확인해야 했어요.

보고서·발표 자료를 만드는 공개 스킬을 조사한 결과는 다음과 같아요.

- huashu-design, frontend-slides, ppt-master 같은 스킬은 HTML이나 SVG를 원본으로 두고 Chromium으로 PDF를 만들어요.
- DOCX를 내보내는 스킬은 찾지 못했어요.

2026-10-15에 이 저장소 개발자의 Mac에서 출력 경로를 직접 시험했어요. 사용한 버전은 Chrome 155, LibreOffice 26.8, Pages 15.4, `docx` npm 9.11이에요.

| 확인한 내용 | 결과 |
| --- | --- |
| Chrome `--print-to-pdf`로 한글 A4 보고서 출력 | 3쪽을 1.85초에 만들었어요. CSS `@page`로 넣은 머리말과 "2 / 3" 형식의 쪽 번호가 동작했고, 표지에서는 머리말을 숨길 수 있었어요. 목차 쪽 번호(`target-counter`)와 장 제목 머리말(`string-set`)은 동작하지 않았어요. 설치된 Pretendard OTF는 PDF 안에 Type 3 글꼴로 들어갔어요. |
| LibreOffice로 HTML을 DOCX로 바로 변환 | 제목 스타일은 남았지만 표지, 표 폭, 글꼴이 사라졌어요. 이미지는 외부 파일 링크로만 들어갔어요. 이미지를 data URI로 넣으면 문서 안에 들어갔어요. CSS 글꼴 목록 전체가 글꼴 이름 하나로 들어갔어요. |
| `docx` npm으로 만든 DOCX를 Pages에서 열기 | 글꼴, 표, 색, 목록, 머리말, 쪽 번호, 각주, 목차 쪽 번호가 모두 의도대로 나왔어요. |
| 같은 DOCX를 LibreOffice에서 열기 | Pretendard를 찾지 못해 대체 글꼴로 그렸고, 한글 굵게와 목차 쪽 번호가 빠졌어요. 새 사용자 프로필로 렌더하면 한글이 모두 빠졌어요. |
| Pages 스크립트로 DOCX 열기, `.pages` 저장, PDF·DOCX 내보내기 | 약 2.7초에 끝났어요. 설치 직후 첫 실행만 56초가 걸렸어요. Word의 제목, 본문, 표, 머리말, 쪽 번호 필드가 유지됐어요. |
| Pages 15.4 스크립팅 사전 | 텍스트에 글꼴, 크기, 색만 지정할 수 있어요. 문단 스타일을 지정하는 기능은 없어요. |

이 결과를 바탕으로 출력 경로를 정했어요.
- PDF는 HTML에서 바로 만들어요.
- DOCX는 HTML을 변환하지 않고 Word 구조로 새로 생성해요.
- Pages는 생성한 DOCX를 거쳐서 만들어요.

## 목표

- 사용자는 `$global-report`를 여러 번 호출해 텍스트와 파일을 추가할 수 있어야 해요. 매 호출은 이전 호출의 내용과 결정을 이어받아야 해요.
- 받은 자료의 원본과 출처가 보고서와 함께 남아야 해요. 어떤 내용이 어떤 자료에서 왔는지 확인할 수 있어야 해요.
- 사용자는 같은 원본에서 PDF, DOCX, Pages 중 원하는 형식을 골라 내보낼 수 있어야 해요.
- 세 형식은 같은 색, 글꼴, 구성을 써서 같은 보고서로 보여야 해요.
- DOCX는 Word의 제목·본문 스타일, 표, 목록, 머리말, 쪽 번호를 그대로 써서 받은 사람이 편집할 수 있어야 해요.
- 내보낸 결과를 쪽별 이미지로 확인할 수 있어야 해요.
- 허용하지 않은 구조, 깨진 이미지 경로, 남은 자리 표시자는 검사 스크립트가 찾아내야 해요.
- Codex와 Claude Code에서 같은 절차로 동작해야 해요.

## 목표가 아닌 것

- Keynote 발표 자료는 만들지 않아요. 별도 스킬 `global-keynote-deck`에서 다뤄요.
- HWP·HWPX 출력, HTML에서 PPTX를 만드는 기능, 웹 페이지 내용을 자동으로 가져오는 기능은 넣지 않아요.
- 다음 기능은 첫 버전이 안정된 뒤 2차 작업으로 미뤄요.
  - PDF 목차 쪽 번호
  - 차트를 이미지로 바꿔 넣는 기능
  - PPTX·XLSX 자료 읽기
  - 여러 테마
  - Pages 고정 양식 자리 표시자 채우기
- 각주는 첫 버전에서 지원하지 않아요. Chrome PDF에서 각주를 쪽 아래에 배치하는 방법이 없어서예요. 출처는 출처 기록과 참고 자료 목록으로 대신해요.
- 회사 로고와 이미지 자산은 넣지 않아요. 이 저장소는 공개 저장소라서 색 값만 맵시 템플릿을 따라요.
- 스킬이 `.gitignore`를 바꾸거나 보고서 폴더를 커밋하지 않아요. 커밋 여부는 사용자가 정해요.

## 계획

### 스킬 구성

```text
skills/global-report/
├── SKILL.md
├── agents/openai.yaml
├── assets/
│   ├── theme.json            ← 색·글꼴·간격 값 (PDF와 DOCX가 함께 사용)
│   ├── report.css            ← theme.json 값을 CSS 변수로 쓰는 인쇄용 스타일
│   ├── fonts/                ← Pretendard TTF와 OFL 라이선스
│   └── templates/            ← 보고서 종류별 report.html 섹션 틀
├── references/
│   ├── writing-rules.md      ← 사실·해석 구분, 출처, 문체
│   ├── allowed-elements.md   ← 허용 태그·class와 Word 대응표
│   └── report-types.md       ← 업무 보고·분석 보고·회의 결과·제안서 구성
└── scripts/
    ├── package.json          ← docx 의존성 고정 (package-lock.json 포함)
    ├── check_deps.mjs
    ├── lint_report.mjs
    ├── export_pdf.mjs
    ├── export_docx.mjs
    ├── export_pages.js       ← osascript -l JavaScript로 실행
    ├── render_preview.mjs
    └── lib/                  ← HTML 파서, 검사, 인쇄 HTML, 작업 폴더 공용 함수
```

스크립트는 Node.js로 작성해요. 이 저장소의 `bin/project-docs.js`와 같은 런타임이고, DOCX 생성에 쓸 `docx` 라이브러리도 Node용이에요. `report.html`은 허용 요소만 쓰는 정돈된 HTML이라 작은 자체 파서로 읽어요. 그래서 검사와 PDF 출력은 npm 설치 없이 동작하고, `docx`는 DOCX 출력에만 필요해요. 테스트는 저장소의 `tests/`에 `node:test`로 추가해요.

### 사용 흐름

```text
$global-report 새 보고서: 10월 RTK 진행 보고, 팀장님 보고용
$global-report (회의록.pdf 첨부) 이 내용 반영해줘
$global-report 2장 표를 최신 수치로 바꿔줘
$global-report 지금 상태 알려줘
$global-report PDF로 내보내줘
```

**첫 호출**
1. 아래 네 가지 중 사용자가 말하지 않은 것만 물어요. Claude Code에서는 질문 도구를 쓰고, Codex에서는 대화로 한두 개씩 물어요.
   - 목적
   - 독자
   - 출력 형식
   - 보고서 종류
2. 보고서 종류에 맞는 섹션 틀로 작업 폴더를 만들어요.
3. 받은 자료가 있으면 바로 반영해요.

**이후 호출**
1. 작업 폴더를 먼저 읽고 이어서 작업해요.
2. 대화에 보고서가 여러 개 언급됐거나 어느 보고서인지 분명하지 않으면 먼저 물어요.

### 보고서 작업 폴더

스킬을 실행한 프로젝트의 저장소 루트에 만들어요. git 저장소가 아니면 현재 디렉터리에 만들어요. 번호와 이름은 테크 스펙과 같은 규칙을 따라요.
- 번호는 `001`부터 시작하고, 기존 폴더의 가장 큰 번호에 1을 더해요.
- 이름은 짧은 영문 kebab-case로 정해요.

```text
docs/reports/001-rtk-october/
├── spec.md       ← 목적·독자·형식·보고서 종류·디자인 선택·미결 사항
├── report.html   ← 보고서 원본
├── sources.md    ← 받은 자료 목록
├── sources/      ← 받은 파일 원본
└── exports/      ← 내보낸 PDF·DOCX·Pages 파일
```

**`sources.md`**
- 자료마다 한 행을 써요. 열은 ID(`S1`, `S2`…), 파일 또는 대화, 받은 날짜, 한 줄 요약, 반영한 섹션이에요.
- `report.html`의 섹션에는 `data-sources="S1 S3"` 속성을 붙여요. 이 속성으로 어떤 섹션이 어떤 자료에서 왔는지 이어 줘요. 화면과 출력물에는 표시하지 않아요.

**`exports/`**
- 파일 이름은 `<보고서 제목>_v<N>_<YYYYMMDD>.<확장자>` 형식이에요.
- 같은 형식을 다시 내보내면 N을 1 올리고 이전 파일은 지우지 않아요.

### 내용 쌓기 규칙

1. 호출마다 `spec.md`, `sources.md`, `report.html`을 먼저 읽어요.
2. 받은 파일은 `sources/`에 복사하고 `sources.md`에 기록해요. 파일 종류별로 내용을 읽는 방법은 다음과 같아요.
   - PDF: `pdftotext`. 글꼴에 따라 `%`, 괄호, 하이픈 같은 기호가 빠질 수 있어서, 수치나 기호가 이상하면 쪽 이미지로 확인해요.
   - DOCX: macOS에서는 `textutil`, 그 밖의 환경에서는 LibreOffice
   - 이미지: 에이전트가 직접 봐요
   - CSV: 표로 읽어요
3. 새 내용은 끝에 붙이지 않고 알맞은 섹션에 넣어요. 기존 내용과 겹치거나 수치가 다르면, 바꾸기 전에 두 값을 보여 주고 어느 쪽을 쓸지 물어요.
4. 확인한 사실과 해석을 나눠 써요. 받은 자료에 없는 수치, 일정, 이름은 만들지 않아요.
5. 호출이 끝나면 이번에 반영한 섹션, 아직 비어 있는 섹션, 확인이 필요한 내용을 짧게 알려요.

### report.html 구조

보고서 원본에는 아래 요소만 써요. 요소마다 PDF용 CSS 모양과 Word 스타일이 하나씩 정해져 있어요. 그래서 `export_docx`가 같은 구조를 Word로 옮길 수 있어요.

| report.html | PDF (report.css) | DOCX (Word 스타일) |
| --- | --- | --- |
| `<section class="cover">` 안의 `h1`, `p` | 첫 쪽 표지, 머리말·쪽 번호 없음 | 첫 쪽 표지(`Title`, `Subtitle`), 머리말·쪽 번호 없음 |
| `<section class="cover compact">` 안의 `h1`, `p` | 첫 쪽 위쪽 제목 블록, 바로 본문 시작 | 첫 쪽 위쪽 `Title`, `Subtitle` |
| `<h2>` | 장 제목 | `Heading 1` |
| `<h3>` | 절 제목 | `Heading 2` |
| `<h4>` | 소제목 | `Heading 3` |
| `<p>` | 본문 | `Normal` |
| `<strong>`, `<em>`, `<a>`, `<span class="accent">`, `<br>` | 굵게, 기울임, 링크, 강조색, 줄바꿈 | 굵게, 기울임, 하이퍼링크, 강조색, 줄바꿈 |
| `<ul>`, `<ol>` (2단계까지) | 목록 | 글머리·번호 목록 |
| `<table>` (`thead`, `tbody`, `th`, `td`, `colspan`, `class="num"`) | 표, 쪽마다 머리행 반복 | Word 표, 머리행 반복 |
| `<figure>` 안의 `table`, `figcaption` | 캡션이 있는 표, 오른쪽 캡션 | 캡션이 있는 Word 표, `Table Caption` |
| `<figure>` 안의 `img`, `figcaption` | 그림과 가운데 캡션 | 문서에 넣은 이미지와 `Caption` |
| `<aside class="callout">` | 왼쪽 강조선이 있는 상자 | `Callout` |
| `<nav class="toc">` | 목차(쪽 번호 없음) | Word 목차 필드 |

- `body`에는 표지, 목차, 장 `section`, 요약 상자(`aside.callout`)만 바로 둬요. 장 `section`은 `h2`로 시작해요.
- `cover compact`는 한두 쪽짜리 업무 보고·회의 결과처럼 표지 쪽 없이 첫 쪽 위에 제목을 두는 형식이에요.
- `div` 레이아웃, 인라인 `style`, `script`, 목록에 없는 class는 쓰지 않아요.
- 이미지는 `sources/` 또는 작업 폴더 안의 파일만 참조해요.

### 디자인

- `theme.json`이 색, 글꼴, 글자 크기, 간격 값을 한 번만 정의해요.
- `export_pdf`는 이 값을 CSS 변수로 주입해요. `export_docx`는 같은 값으로 Word 스타일을 만들어요. 그래서 두 형식의 모양이 갈라지지 않아요.
- 글꼴은 PDF, DOCX, Pages 모두 Pretendard로 통일해요.
  - PDF용으로는 TTF를 `@font-face`로 함께 넣어 Type 3 글꼴로 들어가는 문제를 피해요.
  - DOCX에는 Word 스타일의 글꼴 이름으로 Pretendard를 지정해요. 라틴 문자와 한글 모두 같은 글꼴이에요.
  - Pretendard는 SIL OFL 1.1 라이선스라 라이선스 파일과 함께 넣어요.
- 색과 구성은 맵시 문서 표준 PPT 템플릿을 따라요. 템플릿에서 쓰는 색 값을 그대로 가져왔어요.
  - 짙은 남색(`0C2D6F`): 제목 글자, 표지의 왼쪽 막대, 표 머리행 배경
  - 파랑(`1A56DB`): 장 제목의 왼쪽 막대, 요약 상자 막대, 링크·강조
  - 본문 남색(`111834`), 보조 회색(`5B667A`), 선(`D8E1EF`)
  - 표 본문은 줄무늬(`F4F8FC`)로 행을 구분해요.
- 공개 저장소라서 회사 로고는 넣지 않아요.

### PDF 내보내기

`export_pdf`는 아래 순서로 PDF를 만들어요.
1. `report.html`, `report.css`, 글꼴을 임시 폴더에 모아요.
2. Chrome을 헤드리스로 실행해 `--print-to-pdf --no-pdf-header-footer`로 출력해요. Chrome 위치는 아래 순서로 찾아요.
   - macOS 앱 경로
   - `google-chrome`
   - `chromium`
3. 쪽 구성은 CSS로 정해요.
   - `@page`의 여백 영역에 머리말과 쪽 번호("n / N")를 넣어요.
   - `@page :first`로 표지에서는 숨겨요.
   - 표 머리행은 쪽마다 반복해요.
   - 제목 바로 뒤, 그리고 표와 그림 가운데에서는 쪽이 넘어가지 않게 해요.

출력한 뒤 다음 두 가지를 확인해요.
- `pdfinfo`로 쪽 수
- `pdffonts`로 Type 3 글꼴이 남았는지

### DOCX 내보내기

`export_docx`는 위 대응표에 따라 `report.html`을 Word 요소로 옮겨요. 일을 두 곳에 나눠 맡겨요.
- **본문:** `docx` 9.11에 들어 있는 `docx/html`의 `htmlToContent`가 장들을 Word 문단, 표, 목록, 이미지로 바꿔요.
  - 요소마다 쓸 Word 스타일은 CSS 선택자와 스타일 ID의 대응(`styleMap`)으로 정해요. 예: `h2` → `Heading1`
  - 표 머리행 색, 줄무늬, 숫자 정렬은 `theme.json` 값으로 만든 작은 스타일시트로 정해요.
- **직접 만드는 부분:** 표지, 목차, 머리말, 쪽 번호, Word 스타일 정의는 `export_docx`가 만들어요.
- 스타일은 `theme.json` 값으로 정의해요.
- 머리말에는 보고서 제목을 넣고, 꼬리말에는 쪽 번호 필드(PAGE / NUMPAGES)를 넣어요.
- 표지 쪽과 목차는 각각 새 쪽에서 시작하는 구역으로 나눠요.
  - 표지 구역에는 머리말·꼬리말이 없어요.
  - 쪽 번호는 문서 전체로 이어져요.
  - Pages는 구역 세로 정렬과 쪽 맨 위 문단의 앞 간격을 무시해요. 그래서 표지 제목 앞에 줄 높이를 고정한 빈 문단을 둬서 제목을 내려요.
- 이미지는 파일을 읽어 문서 안에 넣어요. 본문 폭과 높이 110mm 안에 들어가도록 크기를 맞춰요.
- 목차는 Word 목차 필드로 넣어요. Word는 파일을 열 때 필드를 업데이트할지 묻고, Pages는 쪽 번호를 계산해서 보여 줘요.

### Pages 내보내기

`export_pages`는 방금 만든 DOCX를 Pages로 열어 `.pages`로 저장해요. 필요하면 PDF도 함께 내보내요.
- 스크립트가 연 문서만 닫아요.
- Pages를 스크립트가 직접 실행했고 남은 문서가 없을 때만 Pages를 종료해요.
- Pages가 없거나 macOS가 앱 제어 권한을 거부하면 Pages 출력만 건너뛰어요. 이유와 해결 방법을 알리고, 다른 형식의 결과는 그대로 유지해요.

### 확인과 검사

**`lint_report`** — 내보내기 전에 아래 항목을 검사해요.
- 허용하지 않은 태그·class·속성
- 존재하지 않는 이미지 경로
- 남은 자리 표시자(`{{`, `작성 예정`)
- 빈 섹션
- `sources.md`에 없는 `data-sources` ID

오류가 있으면 내보내지 않아요.

**`render_preview`** — 결과를 쪽별 PNG로 만들어요.
- PDF는 바로 `pdftoppm`으로 바꿔요.
- DOCX는 Pages에서 PDF를 뽑은 뒤 바꿔요. Pages가 없을 때만 LibreOffice를 쓰고, 한글 글꼴이 다르게 보일 수 있다고 함께 알려요.

에이전트는 PNG를 직접 확인한 뒤에만 내보내기가 끝났다고 보고해요.

**`check_deps`** — 처음 실행할 때 아래 도구를 확인해요.
- 필수: Chrome, Node.js 22 이상, `pdfinfo`·`pdftoppm`(Poppler)
- 선택: Pages, LibreOffice

`scripts/node_modules`가 없으면 `npm ci`로 고정한 의존성을 설치해요. 빠진 도구는 설치 명령과 함께 알려요.

## 고려 사항

- **DOCX 글꼴:** 받는 사람 PC에 Pretendard가 없으면 Word가 다른 글꼴로 바꿔 보여 줘요. 이 경우를 감수하고 모든 형식을 Pretendard로 통일하기로 했어요(2026-10-15).
- **Codex 샌드박스에서 앱 제어:**
  - Pages 출력은 `osascript`로 Pages에 Apple Event를 보내야 해요. Codex 샌드박스에서 이 호출이 막히는지 확인하지 못했어요.
  - 막히면 권한 상승 실행을 사용자에게 요청하는 절차를 SKILL.md에 적어요.
  - 그래도 실행할 수 없으면 Pages 출력만 건너뛰어요.
- **Pretendard 글꼴 형식:** TTF를 `@font-face`로 넣으면 Chrome PDF에 Type 3가 아니라 CID TrueType으로 들어가는 것을 `pdffonts`로 확인했어요.
- **의존성 설치:**
  - `npx skills add`로 설치한 스킬 폴더에는 `node_modules`가 없어요. 처음 실행할 때 `npm ci`로 네트워크에서 내려받아야 해요.
  - 오프라인에서는 DOCX와 Pages 출력이 동작하지 않아요. 검사와 PDF 출력은 자체 HTML 파서를 써서 Chrome만 있으면 동작해요.
  - 스킬이 심볼릭 링크로 설치돼도 스크립트가 실행되도록, 직접 실행 여부를 실제 경로로 비교해요.
- **LibreOffice 확인 결과의 한계:** LibreOffice는 Pretendard를 찾지 못해 Word·Pages와 다르게 보여 줘요. 결과 확인용으로는 Pages를 먼저 쓰고, LibreOffice 결과로는 글꼴과 굵게를 판단하지 않아요.
- **보고서 내용의 공개 범위:** 보고서와 원본 자료에는 내부 정보가 들어갈 수 있어요. 스킬은 보고서를 커밋하거나 외부로 보내지 않아요. 저장소에 올릴지는 사용자가 정해요.

## 진행 체크리스트

- [x] 1. 테크 스펙 승인
  - [x] 1-1. PDF, DOCX, Pages의 글꼴을 모두 Pretendard로 통일하기로 정했어요.
  - [x] 1-2. 구현 중 바뀐 설계(맵시 색 테마, `docx/html` 사용, `cover compact`·`br`·`figure` 안의 표 추가)를 개발자가 검토하고 다시 승인했어요.
- [ ] 2. 스킬 골격과 작성 규칙
  - [x] 2-1. `skills/global-report/`에 `SKILL.md`, `agents/openai.yaml`, `references/` 세 문서, 보고서 종류 4개의 섹션 틀을 만들어요.
  - [ ] 2-2. 빈 프로젝트에서 `$global-report 새 보고서 …`를 호출하면 `docs/reports/001-<slug>/`에 `spec.md`, `report.html`, `sources.md`가 생겨요.
- [ ] 3. 내용 쌓기
  - [ ] 3-1. 텍스트, PDF, DOCX, 이미지, CSV 자료를 `sources/`에 복사하고 `sources.md`에 ID와 반영 섹션을 기록해요.
  - [ ] 3-2. 두 번째 호출에서 첫 호출의 내용이 유지되고, 새 자료가 알맞은 섹션에 들어가요. 수치가 충돌하면 바꾸기 전에 물어요.
- [x] 4. 테마와 검사 스크립트
  - [x] 4-1. `theme.json`, `report.css`, Pretendard TTF와 OFL 라이선스를 추가해요.
  - [x] 4-2. `lint_report`가 허용하지 않은 태그, 없는 이미지, 남은 자리 표시자, 없는 출처 ID를 오류로 보고하는 테스트가 통과해요.
- [x] 5. PDF 내보내기
  - [x] 5-1. `export_pdf`가 Chrome 위치를 찾아 테스트용 보고서를 PDF로 출력해요.
  - [x] 5-2. 출력한 PDF에서 확인할 것: 표지에 머리말이 없어요. 둘째 쪽부터 "n / N" 쪽 번호가 있어요. `pdffonts`에 Type 3 글꼴이 없어요.
- [x] 6. DOCX 내보내기
  - [x] 6-1. `export_docx`가 대응표의 모든 요소를 Word 요소로 만들고, `theme.json` 값으로 스타일과 머리말·쪽 번호를 넣어요.
  - [x] 6-2. 테스트용 DOCX의 `word/document.xml`에서 확인할 것: `Heading1`~`Heading3` 스타일, 표 머리행 반복(`tblHeader`), 문서 안에 넣은 이미지. Pages로 렌더한 쪽 이미지도 눈으로 확인해요.
- [ ] 7. Pages 내보내기
  - [x] 7-1. `export_pages`가 DOCX를 열어 `.pages`로 저장하고, 사용자가 이미 열어 둔 Pages 문서는 닫지 않아요.
  - [ ] 7-2. Pages가 없거나 권한이 거부되면 PDF·DOCX 결과를 유지한 채 안내해요. Codex 샌드박스에서 실행할 수 있는지 확인해요.
- [x] 8. 결과 확인과 의존성 점검
  - [x] 8-1. `render_preview`가 PDF·DOCX 결과를 쪽별 PNG로 만들어요. `check_deps`는 `node_modules`가 없으면 `npm ci`를 실행해요.
  - [x] 8-2. 도구가 빠진 환경에서 `check_deps`가 빠진 도구와 설치 명령을 출력해요.
- [ ] 9. 문서화와 전체 시나리오
  - [x] 9-1. README의 "자주 사용하는 스킬" 표에 `global-report`를 추가해요.
  - [ ] 9-2. 생성 → 자료 추가 → 내보내기 순서로 세 번 호출하면 PDF, DOCX, Pages 파일이 모두 만들어져요.
