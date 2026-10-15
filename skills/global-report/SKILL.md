---
name: global-report
description: 여러 번 나눠 받은 내용과 파일을 보고서 하나에 쌓고, 정해진 태그만 쓰는 HTML 원본에서 PDF·DOCX·Pages 파일을 만든다. 사용자가 업무 보고·분석 보고·회의 결과·제안서 같은 보고서 작성, 기존 보고서에 자료 추가·반영·수정, 보고서 진행 상태 확인, PDF·Word(DOCX)·Pages로 내보내기를 요청할 때 사용한다. Keynote·PPT 발표 자료에는 사용하지 않는다.
---

# Global Report

## 목적

사용자가 여러 번에 걸쳐 건넨 내용과 파일을 보고서 하나에 쌓아요. 호출할 때마다 보고서의 목적, 형식, 이전 결정을 작업 폴더에서 다시 읽으므로 사용자가 처음부터 설명하지 않아도 돼요. 요청이 오면 같은 원본에서 PDF, DOCX, Pages 파일을 만들어요.

- PDF: `report.html`을 Chrome으로 그대로 인쇄해요.
- DOCX: `report.html`의 구조를 Word 요소로 옮기고 `theme.json` 값으로 만든 Word 스타일을 입혀요.
- Pages: 만든 DOCX를 Pages로 열어 `.pages`로 저장해요.

세 형식 모두 Pretendard와 맵시 문서 템플릿의 짙은 남색·파랑 구성을 써요.

## 결과물

스킬을 실행한 프로젝트의 저장소 루트(`git rev-parse --show-toplevel`)에 보고서마다 폴더를 만들어요. git 저장소가 아니면 현재 디렉터리를 기준으로 해요.

```text
docs/reports/<sequence>-<report-slug>/
├── spec.md       ← 목적·독자·형식·종류·문체·결정 기록·미결 사항
├── report.html   ← 보고서 원본
├── sources.md    ← 받은 자료 목록
├── sources/      ← 받은 파일 원본
└── exports/      ← <제목>_v<N>_<YYYYMMDD>.pdf / .docx / .pages
```

- `<sequence>`는 `001`부터 시작하는 세 자리 번호예요. 기존 폴더의 가장 큰 번호에 1을 더하고, 기존 번호는 바꾸지 않아요.
- `<report-slug>`는 보고서를 설명하는 짧은 영문 kebab-case 이름이에요. 예: `001-rtk-october-status`
- `exports/`의 파일은 직접 고치지 않아요. `report.html`을 고친 뒤 다시 내보내요. 같은 형식을 다시 내보내면 N이 1 올라가고 이전 파일은 남아요.
- 보고서 폴더를 커밋하거나 `.gitignore`를 바꾸지 않아요. 저장소에 올릴지는 사용자가 정해요.

## 참조 문서

- 보고서를 만들거나 고치기 전에 아래 두 문서를 끝까지 읽어요.
  - `references/allowed-elements.md`: `report.html`에 쓸 수 있는 요소와 출력 대응
  - `references/writing-rules.md`: 사실·해석 구분, 출처, 충돌 처리, 문장, 표와 그림
- 새 보고서를 만들 때 `references/report-types.md`에서 종류별 구성을 확인해요.

## 스크립트

모든 스크립트는 `<skill-directory>/scripts/`에 있고 Node.js 22 이상으로 실행해요. `<report-dir>`는 보고서 작업 폴더예요.

| 스크립트 | 하는 일 |
| --- | --- |
| `node check_deps.mjs` | 필요한 도구를 확인하고, `node_modules`가 없으면 `npm ci`로 `docx`를 설치해요. |
| `node lint_report.mjs <report-dir>` | 허용하지 않은 요소, 없는 이미지, 없는 출처 ID, 남은 자리 표시자를 줄 번호와 함께 알려요. |
| `node export_pdf.mjs <report-dir>` | 검사를 통과하면 `exports/`에 PDF를 만들어요. |
| `node export_docx.mjs <report-dir>` | 검사를 통과하면 `exports/`에 DOCX를 만들어요. |
| `osascript -l JavaScript export_pages.js <DOCX 경로>` | DOCX를 Pages로 열어 같은 이름의 `.pages`로 저장해요. macOS와 Pages가 필요해요. |
| `node render_preview.mjs <PDF·DOCX·Pages 경로>` | 결과를 쪽별 PNG로 만들고 경로를 출력해요. |

`lint_report`, `export_pdf`, `export_docx`, `render_preview`, `check_deps`는 `--json`으로 결과를 JSON으로 받을 수 있어요.

## 실행 순서

### 0. 도구를 확인해요

처음 사용하거나 내보내기 전에 `node <skill-directory>/scripts/check_deps.mjs`를 실행해요.
- 필수 도구가 빠지면 출력된 설치 방법을 사용자에게 알리고 내보내기를 멈춰요.
- 선택 도구(Pages, LibreOffice)가 없으면 해당 기능만 빼고 진행해요.

### 1. 이어서 작업할 보고서를 정해요

`docs/reports/`를 확인하고 아래 순서로 정해요.

1. 사용자가 보고서 이름이나 번호를 말했으면 그 보고서예요.
2. 지금 대화에서 다루던 보고서가 있으면 그 보고서예요.
3. 보고서가 하나뿐이고 사용자가 새 보고서를 요청하지 않았으면 그 보고서예요.
4. 그 밖의 경우에는 후보 목록을 보여 주고 물어요.

새 보고서를 요청받았으면 아래 순서로 만들어요.

1. 다음 네 가지 중 사용자가 말하지 않은 것만 물어요.
   - 목적
   - 독자
   - 출력 형식(PDF·DOCX·Pages)
   - 보고서 종류
   질문 도구가 있는 환경(Claude Code)에서는 한 번에 묻고, Codex처럼 없는 환경에서는 대화로 한두 개씩 물어요. 답을 기다리지 않아도 합리적인 초안을 만들 수 있으면 기본값(업무 보고, PDF)을 가정으로 `spec.md`에 적고 진행해요.
2. 번호와 `<report-slug>`를 정하고 작업 폴더를 만들어요.
3. `assets/templates/`에서 종류에 맞는 틀을 `report.html`로 복사하고, `<title>`과 표지를 채워요.
4. `spec.md`와 `sources.md`를 아래 형식으로 만들어요.

`spec.md` 형식:

```markdown
---
title: "RTK 데모 앱 10월 진행 보고"
type: "업무 보고"
audience: "개발팀장"
purpose: "10월 셋째 주 진행 상황 보고"
formats: ["pdf", "docx"]
tone: "-요체"
created: "2026-10-15"
---

## 결정 기록

- 2026-10-15: 진척률은 S2 회의록 값을 쓰기로 했어요.

## 미결 사항

- 다음 주 일정 확정 여부
```

`sources.md` 형식:

```markdown
# 자료 목록

| ID | 자료 | 받은 날짜 | 요약 | 반영한 섹션 |
| --- | --- | --- | --- | --- |
| S1 | sources/회의록.pdf | 2026-10-15 | 10월 셋째 주 회의 결정 사항 | 2. 진행 현황 |
| S2 | 대화 | 2026-10-15 | 재연결 시간 측정값 | 1. 이번 기간 한 일 |
```

### 2. 자료를 반영해요

1. `spec.md`, `sources.md`, `report.html`을 먼저 읽어요.
2. 받은 파일은 `sources/`에 복사하고, `sources.md`에 새 ID로 기록해요. 대화로 받은 내용은 자료 칸에 `대화`라고 적어요. 파일 종류별로 이렇게 읽어요.
   - PDF: `pdftotext -layout`. 글꼴에 따라 `%`, 괄호, 하이픈 같은 기호가 빠질 수 있어요. 수치나 기호가 이상하면 `pdftoppm`으로 해당 쪽을 이미지로 바꿔 확인해요.
   - DOCX: macOS는 `textutil -convert txt -stdout`, 그 밖의 환경은 LibreOffice
   - 이미지: 직접 봐요
   - CSV: 표로 읽어요
3. 새 내용은 끝에 붙이지 않고 알맞은 장에 넣어요. 반영한 장이나 문단에 `data-sources`로 ID를 연결해요.
4. 수치나 사실이 기존 내용과 다르면 바꾸기 전에 두 값과 출처를 보여 주고 물어요. 사용자가 정한 내용은 `spec.md`의 결정 기록에 남겨요.
5. 자료에 없는 수치, 일정, 이름은 만들지 않아요. 필요한 정보가 없으면 `{{확인 필요: …}}`로 남겨요.
6. `node lint_report.mjs <report-dir>`로 구조 오류를 고쳐요. 남은 자리 표시자는 아직 채우지 않은 자리로 보고 3단계에서 알려요.

### 3. 진행 상황을 알려요

호출이 끝나면 아래 세 가지를 짧게 알려요. 사용자가 상태만 물었을 때도 같은 형식으로 답해요.

- 이번에 반영한 장과 자료 ID
- 아직 비어 있는 자리. `lint_report`의 자리 표시자 목록을 써요.
- 확인이 필요한 내용(충돌, 미결 사항)

### 4. 내보내요

1. `node lint_report.mjs <report-dir>`가 통과해야 내보낼 수 있어요. 자리 표시자가 남아 있으면 채울 내용을 묻거나, 사용자가 그 장을 빼기로 하면 지워요.
2. 형식별로 실행해요.
   - PDF: `node export_pdf.mjs <report-dir>`
   - DOCX: `node export_docx.mjs <report-dir>`
   - Pages: DOCX를 먼저 만든 뒤 `osascript -l JavaScript export_pages.js <만든 DOCX 경로>`
3. 내보낸 파일마다 `node render_preview.mjs <파일>`로 쪽 이미지를 만들고, 이미지를 직접 열어 확인해요.
   - 글자 넘침, 표 깨짐, 빈 쪽, 빠진 글자가 없는지 봐요.
   - 이미지 크기와 쪽 나눔이 적절한지 봐요.
   - 문제가 있으면 `report.html`을 고치고 다시 내보내요.
4. 출력에 `확인 필요`가 있으면 사용자에게 함께 알려요. 예를 들어 Type 3 글꼴이 들어갔거나, LibreOffice로 렌더했거나, `docx/html`이 바꾼 요소가 있는 경우예요.

### Pages 출력이 실패할 때

`export_pages.js`의 종료 코드에 따라 처리해요. Pages 출력만 건너뛰고 PDF·DOCX 결과는 그대로 둬요.

- `3`(앱 제어 권한 거부): 사용자에게 시스템 설정 > 개인정보 보호 및 보안 > 자동화에서 Pages 제어를 허용해 달라고 안내해요.
- 샌드박스(Codex 등)에서 `osascript`가 막히면, 그 명령만 권한을 높여 실행하도록 사용자에게 승인을 요청해요.
- `4`(Pages 없음): Pages 출력을 쓸 수 없다고 알려요.

## 완료 기준

- `spec.md`, `sources.md`, `report.html`이 작업 폴더에 있고 받은 자료가 모두 `sources.md`에 기록돼 있어요.
- `lint_report`가 오류 없이 통과해요.
- 요청한 형식의 파일이 `exports/`에 있고, 쪽 이미지를 직접 확인했어요.
- 자료에 없는 사실을 지어내지 않았고, 충돌한 값은 사용자 결정을 따랐어요.

## 사용자 응답

자료를 반영한 뒤에는 3단계의 세 가지를 알려요. 내보낸 뒤에는 파일 경로, 쪽 수, 확인 결과를 알리고 마지막 문장에 아래 의미를 담아요.

```text
보고서를 내보냈어요. 파일을 열어 보고 고칠 부분이나 추가할 자료가 있으면 알려 주세요.
```
